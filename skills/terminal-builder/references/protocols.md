# Protocols and Escape Sequences

The byte-level catalog. Use a library where one exists; use this file to know what the library is doing, to verify behavior, and for the cases libraries don't cover.

## Standards lineage

Six layers, each adding detection burden:

1. **Baseline** — printable text, CR, LF, BS, TAB. Works everywhere, always.
2. **ECMA-48 / ISO 6429 / ANSI** — CSI controls, SGR attributes.
3. **DEC VT lineage** — cursor movement, private modes, device status, application keypad.
4. **xterm conventions** — alternate screen, mouse modes, focus events, bracketed paste, OSC extensions.
5. **Modern emulator extensions** — Kitty keyboard/graphics, iTerm2 images, sixel, OSC 8, OSC 52, theme queries, synchronized output, grapheme width.
6. **Platform host** — Windows VT/ConPTY, tmux/screen/Zellij filtering, SSH latency.

The deeper the layer, the more you need detection, fallback, and cleanup. Layer 1 is the only layer you may assume.

## Sequence introducers

| Name | 7-bit | 8-bit C1 | Terminates with | Use |
|---|---|---|---|---|
| `ESC` | `0x1b` | — | — | prefix |
| `CSI` | `ESC [` | `0x9b` | final byte `@`–`~` | cursor, erase, SGR, modes, reports |
| `OSC` | `ESC ]` | `0x9d` | `BEL` or `ST` | title, hyperlinks, clipboard, palette |
| `DCS` | `ESC P` | `0x90` | `ST` only | sixel, tmux passthrough |
| `APC` | `ESC _` | `0x9f` | `ST` only | Kitty graphics |
| `PM` | `ESC ^` | `0x9e` | `ST` only | rarely used |
| `ST` | `ESC \` | `0x9c` | — | string terminator |

**Emit the 7-bit forms.** Many terminals accept 8-bit C1, but UTF-8 byte streams, log processors, PTYs, and security filters assume `ESC`-prefixed. For OSC 8 and any structured payload, terminate with `ST` — BEL can appear inside payloads and is ambiguous, and modern terminals accept both.

## CSI — cursor, erase, position

| Intent | Sequence | Notes |
|---|---|---|
| Move to row;col | `CSI r ; c H` or `CSI r;c f` | 1-based |
| Relative move | `CSI n A\|B\|C\|D` | up/down/right/left |
| Column absolute | `CSI n G` | |
| Clear screen | `CSI 2 J` | does not clear scrollback |
| Clear scrollback | `CSI 3 J` | user-hostile outside full-screen apps |
| Clear line | `CSI 0 K` / `1 K` / `2 K` | pair with `\r` for inline progress |
| Insert/delete lines | `CSI n L` / `CSI n M` | |
| Scroll region | `CSI top ; bottom r` | **must reset with `CSI r`** |
| Save/restore cursor | `ESC 7` / `ESC 8` | `CSI ?1049h` includes this |
| Report position | `CSI 6 n` → `CSI r;c R` | bound the wait |
| Device attributes | `CSI c` → `CSI ? ... c` | fingerprinting is unreliable; don't block on it |
| DECRQM (query mode) | `CSI ? mode $ p` → `CSI ? mode ; state $ y` | state 1 = set, 2 = reset, 0 = unrecognized |

`CSI 3 J` plus `CSI 2 J` clears scrollback and screen. Do that only in a full-screen app that owns the screen, and ideally never — users value their scrollback.

## SGR — attributes and color

| Intent | SGR |
|---|---|
| Reset all | `0` |
| Bold | `1` · Faint/dim `2` · Normal intensity `22` |
| Italic | `3` · Italic off `23` |
| Underline | `4` · Double underline `21` · Off `24` |
| Blink | `5` (avoid) · Off `25` |
| Reverse | `7` · Off `27` |
| Conceal | `8` · Off `28` |
| Strikethrough | `9` · Off `29` |
| Foreground | `30–37` (normal), `90–97` (bright) |
| Background | `40–47`, `100–107` |
| FG default | `39` |
| BG default | `49` |
| 256 color | `38;5;n` fg, `48;5;n` bg — 16–231 color cube, 232–255 grayscale |
| Truecolor | `38;2;R;G;B` fg, `48;2;R;G;B` bg |
| Underline color | `58;5;n` / `58;2;R;G;B` · off `59` |

**Reset gotchas that cause real bugs:**

- `22` turns off bold *and* faint. There is no portable bold-only off.
- If you nest styles, `0` kills the parent. Either emit `22`/`39`/`49` surgically, or emit `0` and reapply the full parent style at every boundary. The second is simpler and safer; do that unless you're writing a cell renderer that knows the parent.
- Reset at the end of every frame and on every exit path. A missing `CSI 0 m` leaves the user's shell prompt colored, which reads as "your tool broke my terminal."

```text
render(style, text): SGR(style) + sanitize(text) + SGR(reset or parent-reapply)
```

## DEC private modes

Set with `CSI ? n h`, reset with `CSI ? n l`.

| Mode | Purpose | Notes |
|---|---|---|
| `?1` | application cursor keys | changes arrow encoding; let the framework own it |
| `?7` | autowrap | rarely touch |
| `?25` | cursor visible | hide only while drawing; **always restore** |
| `?47` | legacy alt screen | historical; don't use in new code |
| `?1000` | mouse: clicks | |
| `?1002` | mouse: press/release/drag | |
| `?1003` | mouse: every motion | very noisy; avoid |
| `?1004` | focus in/out | `CSI I` / `CSI O` events |
| `?1005` | UTF-8 mouse coords | deprecated; use 1006 |
| `?1006` | SGR mouse encoding | **pair with 1000/1002/1003**; reports releases and columns past 223 |
| `?1015` | URXVT mouse | legacy |
| `?1047` | alt screen, no cursor save | |
| `?1048` | save/restore cursor only | not a buffer |
| `?1049` | alt screen **with** cursor save | **preferred full-screen sequence** |
| `?2004` | bracketed paste | |
| `?2026` | synchronized output | see below |
| `?2027` | grapheme-cluster width | see below |
| `?2031` | dark/light theme change reports | |

Enable the *smallest* mouse mode the UI needs. `1003` fires on every pointer move and will dominate your input queue on a trackpad. `crossterm`'s `EnableMouseCapture` turns on 1000+1002+1003+1006 at once — over-broad if you only need clicks.

## OSC families

| OSC | Form | Use | Posture |
|---|---|---|---|
| `0` | `OSC 0 ; title ST` | icon + window title | sanitize; restore or clear on exit |
| `2` | `OSC 2 ; title ST` | window title | same |
| `4` | `OSC 4 ; idx ; spec ST` | change palette entry | restore before exit |
| `8` | `OSC 8 ; params ; uri ST` … `OSC 8 ; ; ST` | hyperlink | show the URI somewhere; sanitize label |
| `9` | `OSC 9 ; message ST` | desktop notification | see naming trap below |
| `9;4` | `OSC 9 ; 4 ; state ; pct ST` | tab/taskbar progress | state 0 clears |
| `10`/`11`/`12` | `OSC 11 ; ? ST` → `rgb:rrrr/gggg/bbbb` | fg / bg / cursor query | bounded; may never answer |
| `52` | `OSC 52 ; c ; base64 ST` | system clipboard | write-only, best-effort, user-initiated |
| `133` | `OSC 133 ; A/B/C/D;exit ST` | shell prompt marks | REPLs only, not full-screen TUIs |
| `777` | `OSC 777 ; notify ; title ; body ST` | notification with title | where supported |
| `7501` | program status | Bubble Tea v2 view status | optional |

**OSC 9 naming trap.** `OSC 9 ; n ; …` where `n` is a digit is ConEmu's command namespace, parsed by Windows Terminal, Ghostty, and tmux 3.7+. A notification whose text begins `3;` becomes a command or is dropped. Always prefix the text (`build: 3 tests failed`) or use OSC 777.

**OSC 52 limits.** Practical ceiling comes from xterm/hterm's 100,000-byte maximum sequence length, ≈74,994 decoded bytes. Older kitty builds capped far lower. Keep payloads to tens of KB or chunk. Reads are the dangerous half; most terminals prompt or refuse. Treat writes as best-effort and always ship a local fallback.

## Modern protocols

### Synchronized output (mode 2026)

Wrap each frame in `CSI ? 2026 h` … `CSI ? 2026 l` so the terminal paints it atomically instead of tearing mid-redraw.

- Detect with DECRQM: `CSI ? 2026 $ p`.
- **Always** send the end sequence, error paths included. A terminal that never gets `l` releases the stuck frame only after its own timeout: 150 ms in Alacritty, 1 s in Ghostty, 2 s in kitty. That is a visibly frozen UI.
- Supported by kitty, WezTerm, foot, Alacritty, Ghostty, iTerm2, Windows Terminal 1.23.20211+, tmux 3.7+.
- An enhancement, never a prerequisite. Without it: write each frame in one `write()`, send only changed cells, and hide the cursor while drawing.

The practical rule for when to even ask: query only when you have evidence you're talking to a modern emulator. Bubble Tea's rule is a good one — query when there's no `TERM_PROGRAM` and no `SSH_TTY` (bare terminal), or `WT_SESSION` is set, or `TERM_PROGRAM` is set to something other than Apple Terminal and not over SSH, or `TERM` contains `ghostty`, `wezterm`, `alacritty`, `kitty`, or `rio`.

### Grapheme-cluster width (mode 2027)

With 2027 on, the terminal sizes cells by grapheme cluster, so a family emoji or a combining sequence occupies the width your measurement said it does. This eliminates the app/terminal disagreement that breaks aligned tables.

- Detect alongside 2026; same SSH caution.
- When supported, switch your width method to grapheme-cluster measurement (Bubble Tea: `ansi.GraphemeWidth`) rather than per-rune wcwidth.
- Where off — which is most places — app and terminal can still disagree. kitty segments graphemes without implementing 2027. Test emoji-heavy rows on the terminals you claim to support.

### Kitty keyboard protocol

- Push: `CSI > flags u`. Pop: `CSI < u`. Query: `CSI ? u`.
- Flag 1 ("disambiguate") makes Shift+Enter, Ctrl+Enter, Ctrl+Tab, and Ctrl+I distinct from their legacy twins, and sends a lonely Esc as its own code so you stop guessing whether it starts an Alt sequence.
- Flag 2 adds key-release events. Flag 4 adds alternate keys; 8 adds all keys as escape codes; 16 adds associated text.
- Supported: kitty, foot, Alacritty 0.13+, Ghostty, Windows Terminal 1.25+, WezTerm (with `enable_kitty_keyboard`), and Bubble Tea v2 sends it.
- **tmux does not forward it with `extended-keys` off (the default).** Every action still needs a legacy binding.

xterm's `modifyOtherKeys` (`CSI > 4 ; 2 m`) covers a subset of the same keys and is the fallback when KKP is unavailable.

### Cursor shape (DECSCUSR)

`CSI n SP q`: 0 default, 1 blinking block, 2 steady block, 3 blinking underline, 4 steady underline, 5 blinking bar, 6 steady bar.

Windows Terminal, foot, and Ghostty read 0 as the user's configured cursor; xterm reads it as a blinking block, and only patch 411+ restores the user's choice with `CSI 7 SP q`. The current shape **cannot be queried**, so it cannot be saved. Reset to `CSI 0 SP q` on exit anyway — it is better than leaving a bar over the user's shell.

Pair shape with mode in modal editors: block in NORMAL, bar in INSERT. Ratatui's `restore()` does not touch shape; if you set one, you reset it.

### Window title

Set only when it helps: open file, remote host, long-running task.

- Push the old title: `CSI 22 ; 0 t`. Pop: `CSI 23 ; 0 t`.
- xterm, kitty, foot, iTerm2, Alacritty, and tmux keep that stack. WezTerm, Ghostty, and Windows Terminal ignore it, so the user's title is lost there. When in doubt, restore-or-clear on exit.

### Progress (OSC 9;4)

`OSC 9 ; 4 ; state ; percent ST` where state is 0 remove, 1 normal, 2 error, 3 indeterminate, 4 paused. Windows Terminal, Ghostty 1.2+, kitty, iTerm2, tmux 3.7+.

A terminal that only knows OSC 9 notifications may pop it as a notification. Send where supported and clear with state 0 on **every** exit path — a stale progress bar in the user's taskbar outlives your process.

### Shell integration (OSC 133)

`A` prompt start, `B` input start, `C` output start, `D;exit-code` command end; `aid=` when nested in a marking shell. A REPL should mark its prompts. A full-screen TUI should not — it paints the whole screen anyway.

### Dark/light theme changes (mode 2031)

After `CSI ? 2031 h` the terminal reports a switch as `CSI ? 997 ; 1 n` (dark) or `CSI ? 997 ; 2 n` (light); `CSI ? 996 n` asks for current.

kitty 0.38.1+, Ghostty, foot 1.23+, iTerm2 3.7+. WezTerm does not. tmux 3.8 forwards the outer terminal's theme.

Probe with DECRQM first, re-query OSC 11 when a report arrives instead of trusting the report alone (Neovim and lazygit both do this), and turn the mode off before handing the terminal to a child process.

## Graphics

| Protocol | Sequence | Reach |
|---|---|---|
| sixel | `DCS q … ST` | xterm with sixel, foot, WezTerm, mlterm, Windows Terminal 1.22+ |
| Kitty graphics | `APC G … ST` | kitty, Ghostty, WezTerm |
| iTerm2 images | `OSC 1337 ; File=… ST` | iTerm2, WezTerm |
| Unicode blocks | `▀▄█` half-blocks | everywhere |

Graphics are fragmentation incarnate. Never core UI. Provide a text summary, or Unicode block art, or nothing. Test inside tmux — most need DCS passthrough and most passthrough is off by default.

## Multiplexer passthrough

tmux wraps an inner escape sequence in a DCS with every inner `ESC` doubled:

```text
ESC P tmux ; <inner with ESC doubled> ESC \
```

Example, OSC 52 through tmux:

```text
ESC P tmux ; ESC ESC ] 52 ; c ; BASE64 ESC ESC \ ESC \
```

Requirements: `allow-passthrough on` (off by default), and for many features a terminfo entry or DA reply so tmux knows the outer terminal supports it.

**Do not hand-roll this.** Use a library that understands passthrough, and if you must, unit-test the exact bytes. Always provide `--clipboard=never` and `--no-passthrough`.

What tmux answers or forwards itself (so passthrough is unnecessary): synchronized output and progress (3.7+), hyperlinks (3.4+), clipboard via `set-clipboard`, focus reports with `focus-events on`, extended keys with `extended-keys`, theme changes (3.8). What needs passthrough: notifications, image protocols.

## Support matrix (2026)

| Feature | kitty | WezTerm | foot | Alacritty | Ghostty | iTerm2 | WinTerm | tmux | screen |
|---|---|---|---|---|---|---|---|---|---|
| Truecolor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 3.6+ | 5.0+ w/ opt |
| OSC 8 | ✓ | ✓ | ✓ | 0.11+ | ✓ | ✓ | 1.4+ | 3.4+ | ✗ |
| OSC 52 write | ✓ (prompt) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `set-clipboard` | varies |
| OSC 9 notify | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | 3.3+ passthrough | ✗ |
| OSC 9;4 progress | ✓ | ✗ | ✗ | ✗ | 1.2+ | ✓ | ✓ | 3.7+ | ✗ |
| Mode 2026 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | 1.23+ | 3.7+ | ✗ |
| Mode 2027 | ✓ | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Kitty keyboard | ✓ | opt-in | ✓ | 0.13+ | ✓ | ✗ | 1.25+ | `extended-keys` | ✗ |
| Focus events | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | `focus-events` | ✗ |
| Sixel | 0.43+ | ✓ | ✓ | ✗ | ✓ | ✗ | 1.22+ | passthrough | ✗ |
| Kitty graphics | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | passthrough | ✗ |

Treat this table as a starting hypothesis, not a contract. Version numbers move; vendors regress; user configuration changes everything. Detect, don't assume.

## Recovery

When the terminal is already broken, this sequence restores the common cases:

```sh
stty sane
reset
printf '\033[0m\033[?25h\033[r\033[?1049l\033[?1000l\033[?1002l\033[?1003l\033[?1006l\033[?2004l\033[?1004l\033[?2026l'
```

That resets SGR, shows the cursor, resets the scroll region, leaves the alt screen, disables all mouse modes, bracketed paste, focus reporting, and synchronized output. Every one of those is a mode some terminal program forgot to turn off.

Put the same sequence, minus the `stty`/`reset` calls, in your program's own panic path so a crash doesn't require the user to know it.
