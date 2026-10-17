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
            tgt = os.readlink(p)
            hit = next((v for k, v in REPO_MAP.items() if tgt.startswith(k)), None)
            if hit:
                mapping[n] = {"repo": hit, "path": tgt.replace(SK + "/", "")}
            else:
                unresolved.append(n)
        elif n.startswith("mantis-"):
            mapping[n] = {"repo": "https://github.com/google/mantis", "path": n + "/SKILL.md"}
        elif n in MANUAL:
            repo, path = MANUAL[n]
            mapping[n] = {"repo": repo, "path": path + "/SKILL.md"}
        elif os.path.exists(os.path.join(p, "SKILL.md")) and n in lock:
            entry = lock[n]
            mapping[n] = {
                "repo": entry.get("sourceUrl", "").replace(".git", ""),
                "path": entry.get("skillPath", ""),
            }
        elif os.path.exists(os.path.join(p, "SKILL.md")):
            unresolved.append(n)
    return mapping, unresolved


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
        "# cloned repos: pulling is enough, ~/skills symlinks follow automatically",
    ]
    for repo, (mode, where) in MANAGED.items():
        if mode == "cloned":
            o.append("git -C %s pull" % where)
    o += [
        "",
        "# pi-ponytail (5 skills) ships as an npm package",
        "npm --prefix ~/.pi/agent/npm update pi-ponytail",
        "",
        "# everything else was copied in, not cloned. to refresh any of them:",
        "#   tmp=$(mktemp -d)",
        "#   git clone --depth 1 --filter=blob:none --sparse <repo> $tmp/r",
        "#   git -C $tmp/r sparse-checkout set <path>",
        "#   cp -R $tmp/r/<path> ~/skills/<skill>",
        "",
        "# to recover a skill removed upstream, fetch it from the commit before the removal:",
        "#   git clone --filter=blob:none --no-checkout https://github.com/nousresearch/hermes-agent $tmp/h",
        "#   git -C $tmp/h checkout c49fa88b~1 -- skills/github/github-auth",
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
        "These 12 are hermes-agent skills whose paths no longer exist. The lock file still claims the old "
        "paths, so a naive re-install would fail. All were changed in "
        "`c49fa88b` (2026-08-30, \"shipped-set slim\"), reachable with `c49fa88b~1`."
    )
    o += ["", "| skill | current status upstream |", "|---|---|"]
    o += ["| `%s` | %s |" % (k, HERMES_DRIFT[k]) for k in sorted(HERMES_DRIFT)]
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
    print("resolved %d | unresolved %s" % (len(mapping), unresolved or "none"))


if __name__ == "__main__":
    main()
