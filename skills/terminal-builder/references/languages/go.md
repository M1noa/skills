# Go

Go is the reference language for this skill. Its terminal ecosystem is the most complete: a real MVU runtime (Bubble Tea), a real style engine (Lipgloss), a component library (Bubbles), a form engine (Huh), retained-mode widgets (tview/tcell), and SSH transport (wish). Everything in the neutral references maps onto a concrete API here.

Verify versions against `go.mod` before writing imports. Bubble Tea and Lipgloss both shipped v2 modules whose import paths moved to `charm.land/...`; v1 paths (`github.com/charmbracelet/...`) still exist and still appear in most tutorials online. Mixing a v1 Lipgloss with a v2 Bubble Tea compiles until it doesn't, and the failure is a type mismatch on `color.Color` that reads like nonsense.

## Which architecture

Three different runtimes, not three implementations of one. Pick by whether you need retained widgets and by whether the app is served over a network.

| Need | Choice | Mental model |
|---|---|---|
| Default TUI, dashboards, wizards, pickers | Bubble Tea v2 | MVU: state → update → render, immutable model |
| Dense data grids, forms with many focusable widgets, desktop-app feel | tview (on tcell) | Retained: you mutate widgets, they redraw |
| Prompts only, no persistent UI | Huh (or Bubbles standalone) | Blocking form, then exit |
| Served over SSH | wish + Bubble Tea | One program instance per session |
| Scriptable CLI with optional TUI | Cobra, then Bubble Tea behind a check | See `cli-contract.md` → *Product shape* |

Do not build a retained-widget app on Bubble Tea by keeping a pile of component models in one struct and delegating every key to whichever one has focus. That is tview's architecture wearing Bubble Tea's clothes. The reverse is equally bad: driving tview from a pure state function fights `QueueUpdateDraw` on every frame.

## Bubble Tea v2

### The model

```go
type Model interface {
    Init() tea.Cmd
    Update(tea.Msg) (Model, tea.Cmd)
    View() tea.View
}
```

`View` returns a **struct**, not a string. That is the v2 breaking change worth internalizing: the view carries the terminal-side effects that v1 took as program options.

```go
func (m Model) View() tea.View {
    v := tea.NewView(m.frame())
    v.AltScreen = true
    v.MouseMode = tea.MouseModeCellMotion
    v.WindowTitle = "deploy: staging"
    v.ReportFocus = true
    v.KeyboardEnhancements.ReportEventTypes = true
    if m.busy {
        v.ProgressBar = tea.NewProgressBar(tea.ProgressBarIndeterminate, m.pct)
    }
    return v
}
```

Consequences, all of which simplify lifecycle work (`lifecycle.md`):

- **The runtime owns the modes.** Alt screen, mouse, focus reporting, keyboard protocol, bracketed paste, cursor visibility and title are enabled and disabled by Bubble Tea, keyed off the view you return. Your cleanup obligation shrinks to anything you enabled yourself: files, subprocesses, network connections, a raw-mode child, a logger.
- **State drives modes.** Want to leave the alt screen for one screen of output? Return a view with `AltScreen = false` and Bubble Tea exits it. No imperative toggle, no risk of an unclosed mode.
- **Cursor is a view field.** Set `v.Cursor` for the real terminal cursor to be placed and shown; leave it nil and Bubble Tea hides it. Do not hand-place a block character to fake a cursor, because `text.md`'s width rules then apply to a glyph the terminal was going to draw for free.

### Program construction

```go
p := tea.NewProgram(m,
    tea.WithInput(os.Stdin),
    tea.WithOutput(os.Stdout),
    tea.WithContext(ctx),
)
final, err := p.Run()
```

- `WithContext` is how you make cancellation reach `Update`. Without it, a ctx cancel in a command does nothing to the loop.
- `WithInput` matters more than it looks: pass `os.Stdin` explicitly when stdin might be a pipe. If stdin is not a TTY, Bubble Tea's input parsing degrades (see `capability-ladder.md`), and a TUI pointed at `/dev/null` will sit forever waiting.
- `p.Send(msg)` is the only safe way to push a message from outside. It is goroutine-safe; direct model mutation is not.
- `p.Quit()` and `tea.Quit` both work; prefer the command inside `Update` so the quit participates in ordering.
- Returns `(tea.Model, error)`. Type-assert the final model if you need post-run state, and never render after `Run` returns (see `rendering.md`).

### Messages you will actually handle

| Message | Notes |
|---|---|
| `tea.KeyPressMsg` | v2 split press from release. `msg.String()` gives `"ctrl+c"`, `"esc"`, `"enter"`, `"alt+left"` |
| `tea.KeyReleaseMsg` | Only if you asked for event types. Ignore it unless you need hold detection |
| `tea.PasteMsg` | Bracketed paste. `msg.Content` is data, never keystrokes. Sanitize it (`security.md`) |
| `tea.MouseMsg` | v2 subtypes for click/motion/wheel, with `Button`, `Mod`, `X`, `Y` |
| `tea.WindowSizeMsg` | `Width`, `Height` **in cells**. Your only source of truth for size |
| `tea.FocusMsg` / `tea.BlurMsg` | Requires `ReportFocus`. Use to pause animation, not to change layout |
| `tea.SuspendMsg`-adjacent resume signal | Arrives after Ctrl+Z and `fg`; full repaint on receipt, no diffing across it |

Custom messages: define a distinct type per event. Do not reuse `any` or pass raw strings, or `Update` becomes a dispatcher over string comparisons.

```go
type deployDone struct {
    env string
    err error
}
```

### Commands, and not blocking

`tea.Cmd` is `func() tea.Msg`. The runtime runs each in its own goroutine. Everything slow goes in one.

```go
func loadDeployments(ctx context.Context, api *client) tea.Cmd {
    return func() tea.Msg {
        ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
        defer cancel()
        d, err := api.List(ctx)
        return deploymentsLoaded{d: d, err: err}
    }
}
```

Rules that keep the loop honest (`rendering.md` → *Pacing and backpressure*):

- **Never call a blocking function in `Update` or `View`.** Not even "fast" ones: a stat on a network filesystem is 3 seconds when it's bad.
- **Every command needs a deadline.** A command with no timeout is a spinner that runs until the user quits.
- **Batch independent work**, don't chain it. `tea.Batch(a, b, c)` runs all three concurrently; `tea.Sequence` runs them in order, which is what you want for dependent steps only.
- **Cancel by message, not by variable.** If a command is superseded, set a generation number in the model and drop stale results on arrival. Cancelling a context from `Update` races the goroutine's own send.
- **`tea.Tick` for animation only**, not for polling state that hasn't changed. An idle screen should emit zero frames (`design.md` → *Motion*).
- **`tea.Every` for periodic refresh**, with a bound. Every 2s is a reasonable monitor cadence; every 100ms over SSH is a bandwidth bug.

Stale-result guard:

```go
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case refreshDone:
        if msg.gen != m.gen {
            return m, nil // a newer request superseded this one
        }
        m.rows, m.err, m.loading = msg.rows, msg.err, false
        return m, nil
    }
}
```

### Suspend and child processes

Ctrl+Z must actually suspend (`lifecycle.md` → *Suspend and resume*). v2 gives you the pieces:

```go
case tea.KeyPressMsg:
    if msg.String() == "ctrl+z" {
        return m, tea.Suspend
    }
```

`tea.Suspend` restores the terminal, sends SIGTSTP, and on resume reinstalls modes and repaints. You must not assume the alt screen survived: treat resume as a fresh start and rebuild the frame.

For handing the terminal to an editor, pager, or shell:

```go
c := exec.Command(os.Getenv("EDITOR"), path)
return m, tea.ExecProcess(c, func(err error) tea.Msg {
    return editorClosed{err: err}
})
```

`ExecProcess` releases the terminal, runs the child attached to it, then reclaims it and repaints. This is the only correct way to run an interactive child from inside a TUI. Spawning it directly under a held raw mode produces a child that sees no echo, no signals, and a garbled screen.

### Rendering

`View` must be pure: same model + same size → same bytes (`rendering.md` → *Render purity*).

```go
func (m Model) frame() string {
    w, h := m.w, m.h
    if w < minW || h < minH {
        return tooSmall(w, h)
    }
    header := m.theme.style(rolDim).Render(" deployments ")
    body := m.table.View()                       // already sized
    status := m.statusLine()                     // always one row
    footer := m.help.View(m.keys)                // always one row

    bodyH := h - lipgloss.Height(header) - 2     // status + footer
    return lipgloss.JoinVertical(lipgloss.Left,
        header,
        lipgloss.NewStyle().Height(bodyH).Render(body),
        status,
        footer,
    )
}
```

Cost control, because `View` runs on every keystroke:

- **Cache styles, not strings.** A `lipgloss.Style` is a value; store it on the model or a package-level var. Rebuilding styles per row is the single most common Go TUI slowdown.
- **Build with `strings.Builder`** and preallocate. `fmt.Sprintf` in a row loop allocates several times per cell.
- **Measure with `ansi.StringWidth`** (`github.com/charmbracelet/x/ansi`), never `len`. See `text.md`.
- **`View` must not read files, hit the network, or call `time.Now()` for anything but display.** A clock is fine; a filesystem is a bug.
- **Truncate before styling, not after.** Styling inserts escape sequences that shift every width calculation downstream.
- **Long content: virtualize.** Render the visible window only (`rendering.md` → *Virtualization*). A 100k-line log rendered in full each frame is a 40 MB/s allocation fire.

### Panel output and logging

`fmt.Println` from anywhere inside a running program corrupts the frame. Two supported routes:

```go
// 1. in-app log panel: append to a ring buffer, render it
m.logs = append(m.logs, line)

// 2. push output above the TUI without tearing
p.Println("build finished") // Bubble Tea-aware; prints above the view
```

Use `tea.Println` (or `p.Println`) for output that should survive in scrollback, and a log file or ring buffer for diagnostics. `lipgloss.Println` and `log.Print` are both wrong here, since they write directly to the tty.

## Lipgloss v2

Style engine, no runtime. Everything here is a pure function of input, which is why golden tests work at all (`testing.md`).

```go
type theme struct {
    dark  bool
    roles map[role]lipgloss.Style
}

func newTheme(r *lipgloss.Renderer) theme {
    return theme{
        dark: r.HasDarkBackground(),
        roles: map[role]lipgloss.Style{
            rolText:     r.NewStyle(),
            rolDim:      r.NewStyle().Faint(true),
            rolError:    r.NewStyle().Foreground(lipgloss.Color("1")).Bold(true),
            rolSelected: r.NewStyle().Background(lipgloss.Color("237")),
            rolBorder:   r.NewStyle().Foreground(lipgloss.Color("240")),
            rolFocus:    r.NewStyle().Border(lipgloss.NormalBorder(), false, false, false, true),
        },
    }
}
```

That is the neutral `design.md` → *Theming* role enum, made concrete: one mapping point, semantic names, no hex literals at call sites.

- **`lipgloss.Renderer`** is what isolates a program from global state. `r.NewStyle()` inherits that renderer's color profile and background detection. A renderer per SSH session is how wish serves correct colors to two different clients.
- **Background detection**: `r.HasDarkBackground()` performs an actual terminal query. Cache the answer; don't call it per frame.
- **Light/dark adaptive color**: v2 replaced the `AdaptiveColor` type with helper functions returning a `color.Color` based on a predicate. Use it for the accent variant only, exactly as `design.md` requires: the *role* stays stable, the *value* adapts.
- **`Width(n)` pads to at least `n` and wraps longer lines; `MaxWidth(n)` clamps without wrapping.** Getting these backwards produces either a 12-line row where you wanted one, or a row that overflows the pane.
- **`lipgloss.JoinHorizontal`/`JoinVertical` align by baseline and content, not by a fixed grid.** Two panes of unequal height join at their tops, not centered. Pad explicitly when you need alignment.
- **`Place(w, h, hPos, vPos, str)`** centers or anchors a block. It measures in cells, so it is safe with CJK.
- **`lipgloss.Width`/`Height` on a styled string** account for escapes. On an unstyled string they are just `ansi.StringWidth`. Both are O(n); don't call them in nested loops over the same unchanged string.

Style composition gotcha: `Style.Render` returns a new string with escapes, and rendering an already-rendered string re-injects escapes. Compose with `.Inherit()` and render once at the leaf.

## Bubbles

Components are small models you embed and delegate to. The three that cause trouble:

| Component | Gotcha |
|---|---|
| `viewport` | Needs `SetWidth`/`SetHeight` on **every** `WindowSizeMsg`, and `SetContent` with pre-wrapped content. It does not wrap for you |
| `list` | `SetSize` on resize, `SetShowTitle`, and its filter mode swallows keys. Check `list.FilterState()` before handling `esc` |
| `textinput` | Cursor position is not a cell offset when the value contains wide glyphs; `Position()` workarounds belong in your code, not in the display |
| `table` | Column widths are absolute cells; a CJK header overflows a width computed from byte length |
| `spinner` | Keep ticking only while visible. Stop the tick when the state settles or you have a permanent timer |
| `help` | The shortcut for a large key map is `help.View` with `ShowAll=false`; the full list goes behind `?` |

Embedding pattern:

```go
type Model struct {
    list   list.Model
    keys   keyMap
    w, h   int
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch msg := msg.(type) {
    case tea.WindowSizeMsg:
        m.w, m.h = msg.Width, msg.Height
        m.list.SetSize(msg.Width, msg.Height-2)
    case tea.KeyPressMsg:
        if m.list.FilterState() != list.Filtering && msg.String() == "q" {
            return m, tea.Quit
        }
    }
    var cmd tea.Cmd
    m.list, cmd = m.list.Update(msg)
    return m, cmd
}
```

The `FilterState` check is the pattern for every embedded component: **the focused child gets first refusal on keys.** Global bindings only fire when the child isn't consuming input, or the user hits `esc` twelve times trying to exit.

## Huh

Forms as a blocking call, built on Bubble Tea.

```go
form := huh.NewForm(
    huh.NewGroup(
        huh.NewSelect[string]().
            Title("Environment").
            Options(huh.NewOptions("staging", "prod")...).
            Value(&env),
        huh.NewInput().
            Title("Confirm").
            Validate(func(s string) error {
                if s != env { return fmt.Errorf("type %q to continue", env) }
                return nil
            }).
            Value(&confirm),
    ),
).WithTheme(huh.ThemeCharm())

if err := form.Run(); err != nil {
    if errors.Is(err, huh.ErrUserAborted) {
        return 0, nil   // Ctrl-C in a form is a cancel, not a crash
    }
    return 1, err
}
```

- **`ErrUserAborted` is not an error.** Treat it as a clean cancellation with exit 0 unless the caller needed the answer.
- **Accessible mode**: `huh.WithAccessible(true)` degrades to a line-by-line prompt with no alt screen, which is the right thing when stdout is not a TTY (`accessibility.md` → *Plain mode contract*).
- **Validation runs per field and blocks advance.** Keep messages short and actionable: say what to type, not "invalid".
- **Huh inside Bubble Tea** is supported as a model, but nesting a form inside a TUI usually means the product shape is wrong. Forms are summon-choose-exit (`cli-contract.md` → *Product shape*).

## tview and tcell

Retained mode: widgets hold their own state, you mutate them, they redraw.

```go
app := tview.NewApplication()
table := tview.NewTable().SetBorders(false).SetSelectable(true, false)
app.SetRoot(table, true).EnableMouse(true)

go func() {                       // required for any mutation off the input goroutine
    rows := fetchRows()
    app.QueueUpdateDraw(func() {
        table.Clear()
        for r, row := range rows {
            for c, v := range row {
                table.SetCell(r, c, tview.NewTableCell(v))
            }
        }
    })
}()

if err := app.Run(); err != nil { return err }
```

- **`QueueUpdateDraw` is mandatory for cross-goroutine mutation.** Touching a widget from another goroutine races the draw loop and produces stale or torn frames.
- **`tcell` underneath is where raw mode lives.** If you drop to tcell directly: `screen.Init()` then `defer screen.Fini()`, and handle `*tcell.EventResize` by calling `screen.Sync()` before redrawing.
- **Width is tcell's job.** `tcell` implements its own width tables; trust them over anything you compute, and check they match `text.md` expectations for emoji before shipping.
- **Mouse in tview is coarse**: enable it, then map click regions yourself. There is no hit-testing.
- **tview styles are global mutables.** `tview.Styles.PrimitiveBackgroundColor` etc. are package-level; setting them once at startup is fine, mutating them at runtime is a data race.

## wish

Serves a Bubble Tea program over SSH. One model instance per session.

```go
s, err := wish.NewServer(
    wish.WithAddress(":2222"),
    wish.WithHostKeyPath(".ssh/id_ed25519"),
    wish.WithMiddleware(
        bubbletea.MakeRenderer(func(s ssh.Session) *tea.Program {
            return tea.NewProgram(newModel(s.User()), tea.WithInput(s), tea.WithOutput(s))
        }),
        logging.Middleware,
        activeterm.Middleware(),   // refuses sessions with no TTY
    ),
)
```

- **Every session needs its own model, renderer and program.** Sharing state between sessions is a bug unless it is deliberate and synchronized.
- **`activeterm.Middleware`** blocks non-interactive sessions (`ssh host cmd`) that would otherwise hang your program on a stdin that never sends input.
- **Terminal size comes from the SSH PTY**, not from the local one. Bubble Tea gets it via `WindowSizeMsg`; don't read `os.Stdout` for size here.
- **Bandwidth is the budget** (`rendering.md` → *Bandwidth over SSH*). Full repaints over a 200ms RTT are visible. Diff, and cap the frame rate.
- **The client's terminal is unknown.** Never assume truecolor, Kitty keyboard, or Nerd Fonts. Run the capability ladder per session, from the session's `TERM` and `COLORTERM`.

## Cobra

The CLI frame around all of the above.

```go
root := &cobra.Command{
    Use:           "deploy",
    SilenceUsage:  true,   // don't dump usage on a runtime error
    SilenceErrors: true,   // we print the error ourselves, once
    RunE: func(cmd *cobra.Command, args []string) error {
        out := cmd.OutOrStdout()
        errw := cmd.ErrOrStderr()
        if !isTTY(out) || plainFlag {
            return runPlain(out, args)
        }
        return runTUI(cmd.Context(), out, errw, args)
    },
}
```

- **`SilenceUsage` + `SilenceErrors`, always.** The default behavior prints the help text after every error, then main prints the error again. One error message, one exit code.
- **`cmd.Context()`** carries SIGINT cancellation if you wire `signal.NotifyContext` in `main`. That context is what makes Ctrl-C during a long command work.
- **`cmd.OutOrStdout()` / `ErrOrStderr()` / `InOrStdin()`** instead of `os.Stdout` everywhere. That is what makes your commands testable with `bytes.Buffer` (`testing.md`).
- **Exit codes from `main`**, not `os.Exit` inside a command: `os.Exit` skips every `defer`, including your terminal guard (`lifecycle.md` → *Teardown order*).
- **Completion**: `cmd.ValidArgsFunction` and `cmd.RegisterFlagCompletionFunc`. If completion needs the network or a slow call, cap it at a few hundred milliseconds; shell completion that stalls makes the shell feel broken.
- **The TUI is a subcommand or a flag branch, never the only path.** `deploy list --json` must work with no TTY (`cli-contract.md`).

## Testing Go terminal code

- **`teatest`** (Bubble Tea's testing package) drives a program in a virtual terminal and gives you the final output plus a way to send keys and assert on `View()` output.
- **Golden frames**: render `m.View().Content` directly with a fixed size and a forced color profile. No program, no PTY, deterministic (`testing.md` → *Golden frames*).
- **Force the profile in tests**: `lipgloss.SetColorProfile(termenv.Ascii)` in `TestMain`. Otherwise the developer's terminal decides what the golden contains and CI disagrees.
- **`t.Setenv` for detection tests**: `NO_COLOR`, `TERM=dumb`, `COLORTERM=truecolor`. Go's `t.Setenv` cleans up automatically and forbids `t.Parallel`, which is correct here because env is process-global.
- **`go test -race` on every `Update`/command path.** The race detector is the only thing that reliably catches a command writing to the model.
- **PTY tests** via `creack/pty` for the real thing: raw mode entered and left, alt screen balanced (`testing.md` → *PTY harness*).
- **Fuzz `Update`**: `func FuzzUpdate(f *testing.F)` feeding arbitrary key strings. An `Update` that panics on `""` or a 10 KB paste is a crash on day one.
- **Test the too-small path explicitly.** `WindowSizeMsg{Width: 40, Height: 10}` must produce the floor message, not an index panic (`design.md` → *Responsive*).

## Common Go bugs

| Symptom | Cause | Fix |
|---|---|---|
| Garbled output, no echo after exit | raw mode or alt screen left on | Stop enabling modes yourself; let `tea.View` own them |
| `len(s)` alignment breaks on CJK | byte length used as width | `ansi.StringWidth` |
| Frame drops while a request runs | blocking call inside `Update` | move it into a `tea.Cmd` |
| Terminal stuck after panic | cleanup only on the happy path | guard registered first, `recover` at top (`lifecycle.md`) |
| Spinner never stops | tick started unconditionally | tick only while `loading`, stop on settle |
| `defer` cleanup never runs | `os.Exit` inside a command | return the error to `main` |
| Second key press ignored | child component consumed it | check focus/`FilterState` before global bindings |
| Colors wrong in one terminal | global `lipgloss` state | per-renderer styles |
| Output interleaves with the TUI | `fmt.Println` under a running program | `tea.Println` or a log panel |
| Race on model fields | goroutine mutating the model | send a message; `-race` in CI |
| Hub of 40 files, 3 MB binary | importing everything | Bubble Tea + Lipgloss alone covers most TUIs |

## Checklist

- [ ] Framework chosen by architecture, not familiarity; no MVU-on-retained hybrid
- [ ] `View()` pure, no I/O, no clock beyond display
- [ ] `tea.View` fields used for alt screen, mouse, focus, title, keyboard enhancements
- [ ] No mode enabled outside the runtime, or the one you own is closed on every path
- [ ] Every command has a timeout; stale results dropped by generation
- [ ] No blocking call in `Update` or `View`
- [ ] Ctrl-Z wired to `tea.Suspend`; resume triggers a full repaint
- [ ] Interactive children launched with `tea.ExecProcess`
- [ ] Styles cached, not rebuilt per row; `strings.Builder` for frame assembly
- [ ] Width everywhere via `ansi.StringWidth`; truncate before styling
- [ ] Theme resolved once through semantic roles; `HasDarkBackground` cached
- [ ] Child components get first refusal on keys; `FilterState` checked
- [ ] Logging goes to a file or panel; `tea.Println` for scrollback output
- [ ] Cobra: `SilenceUsage`/`SilenceErrors`, `OutOrStdout`, context wired, exit codes from `main`
- [ ] A non-TTY path exists and is tested
- [ ] Golden frames with a forced ASCII profile; `go test -race` green; PTY test in CI
