---
name: terminal-builder
description: Design, build, refactor, or review production-grade terminal software — full-screen TUIs, interactive prompts, dashboards, REPLs, pickers, and one-shot CLIs — that use every terminal feature available while degrading cleanly to dumb 80x24, no-color, piped, multiplexed, remote, and Windows console environments. Use when asked to build or review anything that writes to a terminal; when choosing a framework (Bubble Tea, Ratatui, Textual, Ink, ncurses); when handling raw mode, alternate screen, mouse, bracketed paste, focus events, keyboard protocols, truecolor, hyperlinks, clipboard, images, or progress reporting; when measuring Unicode width, aligning tables, or fixing flicker, tearing, garbled output, and broken terminal cleanup; or when asking what a terminal can do and what to do when it cannot.
license: MIT
compatibility: opencode, claude-code, codex
---

# Terminal Builder — Ultimate Edition

You build terminal software for people who live in a terminal. The rule that outranks every other rule in this skill:

> **Use everything the terminal offers. Require nothing.**

Both halves are binding. A tool that ignores truecolor, hyperlinks, synchronized output, and the Kitty keyboard protocol because "compatibility" is leaving quality on the floor. A tool that *requires* them to function is broken on a serial console, in CI, over tmux, and for every screen-reader user. The job is a capability ladder with a real rung for every environment, chosen at runtime, degrading downward without losing function.

This skill synthesizes the best published terminal engineering: the ANSI/VT/xterm/ECMA-48 standards lineage, the NO_COLOR and CLICOLOR conventions, Unicode UAX #9/#11/#14/#29, WCAG 2.2 contrast and use-of-color, the Kitty keyboard and graphics protocols, synchronized output and grapheme-width modes from the contour vt-extensions work, xterm's control sequences, ncurses lifecycle discipline, framework-specific contracts from Bubble Tea v2, Ratatui, Textual, Ink and ncurses, and field-tested guidance on multiplexers, SSH, ConPTY, and screen-reader terminals.

Attribution: synthesized from MIT-licensed skills by Josiah Siegel (tui-master), gfargo (tui-design), rsteube (carapace-bin bubbletea/cobra), Stefanie Jane (hyperskills), Albert Lv (designing-tuis), Jeffallan (cli-developer), Kyle King (tui-critique), Sam Joyce (ncurses), and Gleb Kalinin (agent-cli). See `LICENSE-NOTES.md`.

## Operating modes

Guidance by default. Loading this skill authorizes nothing.

- **Guidance mode** — a question, a review, one decision. Answer from the relevant reference. No files created.
- **Build mode** — "build / implement / add a TUI / wire up the CLI". Follow *Build order* below.
- **Review mode** — "review / critique / audit this TUI". Follow *Review order* below. Cite `file:line`, not vibes.

If the request is ambiguous about whether a full-screen UI is even wanted, resolve that first — see `references/cli-contract.md` → *Product shape*. Most "build me a TUI" requests are better served by a good CLI plus a small prompt.

## Language and framework defaults

| Language | Default | Use instead when |
|---|---|---|
| **Go** | Bubble Tea v2 + Lipgloss v2 + Bubbles + Cobra | Retained widget set needed → `tview`/`tcell`; SSH-served → `wish`; prompts only → `huh` |
| Python | Textual (apps) / Rich (output) / prompt_toolkit (REPL) | Dependency-light classic TUI → curses |
| TypeScript/JS | Ink | Very large DOM-like tree → OpenTUI; prompts only → Clack |
| Rust | Ratatui + Crossterm | Unix-only → Termion |
| C | ncursesw | Graphics as a product goal → notcurses |

Go is the primary target in this skill; `references/languages/go.md` is the deepest reference. Everything in `references/` outside `languages/` is framework-neutral and applies to all of them.

Do not translate one framework's architecture into another. Bubble Tea's MVU, Ratatui's immediate mode, Textual's reactive widgets, and ncurses' retained windows are four different mental models; picking the wrong one produces code that fights its own framework.

## The five non-negotiables

Every terminal program this skill produces satisfies all five. A review that finds one violated has found the top-priority issue.

1. **Lifecycle closes.** Every mode you enable is disabled on every exit path: normal quit, error, panic, Ctrl-C, SIGTERM, failed partial init, and test assertion failure. Cleanup is idempotent and safe after partial initialization. See `references/lifecycle.md`.
2. **Layout is computed, never assumed.** Terminal dimensions are an input event. Nothing caches absolute coordinates across a resize. Define a minimum size and a truthful "too small" state. See `references/design.md` → *Responsive*.
3. **Width is measured in cells.** Not `len()`, not `str.length`, not code points, not grapheme count alone. ANSI stripped, wide glyphs counted, truncation on grapheme boundaries. See `references/text.md`.
4. **Meaning survives without color.** Color is one channel among several. Status carries a word or symbol; focus carries a marker or border change; the plain mode still reaches every action. See `references/accessibility.md`.
5. **The UI thread never blocks.** Disk, network, subprocess, and CPU work go to a command, worker, goroutine, task, or thread that reports back as a message. See `references/rendering.md`.

## Build order

Work in this sequence; each step has a check that gates the next.

1. **Classify the product shape.** One-shot CLI, summon-choose-exit, or full-screen session. Write the stdout/stderr contract down. Check: can a script consume this without a TTY?
2. **Enumerate states.** Initial, loading, empty, partial, success, error, disconnected, too-small. Check: every one has a rendering.
3. **Sketch layout at four widths** — wide (>120), standard (80–120), narrow (60–80), floor. Check: name what hides at each, and the exact floor message.
4. **Pick the buffer.** Alt screen, inline, or overlay, chosen by workflow not by preference. Check: the exit contract is known (erase cleanly, or leave a one-line receipt).
5. **Build the capability ladder** before the UI. Detection, precedence, and the table of feature → probe → fallback for everything you intend to use. Check: every feature has a working fallback path you have actually rendered.
6. **Build the terminal guard first** — the single owner of raw mode, alt screen, mouse, paste, focus, keyboard protocol, cursor, and title. Check: it is registered before the first mode is enabled, and is idempotent.
7. **Build the input decoder** as its own layer. Check: one owner of stdin; no competing readers; paste is data not keystrokes.
8. **Build state + update** free of terminal concerns. Check: it is unit-testable with no terminal attached.
9. **Build the renderer** as a pure projection of state and size. Check: rendering twice with identical inputs emits identical bytes.
10. **Wire async work** through the message path with timeouts and cancellation. Check: no path awaits inside the render/update loop.
11. **Add the fallbacks** — `--no-tui`, `--plain`, `--json`, `--ascii`, `--color=never`, reduced motion. Check: each is reachable and actually works.
12. **Test the floor, not the happy path.** Lifecycle under panic, resize storm, CJK/emoji, no-color, non-TTY, and one real PTY pass. Check: `references/testing.md` → *Verification matrix* is green.

## Review order

Report findings in this order; stop ranking once the reader can act.

1. Is the product shape right, or should this be a CLI instead of a TUI?
2. Can any exit path leak raw mode, cursor state, mouse capture, alt screen, or a keyboard protocol?
3. Does it block, redraw wastefully, crash on resize, or mismeasure cell width?
4. At 80x24 and 60 columns, what happens? Below the floor, does it say so?
5. Does it work with `NO_COLOR=1`, 16 colors, ASCII only, and a pipe?
6. Run the clutter audit (`references/design.md`): border-nesting depth, signals-per-state, always-on markers, chrome-to-data ratio.
7. Are the important actions reachable by keyboard, and discoverable without documentation?
8. Are output streams, exit codes, and non-TTY behavior honest?
9. Which test layer would have caught each issue you found, and is it missing?

## Anti-patterns

The ten that recur most. Each has a reference behind it.

| Anti-pattern | Instead |
|---|---|
| `NO_COLOR` checked *after* truecolor detection | Resolve user intent first, capability second (`capability-ladder.md`) |
| Full-screen UI for a scriptable workflow | Ship the CLI; add the TUI as an optional surface |
| `fmt.Println` / `console.log` while a TUI owns the screen | File sink or in-app log panel (`lifecycle.md`) |
| Color-only status, selection, or focus | Word, symbol, marker, or border change (`accessibility.md`) |
| `len(s)` or `s.length` for width | ANSI-stripped grapheme cell measurement (`text.md`) |
| Every pane in a heavy border, nested two deep | One border language; whitespace separates (`design.md`) |
| Raw mode enabled with cleanup only on the happy path | Guard registered before enabling, idempotent (`lifecycle.md`) |
| Rendering on a fixed timer regardless of state | Render on change; tick only for animation (`rendering.md`) |
| Nerd Font glyphs assumed present | Explicit opt-in, three-rung fallback (`design.md`) |
| Escape sequences from untrusted data passed through | Sanitize at the render boundary (`security.md`) |

## Reference index

Load only what the task needs. When a prompt names a framework, load its language reference before making API or lifecycle claims.

| Need | Reference |
|---|---|
| What the terminal can do, how to detect it, what to do when it can't | `references/capability-ladder.md` |
| Exact escape sequences, DEC modes, OSC families, modern protocol specs | `references/protocols.md` |
| Setup/teardown ordering, signals, suspend, child handoff, recovery | `references/lifecycle.md` |
| Raw mode, keyboard protocols, mouse, paste, focus, keybinding design | `references/input.md` |
| Layout, hierarchy, density, borders, responsive, theming, icons | `references/design.md` |
| Unicode width, graphemes, truncation, locale, RTL, ASCII fallback | `references/text.md` |
| Color semantics, contrast, CVD, plain mode, screen readers, motion | `references/accessibility.md` |
| Frame loops, diffing, virtualization, frame pacing, SSH budgets | `references/rendering.md` |
| Streams, exit codes, flags, help, config, secrets, distribution | `references/cli-contract.md` |
| Test pyramid, golden frames, PTY, CI matrix, troubleshooting, debugging | `references/testing.md` |
| Escape injection, OSC abuse, sanitization, log hygiene | `references/security.md` |
| Go: Bubble Tea v2, Lipgloss v2, Bubbles, Huh, tview, Cobra | `references/languages/go.md` |
| Python, TypeScript, Rust, .NET, C: APIs, pitfalls, cleanup idioms | `references/languages/others.md` |

## Verification gate

Before declaring terminal work done, all of these must hold:

- Cleanup verified after a forced panic, mid-init failure, Ctrl-C, SIGTERM, and normal quit.
- Resize to 40 columns and back: no panic, no stale frame, selection preserved.
- `NO_COLOR=1`, `TERM=dumb`, `--ascii`, and `--plain` each render something usable.
- `app | cat` and `app > file` produce no escape bytes and no truncation.
- CJK, combining marks, a ZWJ emoji, and an ANSI-styled string all align.
- No writes to stdout from any goroutine/task other than the renderer.
- Exit codes documented and distinct: 0 success, 1 failure, 2 usage, 130 interrupt.
- One real PTY session driven end to end: launch, type, paste, resize, modal, quit.
