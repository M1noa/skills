# Accessibility

The terminal is the most accessibility-hostile surface in common use: no DOM, no accessibility tree, no ARIA, no font scaling, no zoom, and a rendering model that addresses cells by coordinate. Most terminal software is unusable with a screen reader and painful with low vision. You will not fix that entirely. You can avoid making it worse, and you can ship one honest escape hatch.

Two principles carry the whole file:

1. **Color, motion, and pointer are all optional decorations on information that is available without them.**
2. **Every interactive surface has a non-interactive equivalent that a screen reader can read.**

## Color is never the only channel

Roughly 8% of men and 0.5% of women have some color vision deficiency. Add monochrome terminals, `NO_COLOR`, screen readers, and the very common case of a user who simply wasn't looking at the right cell. Color as the sole carrier of meaning is a bug in every one of those cases.

Encode every distinction **twice**:

| Distinction | Color channel | Second channel |
|---|---|---|
| Error | red | `ERROR` / `✗` / `!` prefix, position (last line), `error:` |
| Success | green | `ok` / `✓`, `exit 0` |
| Warning | yellow | `WARN` / `!`, `warning:` |
| Added | green | `+` prefix, left gutter marker |
| Removed | red | `-` prefix, left gutter marker |
| Changed | yellow | `~` prefix, `*` |
| Selected | inverse/bg | `>` or `▸` marker, bold, gutter |
| Focused | border color | border **style** (`─` vs `━`), bold title, cursor placement |
| Disabled | dim | `(disabled)` text, brackets |
| Severity | hue | word (`critical`/`high`/`low`) or bar length |

The gutter marker is the strongest of these because it survives plain-text export, log capture, screen readers, and colorblindness simultaneously. Prefer it.

Anti-pattern: a log viewer that shades error lines red with no marker. `tool logs | grep -i error` then returns nothing, and the screen reader reads every line identically.

## Contrast

WCAG 2.2, which is the standard to cite even for a terminal:

| Content | Minimum ratio |
|---|---|
| Body text | 4.5:1 |
| Large text (≥18.66 px bold or ≥24 px) | 3:1 |
| UI components and graphical objects (borders, focus indicators, icons, chart bars) | 3:1 |
| Incidental decoration | none |

Compute against the **actual background**, not an assumption. A terminal's background is whatever the user's theme says, and it may be transparent over a wallpaper. This has a hard consequence: **you cannot guarantee contrast for any color you pick**, which is why the second channel is not optional.

### The ANSI-16 palette problem

The 16 base colors are user- and theme-controlled. Your "red" is `SGR 31`; the user's `31` might be salmon, crimson, or grey. They chose it for their eyes. Consequences:

- **Do not assume hue or luminance.** `SGR 31` is not guaranteed red-looking and is not guaranteed readable.
- **Do not compute contrast from a hardcoded palette** and conclude you're fine.
- Even the *default* xterm palette fails AA for several colors on black, which is the most common background:

| SGR | Default color | ≈ Contrast on `#000000` | Verdict |
|---|---|---|---|
| 30 black | `#000000` | 1:1 | invisible; never use for text |
| 31 red | `#cd0000` | ≈ 3.6:1 | fails body text, passes 3:1 |
| 32 green | `#00cd00` | ≈ 9.7:1 | fine |
| 33 yellow | `#cdcd00` | ≈ 12.3:1 | fine |
| 34 blue | `#0000ee` | ≈ 2.2:1 | **fails badly**; the classic mistake |
| 35 magenta | `#cd00cd` | ≈ 4.5:1 | borderline |
| 36 cyan | `#00cdcd` | ≈ 10.6:1 | fine |
| 37 white | `#e5e5e5` | ≈ 16.7:1 | fine |
| 90 bright black | `#7f7f7f` | ≈ 5.2:1 | fine for text, standard for dim |

Approximate, for the default palette only; the user's theme overrides all of it. Two conclusions: **pure ANSI blue is not safe for body text**, and **the 16 colors are fine for accents and borders but not for carrying the primary reading load.** Primary text should be default-foreground (`SGR 39` / no color), which the user has already tuned for their own contrast.

Truecolor (`capability-ladder.md` → rung 3+) lets you pick a color you've computed contrast for. It also lets you pick one that clashes with the user's carefully tuned theme. Use truecolor for deliberate accents, not for body text.

## Color vision deficiency

| Type | Prevalence | Confuses |
|---|---|---|
| Deuteranopia/deuteranomaly | ~6% of men | red/ green, green/ brown, light green/ yellow |
| Protanopia/protanomaly | ~1–2% of men | red/ green, red/ black (dark reds collapse) |
| Tritanopia | ~0.01% | blue/ green, yellow/ pink |
| Achromatopsia | rare | everything; luminance only |

Unsafe pairs, in order of how often they appear in real tools:

- **red / green** — the entire diff and status palette. Use `+`/`-` or `✗`/`✓`.
- **green / yellow** — "ok" vs "warn". Use a word.
- **blue / purple** — syntax highlighting, selection. Use bold or underline.
- **red / black** — errors dimmed to invisible, especially with protanopia.
- **light gray / white** — dim vs normal text. Use weight or a marker.

Safe-ish when luminance differs: blue/orange, purple/yellow, teal/red, black/white.

Underline is a legitimate second channel and it's free: underlining an error and coloring it gives you two channels without adding a glyph. Bold likewise. Use inverse for selection plus a `>` marker.

## Semantic tokens

Never name a color where you mean a role. The theme layer resolves the role.

```go
type role int

const (
    rolText role = iota
    rolDim
    rolAccent
    rolOK
    rolWarn
    rolError
    rolSelected
    rolBorder
    rolFocus
)

// theme maps role -> SGR, resolved from user config, terminal caps, and plain mode
func (t theme) style(r role) lipgloss.Style
```

Why this matters concretely: in plain mode, every role resolves to the same zero style plus a text marker. In high-contrast mode, roles get rebalanced. Switching themes is one table, not a grep across 400 call sites. And the marker lives next to the role, so you can't add a new status without deciding its non-color encoding.

```go
func (t theme) status(s status) string {
    switch s {
    case statusOK:    return t.marker("✓", "ok")
    case statusWarn:  return t.marker("!", "warn")
    case statusError: return t.marker("✗", "error")
    }
}
```

## Plain mode contract

Any of `--plain`, `--no-tui`, `NO_COLOR`, `TERM=dumb`, a pipe, or an unsupported terminal triggers plain mode. Define it precisely, because "it degrades" is not a contract:

| Preserved | Dropped |
|---|---|
| Every piece of information, including status, severity, progress | Color, bold, underline, inverse |
| Reading order and grouping | Box drawing, borders, panes, columns where they'd wrap badly |
| The current state after the operation completes | Animation, spinners, live-updating regions |
| Exit codes, stdout/stderr split, `--json` | Alternate screen, cursor addressing, mouse |
| Key bindings for actions that have a non-interactive equivalent | Mouse-only affordances |

The output must be **line-oriented, append-only, and readable in `less`**. That is the format that survives a screen reader, a log file, an email, an issue tracker, and `| tee`.

```text
$ tool status
state: degraded
  api        ok       42ms
  database   warn     slow: 1.8s p99 (threshold 1.0s)
  cache      error    connection refused
```

No cursor movement, no rewritten lines, no `\r` progress. New information is a new line.

Rules:

- **Plain mode is not a punishment.** It is the accessible path and the scriptable path. Don't hide it in a flag nobody documents; mention it in `--help` and the README.
- **Never require the user to prove they need it.** `--plain` works, always, no detection scepticism.
- **Interactive-only actions must have a non-interactive equivalent**, or plainly say they don't. "This command requires an interactive terminal" is an honest failure; hanging is not.
- **Test plain mode in CI** (`testing.md` → *Verification matrix*). It rots silently otherwise.

## Screen readers

Be blunt about the state of this: the alternate screen is effectively invisible to screen readers, and cursor-addressed redraws produce nonsense when linearized. NVDA, JAWS, and VoiceOver read the terminal buffer as a stream of text; a full-screen frame becomes a jumble in reading order.

What actually helps:

- **A line-oriented mode is the accessible interface.** Document it as such, in those words. `tool report --plain`, `tool ls`, `tool watch --lines`.
- **The terminal window title** (OSC 0/2, `protocols.md`) is read by some screen readers on focus change and is the only "announcement" mechanism you have. Set it to `<app>: <state>` and update it on meaningful state change, not per frame.
- **Never emit text whose meaning depends on position.** `[x]` at column 12 with the label at column 30 reads as two unrelated tokens.
- **Announce changes as new lines**, not by rewriting an existing line. A rewritten line is a silent edit; a new line is an announcement.
- **Describe visual-only content.** If a chart carries information, print the numbers next to it or beneath it. `████████░░ 82%` beats a bar alone.
- **Respect that the reader is a stream.** Group by section with plain headings and blank lines; skip table borders.
- **BRLTTY and refreshable braille** are 20–40 cells wide. Plain mode plus narrow wrapping is the only thing that works.

Do not attempt to "detect" a screen reader. There is no signal. Ship the plain path, document it in the accessibility section of the README, and let the user choose.

## Motion

WCAG 2.3.1: nothing should flash more than three times per second. Flashing is also a genuine seizure risk and looks broken to everyone else.

There is **no terminal equivalent of `prefers-reduced-motion`**. So:

- **Default to calm.** No idle animation, no pulsing, no marquee. A static interface is not a boring interface.
- **Offer `--no-motion` / a config key** and honor it everywhere, including framework-level animations.
- **Animation must be information-bearing**, not decoration: a spinner during a genuine wait, a progress bar during a real transfer. A spinner over a local operation that finishes in 4 ms is theatre.
- **Cap frame rate and rate of color change.** A blinking cursor is fine; a blinking warning is not.
- **Stop on blur.** Focus-loss events (`input.md`) stop the ticker.
- **Never animate on a busy state indefinitely** without a way out. If it can take 30 seconds, show elapsed time so the user knows it's alive.

## Keyboard and pointing

- **Every action reachable without a mouse.** The mouse is an accelerator, never a requirement.
- **No mouse-only affordances.** No hover tooltips that are the only place information appears, no click targets with no key equivalent, no drag that can't be done another way.
- **No timing dependencies.** WCAG 2.2.1: if a task can time out, the user must be able to extend or disable it. An auto-dismissing notification carrying a decision is a barrier.
- **Escape always works.** From any modal, any mode, any nested state: Esc backs out one level, and repeated Esc reaches the top. Repro: press Esc five times from anywhere and end up at the main screen.
- **Ctrl+C always exits**, or a documented panic key does. Never a state where the user is stuck and must kill the process from another shell.
- **Focus is visible and unambiguous.** If the border color is the only indicator, it fails for the colorblind. Use weight, a gutter marker, or a filled title bar.
- **Tab order follows reading order.** Left-to-right, top-to-bottom.
- **Confirm destructive actions**, and confirm by typing the name when the action is irreversible and large in scope. A `[y/N]` prompt is fine for one file, not for 10 000.

## Text size and reflow

The user controls font size in the terminal; you control layout in cells. Consequences:

- **Never assume a fixed cell budget.** A user at 150% in an 80-column window has a much narrower effective layout in human terms, but you see the same 80 cells. You cannot detect font size, so **there is no "text too small" signal** — which is why you must survive narrow widths (`design.md` → *Responsive*).
- **Never truncate silently** the text that carries the decision (`text.md` → *Truncation*). Wrapping beats clipping for prose; clipping beats wrapping for aligned columns; both beat hiding.
- **Avoid dense, small-type interfaces.** Wide tables with 20 narrow columns are unreadable at any font size.
- **Respect the user's configured width.** Reflow at the reported width; never emit lines longer than it and let the terminal soft-wrap mid-word.

## Errors that explain

Accessibility includes not making people guess.

```text
error: --timeout must be a positive integer
  got: "--timeout 0"
  fix: --timeout 30s   (bare numbers are seconds)

error: cannot read config
  file: /home/u/.config/tool/config.toml
  line: 14
  reason: retries must be >= 1, got -3
```

- **Identify the thing, the value, the reason, and the fix.**
- **Suggest the correction** for near-miss flags and common mistakes.
- **Never just say "invalid".**
- **Never rely on color** to mark which field failed; name it.

## Checklist

- [ ] Every color-coded distinction also carries a glyph, a word, or a position marker.
- [ ] Primary text uses default foreground, not an ANSI color.
- [ ] ANSI blue is not used for body text; the palette is never assumed to have particular contrast.
- [ ] Contrast checked for truecolor accents: ≥4.5:1 body, ≥3:1 UI and borders.
- [ ] Roles are semantic tokens; plain mode resolves them to text markers in one place.
- [ ] `--plain` exists, is documented, produces line-oriented append-only output, and preserves all information.
- [ ] `--plain` is exercised in CI.
- [ ] No animation by default; `--no-motion` honored; flicker ≤3 Hz; animation stops on blur.
- [ ] Every action has a key binding; nothing requires a mouse.
- [ ] Esc backs out from anywhere; Ctrl+C always exits; no action depends on a response timer.
- [ ] Focus is indicated by more than color.
- [ ] Destructive actions are confirmed; large irreversible ones require typing the name.
- [ ] Errors name the field, the bad value, the reason, and the fix.
- [ ] README has an accessibility section pointing at the plain, screen-reader-usable path.
