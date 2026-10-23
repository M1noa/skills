# Text, Width, and Unicode

A terminal is a fixed grid of cells. Text is the only thing that goes in it, and every layout bug in terminal software traces back to one mistake: treating a string as a sequence of characters when the terminal treats it as a sequence of **cells**.

Four units get confused, and each fails differently:

| Unit | What counts | Fails by |
|---|---|---|
| Bytes | `len(s)` in Go, `Buffer.byteLength` | Non-ASCII text is overcounted (é = 2, 漢 = 3) |
| Code points | `utf8.RuneCountInString`, `[...s].length` | Combining marks and emoji modifiers overcount; ZWJ families overcount 4x |
| Grapheme clusters | `uniseg`, `Intl.Segmenter` | Right for cursor movement, wrong for layout: most clusters are 1 cell, some are 2 |
| **Cells** | `wcwidth`, `runewidth.StringWidth` | What the terminal actually uses |

**Layout is measured in cells. Cursor movement is measured in graphemes. Truncation must respect both.** Get this backwards and you get borders that don't close, tables that lean, and a cursor that lands inside an emoji.

## The width function

Width of a grapheme cluster = sum of code point widths, then clamped:

```text
width(cluster):
  if cluster contains a regional-indicator pair (U+1F1E6..U+1F1FF x2): return 2
  if cluster is an emoji ZWJ sequence:      return 2
  if cluster has VS16 (U+FE0F):             return 2
  if cluster contains a keycap (U+20E3):    return 2
  w = sum(width(cp) for cp in cluster)
  return min(w, 2)        # never 3+; terminals clamp
```

And per code point:

| Class | Examples | Width |
|---|---|---|
| Zero-width (`Mn`, `Me`, `Cf` except soft hyphen) | combining acute, ZWJ, VS, tag chars, U+200B | 0 |
| Hangul Jamo medial (U+1160–U+11FF) and final | `ᅡ`, `ᆨ` | 0 |
| Control (`Cc`) | `\x00`–`\x1f`, `\x7f` | 0 (must be stripped, not measured) |
| East Asian Wide (`W`) and Fullwidth (`F`) | 漢, あ, 한, ！, Ａ, most emoji | 2 |
| East Asian Ambiguous (`A`) | ±, °, §, Greek, Cyrillic, box drawing | 1, or 2 in a CJK locale |
| Everything else (`N`, `Na`, `H`) | Latin, digits, punctuation | 1 |

`Emoji_Presentation=Yes` code points are wide without needing VS16: ⌚ U+231A, ✅ U+2705, 🚀. `Emoji_Presentation=No` ones are narrow unless VS16 is present: ☺ U+263A, ❤ U+2764, ✈ U+2708.

## The ambiguous-width problem

East Asian Ambiguous is the one width class with no correct answer, because it depends on the user's font and locale. `±` is one cell in a Latin font and two in a CJK font that renders it fullwidth.

Three postures, pick one and document it:

1. **Always narrow (1).** What Markus Kuhn's `wcwidth` does by default, what most libraries do. Breaks CJK users' alignment for a handful of glyphs.
2. **Follow the locale.** Wide when `LC_CTYPE`/`LANG` names a CJK locale (`ja`, `zh`, `ko`). This is what `go-runewidth`'s `EastAsianWidth` flag and Python's `unicodedata.east_asian_width` + locale do.
3. **Never emit ambiguous glyphs in aligned content.** The robust answer: use the ambiguous set for decoration only, never in tables or borders where a 1-vs-2 disagreement would misalign the column.

Posture 3 is the one this skill recommends, because it holds regardless of what the user's terminal believes.

## Libraries that get it right

| Language | Width | Graphemes | ANSI-aware |
|---|---|---|---|
| Go | `github.com/mattn/go-runewidth` (set `.EastAsianWidth` from locale) | `github.com/rivo/uniseg` | `github.com/charmbracelet/x/ansi` (`ansi.StringWidth`, `ansi.Truncate`, `ansi.Wrap`) |
| Go (modern) | `golang.org/x/text/width` for classification | `uniseg` | Lipgloss v2 `lipgloss.Width` already strips ANSI |
| Python | `wcwidth` (POSIX-correct, versioned tables) | `grapheme` / `regex` `\X` | `rich.cells.cell_len`, `rich.text.Text` |
| JS/TS | `string-width` | `Intl.Segmenter` (built in) | `slice-ansi`, `wrap-ansi`, `strip-ansi` |
| Rust | `unicode-width` | `unicode-segmentation` (`graphemes(true)`) | Ratatui `Span::width`, `Line::width`; `ansi-to-tui` |
| C | `wcwidth`/`wcswidth` (locale-dependent, glibc has bugs) | `utf8proc` grapheme break | hand-rolled |
| .NET | `Rune` + `StringInfo.GetTextElementEnumerator` | `StringInfo` text elements | `Spectre.Console` |

Two traps in that table. glibc's `wcwidth` is locale-dependent and returns **−1** for unprintable; treat −1 as 0 and strip. And `unicode-width` is conservative by default (emojis as 2 is opt-in via `UnicodeWidthStr::width` on recent versions, check the version) — always assert with the test vectors below rather than trusting the default.

## ANSI awareness

Measurement must ignore escape sequences but not the text inside OSC 8 payloads' *display* portion:

```text
"\x1b[31mred\x1b[0m"                  width 3   (SGR stripped)
"\x1b]8;;https://x\x1b\\link\x1b]8;;\x1b\\"  width 4   (OSC 8; only "link" visible)
"\x1b[2K"                             width 0
```

Rules:

- Strip **CSI** (`ESC [ … final`), **OSC** (`ESC ] … BEL|ST`), **DCS/SOS/PM/APC** (`ESC P/X/^/_ … ST`), and **single-char ESC** (`ESC 7`, `ESC ( B`).
- An unterminated sequence eats the rest of the string. That is correct behavior: it's what the terminal does. But it should never reach the renderer, because you sanitize at the boundary (`security.md`).
- Cache the stripped form. Measuring by re-stripping on every frame is a real cost in a 60 fps table.

## Truncation

Never `s[:n]`. Four rules:

1. **Cut on grapheme boundaries**, never inside a cluster or between `ESC` and its final byte.
2. **Count cells**, and if the cut lands on a wide glyph that would overflow, drop the whole glyph rather than half-render it.
3. **Reserve room for the marker.** `…` is 1 cell; `...` is 3. Pick one and subtract it before measuring.
4. **Reset SGR at the cut.** A truncated string that still has an open color bleeds into the border.

```go
func clip(s string, cells int) string {
    if ansi.StringWidth(s) <= cells {
        return s
    }
    if cells <= 1 {
        return "…"
    }
    return ansi.Truncate(s, cells-1, "…")   // preserves SGR, cuts on graphemes
}
```

For middle-ellipsis (file paths, long identifiers) keep both ends: `ansi.TruncateLeft` for the head and `Truncate` for the tail. `…/src/components/Button.tsx` beats `/Users/minoa/Documents/Projec…`.

**Text that determines whether the user can act must never be silently truncated.** A filename cut to `report-2…` is ambiguous. Either widen, wrap, or provide a detail view. Truncation is for decoration; it is not an information policy.

## Wrapping

Word wrapping with CJK and emoji in the mix:

- **Latin:** break at spaces and after hyphens. Do not break inside a word unless the word exceeds the line, in which case break on grapheme boundaries.
- **CJK:** every character is a valid break point *except* before closing punctuation (`。`, `、`, `）`, `」`) and after opening punctuation (`（`, `「`). Full UAX #14 line breaking is usually overkill; the "no break before closing, no break after opening" rule covers the visible failures.
- **Emoji and combining sequences:** never break inside a cluster.
- **URLs and long identifiers:** break anywhere but mark the break (a trailing `↩` or indentation) so the user knows it continues.
- **Never break inside an ANSI sequence.**

Use the library's wrapper: `ansi.Wrap`, `textwrap`, `wrap-ansi`, `textwrap` crate. Roll your own only if you already handle all of the above.

## Tabs, control characters, and line endings

- A tab is **not** 1 cell. It advances to the next multiple of 8 (or 4, or the terminal's tabstop). Expand tabs before measuring, using the current column: `col += 8 - (col % 8)`.
- Strip C0 controls except `\n` (and `\t` if you expand it). A raw `\x0b` or `\x00` in a log line is a display bug waiting to happen.
- Normalize `\r\n` → `\n` and lone `\r` → overwrite semantics on the current line, or strip it. A progress bar's `\r` arriving in your log pane is the classic symptom.
- Never emit `\x07` unless you mean it. BEL in a log line is user-hostile.

## Locale and encoding

UTF-8 is the only sane assumption and it is still not universal.

| Platform | Reality | What to do |
|---|---|---|
| Linux/macOS | UTF-8 locale is the norm; `LANG=C` happens in containers and systemd units | Check `LC_ALL` → `LC_CTYPE` → `LANG`; if none names UTF-8, degrade to ASCII glyphs |
| Windows | Console default codepage is not UTF-8; Go writes UTF-16 via the console API, Rust and Python need care | Use the wide API; do not require `chcp 65001`; test in `cmd.exe`, not just Windows Terminal |
| Python | `sys.stdout.encoding` depends on locale; `PYTHONIOENCODING`, `PYTHONUTF8` | Set `errors="replace"` and never crash on encode failure |
| Go | Strings are UTF-8 bytes; output is bytes; nothing validates | Validate untrusted input yourself |
| JS | Strings are UTF-16; surrogate pairs are two units, so `.length` is wrong for both cells and code points | `Intl.Segmenter` or `string-width` |

**Invalid UTF-8 must not crash the program.** Decode with replacement (`U+FFFD`), count its width as 1, and move on. A terminal tool that dies on a malformed filename is a terminal tool that dies in `/tmp`.

## Bidirectional text

The terminal grid is LTR. Bidi in terminals is partially implemented and terminally under-specified.

- The terminal decides bidi, not you. mlterm and a few others implement UAX #9; most do not.
- **Do not reorder text yourself.** If you reorder and the terminal also reorders, the result is doubled inversion.
- Do not bidi-mirror brackets or parens. The terminal's font shaping handles presentation.
- For RTL content in an aligned table, alignment should follow paragraph direction; provide `--rtl` or read the locale. Left-aligning Hebrew in a right-aligned numeric column reads wrong.
- Embedding marks (`U+200E` LRM, `U+200F` RLM, `U+202A`–`U+202E`) are invisible and will break your width math if you inject them casually. Inject deliberately, at a labelled boundary, and count them as 0.
- If bidi is a first-class product requirement, say so in the README and test on a terminal known to implement it. Shipping bidi "half right" is worse than shipping LTR-only with a clear note.

## ASCII fallback

Ship a single substitution table, behind one flag, and route every decorative glyph through it.

| Unicode | ASCII | Note |
|---|---|---|
| `─│┌┐└┘├┤┬┴┼` | `-\|+++++` | Box drawing. Vertical bars need no substitution |
| `━┃┏┓┗┛` | `-=++++` | Heavy box |
| `╭╮╰╯` | `/\\\/` | Rounded corners |
| `▁▂▃▄▅▆▇█` | `_.,:;!\|#` | Blocks and sparklines |
| `▏▎▍▌▋▊▉` | `\|\|\|\|\|\|\|` | Partial blocks; lose precision, keep the bar |
| `●○◐◑` | `*o(O)` | Bullets and radio |
| `✓✔` / `✗✘` | `v` / `x` , or `ok`/`fail` | Better: words |
| `→←↑↓↔` | `-> <- ^ v <->` | Arrows |
| `·•‣▪` | `* - o #` | List markers |
| `…` | `...` | Ellipsis |
| `↑↓` sort indicators | `^ v` | |
| Nerd Font icons | nothing, or 1-2 letter tag | See `design.md` → *Icons* |

`--ascii` changes glyphs only. It does **not** change color, layout, or interaction. Keep the axes independent (`capability-ladder.md`).

Also honor `TERM=dumb` and non-UTF-8 locales by selecting this table automatically, and let `--ascii` force it even on a capable terminal.

## Width test vectors

Assert these in a unit test. Every one of them has broken a real terminal program.

| Input | Cells | Trap |
|---|---|---|
| `abc` | 3 | Baseline |
| `日本語` | 6 | Three wide chars |
| `한국어` | 6 | Hangul syllables are wide |
| `café` (NFC) | 4 | Composed é |
| `café` (NFD) | 4 | Decomposed: 5 code points, 4 cells |
| `❤️` (U+2764 U+FE0F) | 2 | VS16 promotes to wide |
| `❤` (U+2764) | 1 | No VS16, narrow |
| `👍🏽` | 2 | Skin-tone modifier is 0 width, does not double |
| `👨‍👩‍👧‍👦` | 2 | ZWJ family: 7 code points, 1 cluster, 2 cells |
| `🇺🇸` | 2 | Regional indicator pair, not 4 |
| `🏳️‍🌈` | 2 | VS16 + ZWJ, still one cluster |
| `#️⃣` | 2 | Keycap sequence |
| `​` | 0 | Zero width space |
| `\x1b[31mred\x1b[0m` | 3 | SGR stripped |
| `±°§` | 3 (or 6) | Ambiguous; pick a posture and test both |
| `\t` at column 5 | 3 | Tab advances to column 8 |
| `ＡＢ` | 4 | Fullwidth Latin |
| `︎` (U+FE0E) | 0 | VS15 forces text presentation; width of base |

Two more properties to assert, beyond the table:

- **Round-trip:** for any string, `width(truncate(s, n)) <= n`.
- **Idempotence:** `truncate(truncate(s, n), n) == truncate(s, n)`.

## Checklist

- [ ] Every width measurement goes through one function, ANSI-aware, cell-counting.
- [ ] No `len()`, `.length`, or rune count used for layout anywhere.
- [ ] Border and table drawing verified against CJK, emoji, and combining marks.
- [ ] Truncation cuts on grapheme boundaries and preserves or resets SGR.
- [ ] Tabs expanded; CRLF normalized; C0 controls stripped before measurement.
- [ ] Non-UTF-8 locale and `--ascii` both produce correct alignment.
- [ ] Invalid UTF-8 input renders as `U+FFFD` without crashing.
- [ ] Bidi: either delegated to the terminal with a documented limitation, or not attempted.
- [ ] Width test vectors from the table above are in the test suite.
