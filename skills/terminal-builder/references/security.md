# Security

A terminal is an interpreter. It reads a byte stream and executes commands: move the cursor, change colors, retitle the window, read the clipboard, open a URL, write to scrollback. Your program prints untrusted text into that interpreter. If the text contains escape sequences, the terminal runs them.

This is not a theoretical class. It is the same bug as XSS with a different parser, and it ships constantly in CLIs that print file contents, log lines, git branch names, HTTP headers, or filenames.

## The threat model

| Source | Attacker controls | Reaches you as |
|---|---|---|
| Filenames on disk | Arbitrary bytes except `/` and NUL | Directory listings, `--diff`, tab completion |
| File contents | Arbitrary bytes | Editors, viewers, `cat`-alikes, diffs |
| Git data | Branch/tag/remote names, commit messages, paths | Log views, prompts, status lines |
| Network responses | Headers, JSON strings, error bodies | API clients, dashboards, monitors |
| Log files | Whatever was logged, including previously injected data | Log viewers — the classic second-order case |
| User input | Pasted text, typed text | Anywhere |
| Environment | `TERM`, `COLORTERM`, `LS_COLORS`, `PROMPT_COMMAND`-ish things | Startup, theming, capability detection |

The attacker does not need to run on your machine. A branch named `\x1b]52;c;BASE64\x07` is enough.

## Escape injection

The two injection paths:

1. **Rendered.** Untrusted bytes go to the screen. The terminal interprets them.
2. **Second-order.** Untrusted bytes get written to a log, then a human opens the log in a viewer that renders it. Same bug, delayed, and the log viewer is often a different program with weaker defenses.

Sanitize at the render boundary, once, for everything. Not at each call site — someone will forget.

### What must never pass through

| Byte / sequence | Why |
|---|---|
| `ESC` (0x1B) | Start of every sequence. The root of all of this |
| `C1` controls (0x80–0x9F) in their raw 8-bit form | Same as CSI/OSC/etc. without the `ESC` prefix. Frequently missed |
| `0x00`–`0x08`, `0x0B`, `0x0C`, `0x0E`–`0x1F` | C0 controls other than the ones below |
| `DEL` (0x7F) | Erases previous cell in some renderers |
| `\r` (0x0D) | Returns to column 0; overwrites text the user already read |
| `\b` (0x08) | Same class as `\r`, one cell at a time |
| `BEL` (0x07) | Audio, and terminates OSC |

Allowed through as-is: `\n` (with care — see below), `\t` (expand it yourself first), and everything ≥ 0x20 that isn't `ESC`/`DEL`.

`\n` is only safe when your renderer controls vertical position. In a full-screen app you place the cursor yourself, so a raw `\n` inside content should be converted to a wrapped row before it reaches the frame, not emitted. In line-oriented output a raw `\n` lets a filename inject a fake log line — a log-forging attack that makes an alert look like it came from a different host.

### The sanitizer

```go
// safe strips everything that can move the cursor, run a command, or lie.
// run this once, at the boundary where untrusted text enters the model.
func safe(s string) string {
    var b strings.Builder
    b.Grow(len(s))
    for _, r := range s {          // ranges decode UTF-8; invalid bytes become U+FFFD
        switch {
        case r == '\n', r == '\t':
            b.WriteRune(r)
        case r == 0x1B, r == 0x7F, r == '\r', r == '\b':
            b.WriteRune('?')
        case r < 0x20:
            b.WriteRune('?')
        case r >= 0x80 && r <= 0x9F:   // C1
            b.WriteRune('?')
        case r == 0x2028, r == 0x2029: // line/para separator
            b.WriteRune(' ')
        case unicode.Is(unicode.Cf, r) && r != 0x200D: // format chars, keep ZWJ
            // bidi overrides, zero-width, invisible operators
            b.WriteRune('?')
        default:
            b.WriteRune(r)
        }
    }
    return b.String()
}
```

Details that matter:

- **Decode, don't scan bytes.** Range over the string so invalid UTF-8 becomes `U+FFFD` instead of passing through raw. `text.md` covers why invalid input must never crash you; this is the other half of that.
- **C1 is the one people forget.** `\x9b` is CSI. Your regex over `\x1b\[` misses it entirely.
- **Strip Unicode format characters.** `U+202E` (right-to-left override) reverses the display of what follows, so `invoice‮fdp.exe` renders as `invoiceexe.pdf`. That is a real filename attack and works in terminals. Keep `U+200D` (ZWJ) or you break emoji.
- **Mark, don't drop, when it matters.** Replacing with `?` tells the user something was there. Silently deleting makes a malicious filename look clean, which is worse.
- **Show the escape when the user asked to see it.** A hex viewer or a diff with `--show-escapes` should render `\x1b` as the literal text `\x1b`. That is not injection; that is the feature. It's a different code path, and it must be explicit.

### Choose your encoding

For the three ambiguous cases, pick one and be consistent:

| Approach | Render | Good for |
|---|---|---|
| Replace with `?` | `file?.txt` | Default. Honest, readable |
| Escape visibly | `file\x1b[31m.txt` | Diffs, log inspection, security tools |
| Unicode "control pictures" | `file␛[31m.txt` | Reviewing exact bytes; `U+2400` block |

Pick per-surface, document it, and never mix within one view.

## OSC abuse

OSC sequences are where the sharp edges live, because several of them have side effects beyond drawing.

### OSC 52 — clipboard

`OSC 52 ; c ; <base64> ST` sets the clipboard. A terminal that supports it will do so on request, from any program, with no confirmation.

- **Writing is a mild risk** — a program can replace what the user is about to paste.
- **Reading is the serious one.** Some terminals allow `OSC 52 ; c ; ?` to *query* the clipboard. If yours does, injected text can read it and exfiltrate it through the next OSC the program emits, or through a request the data makes.
- **The realistic attack** is not remote code execution; it is: injected escape writes a command to the clipboard, the user pastes it into a shell out of habit, and it runs. That's a two-step exploit that needs nothing but a filename.

Mitigations: never pass untrusted bytes anywhere near the OSC layer; if you implement clipboard copy, read from the user's own selection only and require an explicit action; don't implement clipboard read at all unless the feature genuinely needs it.

### OSC 8 — hyperlinks

`OSC 8 ; params ; URI ST text OSC 8 ; ; ST`. The text is the label; the URI is the destination. The two need not match.

| Attack | Shape |
|---|---|
| Mismatched label | Link reads `github.com/foo/repo`, points at `evil.example` |
| Homograph | `https://gіthub.com` with a Cyrillic `і` |
| Dangerous scheme | `javascript:`, `file://`, `data:`, custom protocol handlers |
| Terminal-in-terminal | A URI that itself contains an escape sequence |
| Tracking | Per-recipient URIs that leak who clicked what |

Rules:

- **Allowlist the schemes** you will ever emit: `https`, and maybe `mailto`. Nothing else.
- **Never build a URI from untrusted text without validating it** with a real URL parser, then re-serializing it. Don't string-concatenate.
- **Show the destination** when it differs from the label. Copy-to-clipboard-on-hover is not a defense.
- **Strip the URI of control characters** even after parsing. Parsers disagree about what's legal.
- **Emit `id=` parameters only if you need them**, and never make them correlate to a user.
- **Fall back to plain text where OSC 8 is unsupported.** Don't print the URL in parentheses next to the label — that's noise; see `accessibility.md` for when the URL is the message.

### OSC 0 / 2 — window title

The title bar is outside your frame, and on some terminals it is outside the terminal. It shows in tab bars, window lists, and task switchers, where it persists after your program exits.

- Injected text can set the title. A title reading `ssh prod-db-01` on the attacker's machine is a social-engineering surface.
- **Always set the title from vetted data**, and **always restore it on exit** (`lifecycle.md`).
- **Never encode secrets in the title** — it's visible in `ps`, screen shares, and window lists.

### Other OSC families worth knowing

| OSC | Effect | Risk |
|---|---|---|
| 4 | Set palette color | Visual spoofing; persistent in some terminals |
| 10/11/12 | Set fg/bg/cursor color | Spoofing; can make text invisible |
| 9 ; 4 | Progress bar | Cosmetic; can be spoofed to look like another task |
| 9 ; 9 / 777 | Notification | Can be used for phishing popups |
| 7 | Current directory (`file://host/path`) | Leaks path; some terminals act on it |
| 104 / 110 / 111 | Reset palette / colors | Denial of your own theming; benign |

Any of these from untrusted data is a bug. Sanitization prevents all of them at once, which is why the sanitizer is the answer rather than a per-sequence blocklist.

## Everything else that executes

Not just CSI and OSC:

- **DCS** (`ESC P`) — device control strings. Includes sixel and Kitty graphics. An injected DCS can draw arbitrary images (phishing, fake UI) or exploit a graphics parser. Block `ESC P` entirely from untrusted input.
- **APC / PM / SOS** (`ESC _`, `ESC ^`, `ESC X`) — string sequences with the same termination problem.
- **DECRQSS / XTGETTCAP responses** — normally the terminal answers, but if your program forwards a query response into the display, the *terminal's* answer becomes content.
- **Query responses in general.** If you send DA1 (`CSI c`) or DECRQM, the reply arrives on stdin. If your input loop is not expecting it, and you echo stdin anywhere, you have echoed terminal-controlled bytes into the display. Consume query responses in the input parser and never render them.
- **`wrapped` line abuse** — not execution, but: an attacker who can emit a very long line can push earlier content out of scrollback, hiding what was actually reported. Cap line length on untrusted content.

## Sanitizing the environment

Environment variables are attacker-controlled in any shared or remote context.

- **`TERM`, `COLORTERM`, `NO_COLOR`, `TERM_PROGRAM`** are read for detection. Treat every one as untrusted string input: length-cap them, don't interpolate them into escape sequences, don't compare them in ways that assume they're short.
- **`LS_COLORS` and `COLORTERM`** can be enormous. Cap the parse.
- **`HOME`, `XDG_*`, `TMPDIR`** determine where you write. Validate before use; a `TMPDIR` of `../../etc` is not hypothetical.
- **`PROMPT_COMMAND`-style hooks, `EDITOR`, `PAGER`** — if you invoke a shell or an editor, you are executing a user- (or attacker-) chosen string. Prefer `execve` with an argv array over `sh -c`.

Never `os.ExpandEnv` a template that includes untrusted content, and never construct a shell command by concatenation.

## Log hygiene

Logs are read by humans and by other programs, and both are part of your attack surface.

- **Log files are escape vectors for whoever views them.** A log line containing raw `ESC` will, when `cat`ed or tailed in a terminal, run sequences. Sanitize on the way *in*, so the file itself is safe to `cat`. This is the non-obvious one: the fix belongs at write time, not at read time.
- **Never log secrets.** Not the value, not a prefix, not a hash you think is safe. `cli-contract.md` → *Secrets* defines the `Secret` type; `String()` returning `[redacted]` means `%v` and `%s` are safe by construction.
- **Redact at the type, not at the call site.** One place to audit beats forty.
- **Log what was attempted, not how to reproduce it.** `failed to connect to host` is enough; the full connection string with credentials is not.
- **Log injection via newlines.** A value containing `\n` forges a whole fake entry, including a fake timestamp and a fake severity. Either escape it (`%q`) or refuse it. `%q` is the safe default for any untrusted string in a log line.
- **Cap size.** Unbounded logs from unbounded input is a disk-fill bug; truncate long values with an explicit marker and a length.
- **Crash dumps and `--debug` output leak everything**: argv, env, memory, tokens. Warn on `--debug` if it will contain sensitive data, and never dump memory in a shipped release build.

## The boundary

Put the sanitizer where untrusted data becomes model data, and make the type system help:

```go
type Text string     // sanitized, safe to render
type Raw  string     // untrusted, must go through text.Safe() before display

func (r Raw) Safe() Text { return Text(safe(string(r))) }
```

Then render functions accept `Text` and never `Raw`. The compiler enforces the rule and `grep -n 'Raw'` finds every entry point. This is the same trick as `Secret` in `cli-contract.md`, and it is the only version of this discipline that survives a codebase with more than one author.

One exemption, explicitly typed: `Raw.Bytes()` for writing to a file or an HTTP body, so you don't corrupt data on the way out. Sanitizing for display is not sanitizing for storage.

## Testing

- **Golden injection corpus.** A table of hostile strings — `ESC[2J`, `ESC]52;c;...`, `ESC]8;;javascript:alert(1)ESC\\`, `‮`, `\x9b31m`, lone surrogates, invalid UTF-8, a 1 MB line — each asserted to render as inert text.
- **Assert the output contains no `0x1B`** for any input drawn from untrusted sources. One `strings.Contains(out, "\x1b")` check across the corpus catches the whole class.
- **Fuzz the sanitizer.** It must never panic and never emit `ESC`/C1 for any input.
- **Second-order test.** Write an injected filename to a log, read the log back, render it, assert inert.
- **Test the legit path too.** Emphasis, hyperlinks and color your program emits must still work. A sanitizer that kills everything is a sanitizer nobody keeps.

## Checklist

- [ ] One sanitizer, called at the boundary where untrusted text enters the model
- [ ] `ESC`, C1 (0x80–0x9F), `\r`, `\b`, `DEL` and C0 controls all blocked or replaced
- [ ] Unicode format characters stripped except ZWJ; bidi overrides specifically tested
- [ ] Invalid UTF-8 becomes `U+FFFD`, never raw bytes
- [ ] Filenames, git refs, network strings, log lines and pasted text all treated as untrusted
- [ ] `Text` vs `Raw` types make the compiler enforce the rule
- [ ] OSC 8 destinations parsed, scheme-allowlisted, and shown when they differ from the label
- [ ] OSC 52 read not implemented; write requires an explicit user action
- [ ] Window title set from vetted data only, never from secrets, restored on exit
- [ ] DCS/APC/PM/SOS rejected from untrusted input
- [ ] Query responses consumed by the input parser and never rendered
- [ ] Environment variables length-capped and never interpolated into sequences
- [ ] No shell invocation built by string concatenation
- [ ] Logs sanitized at write time and safe to `cat`; untrusted values logged with `%q`
- [ ] `--debug` and crash paths audited for leaked argv, env and memory
- [ ] Golden hostile-input corpus in CI, asserting zero `0x1B` in sanitized output
- [ ] Fuzz test on the sanitizer: no panic, no escape passthrough
- [ ] Legitimate emphasis, links and color still render correctly
