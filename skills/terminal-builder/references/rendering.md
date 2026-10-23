# Rendering

The renderer is a pure function from `(state, size)` to bytes. Everything else in this file is about delivering those bytes without flicker, without tearing, and without making a remote session feel like a slideshow.

```text
render: (state, size) -> []byte       // identical inputs, identical bytes, every time
```

That purity is what makes golden-frame tests possible (`testing.md`), what makes diffing correct, and what lets you swap the renderer for a plain-text one without touching the model.

## Render purity

`render(state, size)` touches nothing outside its arguments. No clock, no random, no filesystem, no network, no reads of mutable globals, no writing to the terminal. It returns bytes; someone else writes them.

Purity is not tidiness. It is what makes every other guarantee reachable:

| Impurity | What actually breaks |
|---|---|
| `time.Now()` inside render | Golden frames fail on every run; animations can't be tested |
| Unordered map iteration | Diffing emits spurious repaints; output flickers with no state change |
| `rand` for jitter or sparkle | Same input, different bytes; a captured frame can't be replayed |
| Reading config or env mid-render | Two panes in one process disagree; resize changes behavior |
| Writing directly to stdout | Bypasses the diff, tears the frame, and survives into piped output |
| Blocking call (disk, RPC) | The UI thread stalls; `rendering.md`'s budgets are meaningless |

The test: call it twice with the same arguments and compare the bytes. If they differ, you have a bug that golden tests will surface late and confusingly.

Animation is the one place this looks violated and isn't. The clock reading happens in the **update** step, which produces new state; render only sees `state.t`. That keeps render pure and keeps the animation testable, because tests inject the time.

## Frame budgets

Terminals are not displays. Assume the worst and design to it.

| Environment | Realistic ceiling | Budget per frame |
|---|---|---|
| Local modern emulator | 60 fps | 16 ms |
| Local legacy terminal, large window | 30 fps | 33 ms |
| tmux, nested | 30 fps, slower on large panes | 33–50 ms |
| SSH, 20–80 ms RTT | 10–20 fps | 100 ms |
| SSH over a bad link, mosh | 5 fps | 200 ms+ |
| ConPTY / Windows console | 25 fps | 40 ms |

Two consequences. **Never render on a fixed 60 fps timer** — nothing in a terminal UI needs it, and you'll spend bandwidth redrawing an unchanged screen. Render on state change, coalesced to at most one frame per budget window. Tick only for genuine animation, and drop the animation entirely below rung 2 (`capability-ladder.md`).

## Rendering architectures

Know which model your framework uses; fighting it produces the bugs.

| Framework | Model | Who diffs | Consequence for you |
|---|---|---|---|
| Bubble Tea v2 | Elm MVU, `Model.View() string` | The standard renderer, line-based | Return a full frame as a string; the renderer finds the changed lines. Avoid per-frame allocation of the whole model's strings |
| Ratatui | Immediate mode, double-buffered `Buffer` | The library, cell-level | Draw everything each frame into the buffer; the diff is free. Never keep widget state yourself |
| Textual | Reactive widgets, CSS layout | The framework, compositor level | Layout is declared; recompose on state, don't hand-position |
| Ink | React reconciler to a Yoga layout | The renderer | Re-render is React diffing; keep component trees shallow or frames get expensive |
| tview / tcell | Retained widgets, explicit `Draw()` | tcell's cell buffer | You control invalidation; forgetting `SetChanged` gives a stale screen, over-calling it gives full repaints |
| ncurses | Retained windows, `wnoutrefresh`/`doupdate` | ncurses | `wnoutrefresh` marks, `doupdate` writes. Calling `refresh` per window writes repeatedly and flickers |
| OpenTUI | DOM-like tree | The renderer | Large trees are cheap to compose, expensive to lay out; virtualize lists |

## Diffing

Full-frame redraws are the default failure. Three strategies, cheapest first.

**1. Prefix/suffix line diff (Bubble Tea's approach).** Find the common leading and trailing lines, repaint only the middle. Handles append-to-log, cursor move, status line update, and modal-open with no bookkeeping. It fails on non-contiguous change, which is rarer than you'd think.

**2. Cell diff (Ratatui, tcell).** Keep two grids, emit runs of changed cells. Correct, general, and produces minimal output. Cost is a full grid copy per frame, which is nothing at 200x60.

**3. Coarse invalidation (retained frameworks).** Mark regions dirty and repaint whole regions. Simple, occasionally wasteful, never wrong.

What not to do: emit the entire screen every frame "because it's simpler". At 200 columns x 60 rows with SGR, a full repaint is 5–20 KB. At 15 fps over SSH that is 75–300 KB/s, which is a visible tax on a shared connection and a hard blocker on satellite or mobile links.

**Never diff across a resize.** On `SIGWINCH` or a size message, invalidate everything and repaint. Diffs computed against the old dimensions produce truncated garbage.

## Synchronized output and atomic frames

Tearing is what happens when the terminal renders half your frame. It shows as a border in the wrong place for one paint, or a status bar flicking to the old value.

The primitive is mode 2026:

```text
CSI ? 2026 h   begin
... frame bytes ...
CSI ? 2026 l   end
```

Rules:

- Nest-safe only at the outermost level. If your library also emits 2026, double-wrapping is harmless in spec but wasteful; check.
- **Only cede if unsupported.** Terminals without 2026 ignore it (unknown private mode), so emitting it unconditionally is safe. Emitting it on `TERM=dumb` or a pipe is not; gate on interactive.
- Fallback when 2026 is absent: **write the whole frame in one `write()` syscall**, with the cursor hidden. One write is the next best guarantee that the terminal's reader sees the frame as a unit.
- Never leave 2026 enabled on an error path. It belongs in the guard's teardown (`lifecycle.md`).

```go
func (r *renderer) flush(frame []byte) error {
    var buf bytes.Buffer
    if r.caps.Sync { buf.WriteString("\x1b[?2026h") }
    buf.WriteString("\x1b[?25l")          // hide cursor while drawing
    buf.Write(frame)
    buf.Write(r.cursorEscape())            // place cursor last
    buf.WriteString("\x1b[?25h")
    if r.caps.Sync { buf.WriteString("\x1b[?2026l") }
    _, err := r.w.Write(buf.Bytes())       // one write
    return err
}
```

## Flicker taxonomy

Every one of these has a specific cause. Match the symptom.

| Symptom | Cause | Fix |
|---|---|---|
| Whole screen flashes dark each update | `CSI 2J` (erase display) before drawing | Overwrite in place; `CSI 2J` only on resize or mode switch |
| One line flickers | Separate write per line, or clear-line-then-write in two writes | Batch into one frame buffer |
| Border jumps for a frame | Frame emitted in pieces; no 2026, no atomic write | Sync output or single `write()` |
| Cursor visibly hops around the screen | Cursor not hidden during draw | `?25l` at frame start, position and `?25h` at end |
| Alternate screen scrolls when it shouldn't | `\n` at the bottom row, or no scroll region | Write the last row without a trailing newline; use `CSI r` for the region |
| Old content visible in gaps | Shorter line written over a longer one without erase | `CSI K` (erase to end of line) after truncated lines |
| Text smears after resize | Diffed against stale dimensions | Full invalidate on size change |
| Bar `git`-style progress glitches | Repainting a row whose width changed without erasing | Always pad or erase to the previous line width |
| Everything double-spaced | Onlcr/ONLCR newline translation still active in alt screen | Disable output post-processing (`OPOST`/`ONLCR`) or never use `\n` for vertical motion |

The `\n` case deserves a note. In raw mode with `OPOST` on (the default on many systems), `\n` becomes `\r\n`. Inside an alt screen with absolute positioning you want neither translation nor implicit scrolling. Either clear `OPOST` in your raw-mode setup or never use `\n` for movement.

## Cursor discipline

- **One owner.** The renderer positions the cursor, or the framework does. Not both.
- Hide during draw, show after. Exception: a blinking cursor is a mode indicator; then restore the right shape with DECSCUSR (`protocols.md`).
- Position it **last**, after all text. Otherwise the terminal scrolls to follow it and the viewport jumps.
- When hiding, restore the shape you found. Do not leave the user with a solid block cursor in their shell.
- If nothing is focused (a read-only dashboard), hide the cursor entirely and make focus visible some other way (`design.md`).

## Virtualization

A table of 50 000 rows must cost the same to render as a table of 30.

```text
visible_rows = viewport_height
window       = rows[scroll_offset : scroll_offset + visible_rows]
```

Rules:

- **Compute the window first, then format.** Formatting 50 000 rows and slicing 30 is the bug, and it is a 100 ms-per-frame bug.
- Measure width after windowing. Cell-width measurement is the other hot loop.
- Keep the full dataset in a cheap form (ids, offsets) and materialize display strings per visible row, memoized by content hash if the formatting is expensive.
- Filtering and sorting operate on the whole set; only formatting is windowed.
- For huge inputs, prefer a streaming or paginated source over an in-memory slice. A 2 GB log loads fine into a ring buffer and not fine into `[]string`.

Cap every unbounded buffer. A log pane, an event feed, a message history: all ring buffers with a documented maximum, all rendered through the same windowing path.

## Pacing and backpressure

```text
on event:
    dirty = true
    if !scheduled: schedule(render, next_deadline)
on render:
    scheduled = false
    if dirty: dirty = false; emit(frame)

next_deadline = now + min_frame_interval
```

- **Coalesce.** A burst of 500 log lines is one frame, not 500. Debounce input at 1 frame window.
- **Drop, don't queue.** If the writer is still blocked when the next frame is due, discard the pending frame and keep the newest state. Never build an unbounded output queue; that turns a slow terminal into an OOM.
- **Adapt up.** Measure `write()` duration. If it exceeds half the budget, double the interval up to a ceiling (200 ms remote, 50 ms local). Recover slowly.
- **Never block the UI thread on the write.** Use a writer goroutine with a one-slot mailbox, or accept the block if you're already off the update path.
- **Do not animate in the background.** Focus-loss events (`input.md` → *Focus events*) are your signal: stop ticking when unfocused unless the work is the point.

## Bandwidth over SSH

Every byte is a round trip's worth of user patience. Costs, roughly:

| Emit | Bytes | Note |
|---|---|---|
| Printable ASCII | 1 | Cheapest thing you can do |
| CUP (`CSI r;cH`) | 6–8 | But it replaces 1–200 spaces, so it usually wins |
| SGR color set | 5–11 | Set once per run; per-cell color changes are the classic blowup |
| `CSI K` | 4 | Cheaper than padding with spaces |
| `CSI 2J` + full repaint | frame size | Avoid; also destroys scrollback context |
| Sixel image | 10 KB–1 MB | Never per frame |
| Kitty graphics | ~payload, once | Transmit by ID, place by reference |

Practical reductions, in order of effect:

1. **Diff.** 10–100x on typical frames.
2. **Batch SGR per run**, not per cell. A gradient across 200 columns is 200 SGR sequences; a gradient across 4 stops is 4.
3. **Skip leading spaces** with CUP instead of emitting them.
4. **Reduce animation to text changes.** A spinner is 4 bytes; a progress bar repaint is a row.
5. **Cap frame rate adaptively** as above.
6. **Offer `--plain`** for the genuinely constrained link; a line-oriented fallback beats a degraded cartoon.

Also true: **mosh** repaints the whole screen after its own sync events, so a large frame costs more there than the byte count suggests. **tmux** re-emits to the outer terminal, so your diff is diffed again; that's usually in your favor, but passthrough sequences (`protocols.md` → *Multiplexer passthrough*) can defeat it.

## Graphics

If you ship images (sixel, Kitty, iTerm2 inline):

- **Transmit once, reference by ID.** Kitty's protocol supports this explicitly; use it.
- **Never animate an image by re-transmitting.** Re-place it.
- **Bounds.** A 4K screenshot in a 100-column pane is a 10 MB payload; downscale before sending.
- **Always have a text fallback** (`capability-ladder.md` → *Degradation matrix*). Sixel in tmux without passthrough is a screen of `~` and `;`.
- **Last resort placement.** Drawing an image overwrites cells with opaque content that your diff model does not know about. Invalidate the region after any overlay.

## Measuring it

Two debug affordances, ten lines each, that pay for themselves the first time a user says "it's slow":

```go
// --debug-frames
frame  142  bytes 1840  write 3.1ms  state  peer=connected rows=48
```

- **Bytes per frame.** A number above a few KB on an idle screen means the diff isn't working.
- **Write duration.** Growing write times mean the consumer is behind; time to back off.
- **Frame count per second.** A number above 30 on an idle screen means something is ticking that shouldn't.

For flicker, the honest test is a recorded PTY session (`testing.md` → *PTY harness*), not a human watching. Record with `asciinema`, count `CSI 2J` occurrences, and assert the frame count for a scripted interaction. A one-shot action that emits 12 frames is 11 bugs.

## Checklist

- [ ] `render(state, size)` is pure and unit-testable with no terminal attached.
- [ ] No timer-driven redraw; frames follow state change and are coalesced.
- [ ] Diffing in place: prefix/suffix or cell-level. No unconditional full repaint.
- [ ] Resize invalidates everything; no diff across dimension change.
- [ ] Synchronized output when available, single atomic `write()` when not.
- [ ] Cursor hidden during draw, positioned last, shape restored on exit.
- [ ] Alternate screen entered only for full-screen mode; `\n` never used for vertical motion inside it.
- [ ] Lists and tables virtualized: cost is O(viewport), not O(dataset).
- [ ] All buffers bounded; no unbounded output queue; frames dropped under backpressure.
- [ ] Animation stops when unfocused and is dropped below rung 2.
- [ ] `--debug-frames` reports bytes, write time, and frames per second.
- [ ] Idle screen emits zero frames.
