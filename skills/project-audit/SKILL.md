---
name: project-audit
description: "Full codebase audit covering security, performance, dead code, sloppy patterns, noisy logs, and polish. Two modes: small (1-8 files) reads every file and writes AUDIT_REPORT.md + AUDIT_PLAN.md + AUDIT_TODO.md; large (9-1200+ files) uses a JSON-backed batch tracker (5 files at a time, skip/back/overwrite) with workaholic pacing (150 files/hr), CSV export, then report+plan+todo. More detailed than a pure security audit — covers everything a senior dev would flag walking the codebase file by file."
version: 1.0.0
author: OpenCode
license: MIT
platforms: [linux, macos, windows]
metadata:
  tags: [audit, security, performance, code-quality, dead-code, refactor, review]
  related_skills: [security-audit, requesting-code-review]
---

# Project Audit

Full codebase audit: security, performance, dead code, sloppy patterns, noisy logs, bad code, polish. Not a pure security audit — covers everything a senior dev would flag walking the codebase file by file.

## When to Use

- "Audit this codebase", "review this project", "find issues in this code"
- Technical debt assessment on inherited code
- Pre-merge full-repo review (not a diff — use requesting-code-review for diffs)
- "What needs fixing here?"

## Don't Use For

- Single-PR diff review → requesting-code-review
- Pure security pen-test with exploit reproduction → security-audit
- "Does it compile / pass tests" → run the tests

## Audit Categories

Every file gets checked against all ten. A file can pass some and fail others.

| Category | What to flag |
|----------|-------------|
| Security | Injection, auth bypass, hardcoded secrets, unsafe deserialization, missing input validation at trust boundaries, privilege escalation |
| Performance | O(n²) where O(n) works, unbounded caches/maps, N+1 queries, sync I/O in hot paths, eager loading where lazy works |
| Dead Code | Unreachable branches, unused exports, orphaned functions, commented-out code, files never imported |
| Sloppy Code | Copy-paste duplication, inconsistent error handling, magic numbers, unclear naming, functions doing too much |
| Noisy Logs | console.log in prod, excessive debug logging, logs without context, log spam in hot loops |
| Bad Code | Logic bugs, race conditions, incorrect type handling, off-by-one, wrong defaults, broken error propagation |
| Optimization | Known-bad patterns (string concat in loops, array spread in hot paths, re-creating objects per iteration) |
| Improvement | Missing abstractions that would simplify, better library choices, cleaner API design |
| QoL | Better error messages, more helpful comments, clearer variable names, consistent formatting |
| Polish | Inconsistent style, missing docs on public APIs, unclear file organization, dead imports |

Severity: **CRITICAL** (security hole, data loss, crash) · **HIGH** (real bug, perf killer) · **MEDIUM** (should fix) · **LOW** (nice to fix) · **INFO** (observation).

## Mode Selection

| Files | Mode |
|-------|------|
| 1-8 | Small — read everything, write reports directly |
| 9-1200+ | Large — batch tracker, 5 files at a time, JSON-backed |

## Small Mode (1-8 files)

1. **Inventory**: `glob` all source files. Exclude node_modules, .git, dist, build, vendor, __pycache__, .next, coverage, .opencode. Confirm count ≤ 8.
2. **Read**: Read every file fully. No skimming.
3. **Audit**: Check each file against all 10 categories. Note findings with file:line, category, severity, description, recommendation.
4. **Report**: Write `AUDIT_REPORT.md` in codebase root. See [templates/REPORT.md](templates/REPORT.md).
5. **Plan**: Write `AUDIT_PLAN.md` — ordered fix plan, CRITICAL→LOW, each item with file:line, effort estimate, and dependency chain. See [templates/PLAN.md](templates/PLAN.md).
6. **Todo**: Write `AUDIT_TODO.md` — checkbox list of every fix, grouped by category. See [templates/TODO.md](templates/TODO.md).

Done when: all three files written, every finding appears in all three (report=detail, plan=ordered, todo=checklist).

## Large Mode (9-1200+ files)

### Phase 0 — Choose & Adapt Tracker

Three tracker implementations ship with this skill, all functionally identical:

| Script | Runtime | Best for |
|--------|---------|----------|
| `scripts/audit-tracker.cjs` | Node.js | JS/TS repos (Node already installed) |
| `scripts/audit-tracker.py` | Python 3 | Python repos, or any repo with Python |
| `scripts/audit-tracker.sh` | Bash + jq | Minimal environments, no runtime install needed |

**Pick the one that matches the repo's stack** (if Node is installed, use `.cjs`; if Python, use `.py`; otherwise `.sh`). Copy it into the codebase root or run it from the skill directory with the codebase path as an argument.

**Adapt it to the repo.** The tracker is a starting point, not a final product. Before running `init`:
- Adjust `EXCLUDE_DIRS` for the repo's build artifacts, deps, and generated dirs
- Adjust `SOURCE_EXTS` / `is_source_file()` for the repo's languages (e.g. add `.sol` for Solidity, `.proto` for protobuf, `.tf` for Terraform)
- Adjust `CONFIG_FILES` and `ENTRY_POINTS` for the repo's actual config files and entry points
- Adjust `priority_for()` to put the repo's core directories first (e.g. `contracts/` for a smart contract repo, `api/` for a web service)
- Tune `FILES_PER_HOUR` if the codebase is dense (C/C++ → slower) or simple (config-heavy → faster)

The tracker is plain script — edit it, don't wrap it. The JSON schema is the stable interface; the script is disposable.

### Phase 1 — Initialize

> **`<tracker>`** below means whichever script you chose in Phase 0 (e.g. `node audit-tracker.cjs`, `python3 audit-tracker.py`, or `./audit-tracker.sh`).

1. **Inventory**: Run `<tracker> init [codebase-path]`. Walks the tree, counts LOC per file, assigns priority (entry points first), writes `AUDIT_TRACKER.json` to the codebase root.
   - Flags: `--exclude-dir <name>` (repeatable), `--ext .js,.ts` (filter extensions)
2. **Workaholic**: If workaholic skill available, run `<tracker> workaholic` → prints recommended minutes (150 files = 1 hour). Call `workaholic_start` with that duration.
   - No workaholic? Work in batches of 5 with breaks between.
3. **First batch**: `<tracker> next` → first 5 pending files.

### Phase 2 — Audit Loop

Repeat until `status` shows 100%:

1. **Get batch**: `<tracker> next` (5 pending files)
2. **Read each file fully**. No skimming.
3. **Record notes**: `<tracker> add-note <path> "summary of this file"`
4. **Record findings**: `<tracker> add-finding <path> <category> <severity> <line> "description"`
   - Categories: security, performance, dead-code, sloppy-code, noisy-logs, bad-code, optimization, improvement, qol, polish
   - Severities: critical, high, medium, low, info
   - Line is optional (use 0 for file-level findings)
5. **Mark done**: `<tracker> done <path>` (prints next batch)
6. **Skip**: `<tracker> skip <path> "reason"` (binaries, generated code)
7. **Go back**: `<tracker> back <path>` (revert done/skipped to pending)
8. **Overwrite**: `<tracker> overwrite <path>` (reopen done file, keep old notes)

Progress: `<tracker> status`

### Phase 3 — Export & Report

1. **Export CSV**: `<tracker> export-csv` → writes `AUDIT_TRACKER.csv` (one row per finding).
2. **Compact chat**: If platform supports compaction, trigger it. The CSV is the durable record.
3. **Read CSV**: Read `AUDIT_TRACKER.csv` — all findings in compact form.
4. **Generate reports**: Write in codebase root:
   - `AUDIT_REPORT.md` — findings grouped by category, severity-ordered. See [templates/REPORT.md](templates/REPORT.md).
   - `AUDIT_PLAN.md` — ordered fix plan, CRITICAL→LOW, with effort estimates and dependencies. See [templates/PLAN.md](templates/PLAN.md).
   - `AUDIT_TODO.md` — checkbox list of every fix, grouped by category. See [templates/TODO.md](templates/TODO.md).

### Phase 4 — Fix List (Optional)

If the plan calls for tracking fixes individually:

```
<tracker> fix-init          # create AUDIT_FIXLIST.json from findings
<tracker> fix-next          # next 5 fixes
<tracker> fix-done <path> [line]
<tracker> fix-skip <path> [line] "reason"
<tracker> fix-status
```

## Common Pitfalls

1. **Skimming instead of reading.** The whole point is line-by-line. If you're not reading every line, use a scanner instead.
2. **Flagging style preferences as findings.** Inconsistent indentation is polish, not a bug. Only flag things that matter.
3. **Padding with LOW/INFO.** Ten LOWs don't make a report useful. Three HIGHs do.
4. **Skipping workaholic on large codebases.** Without it, you'll run out of context before finishing.
5. **Forgetting to export CSV before compaction.** The CSV is the durable record — generate it first.
6. **Not reading the CSV after compaction.** The CSV has all findings; chat history may not. Always read CSV before writing reports.
7. **Writing notes only in free-text.** Notes are context; findings are queryable in CSV. Use both.
8. **Marking files done without recording anything.** Every file gets at least a note, even "clean, no issues."

## Verification Checklist

- [ ] Every source file has status `done` or `skipped` (not `pending`)
- [ ] Every done file has at least one note (even "clean")
- [ ] `AUDIT_TRACKER.csv` exists with rows for all findings
- [ ] `AUDIT_REPORT.md` exists, findings grouped by category, severity-ordered
- [ ] `AUDIT_PLAN.md` exists, ordered fix items CRITICAL→LOW
- [ ] `AUDIT_TODO.md` exists, checkbox items for every fix
- [ ] Every finding in CSV appears in all three markdown files
- [ ] (If fix list created) `AUDIT_FIXLIST.json` exists with all findings as fix items
