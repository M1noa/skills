# skills
> THIS PROJECT WAS MADE PARTIALLY USING AGENTIC AI CODING TOOLS

agent skills for claude code and opencode. each dir under `skills/` is a standalone skill: drop it into `~/.claude/skills/` or `~/.config/opencode/skills/` as-is.

## contents

| skill | what |
|---|---|
| `skills/security-audit` | deep security audit: recon, hunt, adversarial validation, risk scoring, independent verification, patch + re-attack. includes reproducer/regression-test discipline merged from openclaw test-audit. |
| `skills/project-audit` | full codebase audit: security, perf, dead code, sloppy patterns, noisy logs, polish. small mode (direct) and large mode (json-backed batch tracker). |
| `skills/anti-slop` | prose audit: finds ai slop patterns and rewrites in a human voice. detect / rewrite / edit modes. |
| `skills/osint-ultimate` | osint dossier from any seed: name, handle, email, domain, IP, phone, company, image. |
| `skills/terminal-builder` | build, refactor, or review terminal software: TUIs, prompts, dashboards, REPLs, one-shot CLIs. use every terminal feature, require none. |

## install

```bash
cp -r skills/security-audit ~/.claude/skills/
cp -r skills/project-audit ~/.config/opencode/skills/
```

or symlink to track this repo:

```bash
ln -s "$PWD/skills/security-audit" ~/.claude/skills/security-audit
```

## license

security-audit: CC-BY-SA-4.0. project-audit, anti-slop, terminal-builder: MIT. osint-ultimate: no license declared.
