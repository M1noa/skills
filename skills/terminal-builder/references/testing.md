# Testing

Terminal UIs are easy to test badly and hard to test well. The easy tests are worthless: call `render()` on a fixture and grep for a string. The valuable ones reproduce what the terminal actually does to your bytes — cursor motion, mode changes, resize, the teardown that has to happen when the process dies mid-draw.

The goal is a suite that catches the four things that actually break TUIs: a leaked mode, a wrong width, an unclosed lifecycle, and a frame storm. Everything else is nice to have.

## The pyramid, adjusted

The usual pyramid does not quite fit, because the interesting unit here is bytes.

| Layer | What it asserts | Speed | Count |
|---|---|---|---|
| Width and truncation vectors | Cell counts, grapheme clusters, width properties | microseconds | 50–200 |
| Render purity | Same state + same size → identical bytes | microseconds | as many states as you have |
| Golden frames | Full-screen bytes for a representative state at a fixed size | milliseconds | 20–60 |
| Interaction | Key/key sequence → state transition, no terminal | microseconds | per binding |
| PTY integration | Real process, real pseudo-terminal, real bytes on the wire | 100 ms–2 s | 10–20 |
| Manual matrix | Real terminals, real fonts, real multiplexers | minutes | before release |

Push everything down. A bug that a golden frame catches is a bug a PTY test would have caught slower.

## Width and truncation

These are pure functions, so test them like it. `text.md` has the vectors; the properties are the part people skip:

```go
func TestWidthProperties(t *testing.T) {
    inputs := []string{
        "abc", "日本語", "❤️", "❤", "👍🏽", "👨‍👩‍👧‍👦",
        "🇺🇸", "#️⃣", "\x1b[31mred\x1b[0m",
    }
    for _, s := range inputs {
        for n := 0; n <= 40; n++ {
            got := clip(s, n)
            if w := ansi.StringWidth(got); w > n {
                t.Errorf("clip(%q, %d) produced %d cells", s, n, w)
            }
            if clip(got, n) != got {
                t.Errorf("clip is not idempotent on %q at %d", s, n)
            }
        }
    }
}
```

Two properties, fuzzed over every width: output never exceeds the budget, and clipping is idempotent. Run these against the fuzzer with real-world strings (CJK, emoji, RTL, invalid UTF-8) and width bugs stop shipping.

## Golden frames

Store the full byte stream for a fixed state at a fixed size. Compare exactly.

```text
testdata/
  status_80x24.golden
  status_120x40.golden
  status_60x20.golden
  status_120x40_ascii.golden
  status_120x40_nocolor.golden
  error_empty_80x24.golden
```

Rules that keep golden tests useful instead of cargo cult:

- **Golden frames are `render(state, size)`, never a live process.** That's the payoff of the purity contract (`rendering.md`). No PTY, no sleeps, no flake.
- **One golden per interesting state per band**, not per combination. Three widths across four states beats thirty-two combinations nobody reads.
- **Normalize nothing inside the frame.** If the frame needs normalizing, the renderer is not pure. Fix that.
- **Review golden diffs by eye, then regenerate.** A golden that updates itself in CI is a test that asserts nothing.
- **Update with an explicit flag** (`-update`) and require the diff in review. It is the only moment anyone actually looks at the output.
- **Include one `--ascii` and one `NO_COLOR` golden per screen.** These are the ones that rot.

When a golden fails and you can't see why, dump both sides through a formatter that shows escapes visibly (`cat -v`, or your own `esc.dump`) before diffing. `\x1b[31m` versus `\x1b[38;5;1m` is invisible to a normal diff viewer and is exactly the bug.

## Interaction tests

Model state as a pure function of (state, event) and test the table:

```go
type step struct {
    in   []key.Msg      // or tea.KeyMsg
    want state
}

func TestBindings(t *testing.T) {
    cases := []struct{ name string; steps []step }{
        {"q quits from list", []step{{in: keys("q"), want: quit}}},
        {"esc from detail returns to list", ...},
        {"ctrl+c quits from anywhere", ...},
        {"esc five times reaches main", ...},   // accessibility.md
        {"tab never escapes the modal", ...},
    }
}
```

The `ctrl+c` and `esc five times` cases are cheap and catch real regressions when someone adds a modal.

## PTY harness

Sooner or later you have to run the actual binary. A PTY harness gives you the real thing: a pseudo-terminal, a real size, controlled keystrokes, and the raw bytes your program wrote.

Three tools, in increasing order of effort:

| Tool | Use |
|---|---|
| `creack/pty` (Go) | In-process PTY, spawn the built binary, feed keystrokes, capture output |
| `pexpect` (Python) | Cross-language, good for non-Go programs, easy to script |
| `asciinema` + playback | Record a session, replay it, assert on the byte log |

A minimal Go harness:

```go
func run(t *testing.T, size [2]uint16, input string, args ...string) []byte {
    cmd := exec.Command(bin, args...)
    ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{Rows: size[1], Cols: size[0]})
    if err != nil { t.Fatal(err) }
    defer ptmx.Close()

    var out bytes.Buffer
    go func() { _, _ = io.Copy(&out, ptmx) }()

    time.Sleep(150 * time.Millisecond)   // let first frame land
    _, _ = ptmx.Write([]byte(input))
    _ = cmd.Wait()
    return out.Bytes()
}
```

Assertions the harness can make, ranked by value:

1. **Mode balance.** Every `\x1b[?1049h` has a matching `\x1b[?1049l`. Same for `?25l`/`?25h`, `?1000h`/`?1000l`, `?2004h`/`?2004l`, `?2026h`/`?2026l`. This is the single highest-value PTY assertion — it catches the leaked-mode bug that ruins the user's terminal.
2. **Exit code.** Clean quit returns 0. Ctrl+C in a TUI returns 0 (it's a keypress, not a signal). `cli-contract.md` → *Exit codes*.
3. **Terminal state restored.** After exit, the slave is back in cooked mode. Check by writing a line afterward and confirming echo.
4. **Frame count for a scripted interaction.** Open, press a key that changes one row, quit. Count the frames emitted. Twelve frames is eleven bugs (`rendering.md` → *Pacing and backpressure*).
5. **No full clears after the first.** Count `\x1b[2J`. One at startup on the alt screen, zero on resize, zero between updates.
6. **Resize.** Send `TIOCSWINSZ` mid-session and check the output repaints fully and correctly at the new size.

Do **not** assert on exact frame bytes in the PTY layer. That's what goldens are for. The PTY asserts on *behavior*: balance, counts, exit codes, ordering.

## Death tests

The tests nobody writes, that define whether people trust your program.

| Scenario | Assertion |
|---|---|
| Panic mid-render | Terminal restored. Modes off, cursor visible, cooked mode back |
| SIGINT during a write | Exits, terminal restored, exit 130 or 0 by contract |
| SIGTERM | Same cleanup path, exit 143 |
| Ctrl+Z then `fg` | Screen redrawn correctly, raw mode reapplied |
| SIGWINCH storm (50 rapid resizes) | No corruption, no leak, final frame correct |
| `SIGKILL` | Cannot be handled — verify the fallback is not needed on this path, and document it (`lifecycle.md`) |
| stdout closed (`| head -1`) | Exit 0 or 141, no panic, no partial write |
| Terminal resized to 3×3 | Truthful "too small" state, no panic, no garbage |

Go's `defer` does not run on `os.Exit`. If any code path calls `os.Exit` outside `main`'s final line, the guard is bypassed. Test that specifically.

## Verification matrix

The floor. Everything here must be green, on every change, before release. `SKILL.md` calls this out as the build gate.

| Dimension | Values to test | Where |
|---|---|---|
| Color | truecolor / ansi256 / ansi16 / none / `NO_COLOR=1` | golden + PTY |
| Unicode | full graphemes / basic / `--ascii` | golden + width vectors |
| Width band | wide / standard / narrow / floor / 3 columns | golden + PTY resize |
| Height | 40 / 24 / 10 / 3 rows | golden + PTY |
| Input | cooked / raw / enhanced (Kitty) | interaction + PTY |
| Lifecycle | clean exit / panic / SIGINT / SIGTERM / Ctrl+Z / `SIGKILL` | death tests |
| Stream | TTY / pipe / `> /dev/null` / closed stdout | PTY + unit |
| Terminal | Terminal.app / iTerm2 / Kitty / WezTerm / Windows Terminal / tmux / SSH | manual |
| Plain mode | `--plain`, `--no-tui`, `TERM=dumb`, piped | golden |
| Framerate | idle = 0 frames; scripted interaction ≤ expected count | PTY |

The cross-product is too large to test exhaustively. Test the corners: `{ascii, 60 cols, 10 rows}` and `{truecolor, 200 cols, 50 rows}`. Corners break; middles rarely do.

**Run the plain-mode and `--ascii` golden tests in CI specifically.** They are the two that rot silently, because no developer runs them locally (`accessibility.md` → *Plain mode contract*).

## CI matrix

CI has no terminal. That is the point — it is the harshest `TERM=dumb`/pipe environment you will meet, and your program must not misbehave there.

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
  unit:
    runs-on: ubuntu-latest       # width, render purity, interaction
  golden:
    runs-on: ubuntu-latest       # golden frames, includes ascii + nocolor
  pty-linux:
    runs-on: ubuntu-latest       # full PTY suite
  pty-macos:
    runs-on: macos-latest        # differs: /dev/ptmx semantics, no ConPTY
  build:
    strategy:
      matrix:
        include:
          - { os: ubuntu-latest,  arch: amd64 }
          - { os: ubuntu-latest,  arch: arm64 }
          - { os: macos-latest,   arch: arm64 }
          - { os: windows-latest, arch: amd64 }   # ConPTY: no SIGWINCH the same way
```

Gotchas:

- **Windows has no `SIGWINCH`, no `SIGTSTP`, no `SIGCONT`.** Guard the tests, don't skip the platform. `lifecycle.md`.
- **PTY tests need a real `/dev/ptmx`.** Available on Linux and macOS runners; on Windows use `winpty`/ConPTY or skip with a documented reason, never silently.
- **Terminfo varies by runner image.** `TERM=xterm-256color` is present nearly everywhere; `TERM=screen-256color`, `xterm-kitty`, `xterm-direct` are not. Set them explicitly in the test environment rather than assuming.
- **Locale matters.** `LC_ALL=C` changes width behavior in your runtime and in `wcwidth`. Test both `C` and `en_US.UTF-8`.
- **Timeouts.** A TUI test that hangs must fail in seconds, not at the job limit. Every PTY test gets a deadline and kills its child.
- **No golden regeneration in CI.** `-update` is a local-only flag; make CI fail if goldens change.

## Troubleshooting

When the screen is wrong, work backwards from bytes to model to state. The frame is the ground truth.

| Symptom | First hypothesis | Check |
|---|---|---|
| Garbled geometry, nothing lines up | Writing directly to stdout while the framework also draws | Two writers; see `rendering.md` |
| Duplicate screens stacked down the page | Alt screen never entered, or `\n` scrolling the normal buffer | Look for `?1049h` in the stream |
| Everything is one long line | Missing cursor addressing; you're emitting text, not frames | Is `\x1b[H` or CUP present? |
| Flicker on every keystroke | `CSI 2J` per frame, or per-line writes | Count clears and writes in the log |
| Flicker only over SSH | Frame pacing too aggressive, or no synchronized output | `rendering.md` → *Frame budgets* |
| Wrong width for CJK or emoji | Width measured in runes or bytes, not cells | `text.md` vectors |
| Emoji render as `??` or double-width | Terminal locale is not UTF-8, or VS16 handling | `LC_ALL`, `text.md` |
| Colors wrong or invisible in one terminal | Hardcoded hex against an unknown background | `accessibility.md` → *Contrast* |
| Boxes render as `?` | Nerd Font glyphs shipped unconditionally | `design.md` → *Icons* |
| Terminal left in raw mode after a crash | Cleanup only on the happy path | Death tests |
| Mouse works, then scrolls the whole terminal | Mouse mode not exited, or wheel not handled | `input.md` |
| Keys arrive as garbage over SSH | Terminal reported enhanced keyboard support it doesn't have | `protocols.md` |
| Resize leaves a torn screen | Diffing across a resize | `rendering.md` → *Diffing* |

Record the stream before theorizing. `script -q out.txt ./tool` on macOS/Linux, or `asciinema rec` for something with timing. Then read the escape sequences with `cat -v` or a small decoder. A single `\x1b[2J` in the wrong place explains more than an hour of reading the renderer.

## Debugging the program itself

The terminal is a bad debugger — `fmt.Println` corrupts the frame and `dlv` in the same PTY fights for the screen.

- **Send debug output elsewhere.** A log file (`--debug-log /tmp/tool.log`), or a separate PTY via a second tmux pane. Never stdout while the alt screen is active.
- **`--debug-frames`** prints one line per frame: index, byte count, write duration, and state summary (`rendering.md`). This catches pacing and repaint bugs that no breakpoint will.
- **Headless mode for the debugger.** A `--plain` path or a `render-to-file` flag lets `dlv`/`gdb` run without a TUI at all. Two lines of code, enormous debugging payoff.
- **Reproduce at a fixed size.** `stty rows 24 cols 80` in the test terminal, or the PTY harness. A bug that only happens at 137 columns is a layout bug, and you want it deterministic.
- **Bisect the state, not the code.** Dump the model as JSON on a key binding, then render that JSON in a golden test. State bugs and render bugs need different fixes.

## Checklist

- [ ] Width and truncation property tests, fuzzed, including invalid UTF-8
- [ ] Render is pure and tested as such: same state + size, same bytes
- [ ] Golden frames for each screen at three bands, plus `--ascii` and `NO_COLOR`
- [ ] Golden diffs require human review; `-update` is local only and CI rejects changes
- [ ] Interaction table covers `ctrl+c`, `esc`-to-root, and modal containment
- [ ] PTY harness asserts mode balance, exit codes, restored terminal state
- [ ] PTY asserts frame count for a scripted interaction and zero on idle
- [ ] PTY asserts full repaint on resize and no clear-after-first
- [ ] Death tests: panic, SIGINT, SIGTERM, Ctrl+Z/`fg`, closed stdout, 3×3 resize
- [ ] Verification matrix corners green, not just the happy middle
- [ ] Plain mode and `--ascii` goldens run in CI specifically
- [ ] CI covers Linux, macOS, Windows; PTY skips documented where impossible
- [ ] Every PTY test has a deadline and kills its child
- [ ] A recorded stream exists for the last three nontrivial rendering bugs
