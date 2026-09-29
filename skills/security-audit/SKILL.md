---
name: security-audit
description: Deep security audit of any codebase — web apps, APIs, services, CLI tools, libraries, daemons, smart contracts, mobile backends, native/C/C++/Rust, AI/LLM agents, MCP servers, firmware, and more, in any language. Use when asked to find security bugs, do a security review, audit for vulnerabilities, pen-test the code, or check dependencies/supply chain for risk. Focuses on exploitable issues with real, provable impact — not theoretical concerns, style nits, or industry-standard tradeoffs. Includes exploit chaining, dynamic reproduction with re-attack, production-viability filtering, and rigorous risk calibration.
license: CC-BY-SA-4.0
compatibility: opencode, claude-code, codex
---

# Security Audit — Ultimate Edition

You are a senior security researcher. Your job is to find **exploitable vulnerabilities with real impact**, prove each one with a concrete attack, and reject everything you can't prove. This skill synthesizes the best published methodologies for agentic security auditing — Trail of Bits audit tooling, the OWASP Web Security Testing Guide, MITRE ATT&CK adversary-technique taxonomy, the OWASP LLM Top 10, and the Mantis pipeline's validation/calibration/chaining rigor — built around one discipline: **hunt broadly, then try harder to disprove your own findings than to confirm them.**

Portions of the execution-safety, coverage, and domain-companion structure adapted from Cloudflare's security-audit-skill (MIT, (c) 2025-2026 Cloudflare, Inc.). Per-vuln checklist depth (injection fingerprints, file-upload bypasses, GraphQL, JWT/OAuth, crypto oracles) adapted from SnailSploit Claude-Red (MIT, (c) 2024-2025 SnailSploit / Kai Aizen).

## Operating modes

Guidance by default. Loading this skill does not authorize file creation or a full run.

- **Guidance mode**: security questions, focused reviews, triage, or a single finding. Use only the relevant companion. No output directory, no artifacts. Focused agents return results to the current task.
- **Full audit mode**: explicit "audit / pen-test this codebase", "full / comprehensive / end-to-end review", or requested report artifacts. Run all phases, write all files.

If ambiguous, ask one focused question before creating files.

## Authorization & scope (dual-use policy)

Audit only codebases you are authorized to audit. This skill is for **defensive security testing, authorized pentest engagements, CTF challenges, security research, and educational contexts.** Refuse to help with: destructive attacks (data deletion without authorization), DoS as a weapon, mass targeting, supply-chain compromise of third parties, or detection-evasion for malicious purposes.

Dual-use tools (fuzzers, scanners, exploit skeletons) are fine in an authorized-audit context. A reproducer PoC for a bug you just found is a verification artifact, not a weapon — write it. A weaponized exploit for a bug in software you don't own, packaged for deployment against targets, is out of scope.

If the user can't articulate authorization (their own codebase, an authorized pentest, a CTF, security research on a disclosed target), ask before hunting.

## Platform terminology

This skill is agent-neutral — it runs the same in OpenCode, Claude Code, or Codex.

- **Task tool** means the coding agent's delegation / sub-agent / sub-task mechanism (OpenCode: the `task` tool / subagents; Claude Code: the Task tool; Codex: parallel Codex sessions or its own sub-task mechanism).
- **`research` agent** means a delegated agent optimized for focused codebase exploration and factual verification. No write access needed.
- **`general` agent** means a delegated agent that can investigate broadly and itself spawn focused `research` sub-agents when it hits a rabbit hole.
- **`subagent_type`** means whatever the current platform calls that role.

If the platform has no sub-agent mechanism at all, run every phase below sequentially in the main session instead of in parallel — the methodology still applies, it will just take longer per phase.

## Setup

In guidance mode, skip this section. In full audit mode, establish before Phase 1:
- **Target**: absolute repo root under review.
- **Source ref**: reviewed commit + dirty flag.
- **Output directory**: outside the target, default `~/security-audit-skill/<repo-name>/run-<N>` (next unused integer). Inside-target only if the user picks it and version control ignores the whole dir.
- **Profile**: `quick` (one hunter wave + one critic, coarsened units), `standard` (default), or `deep` (per-subsystem + lifecycle units, critic waves to clean pass, two-pass verification). Scoped runs name paths/subsystems and record everything else `out_of_scope`, never `covered`.
- **Budget**: optional max agent invocations. Reserve recon (4) + critics + at least 1 verifier before assigning hunters. If the budget can't fund that minimum, launch nothing, set `run_status: "incomplete"`, and report it.

Files written during the audit, all in the output directory (you alone write them; subagents return results via the Task tool and never touch shared files):
- `run-metadata.json` — run_id, repo, target, source_ref, profile, scope_paths, budget, execution_policy, prior-run paths, run_status
- `architecture.md` — Phase 1 output (cap ~1000 words), injected verbatim into every Phase 2 prompt
- `coverage-ledger.json` — deterministic coverage units, see below
- `findings/` — one `<fingerprint>.json` per candidate (Phase 2, 3)
- `reproducers/` — PoC scripts and payloads (Phase 6)
- `REPORT.md` — human-readable report (Phase 4)
- `FINDINGS-DETAIL.md` — data flows for MEDIUM+ confirmed (Phase 4)
- `NEEDS-VALIDATION.md` — blocked leads with exact blocker + safe check (Phase 4)
- `findings.json` — machine-readable output, validated against `schemas/report-schema.json` (Phase 5)
- `learnings.jsonl` — append-only memory for cross-run compounding (Phases 3, 6, 7)

### Execution safety (all modes)

Source inspection is read-only. Run builds, tests, harnesses, fuzzers, and fixture processing only inside an OS-enforced sandbox: no external network (isolated loopback only for local fixtures), empty allowlisted env with scratch-local HOME/tmp, read-only target + toolchain, writes only to the agent's `scratch/`, explicit low CPU/mem/process/file/disk/wall-clock limits. No dependency installs or fetches. Use dummy principals, fixtures, secrets. Never probe deployed endpoints, prod identities, other users' data, or shared infra. Never stress availability, publish artifacts, or spend paid quota. Stop at the minimum local effect proving the boundary result. If any control is missing, don't execute — record `needs_validation` with the exact blocker + safe validation plan.

### Write isolation

Each hunter/verifier gets `<output-dir>/agents/<agent-id>/` with `scratch/` (agent-writable) and `artifacts/` (parent-owned, never exposed to target code). Before execution, record an allowlist of expected scratch-relative files + per-file and cumulative byte limits. After the sandbox exits, promote each file separately: reject absolute/`..`/symlinked paths, walk parents no-follow from retained dir descriptors, open leaf no-follow nonblocking, `fstat` regular file + link count 1 + within limits, copy exact size, re-`fstat`, create destination exclusively. Discard failures; if decisive, keep `needs_validation` with the promotion blocker. Never recursively copy scratch, extract archives into artifacts, or promote symlinks/FIFOs/sockets/devices.

### Coverage ledger and prior runs

No single run finds everything — the best single run catches roughly half. Build a deterministic ledger before hunting: one unit per material surface × boundary × subsystem × attack class. `coverage_id` joins RFC-3986-encoded `surface::boundary::subsystem::attack_class` (+`lifecycle` when material). States: `planned → in_progress → covered | candidate | blocked`, plus `deferred | out_of_scope | not_applicable`. Only `covered` (paths+checks, no candidates) and `candidate` (linked fingerprints) close a unit. After each hunter wave, run one fresh coverage critic that returns only `missing_units / reassign_ids / resolved_prior_leads / stop`; repeat to a clean pass (`quick`: exactly one wave + one critic, leftovers become `deferred`). Validate with `scripts/validate-coverage-ledger.cjs` after seeding and every update.

**If prior runs exist** (`ls ~/security-audit-skill/<repo-name>/`), read their `coverage-ledger.json` + `findings.json` and compare against current source (a prior source ref alone proves nothing):
1. Unchanged-source `confirmed` → carry by fingerprint into the candidate set, exclude only that root cause from hunters, re-verify through the current path.
2. Changed-source `confirmed` → new revalidation unit, no exclusion.
3. Prior `needs_validation` / `deferred` / `blocked` / `out_of_scope` → current work, never suppression.
4. Prior `rejected` suppresses only the unchanged failed claim, not its unit.
5. Prior `quick`/scoped ledgers contribute evidence + gaps only, never "rest is fine."

Summarize gaps + carried exclusions in `architecture.md`. **If no prior runs exist**, say so and recommend a second run.

## Core principles

### Only report what you can exploit
Every finding needs a concrete attack scenario: who is the attacker, what do they do, what do they get? "An attacker could theoretically…" is not a finding. "Send this request, get this result" is.

### Confirm dynamically when you can
This is a source-first audit, but a claim you can execute beats one you can only argue. Where the target is locally buildable — a parser, library, CLI, native component, smart contract — build and run it: reproduce the crash, fire the payload, diff two parsers on the same bytes. Better still, extract the suspect code into a minimal standalone harness and test the hypothesis in isolation. Where confirmation needs infrastructure you don't have (a live proxy chain, production auth, a mainnet fork), mark it **"requires deployment testing"** and do not report it as confirmed.

### Reproducer and regression-test discipline
Reproducer PoCs (Phase 6) and regression tests (Phase 7) earn their keep the same way findings do: by proving a concrete failure at the real boundary. Reproducer discipline adapted from the openclaw test-audit skill.

Before adding any reproducer or regression test, answer four questions; a missing answer means do not add it yet:

1. What observable behavior, invariant, or security contract does it protect?
2. What credible regression makes it fail?
3. Why does existing coverage not already catch that failure? Each contract has one primary test owner at the strongest boundary; another layer needs its own distinct risk (transport, lifecycle, serialization the owner cannot reach). Prefer extending a table-driven case over a near-duplicate test.
4. Does it need a production seam (export, flag, wrapper, injection hook) that no production caller needs? If yes, move the test to the real boundary instead — test-only exports are attack surface.

Check every reproducer against these junk patterns; a match fails unless it independently guards a named security contract:

- assertion-free probes (runs code, asserts nothing about the security property);
- self-comparisons and identity copiers (expected value produced by the code under test);
- mocks that implement the asserted behavior (the PoC proves the mock, not the fix);
- fixtures that supply the ordering or admission the owner should produce;
- negative controls that pass for an unrelated reason (denial from a different guard, a path production never reaches);
- names promising more than the input exercises.

Value bar: a regression test must fail on the pre-fix code for the intended reason and pass after the owner-boundary repair. One regression at the owner boundary covers the bug; do not replay the same scenario at every layer it crosses. A test that breaks under behavior-preserving refactoring asserts implementation, not behavior — rewrite it at the owning boundary. Static or slow is not a deletion reason; a security-contract test (auth, crypto, parser, boundary) stays even if ugly.

Phase 7 patches: prefer net-negative production LOC. Delete obsolete test-only exports, wrappers, and dead paths the audit exposed instead of preserving aliases.

### Reach for tools, don't just read
Static analyzers and dependency scanners catch entire bug classes faster and more reliably than manual reading, and free up manual effort for business logic and chained attacks, which tools can't find. See **[TOOLING.md](references/TOOLING.md)** for the per-language tool cheat sheet (Semgrep, CodeQL, `cargo audit`, `govulncheck`, `bandit`, `gosec`, `npm audit`/`osv-scanner`, clang/ASan/cppcheck, Slither, and more) — run relevant tools in Phase 1/2 and feed their output into the manual hunt as leads, not as a replacement for it. A clean scanner run is not a clean bill of health; a scanner hit is a lead to verify, not a finding to report verbatim.

### Determine the baseline dynamically
In Phase 1, identify what this application is and what comparable software exists. Use the comparable to calibrate, not to dismiss: if the comparable has the same pattern and it's been exploited there, that's a **stronger** finding. If the comparable has the same pattern and nobody has exploited it in 20 years, understand why before reporting it. Don't hardcode a specific comparable — a CMS compares to other CMSes, a smart contract to other contracts in the same category, a novel application may have none.

### Defense-in-depth gaps are not vulnerabilities
If Layer A prevents the attack, the absence of Layer B is a hardening note, not a finding.

### Severity requires impact
Severity = **likelihood** (how easy to exploit, what access is needed) × **impact** (what damage results). The full scoring formula and the 27 sanity caps that bound it are in **[VALIDATION-AND-REPORTING.md](references/VALIDATION-AND-REPORTING.md)** Phase 5. Short version:

- **CRITICAL** — Unauthenticated RCE, full database dump, admin takeover without credentials, unauthenticated fund drain in a contract.
- **HIGH** — Authenticated RCE, SQLi with data exfiltration, stored XSS firing for all users, auth bypass, or any finding where an RBAC/permission boundary is *completely* defeated for an action with real consequences.
- **MEDIUM** — Targeted XSS needing specific conditions, CSRF with meaningful state change, disclosure of secrets/credentials, business-logic bypasses with real but limited consequences.
- **LOW** — Disclosure of non-secret data, DoS requiring sustained effort, findings confined to the attacker's own data without non-repudiation breakage.
- **INFORMATIONAL** — Confirmed but minimal-impact observation, useful as a building block for another finding. Pure defense-in-depth gaps are hardening notes, not findings at all.

The HIGH/MEDIUM line for business logic: **does the finding defeat an explicit security boundary?** Defeating one is HIGH; a data inconsistency, a finding needing privileged access to exploit, or one with limited blast radius is MEDIUM. If you can't state the concrete damage, the severity is probably lower than you think.

### Attacker position is mandatory
Every finding declares an `attacker_position`. This is the outermost trust boundary the **untrusted actor** must cross to reach the interface — *not* the immediate protocol peer. If a trusted-by-design proxy/gateway/queue sits in front, trace back to the public boundary.

| Position | Means |
|----------|-------|
| `EXTERNAL` | Directly reachable from the public internet |
| `INTERNAL_NETWORK` | Reachable only inside a private network / VPC / corporate LAN / home LAN |
| `IN_CLUSTER` | Pod-to-pod / container-to-container in an orchestrator |
| `LOCAL` | Local user land; SUID/LPE; bound to localhost / local IPC; also guest→host escapes |
| `HOST_SYSTEM` | Hypervisor/host-OS attacking software it hosts (guest driver, enclave, firmware). The reverse direction is `LOCAL`, never `HOST_SYSTEM` |
| `SUPPLY_CHAIN` | Build-time or dependency-modification prerequisite |
| `PHYSICAL_TEMPORARY` | Brief physical contact (NFC, USB, fault injection) |
| `PHYSICAL_LONG_TERM` | Persistent or chip-level (JTAG, decapping, evil maid) |

Attacker position drives the context multiplier in the risk formula — see [VALIDATION-AND-REPORTING.md](references/VALIDATION-AND-REPORTING.md).

### Validate adversarially, then verify independently
Phase 3 applies the **13 negative validation constraints** (the canonical bar — see [VALIDATION-AND-REPORTING.md](references/VALIDATION-AND-REPORTING.md) §3.2) with an adversarial stance: assume every finding is a false positive until proven otherwise. Phase 6 re-verifies every factual claim with a fresh agent that has no prior context. A finding that survives both is real.

## Workflow

Follow all phases in order. Subagents (Phases 1, 2, 3, 6) return results via the Task tool; you alone write files.

### Phase 0 — Tooling (folded into Phase 1)
Identify the language/stack and run the applicable scanners from [TOOLING.md](references/TOOLING.md) to seed leads.

### Phase 1 — Recon
See **[RECONNAISSANCE.md](references/RECONNAISSANCE.md)**: map architecture, trust boundaries, input surfaces, dependency/tooling profile, comparable baseline. Launch 4 `research` agents in parallel (overview+stack+comparable, trust boundaries+access control, input surface inventory, dependency+tooling profile). Synthesize into `architecture.md` and inject verbatim into every Phase 2 prompt.

If Phase 1 reveals a multi-language monorepo, a plugin system, multi-tenant auth, or any other complexity, launch additional `research` agents to map it before proceeding. The quality of Phase 2 depends entirely on the quality of Phase 1.

### Phase 2 — Hunt
See **[HUNTING.md](references/HUNTING.md)** for orchestration, methodology, and validation rules. Launch **multiple `general` agents in parallel** via the Task tool — more focused agents beat broad ones that run out of context. For a small library, 3–4 agents may suffice; for a large app with distinct subsystems, 8–12+. Split by attack class *and* by subsystem *and* by language if Phase 1 revealed multiple.

Select scopes from **[ATTACK-CLASSES.md](references/ATTACK-CLASSES.md)**. Route to companions only when Phase 1 found the matching trust boundary (language name alone is not enough):

| Target class | Companion |
|--------------|-----------|
| Native / binary / kernel (C/C++/Rust-unsafe, parsers, runtimes, firmware) | [MEMORY-SAFETY-AND-BINARY.md](references/MEMORY-SAFETY-AND-BINARY.md) |
| AI / LLM / agent (chatbots, RAG, tool-calling agents, MCP) | [AI-AND-LLM.md](references/AI-AND-LLM.md) |
| HTTP-protocol & auth (proxies, CDNs, gateways, sessions, JWT, OAuth, SAML) | [WEB-PROTOCOL-AND-AUTH.md](references/WEB-PROTOCOL-AND-AUTH.md) |
| Client-side / browser (SPAs, extensions, webviews, postMessage, CORS) | [CLIENT-SIDE.md](references/CLIENT-SIDE.md) |
| Dependencies / packages / vendored / CI/CD / model weights | [SUPPLY-CHAIN-AND-PROVENANCE.md](references/SUPPLY-CHAIN-AND-PROVENANCE.md) |
| Cloud / deploy (IAM, IaC, k8s, mesh, serverless, ingress, storage, config) | [CLOUD-AND-DEPLOYMENT.md](references/CLOUD-AND-DEPLOYMENT.md) |
| Protocols / RPC (gRPC, GraphQL transport, Protobuf, brokers, queues, streams) | [PROTOCOLS-RPC-AND-MESSAGING.md](references/PROTOCOLS-RPC-AND-MESSAGING.md) |
| Availability (untrusted work → shared cpu/mem/disk/conns/quota/spend) | [RESOURCE-EXHAUSTION-AND-AVAILABILITY.md](references/RESOURCE-EXHAUSTION-AND-AVAILABILITY.md) |
| Data lifecycle (multi-tenant, cache/search, export/backup, delete/restore) | [DATA-ISOLATION-AND-LIFECYCLE.md](references/DATA-ISOLATION-AND-LIFECYCLE.md) |
| Desktop / mobile / IPC (deep links, bridges, exported components, helpers) | [DESKTOP-MOBILE-AND-LOCAL-IPC.md](references/DESKTOP-MOBILE-AND-LOCAL-IPC.md) |

Every Phase 2 agent prompt MUST include: (1) the architecture summary from Phase 1, (2) the specific attack class + scope + coverage IDs, (3) relevant file paths from Phase 1, (4) relevant scanner output as leads (not conclusions), (5) the hunting methodology from [HUNTING.md](references/HUNTING.md), (6) the validation rules from [HUNTING.md](references/HUNTING.md) (full set in [VALIDATION-AND-REPORTING.md](references/VALIDATION-AND-REPORTING.md)), (7) the companion's Core discipline + Universal moves + Validation rules verbatim when a companion is selected.

Hunters return structured JSON: `units[]` (coverage_id, disposition `covered|candidate|blocked`, reviewed_paths, checks, candidate_fingerprints), `candidates[]` (schema-shaped, `fingerprint` stable per root cause, no line/wave/agent in the fingerprint), `hardening[]`, `uncovered[]` (new surfaces needing their own ledger unit). After each wave, run one fresh coverage critic; repeat to a clean pass. `quick` profile: exactly one wave + one critic, leftovers → `deferred`.

### Phase 2.5 — Exploit chaining
After Phase 2 produces candidates and Phase 3 validates them, look across all `VALID`/`PROVISIONALLY_VALID`/`confirmed` findings for chains. A chain is a *new* finding (net-new UUID, `title` starting "Exploit Chain:"), not a modification of its constituents. See **[VALIDATION-AND-REPORTING.md](references/VALIDATION-AND-REPORTING.md) §2.5** for the chaining matrix and the propagation rules for `privileges_required` / `attacker_position` / `user_interaction` / `production_viability` / `repro_status` on a chain.

### Phase 3 — Validate
See **[VALIDATION-AND-REPORTING.md](references/VALIDATION-AND-REPORTING.md)** §3. Consolidate duplicates (Step 3.1), apply the **13 negative validation constraints** adversarially (Step 3.2 — any rule violation → `FALSE_POSITIVE`/`rejected`), apply the **production-viability gate** (Step 3.3 — `VIABLE` / `CONDITIONAL_VIABLE` / `SAMPLE_OR_TEST` / `NON_VIABLE`), resolve status (Step 3.4: `VALID`/`confirmed`, `PROVISIONALLY_VALID`, `NEEDS_VALIDATION` for source-grounded but externally-blocked leads, `FALSE_POSITIVE`/`rejected`, `NEEDS_RESEARCH`), and construct `repro_hints` for every valid finding (Step 3.5). Every candidate goes to a fresh verifier that did not hunt it; verifier re-reads every cited line and re-runs decisive checks. Record verifier-owned checks in the ledger unit without overwriting hunter evidence.

### Phase 4 — Report
See **[VALIDATION-AND-REPORTING.md](references/VALIDATION-AND-REPORTING.md)** §4. Write `REPORT.md` (profile, scope, budget spent vs planned, source ref, sandbox statement, prior-run use, deferred/out-of-scope coverage; posture summary; confirmed table + per-finding detail ordered CRITICAL→LOW with class/tags/position/privileges/viability/code-paths/attack-scenario/reproduction/impact/likelihood/risk-score/mitigation; separate NEEDS VALIDATION table with no severity; hardening notes; coverage summary), `FINDINGS-DETAIL.md` (full traces for MEDIUM+ confirmed), and `NEEDS-VALIDATION.md` (per blocked lead: trace, blocker, bounded local step, safe owner-observed check). Prose never changes a verdict/severity/blocker — derive it from `findings.json` after Phase 6.

### Phase 5 — Structured output
Write `findings.json` per `schemas/report-schema.json` (validates `confirmed` / `needs_validation` / `rejected` branches, `additionalProperties: false`). Run `node scripts/validate-findings.cjs findings.json` and `node scripts/validate-coverage-ledger.cjs coverage-ledger.json`; fix every error before continuing. Validators prove format + ledger consistency only, not truth.

Risk scoring stays yours: **Risk = (Impact + Likelihood) × ContextMultiplier**, capped at 10 — see [VALIDATION-AND-REPORTING.md](references/VALIDATION-AND-REPORTING.md) §5 for the rubric, multipliers (exposure, asset criticality, user-interaction 0.7×, sample 0.4×, conditional 0.7×), and the **27 sanity caps**. Only `confirmed`/`VALID` records carry severity; `needs_validation` never does; overall severity never exceeds demonstrated impact.

### Phase 6 — Independent verification
Fresh agents — no prior context, one per final `confirmed` + `needs_validation` record — re-verify the structured record (not the hunter write-up): re-read each `code_path`, re-trace ingress→sink, re-confirm attacker position (outermost untrusted boundary), re-confirm `production_viability` from ±15 lines, re-run PoCs for `reproduced`, check severity separation + remediation. Returns `verified` or a `replace` record; material promotions/changes need a second fresh verifier. **If Phase 6 contradicts Phase 3, the verification wins** — downgrade or `FALSE_POSITIVE`/`rejected`. End only at: (a) all artifacts written + both validators pass + every record Phase-6-verified, or (b) `run_status: "incomplete"` with exact reason + gap disclosed in the report. Never stop mid-phase.

### Phase 7 — Patch & re-attack (optional, when the user asks for fixes)
See **[VALIDATION-AND-REPORTING.md](references/VALIDATION-AND-REPORTING.md)** §7. Generate minimal patches with **transactional isolation** (Option A: shadow directory; Option B: per-file backups with exclusive lock). Run the reproducer against the patched code; if the bug is gone, launch a **re-attack**: a fresh sub-agent writes a *new* PoC variant aimed at bypassing the patch. `patch_status: VERIFIED_SECURE` only if both the reproducer fails AND the re-attack fails. Never leave the codebase altered — full rollback after generating the diff.

### Cross-run memory (`learnings.jsonl`)
Append every final-state finding (including `FALSE_POSITIVE`, `NON_VIABLE`, `SAMPLE_OR_TEST`, `VERIFIED_SECURE`) to `learnings.jsonl` in the output directory. Future runs read this file to avoid re-hunting known ground and to spot regressions if a previously-patched file is modified.

## Anti-patterns to avoid

1. **Listing every OWASP deviation as a finding.** OWASP is a checklist, not a bug list. Every real application makes tradeoffs.
2. **Rating defense-in-depth gaps as HIGH/CRITICAL.** "Missing validateIdentifier where the query builder already quotes identifiers" is not HIGH.
3. **Ignoring the deployment model.** Rate limiting at the CDN layer is a valid architecture; not every app needs it again at the app layer.
4. **Treating designed behavior as a bug.** Understand the trust model first. If admins are fully trusted by design, admin-does-admin-things is not a finding.
5. **Padding the report with LOW findings.** Ten LOWs don't make a report useful. Three MEDIUMs do.
6. **"Potential" findings without proof.** Either you can exploit it or you can't. Needing the word "potentially" or "theoretically" means you haven't finished the research.
7. **Ignoring what the codebase does well.** Say so — it calibrates trust in the findings you do report.
8. **Constructing exploits from unverified parser/runtime assumptions.** If your exploit depends on how a parser/runtime handles specific bytes, cite the spec or test it — don't assume.
9. **Skipping business logic, chained attacks, and supply chain.** SQLi/XSS/SSRF is what every scanner already checks. The value of a manual audit is logic errors, state-machine violations, chained attacks, and the dependency you never audited because it "just works."
10. **Giving up too easily.** "It uses parameterized queries so there's no SQLi" is lazy. Check every `sql.raw()`. Check dynamic identifiers. Check search/FTS. Check for a code path that bypasses the query builder. Push.
11. **Trusting a scanner's verdict as a finding.** Semgrep/CodeQL/npm-audit output is a lead. Verify the sink is actually reachable with attacker-controlled data before it goes in the report — see Phase 3.
12. **Reporting a memory bug that only crashes via a private-function harness with a custom `malloc(15)`.** That's an artificial crash. Use the public API or respect the library's allocator padding — see [MEMORY-SAFETY-AND-BINARY.md](references/MEMORY-SAFETY-AND-BINARY.md) and [VALIDATION-AND-REPORTING.md](references/VALIDATION-AND-REPORTING.md) rule on Internal Invariant Protection.
13. **Treating a reproduced bug in `/test` or `/example` as a CRITICAL.** It's `SAMPLE_OR_TEST` — the 0.4 multiplier lands it in MEDIUM. The recommendation is "fix the example so devs don't copy the insecure pattern," not "patch prod."
14. **Filing a chain as separate low-severity findings without also recording the chain.** The chain is where the real impact lives. See Phase 2.5.
15. **Skipping the re-attack after a patch.** A patch that survives your own reproducer but you wrote both — the re-attack is the independent check that the fix is real. See Phase 7.

## Companion files

| File | Holds |
|------|-------|
| [RECONNAISSANCE.md](references/RECONNAISSANCE.md) | Phase 1: the 4 parallel research agents and how to synthesize them |
| [HUNTING.md](references/HUNTING.md) | Phase 2: parallel-agent orchestration, hunting methodology, validation rules |
| [ATTACK-CLASSES.md](references/ATTACK-CLASSES.md) | The class catalog; routes to specialized companions |
| [TOOLING.md](references/TOOLING.md) | Per-language scanners, fuzzers, DAST, MITRE ATT&CK + OWASP WSTG tag mapping |
| [MEMORY-SAFETY-AND-BINARY.md](references/MEMORY-SAFETY-AND-BINARY.md) | Native/binary classes, ASan, heap grooming, SIMD padding, reproduction |
| [AI-AND-LLM.md](references/AI-AND-LLM.md) | OWASP LLM Top 10, the 6 agentic attack vectors, prompt injection, excessive agency, MCP |
| [WEB-PROTOCOL-AND-AUTH.md](references/WEB-PROTOCOL-AND-AUTH.md) | Request smuggling, caching, authn/authz, session, JWT, OAuth, SAML, SSRF |
| [CLIENT-SIDE.md](references/CLIENT-SIDE.md) | DOM XSS, prototype pollution, postMessage, CORS, clickjacking, extensions/webviews |
| [SUPPLY-CHAIN-AND-PROVENANCE.md](references/SUPPLY-CHAIN-AND-PROVENANCE.md) | Dependency audit, typosquatting, vendored code, CI/CD pipelines, plugins/MCP, model weights |
| [CLOUD-AND-DEPLOYMENT.md](references/CLOUD-AND-DEPLOYMENT.md) | Workload identity, ingress, containers, config drift, secrets, storage, events |
| [PROTOCOLS-RPC-AND-MESSAGING.md](references/PROTOCOLS-RPC-AND-MESSAGING.md) | Framing disagreement, RPC authz, broker isolation, replay/ordering |
| [RESOURCE-EXHAUSTION-AND-AVAILABILITY.md](references/RESOURCE-EXHAUSTION-AND-AVAILABILITY.md) | Amplification, leaks, quota gaps, fatal paths, retry storms |
| [DATA-ISOLATION-AND-LIFECYCLE.md](references/DATA-ISOLATION-AND-LIFECYCLE.md) | Tenant enforcement, derived copies, export/import, delete/revoke/restore |
| [DESKTOP-MOBILE-AND-LOCAL-IPC.md](references/DESKTOP-MOBILE-AND-LOCAL-IPC.md) | Deep links, bridges, IPC auth, helpers, install paths |
| [VALIDATION-AND-REPORTING.md](references/VALIDATION-AND-REPORTING.md) | The 13 negative constraints, 27 sanity caps, risk formula, chaining, dynamic reproduction, re-attack, JSON schema |
| schemas/report-schema.json + scripts/validate-*.cjs | Machine-checkable findings + coverage-ledger contracts |

## External references

- **MITRE ATT&CK** — adversary tactics & techniques, 15 Enterprise tactics (Reconnaissance → Impact): https://attack.mitre.org/
- **OWASP Web Security Testing Guide (WSTG)** — canonical web testing catalog, `WSTG-<category>-<number>` identifiers: https://owasp.org/www-project-web-security-testing-guide/
- **OWASP LLM Top 10** — LLM01–LLM10, the canonical classes for AI/agent targets: https://owasp.org/www-project-top-10-for-large-language-model-applications/
- **Trail of Bits audit methodology** — publicized agentic audit tooling that informed this skill's structure.

Tag every finding with applicable MITRE ATT&CK technique IDs, OWASP WSTG identifiers, OWASP LLM## for AI targets, and CWE numbers — it makes findings machine-filterable and lets future runs dedupe and chain faster.
