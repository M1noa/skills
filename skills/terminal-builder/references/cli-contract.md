# CLI Contract

A terminal program is a Unix citizen before it is a UI. Shells call it, pipes consume it, scripts parse it, `xargs` feeds it, and users expect Ctrl+C to work. Get the contract right and the TUI is a bonus; get it wrong and no amount of interface design saves it.

## Product shape

Decide which shapes you are. Most tools are two of these, and knowing which two determines your I/O rules more than any design preference.

| Shape | Signature | Reads | Writes | Controls |
|---|---|---|---|---|
| **One-shot** | `tool build` | args, config | stdout (result), stderr (progress) | exit code |
| **Filter** | `tool fmt < in > out` | stdin | stdout | exit code, streaming |
| **Interactive** | `tool edit` | args, config, stdin | terminal (alt screen) | keyboard, mouse |
| **Daemon / server** | `tool serve` | args, config | logs, socket | signals, port |

The dangerous combination is **one-shot that becomes interactive when stdin is a TTY** with no way to say otherwise. `git add -p` inside a script is the classic hang. Always give an explicit flag (`--interactive` / `--no-interactive`) rather than inferring from `isatty`, and if you do infer, respect the documented precedence in `capability-ladder.md` → *Precedence*.

The other dangerous combination: **filter that also draws a progress bar to stdout**. Progress belongs on stderr, always, no exceptions.

## Streams

| Stream | Carries | Never carries |
|---|---|---|
| stdout | program output: the data, the result, the thing being piped | banners, progress, warnings, "Starting…", prompts |
| stderr | diagnostics: progress, warnings, errors, prompts, verbose logs | the data |
| stdin | user data, or keystrokes in interactive mode | — |

Rules:

- **Redirectable stdout is a hard guarantee.** `tool list | wc -l` must count records, not records plus a header you printed for humans.
- **Anything you print to stdout when not a TTY must be machine-parseable.** If the user pipes, strip color, progress, and decorative frames by default (`NO_COLOR`, `CLICOLOR`, and the TTY check in `capability-ladder.md`).
- **Flush stdout before you write to stderr** if ordering matters for a human reading both. Buffering reorders them.
- **Close stdout when done** so the reader sees EOF. Don't loop forever waiting on a socket after the last record.
- **Handle `EPIPE`.** `tool list | head` closes stdout early; that's normal, not an error. Exit 0 (or 141, see below) quietly, don't print a stack trace.
- Prompts go to stderr, and only when stdin is a TTY.

```go
// broken: prompt on stdout, no isatty check
fmt.Println("Overwrite? [y/N]")
fmt.Scanln(&resp)

// correct: stderr, tty check, explicit flag
if !term.IsTerminal(int(os.Stdin.Fd())) && !force {
    return fmt.Errorf("stdin is not a terminal; pass --force to overwrite")
}
fmt.Fprint(os.Stderr, "Overwrite? [y/N] ")
```

## Exit codes

| Code | Meaning | Convention |
|---|---|---|
| 0 | success | Anything else is a bug unless documented |
| 1 | general runtime failure | Not for usage errors |
| 2 | usage error: bad flag, bad arg, bad combination | What `flag`/Cobra/`clap` do by default |
| 126 | command found but not executable | Shell convention, if you exec subprocesses |
| 127 | command not found | Same |
| 130 | interrupted by `SIGINT` | 128 + 2 |
| 143 | terminated by `SIGTERM` | 128 + 15 |
| 141 | `SIGPIPE` | 128 + 13; acceptable for `| head` |

Beyond those, `sysexits.h` (`EX_USAGE=64`, `EX_DATAERR=65`, `EX_UNAVAILABLE=69`, `EX_CONFIG=78`) is defensible if documented in `--help`. Picking arbitrary codes 3–42 is not: nobody can script against a code they can't discover.

Hard requirements:

- **One code per outcome class.** A script branches on the code; "it failed with 3, 7, or 11 depending on where" is unusable.
- **Never exit 0 on failure** because cleanup succeeded. The last real status wins.
- **Document the codes** in `--help` or the man page. A table with three rows.
- **In raw-mode TUIs, exit code must still be right** after restoring the terminal. The guard (`lifecycle.md`) restores, then you exit; if restoring panics, still exit non-zero.
- **SIGINT in a TUI is a keypress, not a signal** (`input.md`). Handle `q`/Ctrl+C semantically, then exit with 130 only if the user actually interrupted work; a clean quit is 0.

## Flags

Follow GNU/POSIX conventions even if you're not on Unix. Every deviation costs a user a minute.

| Convention | Detail |
|---|---|
| `-h`, `--help` | Prints usage, exits 0. Not 1 |
| `--version` | One line, exits 0. `<name> <semver> (<commit>, <date>)` or just the semver |
| `--` | Ends flag parsing; everything after is positional |
| `-abc` | Bundled short flags |
| `-o value`, `-ovalue`, `--opt value`, `--opt=value` | All four forms |
| `-v` / `-q` | Verbose / quiet, repeatable for levels |
| `--dry-run` | Show what would happen, change nothing. Distinct from `--force`, which does change things |
| `-a` / `--all` | Include otherwise-hidden entries; the one universal shortcut |
| `--json` | Machine-readable output to stdout, nothing else on stdout |
| `--no-<x>` | Negates any boolean that defaults true, rather than making people `--x=false` |
| Subcommand | `tool noun verb`, each with its own `--help` |

Reserved and near-universal: `-n/--dry-run` in some ecosystems (be careful; `-n` means count in `echo`/`head`), `-f/--force`, `-r/--recursive`, `-o/--output`, `-i/--in-place`, `-q/--quiet`, `-v/--verbose`. Don't take `-h`, `-V`, `-?`, or `--help`/`--version` for anything else.

Boolean flags don't take `=false` in the POSIX world; accept it anyway if it costs nothing.

## Help

`--help` is the documentation most users actually read. Structure it, don't dump it.

```text
tool — one-line description

Usage:
  tool [flags] <input>...
  tool <subcommand> [flags]

Description:
  Two or three sentences. What it does, what it doesn't.

Examples:
  tool scan ./src
  tool scan --json ./src | jq '.[] | select(.severity == "high")'

Flags:
  -o, --output PATH    write to PATH instead of stdout
      --json           machine-readable output
  -q, --quiet          suppress progress
  -h, --help           show this help

Exit codes:
  0  success
  1  scan completed with findings
  2  usage error

Environment:
  TOOL_TOKEN    API token (see also: --token)
  NO_COLOR      disable color
```

- **Examples are mandatory.** Two, one of which is a pipe. They answer more questions than any flag description.
- **Group flags** by purpose once you pass ~12. Alphabetical within group.
- **No color when stderr or stdout is not a TTY** (`capability-ladder.md`).
- **No width assumption.** Wrap to 80 columns or let the terminal wrap; don't hardcode alignment columns past column 60.
- **Man page or generated docs** for anything shipped as a package. `cobra/doc`, `clap_mangen` generate them from the flag definitions; the generated version never drifts.
- `-h` should be fast. Don't open a database to print help.

## Version

```
tool 1.4.2
tool 1.4.2 (commit a1b2c3d, built 2026-02-14, go1.26)
```

- One line by default; more with `--version --verbose` if you want.
- Include the build/commit for anything distributed as a binary; bug reports need it.
- Emit to stdout, exit 0. It's data.
- Make it reproducible: inject at build time via `-ldflags`, don't hardcode a string someone forgets to bump.

## Configuration

Precedence, highest to lowest. Document yours; this ladder is what people expect.

| Level | Source | Note |
|---|---|---|
| 1 | CLI flag | Always wins |
| 2 | Environment variable | `TOOL_<SETTING>`; the escape hatch for containers |
| 3 | Project file | `./.toolrc`, `./tool.toml`, found by walking up |
| 4 | User file | `$XDG_CONFIG_HOME/tool/config.toml`, `~/.config/tool/config.toml` |
| 5 | System file | `/etc/tool/config.toml` |
| 6 | Default | Compiled in, documented in `--help` |

Rules:

- **Same key, same name, all levels.** `--max-retries` is `TOOL_MAX_RETRIES` is `max_retries` in the file. Guessing mappings is a support burden.
- **`tool config` (or `tool config path`) prints the resolved file and location.** Users need to know which file won.
- **`tool config --show` prints merged effective config** with the source of each value if you can manage it.
- **Validate with a location.** `config.toml:14: retries must be >= 1, got -3`, not `invalid config`.
- **Unknown keys: warn, don't fail.** Unless the file declares strictness. A typo'd key silently ignored is worse than a warning.
- **Refuse to auto-create config** in a home directory on first run unless the user asked. Silent state in `~` is user-hostile.
- **Never write secrets into the config file** as a side effect of a login command. See below.

XDG on Linux/macOS (`$XDG_CONFIG_HOME`), `~/Library/Application Support` on macOS if you must, `%APPDATA%` on Windows. One path per platform, documented.

## Secrets

Terminal programs leak credentials in predictable ways. Close them.

| Sink | Problem | Fix |
|---|---|---|
| argv (`--token abc`) | Visible in `ps`, shell history, process listings | Prefer env var or file; accept a flag but document the exposure |
| `--password abc` | Same, plus history | `--password-stdin`, or prompt on the TTY with echo off |
| Config file in a repo | Committed by accident | Read from env/keyring; if writing a file, `0600` and warn |
| Logs | Tokens in log lines | Redact at the log boundary, not at each call site |
| Error messages | `failed to auth with token sk-…` | Print a prefix and length, never the value |
| Crash output | Panic dumps the whole config struct | Redact in `String()`/`Format()` methods on secret types |
| Debug mode | `--debug` prints the request with headers | Redact headers by name |

Prompting for a password:

```go
// read with echo off, restore on every path
fmt.Fprint(os.Stderr, "Password: ")
pw, err := term.ReadPassword(int(os.Stdin.Fd()))
fmt.Fprintln(os.Stderr)   // newline the echo-off skipped
```

A token type that can't be printed by accident:

```go
type Secret string

func (Secret) String() string   { return "[redacted]" }
func (Secret) GoString() string { return "[redacted]" }
func (s Secret) Reveal() string { return string(s) }  // grep-able at call sites
```

`Reveal()` being the only unredacting accessor means `grep Reveal` enumerates every place a secret can escape. That's the audit.

## Machine output

If a human might pipe it, define the shape.

- `--json` emits JSON to stdout and nothing else. One document, or JSON Lines for streams (declare which).
- **Version the schema** (`{"schema": 1, ...}`) or at minimum never remove fields. Adding is fine; renaming breaks scripts.
- **Stable key order** if you're diffing the output in tests; Go's `encoding/json` sorts map keys but not struct fields, so struct order is stable — rely on that.
- **No trailing text after the JSON.** No "done." on stdout.
- `--format=text|json|tsv` is a reasonable generalization; `--json` alone is fine for most.
- **Numbers as numbers**, not strings. `null` for absent, not `""`.
- **Timestamps RFC 3339, UTC** unless a flag says otherwise.

## Errors

An error message is read once, by someone already frustrated.

```text
error: cannot open config
  file: /home/u/.config/tool/config.toml
  reason: permission denied
  fix: chmod 644 /home/u/.config/tool/config.toml

error: unknown flag --formt
  did you mean --format?
```

- **State what failed, where, why, and what to do.** The `fix:` line is the difference between a bug report and a support ticket.
- **`error:` prefix on stderr**, lowercase, no period at the end.
- **Never a stack trace by default.** `--debug` or `RUST_BACKTRACE`/`GODEBUG` for that.
- **Suggest near-misses** for flags and subcommands. Levenshtein over a table of 30 flags is 20 lines.
- **No "Oops", no "Whoops", no exclamation marks, no emoji.** The user's day already has a problem in it.
- **Exit non-zero.** An error printed with exit 0 is invisible to scripts.
- **Don't print the error twice**, once in your handler and once in `main`. One printer.

## Interruption and partial output

- **`SIGINT` during a one-shot operation** should stop promptly, clean up temp state, and exit 130. Don't finish the batch "since we're nearly done".
- **Write output atomically**: temp file in the same directory, then `rename()`. A half-written config on Ctrl+C is the bug that loses trust permanently.
- **Handle `SIGTERM` the same as `SIGINT`** for daemons, plus graceful connection drain with a deadline.
- **In a TUI, Ctrl+C during a modal** dismisses the modal or quits, consistently. Pick one, document it, keep it identical everywhere.
- **Never leave a lock file behind.** `flock`/`O_EXCL` with a PID that gets cleaned on the next run beats a stale lock that blocks the user forever.

## Distribution

Checklist for shipping something people can install without reading a wiki.

- [ ] **Single static binary**, no runtime dependency. Cross-compiled for `linux/amd64`, `linux/arm64`, `darwin/arm64`, `darwin/amd64`, `windows/amd64`.
- [ ] **Checksums** (`SHA256SUMS`) published with the release, and a signature if you can.
- [ ] **Install line** in the README, one per platform, copy-pasteable.
- [ ] **Package managers** where the audience is: Homebrew tap, `go install`, `cargo install`, `npm i -g`, `pipx`, apt/rpm via a repo or a `.deb`/`.rpm` asset.
- [ ] **Shell completions** for bash, zsh, fish. Cobra and clap generate them; ship them in the release and document the two-line install.
- [ ] **Man page** generated and shipped.
- [ ] **`--version` reports the commit**, so bug reports are actionable.
- [ ] **No telemetry by default.** If you want it, opt-in, documented, and off when the network is closed.
- [ ] **Uninstall documented.** Files it created, where.
- [ ] **Docker image** if it's a server, with a non-root user and a healthcheck.
- [ ] **Reproducible builds** or at least a documented toolchain; supply chain questions arrive eventually.

## Checklist

- [ ] The product shape is named, and the interactive path has an explicit off switch.
- [ ] stdout carries only data. Progress, prompts, warnings, and errors all go to stderr.
- [ ] Exit codes are a documented table, with 0/1/2/130 as the baseline.
- [ ] `-h` and `--version` exist, are fast, print to stdout, and exit 0.
- [ ] `--` ends flags; bundling and `=` forms work.
- [ ] `--help` has two examples, one of them a pipe.
- [ ] Config precedence is flag → env → project → user → system → default, and `tool config` reveals the source.
- [ ] No secret can reach argv, logs, error messages, or a panic dump without being explicitly revealed.
- [ ] `--json` output is stable, versioned, and alone on stdout.
- [ ] Errors say what failed, where, why, and how to fix it. No stack trace without `--debug`.
- [ ] `SIGINT` exits promptly with 130 and writes output atomically.
- [ ] `EPIPE` is handled quietly, no stack trace.
- [ ] Install, completions, man page, checksums, and `--version` with commit.
