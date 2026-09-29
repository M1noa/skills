# Tooling

Per-language scanner and triage cheat sheet. Run relevant tools in Phase 1/2 and feed their output into the manual hunt as **leads to verify, not findings to report verbatim** — see [VALIDATION-AND-REPORTING.md](VALIDATION-AND-REPORTING.md) rule 6 (scanner hits are leads, not findings).

A clean scanner run is not a clean bill of health. A scanner hit is a lead, not a conclusion.

## Multi-language / SAST

| Tool | Languages | What it catches | Run |
|------|-----------|------------------|-----|
| **Semgrep** | Most | Injection, insecure patterns, custom rules | `semgrep --config=p/default --config=p/security-audit --config=p/owasp-top-ten .` |
| **CodeQL** | JS/TS, Python, Go, Java, C/C++, C#, Ruby | Deep data-flow, taint tracking | `codeql database create db && codeql database analyze db codeql/python-queries` |
| **GitHub CodeQL** (gh codeql) | Same as CodeQL | Same, in CI | `gh codeql analyze` |

Always check for a repo-local Semgrep/CodeQL config first — reuse the project's rules before adding your own.

## Per-language

### Python
- **bandit**: `bandit -r src -f json -o bandit.json` — broad insecure-pattern sweep.
- **pip-audit** / **safety** / **osv-scanner**: `pip-audit` / `safety check` / `osv-scanner scan --lockfile requirements.txt` — known-bad dependencies.
- **ruff** (preview rules): `ruff check --select=S --preview` — flake8-bandit-equivalent built into the linter.
- **pyright/mypy**: type-check untrusted-input flows into typed-vs-untyped boundaries.

### JavaScript / TypeScript (Node)
- **npm audit** / **pnpm audit** / **yarn audit**: dependency CVEs.
- **osv-scanner**: `osv-scanner scan --lockfile package-lock.json` — cross-ecosystem.
- **eslint-plugin-security**: `npx eslint --plugin security` — `eval`, `child_process`, regex DoS.
- **Semgrep JS rules**: `p/javascript` — prototype pollution, ReDoS, ssrf.

### Go
- **gosec**: `gosec -fmt=json ./...` — broad Go security sweep.
- **govulncheck**: `govulncheck ./...` — actually-reachable stdlib/module CVEs (better than `go list -m -u all`).
- **gitleaks** (any lang): `gitleaks detect --source .` — committed secrets.

### Rust
- **cargo audit**: `cargo audit` — advisory DB for crates.
- **cargo deny**: `cargo deny check` — licenses, bans, advisories in one config.
- **clippy** (with `cargo clippy -- -W clippy::all`): catches some unsafe patterns.
- Manual: grep `unsafe { }` blocks — every one is a manual audit point.

### C / C++
- **clang static analyzer**: `scan-build make` — path-sensitive analysis.
- **clang-tidy** (cert/bugprone checks): `clang-tidy -checks='cert-*,bugprone-*,security-*'` — CERT/SEI rules.
- **cppcheck**: `cppcheck --enable=all --inconclusive` — broad static check.
- **flawfinder**: cheap pattern-based sweep for known-bad C functions (`gets`, `strcpy`, `sprintf`).
- **ASan/UBSan/MSan** (runtime): compile with `-fsanitize=address,undefined,memory` — see [MEMORY-SAFETY-AND-BINARY.md](MEMORY-SAFETY-AND-BINARY.md).
- **CodeQL C/C++ queries**: `codeql/cpp-queries` — memory safety, integer overflow.

### Java / Kotlin (JVM)
- **spotbugs** + **find-sec-bugs**: `spotbugsCheck -Pfindsecbugs` — deserialization, XSS, SQLi.
- **dependency-check** (OWASP): `dependency-check --project X --scan pom.xml` — CVE scan.
- **Semgrep java**: `p/java` — injection, XML, JNDI.

### Ruby
- **brakeman**: `brakeman -o brakeman.json` — Rails-specific, the gold standard for Rails apps.
- **bundler-audit**: `bundle audit check --update` — gem CVEs.

### PHP
- **psalm** (taint analysis): `psalm --taint-analysis` — Psalm's taint analysis is the best for PHP injection.
- **phpcs-security-audit** / **progpilot**: legacy pattern sweeps.

### C# / .NET
- **SecurityCodeScan** (SCS): `dotnet build -p:RunCodeAnalysis=true` — deserialization, XAML, SQL.
- **Semgrep csharp**: `p/csharp` — injection, deserialization.

### Swift / iOS
- **Semgrep swift**: limited ruleset.
- Manual: review `Keychain` access, `WKWebView` JS bridge, URL-scheme handlers, ATS bypasses.

### Solidity / Smart contracts
- **slither**: `slither .` — the de-facto Solidity static analyzer (reentrancy, unchecked math, shadowing).
- **mythril** / **manticore**: symbolic execution — deeper but slower.
- **semgrep solidity**: `p/solidity` — community rules.
- See [WEB-PROTOCOL-AND-AUTH.md](WEB-PROTOCOL-AND-AUTH.md) for Web3 protocol-layer checks.

### Infrastructure-as-Code / Cloud
- **tfsec** / **checkov** / **kics**: scan Terraform, CloudFormation, Kubernetes manifests.
- **kube-bench**: CIS Kubernetes benchmark.
- **kube-hunter**: active Kubernetes attack simulator (Pentest mode).

## Cross-cutting

- **gitleaks** / **trufflehog** / **ggshield**: committed secrets, across git history.
- **osv-scanner**: cross-ecosystem vulnerability DB, one tool for npm+pip+go+maven+etc.
- **syft** + **grype**: SBOM generation + SBOM vulnerability matching.

## Fuzzing (for binaries and parsers)

- **libFuzzer** (C/C++ in-process): `clang -fsanitize=fuzzer,address` then run harness.
- **AFL++** (C/C++ out-of-process): persistent mode for parsers; instrumented builds.
- **cargo-fuzz** (Rust): `cargo fuzz run target` — libAFL-based.
- **go-fuzz** / **fuzzing** (Go): pre-native-fuzz coverage.
- **Jazzer** (JVM): libFuzzer for Java.
- **afl-fuzz + grammar**: for structured inputs (SQL, JSON, XML, file formats).
- **honggfuzz**: hardware-perf-counter driven, good for complex targets.
- **boofuzz** / **kitty**: network protocol fuzzers.

For harness construction and crash interpretation, see [MEMORY-SAFETY-AND-BINARY.md](MEMORY-SAFETY-AND-BINARY.md).

## Dynamic / DAST (web)

- **ZAP** (OWASP ZAP): `zap-cli quick-scan http://target` or `zap-cli active-scan`. Active scan = lead source, not finding source.
- **nuclei**: `nuclei -u https://target -t cves/ -t exposures/ -t misconfiguration/` — template-driven, very fast for known exposure checks.
- **ffuf** / **feroxbuster** / **gobuster**: content/parameter/vhost brute — for finding hidden surfaces in Phase 1.
- **sqlmap**: only after you've identified a candidate injection point — never as a blind scanner against prod.

## Mapping to MITRE ATT&CK and OWASP WSTG

When reporting, tag findings with both:

- **MITRE ATT&CK technique IDs** where the issue enables an adversary technique (e.g., `T1190` Exploit Public-Facing Application, `T1059.004` Unix Shell, `T1611` Escape to Host, `T1556.003` PAM, `T1055.012` Process Hollowing). The 15 Enterprise tactics are: Reconnaissance, Resource Development, Initial Access, Execution, Persistence, Privilege Escalation, Stealth, Defense Impairment, Credential Access, Discovery, Lateral Movement, Collection, Command and Control, Exfiltration, Impact. Cross-reference at https://attack.mitre.org/.
- **OWASP WSTG identifiers** (`WSTG-<category>-<number>`) for web testing: `WSTG-INFO-*` (Information Gathering), `WSTG-CONF-*` (Configuration), `WSTG-IDNT-*` (Identity Management), `WSTG-ATHN-*` (Authentication), `WSTG-ATHZ-*` (Authorization), `WSTG-SESS-*` (Session), `WSTG-INPV-*` (Input Validation), `WSTG-ERRH-*` (Error Handling), `WSTG-CRYP-*` (Cryptography), `WSTG-BUSL-*` (Business Logic), `WSTG-CLNT-*` (Client-side), `WSTG-APIT-*` (API Testing). Catalog: https://owasp.org/www-project-web-security-testing-guide/.

Tags make findings machine-filterable and let downstream agents dedupe / chain faster.
