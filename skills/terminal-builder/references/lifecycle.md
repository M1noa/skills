# Terminal Lifecycle

The most common way a terminal program fails is not a rendering bug. It is leaving the terminal in a state the user cannot get out of: no echo, hidden cursor, alt screen with no scrollback, mouse capture on, paste markers visible, scroll region stuck.

Cleanup is not an afterthought added before shipping. It is the first thing you write.

## The contract

Every mode you enable gets disabled on **all** of these paths:

1. Normal quit
2. `Ctrl-C` / SIGINT
3. SIGTERM
4. Panic / uncaught exception / rejected promise
5. `Err`/exception returned from the main loop
6. Early return after **partial** initialization (raw mode on, alt screen not yet)
7. Suspend and resume (`Ctrl-Z`, `fg`)
8. A child process handing the terminal back
9. Test assertion failure

Two properties make this tractable: the guard is **registered before the first mode is enabled**, and cleanup is **idempotent** — safe to call twice, safe to call when nothing was enabled, and never panics.

## Setup order

Each step depends on the previous. Do not reorder.

1. Verify `stdin` and `stdout` are terminals. Bail to the plain path if not.
2. **Register cleanup.** Not "remember to call it" — install it: `defer`, `try/finally`, `Drop`, `atexit`, panic hook, `process.on('exit')`.
3. Enable raw/cbreak mode.
4. Read the terminal size once so the first frame isn't rendered at zero dimensions.
5. Enter the alternate screen (full-screen apps only).
6. Enable optional input modes: mouse, bracketed paste, focus, keyboard protocol — in that order, each only if needed.
7. Hide the cursor only if your renderer owns restoring it.
8. Render and flush the first frame **synchronously**, before any async work.
9. Start async work / the event loop.

Step 8 is the one people skip, and its symptom is the worst: a blank alt screen that looks like a freeze until some network call returns.

## Teardown order

Reverse of setup, plus a few things setup didn't mention.

1. Stop workers, or detach their output from the terminal.
2. Disable input modes: keyboard protocol (pop), focus, paste, mouse.
3. Reset synchronized output if a frame was in flight (`CSI ? 2026 l`).
4. Show the cursor, in the shape you found or the default.
5. Reset SGR (`CSI 0 m`), then foreground/background defaults.
6. Leave the alternate screen.
7. Disable raw/cbreak mode.
8. Reset the scroll region (`CSI r`).
9. Restore or clear the window title and any progress indicator (`OSC 9;4;0`).
10. Flush final output, restore logging, exit with the documented code.

Order matters at two points: leave the alt screen **before** disabling raw mode so the shell prompt lands on the restored buffer, and reset SGR **before** leaving the alt screen so the reset isn't lost with the buffer.

## Guard patterns

**Go** — `defer` plus an idempotent close, and never `os.Exit` from inside the loop:

```go
type guard struct {
    in     bool
    screen bool
    done   bool
}

func (g *guard) restore() {
    if g.done { return }
    g.done = true
    if g.screen { fmt.Fprint(os.Stdout, "\x1b[0m\x1b[?25h\x1b[?2004l\x1b[?1004l\x1b[?1006l\x1b[?1003l\x1b[?1002l\x1b[?1000l\x1b[?1049l") }
    if g.in { _ = term.Restore(int(os.Stdin.Fd()), g.state) }
}

func main() {
    g := &guard{}
    defer g.restore()
    // install signal handler that calls g.restore() then re-raises
}
```

With Bubble Tea v2 this is handled for you: `Program.Run()` restores on normal exit, error, and recovered panic. Do **not** add `defer p.RestoreTerminal()` — that is the counterpart to `ReleaseTerminal` (a temporary handoff), not a final cleanup.

**Python** — `curses.wrapper` for curses; `contextlib.ExitStack` or `try/finally` otherwise:

```python
def main():
    with ExitStack() as stack:
        backends = raw_mode()
        stack.callback(backends.restore)
        stack.enter_context(alternate_screen())
        run()
```

Without a wrapper, `curses.initscr()` on an exception path leaves echo off. Always go through `curses.wrapper(app)`.

**JS** — process handlers plus a flag:

```js
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdout.write('\x1b[0m\x1b[?25h\x1b[?2004l\x1b[?1049l');
}
process.once('exit', cleanup);
process.once('SIGINT', () => { cleanup(); process.exit(130); });
process.once('uncaughtException', (e) => { cleanup(); console.error(e); process.exit(1); });
process.once('unhandledRejection', (e) => { cleanup(); console.error(e); process.exit(1); });
```

**Rust** — RAII plus a panic hook, because `Drop` does not run when the process aborts and a panic inside `Drop` is worse than no cleanup:

```rust
struct TerminalGuard;
impl Drop for TerminalGuard {
    fn drop(&mut self) {
        let _ = execute!(io::stdout(), Show, LeaveAlternateScreen, ResetColor);
        let _ = disable_raw_mode();
    }
}

fn main() -> anyhow::Result<()> {
    let prev = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| { restore(); prev(info); }));
    let _g = setup_terminal()?;
    run()
}
```

Ratatui's `ratatui::restore()` undoes raw mode and the alt screen and **nothing else** — not cursor shape, not mouse, not paste, not focus. Know what your framework's cleanup actually covers before trusting it. Bubble Tea v2 covers everything it enabled; crossterm's `disable_raw_mode` covers raw mode alone.

## Signals

| Signal | Cooked mode | Raw mode (full-screen app) | What you owe the user |
|---|---|---|---|
| `SIGINT` (Ctrl-C) | terminates, exit 130 | arrives as a **keypress**, not a signal | cancel the work or quit; exit 130 if by signal |
| `SIGTSTP` (Ctrl-Z) | suspends | arrives as a keypress (and `IXON` is cleared) | suspend properly: restore, stop, redraw on `SIGCONT` |
| `SIGWINCH` | — | delivered on resize (Unix only) | re-layout from the new size |
| `SIGTERM` | terminates | terminates | restore the terminal before exiting |
| `SIGHUP` | terminates | terminates | daemons reload; one-shots exit |
| `SIGPIPE` | terminates | terminates | exit silently, 0 or 141 — **never a stack trace** |
| `SIGKILL` | terminates | terminates | **cannot be handled.** No cleanup will run. |

`SIGKILL` and a hard power loss are why cleanup must also be recoverable by the *user*: document `reset`, `stty sane`, and `--no-tui`.

The Ctrl-C subtlety deserves emphasis. In raw mode there is no SIGINT — the byte arrives as input. So:

- A SIGINT handler only fires when input is **not** a TTY (piped input).
- Inside the UI you must handle Ctrl-C as a keypress yourself.
- Do not `os.Exit` from inside the update loop; return a quit message and let the framework restore.

## Suspend and resume

Unix job control, done right:

1. Ctrl-Z is received as a keypress.
2. Restore the terminal fully (teardown steps 2–9) — the shell needs it back.
3. Ignore further terminal signals while suspended.
4. `kill(0, SIGTSTP)` — or the framework's suspend call.
5. Block until `SIGCONT`.
6. Re-enable all modes (setup steps 3–7).
7. **Force a full redraw** and reload anything a child could have changed.

Step 7 matters: the screen was repainted by whatever ran while you were suspended. Repainting your stale model is not enough; re-read externally mutable data.

Windows has no `SIGTSTP`, `SIGCONT`, `SIGWINCH`, or job control. Suspend must not be a required path there. Hide or rebind the key when `runtime.GOOS == "windows"`, and detect the platform rather than assuming.

Bubble Tea v2: return `tea.Suspend` from `Update`, and handle `tea.ResumeMsg` to refresh state.

## Child process handoff

When your TUI launches an editor, pager, shell, `less`, `git commit`, or a `$PAGER`:

1. Persist or pause your UI state.
2. Restore the terminal completely (leave alt screen, disable raw, show cursor).
3. Attach the child to the real terminal (`stdin`, `stdout`, `stderr` inherited).
4. Wait.
5. Re-enable modes, force a full redraw, and **re-read anything the child could have changed**.

Prefer the framework's handoff API: Bubble Tea's `tea.ExecProcess` does exactly this and reports the child's error back as a message. For non-interactive children, do not hand over the terminal at all — pipe their output into your model (`stdio: 'pipe'`, `exec.Command` with pipes, `subprocess.PIPE`).

The failure this prevents: compiler output bleeding through a bordered pane, or a `git commit` running with echo off.

## Panic and exception paths

| Language | Mechanism | Note |
|---|---|---|
| Go | `defer` + `recover()` in the loop | `defer` runs on panic; it does not run on `os.Exit` or `log.Fatal` |
| Rust | `Drop` + `panic::set_hook` | hook runs before unwinding; use `catch_unwind` if you need ordering control |
| Python | `try/finally` + `sys.excepthook` | curses: `curses.wrapper` |
| JS | `process.on('exit'/'uncaughtException'/'unhandledRejection')` | `process.exit()` still fires `exit`; `SIGKILL` doesn't |
| C | `atexit` + a sigaction handler that sets a flag | never call complex curses APIs from a signal handler |

Rule for all of them: **the guard is installed before anything is enabled**, and the guard function contains no allocation, no locking, and no calls that can fail loudly.

## Partial initialization

The hardest path, and the one that produces the worst bugs, because you enabled raw mode and then the alt screen failed:

```go
func setup() (cleanup func(), err error) {
    if err = rawMode(); err != nil { return func(){}, err }
    cleanup = func() { restoreTerm() }   // registered immediately
    if err = enterAlt(); err != nil { cleanup(); return func(){}, err }
    return cleanup, nil
}
```

Every failure after a successful step calls the cleanup for that step. The alternative — a boolean chain checked at exit — is where cleanup quietly stops covering the case you added last week.

## Recovery instructions

Ship these in `--help` and in error output, because users will hit a broken terminal at some point:

```text
If your terminal looks broken after this program exits:
  reset            # full reset
  stty sane        # restore line discipline (echo, signals)
  q / Ctrl-C       # quit key, if the UI is still drawing
  app --no-tui     # run without full-screen mode
```

## Lifecycle checklist

- [ ] Cleanup registered before the first mode is enabled.
- [ ] Cleanup idempotent; calling it twice does nothing and throws nothing.
- [ ] Verified after a forced panic mid-render.
- [ ] Verified after Ctrl-C in raw mode.
- [ ] Verified after SIGTERM.
- [ ] Verified after a failed alt-screen entry.
- [ ] Verified after suspend/resume: screen redrawn, data refreshed.
- [ ] Verified after a child editor returns: full redraw plus reload.
- [ ] Cursor visible and shape default after exit.
- [ ] No mouse sequences when clicking in the shell afterwards.
- [ ] No `^[[200~` when pasting into the shell afterwards.
- [ ] Shell prompt not colored/dim after exit.
- [ ] Scrollback intact after exit (alt screen left).
- [ ] Progress bar cleared from the tab (`OSC 9;4;0`).
- [ ] Window title restored or cleared.
