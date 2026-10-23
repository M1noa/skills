# The Capability Ladder

Everything else in this skill assumes this file. Capability detection is where terminal software succeeds or fails, and it is the thing most implementations get wrong in one of two directions: one magic environment variable, or nothing at all.

## The two rules

1. **User intent beats detection.** If the user said `--color=never` or set `NO_COLOR`, detection is over. Never "detect" your way past an explicit preference.
2. **Multiple weak signals beat one strong one.** No single variable tells you what a terminal can do. `TERM` lies inside tmux, `COLORTERM` does not survive SSH, and `WT_SESSION` says nothing about color depth.

## Precedence

Resolve top to bottom. First match wins.

| # | Source | Examples |
|---|---|---|
| 1 | Explicit CLI flag | `--color=always\|auto\|never`, `--plain`, `--ascii`, `--no-tui`, `--tui`, `--no-mouse`, `--no-animation`, `--reduced-motion` |
| 2 | Tool-specific env | `MYAPP_NO_COLOR`, `MYAPP_FORCE_COLOR`, `MYAPP_ASCII`, `MYAPP_THEME` |
| 3 | Standard env | `NO_COLOR`, `CLICOLOR`, `CLICOLOR_FORCE`, `FORCE_COLOR`, `TERM=dumb`, `DO_NOT_TRACK` |
| 4 | Stream/terminal detection | isTTY per stream, `TERM`, `COLORTERM`, `TERM_PROGRAM`, `WT_SESSION`, `TMUX`/`STY`/`ZELLIJ`, `SSH_TTY`, terminfo, bounded queries |
| 5 | Conservative default | 16-color, Unicode-safe, no mouse, no images, no clipboard |

### `NO_COLOR` semantics — get this right

- Presence with a **non-empty** value suppresses automatic color. Empty (`NO_COLOR=`) does not.
- It suppresses **color only**. Not bold, not underline, not reverse video, not layout, not borders, not cursor movement. A tool that turns into unstyled walls of text is over-applying it.
- An explicit `--color=always` may override it, if you document that precedence. Most tools that do this document it; most that don't simply let `NO_COLOR` win. Pick one and write it in `--help`.
- When `NO_COLOR` and a force signal are both set at the same precedence level, disable wins. Note that runtimes split: Python 3.13 lets `NO_COLOR` win, Node/chalk lets `FORCE_COLOR` win. You are not required to match either; you are required to be consistent.

`FORCE_COLOR` in the chalk/supports-color convention treats `0` as force-*off*; force-color.org treats any non-empty value, including `0`, as on. If you honor `FORCE_COLOR`, say which convention you follow.

`TERM=dumb` means no cursor addressing, no color, no mode switching. Output must be plain lines. It does **not** mean "strip all formatting" — but nothing interactive may run.

## Signal inventory

What each signal actually proves, and what it does not.

| Signal | Proves | Does **not** prove |
|---|---|---|
| `isatty(stdout)` | Output is a terminal, so escape sequences won't land in a file | Anything about color depth, Unicode, or size |
| `isatty(stdin)` | Keys can be read interactively | That stdout is also a terminal (check both) |
| `TERM` | A terminfo entry name | Real capabilities — `xterm-256color` is the default lie |
| `COLORTERM=truecolor`/`24bit` | 24-bit color, per the termstandard convention | Anything else; it's the first variable lost over SSH |
| `TERM_PROGRAM` | The emulator, usually | That you're talking to it (a multiplexer may sit between) |
| `WT_SESSION` | Windows Terminal | Color depth or font |
| `TMUX` / `STY` / `ZELLIJ` | A multiplexer is mediating | What survives it |
| `SSH_TTY` / `SSH_CONNECTION` | A remote session: queries cost round trips | Local emulator capabilities |
| `LANG`/`LC_*` naming UTF-8 | Locale encoding | Glyph coverage or ambiguous-width setting |
| `CI` | Automation; no human at the keyboard | That stdout is a pipe (it often is) |
| `TERM_PROGRAM_VERSION` | Emulator version, when set | Feature support, which varies by patch |
| `COLUMNS`/`LINES` | A size hint, often stale | The real size (`ioctl`/`GetConsoleScreenBufferInfo` does) |

**Never trust `COLUMNS`/`LINES` over a real terminal-size read.** They are unexported by default in most shells and go stale across resize.

## The ladder

Design every visual feature as a rung. Write down which rung you're on and what the rung below loses. If a rung below loses *function* rather than *polish*, the design is wrong.

| Rung | Environment | Color | Glyphs | Input | Extras |
|---|---|---|---|---|---|
| 0 | `TERM=dumb`, not a TTY, CI log | none | ASCII | none | line output only |
| 1 | 8/16-color console, legacy SSH, screen | 16 ANSI | ASCII | cooked | no alt screen assumed |
| 2 | 256-color terminal, tmux default | 256 | Unicode BMP | raw + paste | alt screen, mouse |
| 3 | modern emulator | truecolor | Unicode + emoji | raw + paste + focus | hyperlinks, sync output, title |
| 4 | protocol-forward emulator | truecolor | graphemes correct | + Kitty keyboard | images, clipboard, progress, theme reports |

Rung boundaries to respect: `NO_COLOR` moves you to rung 0/1 for color while leaving everything else alone. `--ascii` moves glyphs to ASCII while leaving color alone. These are **independent axes**, not one linear setting. Model them as a struct, not an enum.

```go
type caps struct {
    Color    colorLevel // none | ansi16 | ansi256 | truecolor
    Unicode  unicodeLevel // ascii | basic | graphemes
    Input    inputLevel // cooked | raw | enhanced
    Mouse    bool
    Paste    bool
    Focus    bool
    Sync     bool
    Hyperlink bool
    Clipboard bool
    Images   imageLevel // none | sixel | kitty | iterm2
    Notify   bool
    Progress bool
}
```

## Detection per axis

### Color

Order of resolution inside `colorLevel`:

1. Flag (`--color=always|never`) → decided.
2. `NO_COLOR` non-empty → `none`. `FORCE_COLOR`/`CLICOLOR_FORCE` → force at least 16.
3. Not a TTY → `none` (unless forced).
4. `TERM=dumb` → `none`.
5. `COLORTERM` contains `truecolor` or `24bit` → `truecolor`.
6. Library detection (colorprofile/termenv/chalk/supports-color/rich) → its answer.
7. terminfo `colors` → 256 if `>=256`, else 16.
8. `TERM` contains `256color` → `ansi256`.
9. Default → `ansi16`.

Two traps. First, `TERM=xterm-256color` is what every terminal calls itself, including ones that will render truecolor fine; it proves 256 and no more. Second, inside tmux the `TERM` describes tmux, and tmux 3.6+ sets `COLORTERM=truecolor` in panes while downsampling for the outer terminal — so truecolor inside tmux is often a lie in the *safe* direction (it looks right) and occasionally a lie in the unsafe one (the outer terminal is 256).

Best available upgrade: ask the terminal. XTGETTCAP `RGB` (Bubble Tea sends this) or DA1's `4` parameter confirm 24-bit. Treat a positive answer as an upgrade and a timeout as no answer, not as a negative.

### Unicode

Independent of color. Decide separately:

- `--ascii` or `MYAPP_ASCII=1` → ASCII.
- Locale names UTF-8 (`LC_ALL` → `LC_CTYPE` → `LANG`, first non-empty) → at least `basic`.
- Not UTF-8 locale → ASCII, regardless of what the terminal could render. A non-UTF-8 locale breaks rendering even on a capable emulator.
- Windows: use the wide console API (Go, Rust, and Python do this for you); do not require `chcp 65001`.
- Mode 2027 support → `graphemes` (correct emoji/ZWJ/combining width by agreement rather than guess).

There is **no way to detect font coverage.** No terminal exposes "a Nerd Font is installed." See `design.md` → *Icons*.

### Input

- `isatty(stdin)` and `isatty(stdout)` → `raw` capable.
- Terminal responds to `CSI ? u` → `enhanced` (Kitty keyboard protocol).
- Terminal responds to a `modifyOtherKeys` probe → partial enhancement.
- Otherwise → legacy encoding, which means Esc/Alt ambiguity and no Ctrl+I vs Tab distinction.

Never require enhanced input. Every action needs a binding that works in the legacy encoding, because that is what reaches you inside tmux (its `extended-keys` is off by default).

### Feature probes (optional, bounded)

| Feature | Query | Positive reply | Enabled by |
|---|---|---|---|
| Kitty keyboard | `CSI ? u` | `CSI ? flags u` | `CSI > flags u`, pop with `CSI < u` |
| Synchronized output | `CSI ? 2026 $ p` (DECRQM) | `CSI ? 2026 ; 1 $ y` | `CSI ? 2026 h` / `CSI ? 2026 l` |
| Grapheme width | same DECRQM on 2027 | `CSI ? 2027 ; 1 $ y` | `CSI ? 2027 h` |
| Dark/light changes | DECRQM 2031 | `CSI ? 2031 ; 1 $ y` | `CSI ? 2031 h` |
| Background color | `OSC 11 ; ? ST` | `OSC 11 ; rgb:rrrr/gggg/bbbb ST` | n/a |
| Truecolor | `XTGETTCAP` `RGB`, or DA1 `4` | capability report | n/a |
| Cursor position | `CSI 6 n` | `CSI row;col R` | n/a |

### Query discipline

Terminal queries share the input stream with keystrokes. Five rules:

1. **Render a working default first.** Never blank the screen waiting for a reply.
2. **Send after you own input**, so you can read the reply without stealing keys.
3. **Bound the wait.** 100 ms local, up to 500 ms remote. Never unbounded, never on every frame.
4. **Accept malformed, missing, and late replies.** A reply that arrives after the timeout looks exactly like typing — correlate and drop it.
5. **Cache for the session.** One probe per capability per run.

A reliable sentinel for "the terminal won't answer": after `OSC 11`, send DA1 (`CSI c`) or `CSI 5 n`. If the sentinel arrives first, no background reply is coming. Terminals that never answer OSC 11: Linux console, PuTTY, mosh, GNU screen, ConEmu. Budgets in the wild: Neovim 100 ms, lazygit 500 ms, Lipgloss 2 s.

## Degradation matrix

Feature → what it buys → what you do without it. Every row is a thing you should implement, plus the rung that loses it.

| Feature | Buys | Fallback | Rung |
|---|---|---|---|
| Truecolor | exact brand color | 256 → nearest index; 16 → semantic role | 0–2 |
| 256 color | graded palettes | 16 → named ANSI roles only | 0–1 |
| Alternate screen | clean full-screen, scrollback preserved | inline rendering with a bounded viewport | 0–1 |
| Synchronized output | no tearing on redraw | write one full frame per `write()`, hide cursor while drawing | 0–3 |
| Grapheme width (2027) | emoji/ZWJ/combining align | measure with a wcwidth table, expect disagreement | 0–3 |
| Bracketed paste | paste distinguishable from typing | treat input as keystrokes; do not auto-execute anything | 0–1 |
| SGR mouse | click/scroll/drag | keyboard-only (must always work) | 0 |
| Focus events | pause work in background | poll, or keep running | 0–2 |
| Kitty keyboard | Shift+Enter, Ctrl+Tab, Esc vs Alt | legacy bindings for every action | 0–3 |
| OSC 8 hyperlinks | clickable links | print the URL, or a "reveal" action | 0–2 |
| OSC 52 clipboard | copy from a remote session | `pbcopy`/`xclip`/`wl-copy`/`arboard`; or print the text | 0–1 |
| Images (sixel/kitty/iTerm2) | real graphics | text summary, Unicode block art, or nothing | 0–3 |
| OSC 9 / 777 notifications | alert when unfocused | in-UI status line | 0–3 |
| OSC 9;4 progress | tab/taskbar progress | in-UI progress bar only | 0–3 |
| OSC 0/2 title | window context | don't set it | 0–2 |
| Dark/light change (2031) | theme follows the user | read once at startup, offer `--theme` | 0–3 |
| Cursor shape (DECSCUSR) | mode feedback | mode label in the status line | 0–3 |
| DECSTBM scroll region | efficient viewport scrolling | redraw the viewport | 0–1 |

## Environment matrix

What breaks, how to detect it, what to do.

| Environment | What breaks | Detect | Posture |
|---|---|---|---|
| **tmux** | Prefix `Ctrl+B` never reaches you; a lone Esc waits `escape-time` (500 ms before 3.5, 10 ms since); since 3.8 a plain drag belongs to tmux unless you enable mouse reporting; `extended-keys` off; `allow-passthrough` off | `$TMUX`, `TERM_PROGRAM=tmux` | Never make `Ctrl+B` the only path; keep a legacy keymap; document the `tmux.conf` lines you need |
| **GNU screen** | Prefix `Ctrl+A` never reaches you; truecolor dropped unless `truecolor on` (5.0+); non-title OSC discarded; alt screen off by default | `$STY`, `TERM=screen*` | 256-color; no OSC-dependent feature without fallback; clear on exit |
| **Zellij** | Default mode captures `Ctrl+G/P/T/N/H/S/O/Q/B` and many Alt keys | `$ZELLIJ` | Non-Ctrl, non-Alt path to every action; point at Unlock-First |
| **SSH / mosh** | Queries cost round trips; `COLORTERM` usually absent; remote may lack your terminfo; OSC 52 is the only clipboard | `$SSH_TTY`, `$SSH_CONNECTION` | Bounded timeouts; truecolor from query or user setting; `TERM=xterm-256color` when terminfo is missing |
| **Windows Terminal + ConPTY** | No SIGTSTP/SIGWINCH/SIGCONT; different buffering; sets no `TERM`/`COLORTERM` | `$WT_SESSION` | Non-suspend path; console resize events; test through ConPTY, not a Unix PTY |
| **Classic conhost** | No VT processing before Win10 Anniversary; older builds lack features | absence of `WT_SESSION` | `ENABLE_VIRTUAL_TERMINAL_PROCESSING`; degrade to 16-color plain |
| **CI / pipes** | No TTY: no prompts, no full-screen UI | `$CI`, non-TTY stdout | `cli-contract.md` |
| **Container shell** | No locale, no terminfo, no TTY unless `-it` | `TERM` empty, locale `C` | Document `-it`; detect non-TTY and refuse interactivity cleanly |
| **macOS Terminal.app** | Conservative: no truecolor until 10.12+, no OSC 8, Option/Alt nuances | `TERM_PROGRAM=Apple_Terminal` | Standard VT + 256 color; treat extensions as optional |
| **Screen reader / high-contrast** | Grid repaint is unusable | not detectable — offer opt-in | `accessibility.md` plain-mode contract |

## Per-language detection

**Go** — prefer libraries over hand-rolling:

```go
import (
    "golang.org/x/term"
    "github.com/charmbracelet/colorprofile"
    "github.com/charmbracelet/x/ansi"
)

isTTY := term.IsTerminal(int(os.Stdout.Fd()))
w, h, _ := term.GetSize(int(os.Stdout.Fd()))   // -1,-1 if not a terminal

p := colorprofile.Detect(os.Stdout, os.Environ()) // ASCII|ANSI|ANSI256|TrueColor
_ = ansi.GraphemeWidth                            // grapheme-aware width method
```

Bubble Tea v2 users get this for free: it detects the profile, queries capabilities, and emits `tea.ColorProfileMsg` / `tea.BackgroundColorMsg`. Do not query the background yourself while a program is running — `lipgloss.HasDarkBackground` competes with the runtime for stdin. Return `tea.RequestBackgroundColor` from `Init` instead.

**Python** — `sys.stdout.isatty()`, `os.environ`, `shutil.get_terminal_size()` (it honors `COLUMNS` then falls back to `ioctl`), `curses.setupterm()` + `curses.tigetnum("colors")`. Rich does the depth detection for you; Textual exposes theme state.

**JS/TS** — `process.stdout.isTTY`, `process.stdout.columns`/`rows` (may be `undefined` in a worker), `tty.WriteStream.getWindowSize()`, `string-width`, and chalk's `supports-color` (which reads `FORCE_COLOR`, `NO_COLOR`, `TERM`, `CI`, and `TERM_PROGRAM`). Node has no terminfo.

**Rust** — `std::io::IsTerminal`, `crossterm::terminal::size()`, `terminal_size` crate, `unicode-width`, and Ratatui's `Terminal::size()`. `crossterm` consults `TERM` only when `COLORTERM` is unset.

## What not to probe

- **Font availability.** No query exists. Opt in explicitly.
- **Whether the user is a screen reader user.** No query exists and guessing is an accessibility failure mode.
- **The outer terminal through a multiplexer.** Not reliably possible; degrade conservatively and let the user override.
- **Anything on every frame.** Probe once, cache for the session.
- **Anything unbounded.** A terminal that never answers must not hang your program.

## Recording the decision

When you build the ladder, write the resolved struct once at startup and pass it down. Two consequences: the renderer never re-detects mid-run (no flicker when a query lands late), and every degradation path has a single place to be tested.

```go
func main() {
    c := detect(os.Args[1:], os.Environ(), os.Stdout)
    logIfDebug(c)          // --debug prints the resolved struct
    if !c.Interactive { return runPlain(c) }
    return runTUI(c)
}
```

`--debug` printing the resolved capability struct is worth the ten lines: it turns every "works on my machine" bug report into a diff.
