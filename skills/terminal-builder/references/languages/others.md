# Other languages

The neutral references apply unchanged. What changes per language is who owns the terminal, what cleanup they forget, and how they measure width. Those three are the whole file.

## Picking, per language

| Language | Default | Retained widgets | Prompts only | Line-mode UI |
|---|---|---|---|---|
| Python | Textual | Textual (`DataTable`, `Tree`) | questionary / prompt_toolkit | Rich |
| TypeScript | Ink | OpenTUI | Clack | ora + cli-table |
| Rust | Ratatui + Crossterm | Ratatui | inquire | — |
| C# | Spectre.Console | Terminal.Gui | Spectre `Prompt` | Spectre |
| C | ncursesw | ncursesw | — | notcurses `ncdirect` |

Two rules that survive translation, restated because they are the ones people break:

- **One owner of stdin.** Two libraries reading stdin in one process is a bug with no clean fix. Pick the highest-level one and let it own input.
- **The framework owns the modes it can restore.** Anything you enable yourself is yours to close on panic, signal, and `exit` (`lifecycle.md` → *Teardown order*).

## Python

### Textual

Reactive widgets, CSS-like styling, async loop. The closest thing in this list to a real app framework.

```python
from textual.app import App, ComposeResult
from textual.widgets import DataTable, Header, Footer, Input
from textual.binding import Binding

class Deploy(App):
    CSS_PATH = "deploy.tcss"
    BINDINGS = [Binding("q", "quit", "Quit"), Binding("/", "focus('#filter')", "Filter")]

    def compose(self) -> ComposeResult:
        yield Header()
        yield Input(placeholder="filter", id="filter")
        yield DataTable(id="rows")
        yield Footer()

    def on_mount(self) -> None:
        t = self.query_one(DataTable)
        t.add_columns("env", "status", "age")
        self.set_interval(2.0, self.refresh_rows)   # bounded cadence, not 60fps

    async def refresh_rows(self) -> None:
        rows = await asyncio.to_thread(fetch_rows)  # never block the loop
        t = self.query_one(DataTable)
        t.clear()
        for r in rows:
            t.add_row(*r)

Deploy().run()
```

- **Blocking the event loop freezes the screen.** `requests.get`, `subprocess.run`, a big file read: all of it goes through `asyncio.to_thread`, `@work(thread=True)`, or an async client. This is `rendering.md`'s "drop, don't queue" failure mode with a Python accent.
- **`set_interval` is your frame clock**, so pick the interval from the data, not from a refresh reflex.
- **Textual restores the terminal** on exception, on `Ctrl+C`, and on `app.exit()`, including raw mode, alt screen and mouse. Unlike curses, you do not need `atexit`.
- **Two renderers, one process**: Textual's own driver plus any `print()` you leave in. `print` inside a Textual app is swallowed or tears the frame. Use `self.log` (goes to the devtools console) or a `RichLog` widget.
- **Width is handled**, including CJK and emoji, as long as you set content through the widget APIs rather than writing escapes into a string.
- **Testing**: `app.run_test()` gives a `Pilot` in headless mode: `await pilot.press("q")`, `await pilot.click("#rows")`, then assert on widget state or `app.export_screenshot()` (SVG). That is the golden-frame layer from `testing.md` without a PTY.

### Rich

Line-mode and live regions. Not a TUI framework, and shouldn't be pushed into being one.

```python
from rich.console import Console
from rich.live import Live
from rich.table import Table

console = Console(stderr=True)          # keep stdout clean for pipes

with Live(render(state), console=console, refresh_per_second=8, transient=False) as live:
    for msg in stream:
        state = reduce(state, msg)
        live.update(render(state))
```

- **`Console` binds its stream at construction.** Pass `file=` explicitly and never rely on the default `sys.stdout` in code you want to test.
- **`console.is_terminal` is your capability gate.** It respects `TERM=dumb`, `NO_COLOR`, `FORCE_COLOR` and redirection. Do not re-implement that check (`capability-ladder.md`).
- **Markup is an injection surface.** `Text.from_markup` and `console.print("[bold]…")` interpret `[...]`. Untrusted data must go through `rich.markup.escape` or, better, be passed as a `Text` object. Same class as `security.md` → *Escape injection*: user content that reaches a markup parser reaches an interpreter.
- **Width helpers exist and are cell-accurate**: `rich.cells.cell_len`, `chop_cells`, `set_cell_size`. `len(s)` is not.
- **`Live(screen=True)`** takes the alt screen; that mode is restored by the context manager, so an exception inside the `with` still cleans up. An exception outside it does not.

### prompt_toolkit

Owns the terminal through its own input/output abstraction, which is exactly why it composes badly with everything else.

```python
from prompt_toolkit import PromptSession, patch_stdout

session = PromptSession()

with patch_stdout():                 # background prints won't corrupt the prompt
    answer = session.prompt("env> ", complete_while_typing=True)
```

- **`patch_stdout` is mandatory** if any thread prints. Without it, a log line lands mid-prompt and the cursor position is permanently wrong (`input.md` → *One owner for stdin*).
- **Never mix it with `input()`** or with Textual in the same process.
- **KeyBindings are global to the session** (`kb.add("c-c")`), and its paste handling is separate from bracketed paste. Check which one you enabled.

### curses (stdlib)

Only reach for it when you cannot add a dependency. `curses.wrapper` is the entire safety story:

```python
import curses, locale

def main(scr):
    locale.setlocale(locale.LC_ALL, "")      # before anything wide-glyph related
    curses.curs_set(0)
    scr.keypad(True)
    while True:
        scr.erase()
        scr.addstr(0, 0, "q to quit")
        scr.refresh()
        if scr.get_wch() == "q":
            break

curses.wrapper(main)
```

- **`wrapper` restores the terminal on exception and on `Ctrl+C`.** Calling `initscr()` yourself and skipping `endwin()` leaves the user's shell in raw mode, which is the single worst terminal bug you can ship.
- **`locale.setlocale(locale.LC_ALL, "")` must come before `initscr`** or wide characters raise or render as `?`. Also use `addwstr`/`get_wch`, not `addstr`/`getch`.
- **`get_wch` returns a str, `getch` returns ints**: mixing them gives you 3 keypresses where you typed 1 emoji.
- **Handle `KEY_RESIZE`** by calling `curses.update_lines_cols()` and recomputing layout. Layout is never assumed (`design.md` → *Responsive*).
- **Windows needs `windows-curses`**, which is a separate wheel with different behavior. If Windows matters, use Textual.
- **Width**: `curses` refuses to write past the window edge and returns `ERR`. That is a truncation signal, not a wrapping one, so wrap yourself using `wcwidth`.

Threading: curses is not thread-safe. One thread touches the screen; everyone else posts to a queue that the UI thread drains.

## TypeScript

### Ink

React components rendering to the terminal. Good when the team already thinks in React; the cost is React's scheduling in a frame loop.

```tsx
import { render, Box, Text, useInput, useApp, useStdout } from "ink";

function App({ rows }: { rows: Row[] }) {
  const { exit } = useApp();
  useInput((input, key) => { if (input === "q" || key.escape) exit(); });
  return (
    <Box flexDirection="column" height={process.stdout.rows ?? 24}>
      {rows.map((r) => (
        <Box key={r.id}><Text color={colorFor(r.status)}>{r.env}</Text></Box>
      ))}
    </Box>
  );
}

render(<App rows={rows} />, { patchConsole: true, exitOnCtrlC: true });
```

- **`patchConsole: true`** (the default) reroutes `console.log` above the UI. Turn it off and every stray log tears the frame. This is Ink's version of `tea.Println`.
- **Yoga measures layout, `string-width` measures cells.** Import `string-width` and `cli-truncate` rather than `s.length === width`.
- **Never unmount the component tree mid-write.** `exit()` inside a write callback aborts a partial frame.
- **Alt screen is manual**: write `\x1b[?1049h` and register the matching `\x1b[?1049l` in a signal handler and a `process.on("exit")`. Ink will not do it for you, and a crash will leave the user on an empty screen.
- **`useInput` only fires while a component is mounted**, so a spinner in a modal swallows keys from the parent. Read input in one place and pass handlers down.
- **`ink-testing-library`** for render assertions: `render(<App />)`, `lastFrame()`, `stdin.write()`. Deterministic output, no PTY, which is the golden layer.

### OpenTUI

Native-backed renderer (Zig core) with React and Solid bindings. Materially faster than Ink for large tables and gives real diffing. It is young and the API is still moving, so pin the version and read the changelog before upgrading; treat anything you read about it from memory as suspect.

### Clack

Blocking prompts, promise-based.

```ts
import * as p from "@clack/prompts";

p.intro("deploy");
const env = await p.select({ message: "environment", options: [
  { value: "staging", label: "staging" },
  { value: "prod", label: "prod", hint: "live traffic" },
]});
if (p.isCancel(env)) { p.cancel("aborted"); process.exit(0); }
```

- **`p.isCancel(value)` after every prompt.** The sentinel is a symbol, not an error, and unchecked it becomes a stringly-typed bug.
- **Cancel exits 0**, per `cli-contract.md` → *Exit codes*. A user pressing Ctrl+C on a question is not a failure.
- **Clack owns stdin while a prompt is open.** Don't run it under a spinner that also polls.

### Library notes

`blessed` and its forks are effectively unmaintained; don't start there. `string-width`, `cli-truncate`, `wrap-ansi` and `ansi-escapes` are the small primitives you actually need, and they agree with `text.md`. `ora` is a line-mode spinner and will fight any full-screen renderer.

## Rust

### Ratatui + Crossterm

Immediate mode: you get a frame every draw, draw the whole UI, the library diffs against its buffer. State lives in your structs, not in widgets.

```rust
use ratatui::{backend::CrosstermBackend, Terminal, Frame, layout::{Layout, Constraint},
              widgets::{Block, Paragraph}};

fn main() -> std::io::Result<()> {
    // ratatui 0.29: init/restore handle raw mode, alt screen, panic hook
    let mut terminal = ratatui::init();
    let res = run(&mut terminal);
    ratatui::restore();
    res
}

fn run(terminal: &mut Terminal<CrosstermBackend<std::io::Stdout>>) -> std::io::Result<()> {
    loop {
        terminal.draw(|f: &mut Frame| {
            let rows = Layout::vertical([Constraint::Min(1), Constraint::Length(1)]).split(f.area());
            f.render_widget(Paragraph::new("body").block(Block::bordered()), rows[0]);
            f.render_widget(Paragraph::new("status"), rows[1]);
        })?;
        if !crossterm::event::poll(std::time::Duration::from_millis(250))? { continue; }
        match crossterm::event::read()? {
            crossterm::event::Event::Key(k) if k.code == crossterm::event::KeyCode::Char('q') => return Ok(()),
            _ => {}
        }
    }
}
```

- **The panic hook is not optional.** On an older ratatui, or if you call `enable_raw_mode` yourself, register `std::panic::set_hook` that restores the terminal before the default hook prints the backtrace. Otherwise a panic writes a Rust backtrace into a raw-mode alt screen and the user has to `reset`.
- **`poll` is the frame clock.** No poll means a blocking read and no way to redraw on a timer. Unbounded redraw means 100% CPU. 100–250 ms is right for a monitor; 0 for a keystroke-driven form.
- **Diffs are automatic, output is not free.** A `Paragraph` of 100k lines re-wrapped each frame is slow even with diffing. Virtualize (`rendering.md`).
- **Scroll and selection live in `ListState`/`TableState`**, which you pass as `&mut`. Losing that struct across frames resets the user's position, which reads as "the app forgets where I was".
- **`Constraint::Min(1)` not `Length`** for the body. Fixed heights are how you get a zero-height pane on a 10-row terminal (`design.md` → *Responsive*).

### Crossterm

- **One owner.** Crossterm and Termion both read stdin; never link both.
- **Keyboard enhancement flags must be popped.** If you push disambiguate-escape-codes and exit without popping, the parent shell inherits the mode and misbehaves. `SupportsKeyboardEnhancementProtocol` tells you whether to bother (`protocols.md` → *Kitty keyboard protocol*).
- **`EnableBracketedPaste` / `EnableMouseCapture`** are push/pop pairs with the same obligation. Put them next to the guard, not scattered through `main`.
- **`terminal::size()` in cells**, and re-read on every `Event::Resize`. Don't cache it across events.

### Termion

Smaller, Unix-only, no Windows at all. Fine for a personal tool; wrong for anything distributed. It has no bracketed paste in its stable API, so pastes arrive as keystrokes and multi-line pastes execute. If paste matters, use Crossterm.

### Width in Rust

`unicode-width` (`s.width()`) for cells and `unicode-segmentation` for clusters. Note that `unicode-width` changed its emoji handling between 0.1 and 0.2: the same string measures differently depending on which version is in `Cargo.toml`, and alignment bugs that reproduce on one machine and not another are usually this. Pin it and test with `text.md`'s corpus.

## C# / .NET

### Spectre.Console

Line-mode, tables, live regions, prompts.

```csharp
using Spectre.Console;

var table = new Table().Border(TableBorder.None).AddColumn("env").AddColumn("status");
await AnsiConsole.Live(table)
    .AutoClear(false)
    .Overflow(VerticalOverflow.Ellipsis)
    .StartAsync(async ctx =>
    {
        await foreach (var row in stream)
        {
            table.AddRow(Markup.Escape(row.Env), Markup.Escape(row.Status));
            ctx.Refresh();
        }
    });
```

- **`Markup.Escape` on every untrusted value.** Spectre markup uses `[...]` and is interpreted; unescaped output is the same interpreter problem as Rich. `Text` objects skip markup parsing entirely and are the cheaper correct answer.
- **Take `IAnsiConsole` as a dependency**, not `AnsiConsole.Console`. `Spectre.Console.Testing.TestConsole` then gives you a string back in unit tests, which is the only way to make golden output work in .NET.
- **`Profile.Capabilities`** tells you whether color, unicode, interaction and links are available. That is your capability ladder for free; branch on it rather than on `Environment.OSVersion`.
- **`Live` restores the terminal through its own `IDisposable`.** Awaiting inside the callback without cancellation can hang the restore; pass a `CancellationToken`.

Terminal.Gui is the retained-widget option with a desktop-app feel. It is event-driven with `Application.Run`, mouse and real focus traversal. Heavier, and its styling is not Spectre's.

## C

### ncursesw

The only option that is guaranteed present on a Unix box, and the one that punishes mistakes hardest.

```c
#include <locale.h>
#include <ncurses.h>

int main(void) {
    setlocale(LC_ALL, "");            /* BEFORE initscr, or wide chars break */
    initscr();
    atexit((void (*)(void))endwin);   /* last line of defence */
    cbreak(); noecho();
    keypad(stdscr, TRUE);
    curs_set(0);

    wint_t ch;
    while (get_wch(&ch) != ERR && ch != L'q') {
        int rows, cols; getmaxyx(stdscr, rows, cols);
        erase(); mvaddwstr(0, 0, L"q to quit"); refresh();
    }
    return 0;
}
```

- **Link `ncursesw`, not `ncurses`.** The narrow build cannot render CJK or emoji, and the failure is not an error, it is `??`.
- **`setlocale` before `initscr`.** After is too late; the screens are sized with the wrong locale.
- **`get_wch`, `addwstr`, `mvaddwstr`.** Narrow variants truncate multibyte sequences in the middle of a codepoint.
- **`atexit(endwin)` plus a signal handler that calls `endwin()`** for SIGINT/SIGTERM/SIGHUP. `endwin` is not async-signal-safe, so set a flag and let the main loop exit cleanly; only call `endwin` in the handler as a last resort.
- **Never `printf` after `initscr`** without `endwin` first. Mixed stdio and curses output is the classic corruption.
- **`KEY_RESIZE`** arrives as a key. Handle it, then `refresh()`.
- **Windows is PDCurses, not ncurses**, with different color and mouse behavior. If you must ship both, test both or don't ship Windows.

### notcurses

Planes, truecolor, image protocols (sixel, Kitty graphics), and a line-mode `ncdirect` API that needs no full-screen setup. Choose it when you need graphics or per-cell blitting. It is a large dependency with a real learning curve: planes, z-order, and `ncplane_*` calls. `notcurses_stop` is the teardown; miss it and the same raw-mode disaster applies.

### Doing raw mode by hand

Only if the task is a few hundred lines and curses is overkill. Then `tcgetattr`, `cfmakeraw`, `tcsetattr`, and the restore path in a handler. You are now responsible for everything in `lifecycle.md` with no library help, including the case where your process is SIGKILLed and nothing can run.

## Cross-language pitfalls

| Symptom | Language | Cause |
|---|---|---|
| Shell in raw mode after exit | all | no `atexit`/panic-hook/`defer` restore |
| `??` instead of CJK | C | narrow ncurses, or `setlocale` after `initscr` |
| Emoji misalign, one platform only | Rust | `unicode-width` version drift |
| Cursor lands wrong after a log line | Python | missing `patch_stdout` |
| Keys stop working in a modal | TypeScript | `useInput` unmounted, or a second reader |
| Existing answer overwritten mid-prompt | any | two libraries reading stdin |
| Untrusted text renders as bold or as a link | Python/C# | markup interpreted instead of escaped |
| Blank terminal after a crash | TS/C | alt screen entered, restore only on happy path |
| 100% CPU on an idle screen | Rust/TS | redraw loop with no wait |
| Layout correct at 80, zero-height at 40 | any | fixed heights instead of minimums |

## Checklist

- [ ] One stdin reader in the process; the framework owns the modes it can restore
- [ ] Own-enabled modes closed on panic, signal, `exit`, and normal return
- [ ] Alt screen entered *and* restored by the same mechanism
- [ ] Width measured with the language's cell-accurate helper, never `len`
- [ ] Async work off the UI thread; no blocking call in a render path
- [ ] Markup-formatting libraries fed escaped or structured text, never raw user data
- [ ] Input cancellation exits 0; usage errors exit 2; failures 1; SIGINT 130
- [ ] Prompt-only surfaces use a prompt library, not a TUI framework
- [ ] A non-TTY path exists and is tested
- [ ] Headless test harness used for golden output; one real PTY test in CI
