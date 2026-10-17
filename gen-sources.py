#!/usr/bin/env python3
"""regenerate SOURCES.md from the live ~/skills tree.

resolution order: symlink target -> mantis- prefix -> manual map -> skill lock file.
run after adding/removing skills:  python3 gen-sources.py
"""
import collections
import json
import os

SK = os.path.expanduser("~/skills")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "GOOD-SKILLS.md")
REG = os.path.join(SK, "sources.tsv")  # machine-readable registry, read by update.sh
LOCK = os.path.expanduser("~/.agents/.skill-lock.json")

REPO_MAP = {
    "/Users/minoa/skills/.repos/scientific-agent-skills/skills/": "https://github.com/K-Dense-AI/scientific-agent-skills",
    "/Users/minoa/skills/.repos/claude-red/Skills/": "https://github.com/SnailSploit/claude-red",
    "/Users/minoa/Documents/Projects/skills/skills/": "https://github.com/M1noa/skills",
    "/Users/minoa/.pi/agent/npm/node_modules/pi-ponytail/skills/": "https://github.com/thelegendtubaguy/pi-ponytail",
}

MANUAL = {
    "libraries-dev": ("https://github.com/Jakubantalik/Libraries.dev", "skills/libraries-dev"),
    "reverse-engineer-anything": ("https://github.com/morluto/rea", ".agents/skills/reverse-engineer-anything"),
    "hallmark": ("https://github.com/Nutlope/hallmark", "skills/hallmark"),
    "modern-web-guidance": ("https://github.com/GoogleChrome/modern-web-guidance", "skills/modern-web-guidance"),
    "chrome-extensions": ("https://github.com/GoogleChrome/modern-web-guidance", "skills/chrome-extensions"),
}

# repos we keep a local clone of, so updating is a pull
MANAGED = {
    "https://github.com/K-Dense-AI/scientific-agent-skills": ("cloned", "~/skills/.repos/scientific-agent-skills"),
    "https://github.com/SnailSploit/claude-red": ("cloned", "~/skills/.repos/claude-red"),
    "https://github.com/M1noa/skills": ("cloned", "~/Documents/Projects/skills"),
    "https://github.com/thelegendtubaguy/pi-ponytail": ("npm", "~/.pi/agent/npm/node_modules/pi-ponytail"),
}

# upstream paths that moved after the lock file was written. the lock still
# claims the old path, so resolve these by name instead.
MOVED = {
    "blocked-page-recovery": "skills/web/blocked-page-recovery",
    "codebase-inspection": "skills/software-development/codebase-inspection",
    "excalidraw": "optional-skills/creative/excalidraw",
    "huggingface-hub": "optional-skills/mlops/models/huggingface-hub",
    "llama-cpp": "optional-skills/mlops/inference/llama-cpp",
    "research-paper-writing": "optional-skills/research/research-paper-writing",
}

# hermes-agent skills whose upstream path moved or vanished in commit c49fa88b
HERMES_DRIFT = {
    "merge-reconciler": "renamed -> `optional-skills/autonomous-ai-agents/agent-merge-conflict-arbiter/`",
    "touchdesigner-mcp": "moved to the optional-skills hub, then dropped. git history at `c49fa88b` only",
    "github-auth": "merged into `skills/software-development/github` (git history at `c49fa88b`)",
    "github-code-review": "merged into `skills/software-development/github/references/code-review.md`",
    "github-issue-to-pr": "merged into `skills/software-development/github/references/issue-to-pr.md`",
    "github-issues": "merged into `skills/software-development/github/references/issues.md`",
    "github-pr-workflow": "merged into `skills/software-development/github/references/pr-workflow.md`",
    "github-repo-management": "merged into `skills/software-development/github` (git history at `c49fa88b`)",
    "nano-pdf": "merged into `skills/productivity/pdf` as a reference + script",
    "ocr-and-documents": "merged into `skills/productivity/pdf`",
    "session-librarian": "DELETED upstream. never maintainer-intended. git history at `c49fa88b` only",
    "plan": "dropped from HEAD. git history at `c49fa88b`",
}


def resolve(lock):
    mapping, unresolved = {}, []
    for n in sorted(os.listdir(SK)):
        if n.startswith("."):
            continue
        p = os.path.join(SK, n)
        if os.path.islink(p):
            # update.sh is symlinked in here too, and it is not a skill
            if not os.path.isdir(p):
                continue
            tgt = os.readlink(p)
            hit = next(((k, v) for k, v in REPO_MAP.items() if tgt.startswith(k)), None)
            if hit:
                pre, repo = hit
                # normalise to a repo-relative dir: <parent of prefix>/<rest>
                parent = pre.rstrip("/").rsplit("/", 1)[-1]
                mapping[n] = {"repo": repo, "path": "%s/%s" % (parent, tgt[len(pre):])}
            else:
                unresolved.append(n)
        elif n.startswith("mantis-"):
            mapping[n] = {"repo": "https://github.com/google/mantis", "path": n}
        elif n in MANUAL:
            repo, path = MANUAL[n]
            mapping[n] = {"repo": repo, "path": path}
        elif os.path.exists(os.path.join(p, "SKILL.md")) and n in lock:
            entry = lock[n]
            mapping[n] = {
                "repo": entry.get("sourceUrl", "").replace(".git", ""),
                "path": MOVED.get(n, entry.get("skillPath", "").replace("/SKILL.md", "")),
            }
        elif os.path.exists(os.path.join(p, "SKILL.md")):
            unresolved.append(n)
    return mapping, unresolved


def registry(mapping):
    """write sources.tsv: mode, repo, local name, repo-relative upstream dir.

    mode mirrors how the skill is installed locally, which decides how it updates:
      link  symlink into a clone we already keep -> pulling the clone is enough
      copy  real directory -> refetch the upstream dir and copy it over
      npm   symlink into node_modules -> the package manager owns it
    """
    rows = []
    for n, v in sorted(mapping.items()):
        if os.path.islink(os.path.join(SK, n)):
            mode = "npm" if "pi-ponytail" in v["repo"] else "link"
        else:
            mode = "copy"
        rows.append((mode, v["repo"], n, v["path"]))
    with open(REG, "w") as f:
        f.write("# mode\trepo\tname\tupstream dir (repo-relative)\n")
        f.write("# generated by gen-sources.py, read by update.sh\n")
        for r in rows:
            f.write("\t".join(r) + "\n")
    return len(rows)


def render(mapping, unresolved):
    by_repo = collections.defaultdict(list)
    for name, v in mapping.items():
        by_repo[v["repo"]].append(name)

    summary = "**%d skills across %d sources.**" % (len(mapping), len(by_repo))
    summary += (" no traceable source for %d." % len(unresolved)) if unresolved else " all sources identified."
    o = [
        "# skill sources",
        "",
        "where every skill in `~/skills` came from, and how to refresh it.",
        "",
        summary,
        "",
        "regenerate with `python3 gen-sources.py` after adding or removing skills.",
        "",
        "## sources",
        "",
        "| source | skills | local copy | update |",
        "|---|---:|---|---|",
    ]
    for repo, names in sorted(by_repo.items(), key=lambda kv: -len(kv[1])):
        mode, where = MANAGED.get(repo, ("copy", "-"))
        how = {
            "cloned": "`git -C %s pull`" % where,
            "npm": "reinstall the pi-ponytail package",
        }.get(mode, "re-clone, not tracked locally")
        o.append("| [%s](%s) | %d | `%s` | %s |" % (repo.replace("https://github.com/", ""), repo, len(names), where, how))

    o += [
        "",
        "## update",
        "",
        "```bash",
        "~/skills/update.sh              # pull every source, sync the copied-in skills",
        "~/skills/update.sh --dry-run    # show what would change, write nothing",
        "~/skills/update.sh --prune      # also delete local files upstream removed",
        "~/skills/update.sh --list-new   # upstream skills not installed here",
        "```",
        "",
        "`update.sh` reads `~/skills/sources.tsv`, the registry this generator writes. "
        "Regenerate both with `python3 gen-sources.py`.",
        "",
        "A skill updates one of two ways, decided by how it is installed locally:",
        "",
        "| installed as | update | which skills |",
        "|---|---|---|",
        "| symlink into a local clone | `git pull` on the clone, nothing else | the four cloned sources |",
        "| real directory | refetched from upstream and copied over | hermes, modern-web-guidance, hallmark, Libraries.dev, rea |",
        "",
        "Each source is cloned once into `~/skills/.repos/<name>` and kept, so later runs only fetch. "
        "To recover a skill dropped upstream, check out the commit before the removal:",
        "",
        "```bash",
        "git -C ~/skills/.repos/hermes-agent log --oneline -- skills/github/github-auth",
        "git -C ~/skills/.repos/hermes-agent checkout c49fa88b~1 -- skills/github/github-auth",
        "```",
        "",
    ]

    if unresolved:
        o += [
            "## no source found",
            "",
            "| skill | note |",
            "|---|---|",
        ]
        o += ["| `%s` | |" % n for n in unresolved]
        o.append("")

    o += ["## upstream drift", ""]
    o.append(
        "Twelve hermes-agent skills whose upstream paths no longer exist. All changed in "
        "`c49fa88b` (2026-08-30, \"shipped-set slim\"), reachable with `c49fa88b~1`."
    )
    o += ["", "| skill | current status upstream |", "|---|---|"]
    o += ["| `%s` | %s |" % (k, HERMES_DRIFT[k]) for k in sorted(HERMES_DRIFT)]

    o += [
        "",
        "A further six moved without being renamed, and are still installed. The lock file "
        "claims the old path, so `gen-sources.py` carries the new one in `MOVED`. If "
        "`update.sh` reports one as missing upstream, its path moved again.",
        "",
        "| skill | upstream path now |",
        "|---|---|",
    ]
    o += ["| `%s` | `%s` |" % (k, MOVED[k]) for k in sorted(MOVED)]
    o += [
        "",
        "`camoufox/` and `software-development/` are category dirs, not skills "
        "(`software-development/hermes-agent-skill-authoring` is the skill).",
        "",
        "## full inventory",
        "",
        "| skill | source | path in source |",
        "|---|---|---|",
    ]
    for repo, names in sorted(by_repo.items()):
        for n in sorted(names):
            o.append("| `%s` | %s | `%s` |" % (n, repo.replace("https://github.com/", ""), mapping[n]["path"]))
    return "\n".join(o) + "\n"


def main():
    lock = json.load(open(LOCK))["skills"]
    mapping, unresolved = resolve(lock)
    with open(OUT, "w") as f:
        f.write(render(mapping, unresolved))
    print("wrote %s" % OUT)
    print("wrote %s (%d rows)" % (REG, registry(mapping)))
    print("resolved %d | unresolved %s" % (len(mapping), unresolved or "none"))


if __name__ == "__main__":
    main()
