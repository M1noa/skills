# Input

Input is where terminal software most often breaks in ways users can't articulate. Keys feel "sticky," paste fires a destructive action, Esc doesn't cancel on the first press, focus vanishes, clicks land on the wrong row.

## One owner for stdin

Exactly one component reads input. Everything else receives decoded events.

The failure mode this prevents: mixing `readline` with raw listeners, a prompt library inside a full-screen framework, or two goroutines calling `Read`. Symptoms are keys that work intermittently, Enter that works while arrows don't, or a UI that stops responding after opening a modal.

Declare ownership in your architecture — a comment at the top of the input module saying "this file is the only reader of stdin" — and enforce it in review.

## Input modes

| Mode | Line discipline | Echo | Signals from keys | Use |
|---|---|---|---|---|
| Cooked (canonical) | line-buffered | on | yes | one-shot CLIs, prompts |
| Cbreak | per-char | on | yes | curses, some prompts |
| Raw | per-byte | off | **no** | full-screen TUIs |

Raw mode (`cfmakeraw` semantics) also clears `IXON`, so Ctrl-S/Ctrl-Q stop being flow control and become ordinary keys — which is exactly why a TUI may bind Ctrl-S. Flow-control freezes only affect cooked-mode programs (`stty -ixon` is the user-side workaround).

Only enter raw mode when `stdin` is a terminal. Provide a non-interactive path for everything else.

## Key decoding

### Legacy encoding and its ambiguities

- A lone `0x1b` may be Escape, or the start of an Alt-prefixed key, or the start of a control sequence. The parser must wait to find out — that wait is why Esc feels laggy.
- Ctrl combinations collapse onto control bytes: Ctrl-M is CR is Enter, Ctrl-I is Tab, Ctrl-H is often Backspace, Ctrl-[ is Esc.
- Function keys, keypad keys, and Home/End vary by terminfo entry.

Tuning the Esc timeout is the honest fix when you can't use an enhanced protocol: 25–50 ms is a reasonable compromise. Over SSH or tmux, the delay compounds — tmux's `escape-time` alone was 500 ms before 3.5 and is 10 ms since.

### Enhanced protocols

Kitty keyboard protocol and xterm `modifyOtherKeys` disambiguate modifiers, distinguish press from release, and separate text from physical keys. See `protocols.md` for the sequences.

Rules:

1. Probe, push flags, and **pop on every exit path**.
2. Keep a legacy binding for every action.
3. Handle key press, repeat, and release deliberately. One physical press must not submit twice — common with frameworks that deliver both press and release, or on Windows where a key can arrive as press twice.
4. Do not assume Ctrl-I differs from Tab, or Ctrl-M from Enter, on a terminal that hasn't negotiated the protocol.

In Ratatui, filter for `KeyEventKind::Press`; without it, Windows delivers press *and* release and every action fires twice.

## Key event model

Decode into something semantic before the app sees it:

```text
Key(code, modifiers, kind)   kind: press | repeat | release
Rune(text, modifiers)        text is what to insert, if anything
```

Keep the physical key and the text separate. A text field wants the rune; a keybinding wants the code plus modifiers. Collapsing them means `Shift+2` and `@` become indistinguishable, and international layouts break.

## Mouse

| Mode | Events |
|---|---|
| 1000 | press + release |
| 1002 | + drag |
| 1003 | + every motion |
| 1006 | SGR encoding — pair with any of the above |

Enable the smallest mode that serves the UI. 1003 on a trackpad floods the queue. SGR coordinates avoid the 223-column limit of the legacy encodings and report releases unambiguously.

Rules:

- Validate coordinates against the **current** layout, and drop events whose coordinates exceed the viewport (stale after resize).
- Treat motion, drag, and wheel as high-frequency input; throttle expensive side effects.
- Mouse capture takes over the terminal's own text selection. Document the bypass modifier — Shift in most terminals, Option in iTerm2, Fn in Terminal.app — and offer a way to turn capture off.
- Every mouse target needs a keyboard equivalent. A mouse-only action is an accessibility bug.
- Inside tmux 3.8+, a plain drag belongs to tmux unless your app enables mouse reporting.

## Paste

Bracketed paste (mode 2004) wraps pasted text in `CSI 200~` … `CSI 201~` so the application can distinguish it from typing.

This is a **security** feature, not a convenience one. Without it, pasting

```
rm -rf /
```

plus a trailing newline executes. The paste is not a sequence of commands; it is text.

Rules:

- Enable it for every free-text input: editors, search boxes, command palettes, multiline fields.
- Treat the payload as data. Never dispatch it as keystrokes.
- Decide per field what a multi-line paste means. A single-line field keeps the first line or refuses; it never submits.
- Limit payload length before processing (a 10 MB paste should not freeze the UI).
- Sanitize control characters when the pasted text is echoed (`security.md`).
- xterm, kitty, Ghostty, and foot neutralize escape characters inside a paste so it can't terminate itself early. Do not assume every terminal does.

## Focus events

Mode 1004 sends `CSI I` and `CSI O` on window focus change.

Use them to pause animation and polling in the background and to refresh stale data on return. They are **advisory**: terminals and multiplexers may omit or filter them (tmux needs `focus-events on`), so never make correctness depend on one arriving.

## Resize

Resize is a normal input event. It invalidates layout, viewport measurements, mouse hit boxes, wrapped text, table widths, and snapshot expectations.

- Recompute layout from the current size; never cache absolute coordinates across frames.
- Coalesce resize storms before expensive recalculation, but keep it feeling immediate.
- Tolerance for stale dimensions matters: over SSH and in multiplexers, resize propagation can be delayed or lost.
- Never panic on zero or tiny dimensions. Render the floor message.

## Keybinding design

### Hierarchy

1. Global lifecycle: quit, cancel, help, palette.
2. Navigation: arrows, Tab/Shift-Tab, PageUp/Down, Home/End.
3. Focused widget: editor motion, list selection, table sort.
4. Mode-specific: vim normal/insert, search, multi-select.
5. Destructive actions: confirmation + visible label.

### Conventions worth following

| Key | Action |
|---|---|
| `q` | quit |
| `?` | help |
| `/` | search / filter |
| `n` / `N` | next / previous match |
| `Esc` | cancel / back / dismiss |
| `Enter` | confirm / drill in |
| `Space` | toggle / mark |
| `:` | command mode |
| `gg` / `G` | top / bottom |
| `Tab` / `Shift-Tab` | cycle focus |
| `r` | refresh |
| `1`–`9` | jump to panel |
| `hjkl` + arrows | move (when no text field owns input) |
| `Ctrl+P` | command palette |
| `y` / `p` | yank / paste |
| `d` / `e` / `o` | delete / edit / open |

Pick one paradigm and stay consistent. Mixing `Ctrl+S` and `:w` for save unless both unambiguously mean "write" is a bug.

### Reserved keys

In cooked mode these belong to the driver and shell. In raw mode they arrive as ordinary keypresses, which means **you** are responsible for the behavior users expect:

| Key | Expected |
|---|---|
| `Ctrl-C` | cancel or quit cleanly |
| `Ctrl-Z` | suspend, restoring the terminal, redrawing on resume |
| `Ctrl-\` | abort |
| `Ctrl-S` / `Ctrl-Q` | flow control in cooked mode; free keys in raw |

Keep `Ctrl-C` as cancel/quit unless there's a strong reason not to, and if you rebind it, provide an obvious exit. Implement `Ctrl-Z` through the framework so the terminal is restored. Do not make `Ctrl+B` (tmux prefix) or `Ctrl+A` (screen prefix) the only path to an action.

### Discoverability, four layers

1. **Always-visible footer hints** — the 3–5 most useful shortcuts, updated by context. Strongest single tool; most users never read docs. Generate them from the keymap (`bubbles/help`, Textual `Footer`) so they can't drift.
2. **`?` help overlay** — all bindings, grouped by context, formatted `key  action  context`.
3. **Leader / which-key** — after a prefix key, show available follow-ups. Worth adding past ~20 actions.
4. **Command palette** — fuzzy-searched actions with keybindings shown beside each. Once it exists, every keybound action must also be a palette entry.

### Focus model

Every interactive element needs:

- A stable identity.
- Focus eligibility rules (disabled, hidden, modal).
- A visible indicator that survives no-color: border change, reverse video, prefix marker, or cursor position. Combine two for the focused panel.
- Navigation: Tab order following visual reading order; numeric jumps for 5+ panels; Esc to leave a focus trap.
- Mouse click that sets focus before activating.
- A defined "next focus" when the focused element is removed.

Focus traps are correct for modals and forms: Tab cycles within, Esc exits, the previous focus is restored on close.

### Destructive actions

Match friction to consequence:

| Level | Pattern |
|---|---|
| Light | `Delete 3 files? [y/N]` — default No |
| Medium | type the object name: `Type the database name to confirm: prod-main` |
| Heavy | two-stage typed confirmation |

Do not make every confirmation typed-name; users learn to type fast and the safety evaporates. Where undo exists, prefer undo over confirmation. Never silently destroy.

## Text input semantics

- Cursor movement, deletion, selection, and word motion operate on **grapheme clusters**, not bytes or runes.
- Left/right by grapheme; Ctrl/Option+arrows by word; Home/End per line in multiline fields.
- Horizontal scroll offset in cells, not characters, so a wide glyph doesn't push the cursor off.
- Mask secrets, support explicit reveal, never log them.
- Validate on blur or submit, not on every keystroke — an incomplete value is not an error while it's still being typed. After an error has been shown, live revalidation to clear it is helpful.
- There is no framework-standard "required field" marker. If you need one, write `(required)` in the label; do not assume an API exists.

## Failure table

| Symptom | Likely cause | Fix |
|---|---|---|
| Esc feels delayed | parser waiting to distinguish Alt | tune timeout, or use an enhanced protocol |
| Ctrl-C doesn't exit | raw mode swallowed the signal; handler never runs | map Ctrl-C as a keypress, restore, exit 130 |
| Keys arrive twice | press and release both handled | filter on press (Ratatui `KeyEventKind::Press`) |
| Paste executes actions | no bracketed paste, or paste dispatched as keys | enable 2004, treat payload as text |
| Paste shows `^[[200~` | enabled 2004, never disabled | send `CSI ?2004l` on exit |
| Clicks land on the wrong row | stale layout coordinates after resize | validate against current viewport |
| `q` doesn't quit | a text field owns input | route keys through focus and mode |
| Focus disappears | removed widget owned it | compute the next eligible target |
| Arrow keys print sequences | wrong mode, or no keypad/terminfo | check raw mode and the input decoder |
| Nothing responds but the screen draws | stdin paused (Node `pause()` without `resume()`), or a competing reader | one owner, resume before waiting |
