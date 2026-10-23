# Design

A terminal is a monospaced grid with no subpixel rendering, no shadows, no opacity, no custom fonts, and a palette the user chose before your program existed. Design inside that and it looks intentional. Design as though it were a web page and it looks broken.

The constraints are also the advantages: instant startup, perfect texture, total keyboard control, and a visual language (`+ | - #`) that developers already read faster than any UI kit. Use them.

## Layout

Every full-screen layout is a variation on one frame:

```text
┌ header ──────────────────────────────────────────┐  identity, current context, breadcrumb
├ body ────────────────────────────────────────────┤
│                                                  │  the work; the only region that earns 70%+ of cells
│                                                  │
├ status ──────────────────────────────────────────┤  mode, counts, selection, connection state
└ footer ──────────────────────────────────────────┘  key hints; the discoverability surface
```

Budgets for a 30-row body:

| Region | Rows | Notes |
|---|---|---|
| Header | 0–2 | Often should be zero. A title bar repeating the app name is pure chrome |
| Body | all remaining, ≥ 60% | Never less than half the screen |
| Status | 1 | Always visible; state must never be hidden |
| Footer / hints | 1 | Always visible; this is how anyone learns the keys |

- **Header is optional. Status and footer are not.** Users tolerate a missing title; they do not tolerate not knowing what mode they're in or how to get out.
- **Fixed regions do not scroll.** Only the body scrolls.
- **Align to a grid.** Consistent columns, no ragged left edges. Misalignment reads as a bug, not as looseness.
- **Whitespace is the cheapest structural element you have.** One blank line separates groups better than any border.
- **Indent the body by one or two cells** when there is a border. Text flush against a box wall is harder to scan.
- **Right-align numbers**, left-align text. A column of figures that doesn't line up on the decimal is unreadable at a glance.

Layout is computed from the measured size, never assumed. See `capability-ladder.md` → *Degradation matrix* for what to drop when the size is small, and `rendering.md` → *Render purity* for why `render(state, size)` must be a pure function.

## Hierarchy

The eye lands on four things, in this order. Spend them accordingly.

1. **Position.** Top-left is read first. Put what matters there. A status line at the bottom is checked last, so it must not be the only place critical state lives.
2. **Brightness / weight.** Default foreground beats dim. Bold beats regular. This costs nothing and works on a monochrome VT220.
3. **Spacing.** A blank line above a heading separates it from everything before. Grouping by proximity is stronger than grouping by a box.
4. **Glyph weight.** A `▸` before a selected row, an `!` in a gutter. Small marks, high information.

Color is fifth, and optional. See `accessibility.md` → *Color is never the only channel*.

Practical hierarchy for a list-detail screen:

```text
tool status                        ← default foreground, bold: where you are
                                    ← blank line
  api        ok        42ms         ← body: default foreground
  database   warn      slow: 1.8s   ← body, warning marked in the gutter
  cache      error     refused      ← body, error marked in the gutter
                                    ← blank line
[q]uit  [r]etry  [enter] details    ← footer: dim
```

Note that nothing is colored and the hierarchy still reads. That is the test.

## Density

Density is a dial, not a virtue. Pick a target for the screen, then hold it.

| Screen | Target | Why |
|---|---|---|
| Log / stream viewer | 1 row per record, fill vertically, no padding | Scanning is the whole job |
| Table / browser | 1 row per record, dense, no blank lines between rows | Comparison across rows |
| Detail / inspector | Generous; blank line between field groups | Reading, not scanning |
| Form | Generous; one field group per screen section | Errors need room to appear |
| Dashboard | 3–5 blocks, never more | More than 5 and nothing is a dashboard |

Chrome-to-data ratio, measured as cells spent on borders, headers, padding and hints divided by cells spent on content:

- **List views: keep data above 70%.** At 50% you have built a picture frame.
- **Detail views: 50–60% is fine.** The chrome defines the reading area.
- **Below 40%** you are decorating, not displaying.

Density mistakes, in order of how often they ship:

- A border around a single-column list of 5 items, on a 50-row terminal.
- A blank line after every row in a log view.
- Padding inside every cell of a table.
- A status line, a footer, a header, and a mode line, all saying the same thing.
- Column gutters of 3+ cells where 1 would do.

## Borders and containment

Borders are a tool for nesting, not for decoration. Every box you draw claims "this is a distinct thing." Make too many claims and none of them read.

**Maximum nesting depth is 2.** Outer frame plus one inner panel. At 3 the walls consume the width and the eye cannot find the content. If you want a third level, you wanted a heading and a blank line.

Pick one border style for the whole app, and one reason to switch:

| Style | When |
|---|---|
| Heavy `┏━┓` | Avoid. Competes with content brightness |
| Light `┌─┐` | The default for a frame that must exist |
| Rounded `╭─╮` | Softer; fine, but pick it once and mean it |
| Double `╔═╗` | Only if you have exactly one such box and it is a modal |
| None / whitespace | The answer more often than any of the above |

Rules that survive review:

- **Borderless beats bordered** when whitespace can do the job. Two blank lines between sections beats a boxed section.
- **Never draw a box that contains only one line of content.**
- **Align the corners with the content.** A box whose right wall is at column 79 on an 80-column terminal leaves a stray cell that looks like a rendering bug.
- **Do not put a border on the outer edge of an alternate-screen app.** The terminal is already the frame. Double-framing wastes two rows and two columns forever.
- **Use `├ ┤ ┬ ┴ ┼` joins, not overlapping `│` and `─`.** Overlaps look wrong at the corners and every reviewer notices.
- **ASCII fallback is a border set, not a per-glyph substitution.** Under `--ascii`, the whole box becomes `+ - |`. Mixing `┌` with `+` looks like a bug, because it is one. See `text.md` → *ASCII fallback*.

## Signals per state

Every visual state needs a bounded number of redundant channels. Two is right. Three is noisy. One is a bug for anyone who cannot see the one.

| State | Channel 1 (always) | Channel 2 (default) | Channel 3 (only if earned) |
|---|---|---|---|
| Error | Gutter `✗` / `!` | Color red | Word `error` in the row |
| Selected | Cursor `▸` or inverse video | Bold | Count in status line |
| Focused | Border or caret change | Brightness | — |
| Disabled | Dim / `·` prefix | Word `(disabled)` | — |
| Changed | `*` in gutter | Bold | — |

An always-on marker is a marker that stops meaning anything. If `!` appears on 40% of rows, nobody reads the 40%. Fix the content, not the marker.

## Responsive

Terminals resize. Layouts must be computed for the size you actually have, and the same state must render well at 40 columns and at 200. Four bands:

| Band | Columns | Layout |
|---|---|---|
| Wide | ≥ 120 | Three panes, or list + detail side by side. Full table columns. Hints can include descriptions |
| Standard | 80–119 | Two panes, or one pane plus a fixed sidebar ≤ 30 cells. Table drops low-priority columns |
| Narrow | 60–79 | Single pane, stacked. Table becomes two-line rows, or key: value pairs. Sidebar collapses into a toggle |
| Floor | < 60 | Single column, no borders, no tables. Degrade to a plain scrolling list. Below ~40 columns print one line saying the terminal is too small and offer `--plain` |

Degradation order — drop in this order, stop as soon as it fits:

1. Decorative borders
2. Low-priority table columns
3. Non-essential glyphs and icons
4. Padding and blank lines between groups
5. Full labels → abbreviations (`database` → `db`) using a fixed table, never truncation
6. Panes → stacked regions
7. Interactive → plain line output

Things that must survive every band:

- The status line (mode, connection, selection count).
- The footer (how to quit).
- Any text that determines whether the user can act. Per `text.md`, that text is never silently truncated; it wraps or it gets its own row.

**Height matters as much as width.** At 5 rows, header and footer are all you have. Below 3 rows, print a single line and wait for a resize.

**Never diff across a resize** — a resize invalidates every cell. Full repaint on `SIGWINCH`, then resume diffing. `rendering.md` → *Diffing*.

## Theming

The user's terminal theme is the source of truth for what light and dark look like. Your job is to be legible against it, not to impose a palette.

Use semantic roles, not colors, everywhere in the code:

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

func (t theme) style(r role) lipgloss.Style
```

Then exactly one place maps `role` → color, and it is 12 lines you can read in one sitting. Every call site says what it means.

- **Default foreground for primary text.** It is the one color guaranteed to be legible against the user's background. `accessibility.md` → *Contrast* covers why ANSI blue is not a substitute.
- **Use the 16-color palette for semantics, never for decoration.** The user tuned those 16 colors to their own contrast preferences. Reaching past them into 256 or 24-bit hex means you no longer know the contrast ratio.
- **Never use a hardcoded hex for body text.** It will eventually land on a background it vanishes into.
- **Honor a user override** (`--theme`, `tool.theme` in config) for accent and mode, and treat it as one more role mapping.
- **Light/dark.** Mode 2031 (`CSI ? 996 n` reporting) tells you whether the terminal is in dark or light mode, on the few terminals that support it. Use it to pick the *variant* of an accent, not to pick a whole different design. On terminals without it, the default theme has to work on both, which means: default foreground for text, and accents chosen for mid-gray backgrounds. `protocols.md` → *Modern protocols*.
- **256-color ansi256 indices are not portable.** Index 208 is orange in one theme and salmon in another. If you use them, use them for a graded ramp (`color 232..255` for dimming), not for semantics.

## Icons

Icons in a terminal are a portability problem wearing a nice hat.

There is no way to detect whether the user has a Nerd Font. There is no capability query for it, no environment variable, no DA1 response. Every program that ships Nerd Font glyphs on by default ships `□` tofu to someone. Therefore:

**Nerd Font icons are opt-in, never auto-detected.** Three rungs, chosen by capability and configuration, in this order:

| Rung | Requires | Set | Example row |
|---|---|---|---|
| Nerd Font | explicit opt-in only (`--icons`, config) | private-use glyphs | `  src/` |
| Unicode | `unicodeLevel ≥ basic` | box drawing, geometric, arrows | `▸ src/` |
| ASCII | always | punctuation and letters | `> src/` |

The `--ascii` flag and the icon rung are **independent axes**. A user can want Unicode box drawing with plain-text icons, or Nerd Font icons with strict ASCII elsewhere. Do not collapse them into one switch — `capability-ladder.md` models them as separate `caps` fields for exactly this reason.

Width is the trap. Private-use glyphs have inconsistent reported widths across terminals, and many fall in East Asian ambiguous ranges. Do **not** measure them. **Reserve a fixed cell budget:**

```go
// icons occupy a fixed 2-cell column: glyph + padding
// never measure the glyph itself
func (r row) iconCell() string {
    g := r.theme.icon(r.kind)   // one cell by convention, but unverified
    return g + " "              // always pad, so the column is 2 cells no matter what
}
```

Rules for icons:

- **Never carry meaning alone.** An icon that is the only indicator of a state is invisible to a screen reader and to anyone with a font that lacks it. `accessibility.md` → *Screen readers*.
- **One icon set for the whole app.** Mixing `✓` and `✔` and `√` reads as three unrelated things.
- **Prefer the gutter over the row body.** Gutter markers align, survive copy-paste, and don't disturb the text.
- **A text label beats an ambiguous icon.** `[x]` beats a mystery glyph. `error` beats `⬤`.
- **Test with `--ascii` before shipping.** If the layout collapses there, the icons were load-bearing and the design is wrong.

## Empty, loading, error

Three states every screen will reach, and the three most often forgotten.

| State | Requirement |
|---|---|
| Empty | Say why it's empty and what to do. "No results for `foo`. `esc` clears the filter." Not "No data." |
| Loading | Show it within 100 ms of the request or the user thinks it hung. A spinner with the operation name, plus elapsed time if over 2 s. |
| Error | What failed, where, why, and the next action. `cli-contract.md` → *Errors* defines the format. |
| Partial | Say what's missing. "Showing 100 of 4,312 — press `l` to load more." Silence about truncation is a lie. |

**Never show an empty table with headers and no explanation.** That is the single most common state bug in TUI work.

Loading indicators must stop. A spinner that runs after the operation completes is worse than no spinner: it says "still working" forever. See `lifecycle.md` for stopping timers on every exit path.

## Motion

There is no terminal equivalent of `prefers-reduced-motion`, so the default must be calm. See `accessibility.md` → *Motion* for the policy; design consequences:

- **Animate state transitions, not idle states.** A spinner while loading is information. A pulsing logo is not.
- **Never animate layout.** Resizing panes smoothly means 30 intermediate frames of a half-drawn grid. Snap.
- **Motion implies a frame rate.** Every animation is a reason to render, and per `rendering.md` → *Pacing and backpressure*, an idle screen emits zero frames. An animation that runs continuously costs the user CPU and battery for nothing.

## Checklist

- [ ] Layout computed from measured size, never hardcoded, works at 200 and at 60 columns
- [ ] Body gets at least 60% of rows; data cells exceed 70% in list views
- [ ] Status and footer always visible; header removable without loss
- [ ] Border nesting never exceeds 2; no box contains a single line
- [ ] One border style, one icon set, one accent, for the whole app
- [ ] Every state is legible with zero color and zero icons (`--ascii` passes)
- [ ] Every state uses ≤ 3 signals, and no always-on marker appears on most rows
- [ ] Degradation order is explicit and stops as soon as the content fits
- [ ] Text that determines whether the user can act is never truncated at any band
- [ ] Empty, loading, error and truncated states all explain themselves
- [ ] Semantic roles everywhere in code; exactly one role → color mapping
- [ ] Nerd Font icons require opt-in; private-use glyph widths are reserved, never measured
- [ ] Idle screen emits zero frames; nothing animates without carrying information
- [ ] Full repaint on resize; diffing never spans a size change
