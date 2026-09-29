# AGENT.md

agent skill collection. canonical source for three skills, synced to local claude code / opencode dirs.

## Setup

copy or symlink `skills/<name>` into `~/.claude/skills/` or `~/.config/opencode/skills/`.

## Architecture

- `skills/security-audit/` — canonical copy is `~/.claude/skills/security-audit/` (the opencode copy has extra run output, not tracked here). edit there, then copy SKILL.md over.
- `skills/project-audit/`, `skills/anti-slop/` — symlinked from claude skills into opencode dirs, so either path edits the same files.

## Gotchas

- never commit audit run output (`findings/`, `reproducers/`, `AUDIT_TRACKER.json`, etc.) — skills only.
- keep the three skills' frontmatter (`name`, `description`, `license`) intact; loaders key off it.
