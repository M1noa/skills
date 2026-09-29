# Validation and Reporting

The bar that turns raw hunting into rigorously-validated, risk-calibrated, exploit-confirmed findings. Phases 3, 4, 5, and 6 of the workflow in [SKILL.md](../SKILL.md).

---

## Phase 3 — Validate

Phase 2 produces a pile of candidate findings. Phase 3 culls them ruthlessly.

### Step 3.1 — Dedupe

Before validation, dedupe. Cross-reference every finding against:
- Other findings in the current batch (same `code_paths` + similar `title` → merge).
- Prior-run `findings.json` from `~/security-audit-skill/<repo>/run-<N>/` (see [SKILL.md "Coverage and prior runs"](../SKILL.md)) — known findings get mentioned, not re-hunted.

Merge rules (apply deterministically):
- **Title**: pick the most comprehensive.
- **Severity**: pick the highest.
- **Privileges required**: `NONE` > `LOW` > `HIGH` (most exploitable wins).
- **Attacker position**: `EXTERNAL` > `INTERNAL_NETWORK` > `IN_CLUSTER` > `LOCAL` > `HOST_SYSTEM` > `SUPPLY_CHAIN` > `PHYSICAL_TEMPORARY` > `PHYSICAL_LONG_TERM` (most reachable wins).
- **User interaction**: `NONE` > `REQUIRED` (zero-click wins).
- **Code paths**: union, deduplicated.
- Preserve all `history` entries from merged findings; append a dedupe entry.

### Step 3.2 — Apply the 13 negative validation constraints

For each finding, take an **adversarial stance**: assume it is a false positive until proven otherwise. Try harder to disprove it than to confirm it. Evaluate against the 13 rules below. If a finding violates any rule → mark `FALSE_POSITIVE`.

| # | Rule | What kills the finding |
|---|------|------------------------|
| 1 | **Ignore hypothetical misuse** | The flaw relies on a *caller* hypothetically misusing a safe function. The function itself behaves safely → FP. |
| 2 | **Ignore missing hygiene / defense-in-depth** | Missing `X-Content-Type-Options`, missing authn on a local-only test fn, hardcoded mock DB → FP, not a finding. |
| 3 | **Require strict reproducibility** | The flaw must be triggerable, not just theoretical. Fragile timing that *can be automated/retried* is still valid (a 1-in-a-million race you can hammer is a finding; a 1-in-a-million race that requires a one-shot setup is FP). |
| 4 | **Avoid pedantic linting** | Uses safe stdlib (`json.loads`, parameterized SQL, secure hash) but lacks extreme paranoia → FP. |
| 5 | **No security-flaw stretching on mitigations** | You're auditing a mitigation that blocks the original class. Don't invent an adjacent class (e.g., flag SSRF when reviewing command-injection fixes). If the primary flaw is blocked → FP. |
| 6 | **Evaluate questionable file paths** | Don't dismiss `/test`, `/experimental`, `/mock` outright — trace whether the code is compiled into the production target or reachable via a production endpoint. If reachable → keep; if genuinely dead → FP. |
| 7 | **Ignore resource-exhaustion DoS** | Don't flag missing recursion limits, input-size bounds, or cycle constraints *unless* the module's primary stated purpose is DoS defense. |
| 8 | **Intrinsic security flaws stay valid** | MD5/SHA1 in a security context, hardcoded static secrets, direct injection in the function's own logic → VALID even if no caller currently invokes it. |
| 9 | **Verify mitigations pragmatically** | Don't hallucinate flaws in real mitigations. Trailing slashes, safe parsing flags → accept they work. |
| 10 | **Refine `code_paths` strictly** | Only the exact `file:line` of the flawed block. Strip helper files, test harnesses, correct caller files. |
| 11 | **Ignore SIMD/vector padding violations** | OOB inside NEON/SSE/AVX/VSX routines is FP if the library uses a global allocator contract (e.g., `row_bytes + 16` trailing padding) and the OOB is mathematically inside the padding. |
| 12 | **Source code coherence (anti-hallucination)** | Every `file:line` in `code_paths` must exist. Every function/variable/line number must exist at that location. Missing references → FP immediately. |
| 13 | **Verify attacker control of the source** | For data-flow findings, cite the `file:line` where untrusted data enters (the ingress point) or where the tainted field is written by an untrusted writer. If the source data is provably trusted-side-only (server-authored static config, host-plane internal state) → FP. Exception: intrinsic flaws (rule 8) don't need a live caller. |

Build a `triage_checklist` object evaluating all 13 constraints. Each gets `outcome: PASS | FAIL | UNKNOWN | NOT_APPLICABLE`. A `FAIL` on any rule → status `FALSE_POSITIVE`.

### Step 3.3 — Production viability gate

For every finding that passes Step 3.2 (status `VALID` or `PROVISIONALLY_VALID`), apply the production-viability filter:

| Viability | When |
|-----------|------|
| **`NON_VIABLE`** | Reachable only in: debug builds where `assert()`/`debug_abort()` fires and `NDEBUG` strips them; `#ifdef DEBUG` paths; blocked by non-configurable environmental controls (kernel sandbox, read-only FS). |
| **`SAMPLE_OR_TEST`** | Issue resides in example/test/fuzz-harness code. |
| **`CONDITIONAL_VIABLE`** | Exploitable only under specific non-default configs, optional flags, hardened builds. |
| **`VIABLE`** | Fully triggerable in a standard release/production build. |

If the threat model declares the entire repo as `Intent: SAMPLE_OR_TEST_ONLY`, mark every finding `SAMPLE_OR_TEST` regardless of location.

For memory-safety: check the allocator source. If the OOB is contained within guaranteed padding → `NON_VIABLE`. For logic/auth: check whether the bypassed endpoint is actually reachable in standard deployment (debug-only backdoor, mock auth provider, test-only route → `NON_VIABLE`).

### Step 3.4 — Status resolution

- **`VALID`** — passes all 13 rules, has a clear triggerable flaw, production-viable.
- **`FALSE_POSITIVE`** — violates any rule, or `NON_VIABLE`.
- **`PROVISIONALLY_VALID`** — passes the rules, but feasibility is uncertain without dynamic verification (complex heap grooming, precise timing).
- **`NEEDS_RESEARCH`** — review inconclusive due to high complexity, unresolved external APIs, massive call graphs.
- **`NEEDS_VALIDATION`** — source-grounded boundary hypothesis blocked on one exact external fact (deployed config, provider behavior, OS/packaging). carries `blockers[]` + `validation_plan`, never severity.
- **`DUPLICATE`** — same root cause as another finding; carries `duplicate_of`.

### Step 3.5 — Construct reproduction hints

For every `VALID` or `PROVISIONALLY_VALID` finding, write high-signal `repro_hints`: what input/payload triggers the bug, what crash condition or unexpected result confirms it (ASan output, `200 OK` on an unauthenticated request, exit code 139, etc.).

---

## Phase 2.5 — Exploit chaining (optional, after Step 3.4)

After validation, look across all confirmed findings for chains. A chain is a *new* finding, not a modification of its constituents.

**The chaining matrix**: for each pair (A, B), ask: *Can the output or side-effect of A satisfy the precondition required to trigger B?*

Classic chains:
- **Path traversal + loose permissions → RCE**: low-sev path traversal writes to `/tmp`, a cron job execs scripts in `/tmp`.
- **XSS + CSRF → account takeover**: stored XSS harvests an anti-CSRF token to fire a state-changer.
- **Info leak + buffer overflow → ASLR bypass**: leak reveals base pointer, satisfies the precondition for a stack BOF.
- **Open redirect + OAuth callback → token theft**.
- **IDOR + missing rate limit → enumeration**: info-disclosure on resource IDs + brute-forceable ID space.

For a confirmed chain:
- Generate a **net-new UUID** (don't modify the constituent findings).
- `title` must contain "Exploit Chain:" (for dedupe in later runs).
- Record `constituent_findings: [UUID_A, UUID_B, …]`.
- `privileges_required` = the privilege needed to start the *first* step of the chain (entry point). If step 1 is unauthenticated and the chain leads to RCE → `privileges_required: NONE`.
- `attacker_position` = inherited from the entry point.
- `user_interaction` = `REQUIRED` if *any* step requires it; `NONE` only if the whole chain is zero-click.
- `severity` = `CRITICAL` or `HIGH` (the escalated impact).
- `production_viability` = inherit from constituents (`SAMPLE_OR_TEST` if any constituent is; else `CONDITIONAL_VIABLE` if any is; else `VIABLE`).
- `repro_status` = never `reproduced` (constituent reproduction doesn't prove end-to-end); use `statically_confirmed` or `not_attempted`.

---

## Phase 4 — Report

Write two files to the output directory:

### `REPORT.md` (human-readable)

```markdown
# Security Audit Report — <repo-name>

**Date:** <ISO date>
**Run:** run-<N>
**Prior runs:** <list or "none">

## Executive summary
- N confirmed findings: X CRITICAL, Y HIGH, Z MEDIUM, W LOW.
- The codebase does [these things well] — <call this out, it calibrates trust>.
- Top risks: <2-3 sentences on the most impactful chains/findings>.

## Findings (CRITICAL → HIGH → MEDIUM → LOW)
For each finding:
### F-<id> — <title> [<severity>]
- **Class:** <attack class, e.g. "Injection — SQLi" or "Memory — UAF">
- **Tags:** <MITRE ATT&CK technique IDs, OWASP WSTG IDs, OWASP LLM##, CWE>
- **Attacker position:** <enum>
- **Privileges required:** <NONE | LOW | HIGH>
- **User interaction:** <NONE | REQUIRED>
- **Production viability:** <VIABLE | CONDITIONAL_VIABLE | SAMPLE_OR_TEST | NON_VIABLE>
- **Code paths:** `<file:line>`, …
- **Attack scenario:** <who is the attacker, what do they do, what do they get — concrete>
- **Reproduction:** <PoC file path + run command + expected output>
- **Impact:** <what damage results>
- **Likelihood:** <1-5 with justification>
- **Risk score:** <1-10, see Phase 5>
- **Mitigation:** <recommended fix>

## Hygiene & low-priority notes
- <defense-in-depth gaps, NON_VIABLE observations, etc. — clearly labeled as non-findings>

## Not audited
- <areas skipped, with reason>
```

### `FINDINGS-DETAIL.md`

For MEDIUM+ findings, the full data-flow trace: entry point → validation → transformation → storage → retrieval → sink. Include the exact PoC payload and the expected-vs-observed output.

### `NEEDS-VALIDATION.md`

One section per `NEEDS_VALIDATION` record: trace, exact blocker, affected boundary, bounded local step, safe owner-observed deployment check. No severity, no live-probe instructions.

---

## Phase 5 — Structured output (`findings.json`)

Produce a machine-readable `findings.json` — an array validated by `../schemas/report-schema.json` (`node ../scripts/validate-findings.cjs findings.json`). Field shape below; `NEEDS_VALIDATION` records carry `blockers[]` + `validation_plan` and no severity.

```json
{
  "id": "<UUID>",
  "title": "<Exploit Chain: … | …>",
  "description": "<root cause analysis>",
  "impact": "<exploit outcome>",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW | INFORMATIONAL",
  "privileges_required": "NONE | LOW | HIGH",
  "attacker_position": "EXTERNAL | INTERNAL_NETWORK | IN_CLUSTER | LOCAL | HOST_SYSTEM | SUPPLY_CHAIN | PHYSICAL_TEMPORARY | PHYSICAL_LONG_TERM",
  "user_interaction": "NONE | REQUIRED",
  "code_paths": ["<file>:<line>", …],
  "status": "VALID | PROVISIONALLY_VALID | FALSE_POSITIVE | NEEDS_RESEARCH | NEEDS_VALIDATION | DUPLICATE",
  "duplicate_of": "<UUID or omitted>",
  "production_viability": "VIABLE | CONDITIONAL_VIABLE | SAMPLE_OR_TEST | NON_VIABLE",
  "repro_status": "reproduced | failed_to_reproduce | statically_confirmed | not_attempted",
  "repro_file_path": "<path to PoC, in reproducer dir>",
  "run_command": "<exact command>",
  "repro_output": "<truncated stdout/stderr that confirms the bug>",
  "patch_status": "VERIFIED_SECURE | MITIGATION_PROPOSED | VERIFICATION_INCOMPLETE | VERIFICATION_FAILED | ERROR | omitted",
  "patch_diff": "<unified diff or omitted>",
  "reattack_status": "bypassed_patch | failed_to_bypass | omitted",
  "inferred_exposure": "EXPOSED | INTERNAL | PRIVILEGED",
  "tags": ["MITRE:T1190", "WSTG:INPV-11", "LLM:LLM01", "CWE-79", …],
  "risk_score": <1-10>,
  "impact_score": <1-5>,
  "likelihood_score": <1-5>,
  "context_multiplier": <0.1-1.0>,
  "executive_summary": "<1-2 sentences for stakeholders>",
  "mitigation": "<recommended fix>",
  "constituent_findings": ["<UUID>", …],
  "triage_checklist": {
    "ignore_hypothetical_misuse": {"outcome": "PASS|FAIL|UNKNOWN|NOT_APPLICABLE", "reason": "<if not PASS>"},
    "ignore_missing_hygiene": {"outcome": "…"},
    "require_strict_reproducibility": {"outcome": "…"},
    "avoid_pedantic_linting": {"outcome": "…"},
    "no_security_flaw_stretching": {"outcome": "…"},
    "evaluate_questionable_file_paths": {"outcome": "…"},
    "ignore_resource_exhaustion_dos": {"outcome": "…"},
    "intrinsic_security_flaws": {"outcome": "…"},
    "verify_mitigations_pragmatically": {"outcome": "…"},
    "refine_code_paths_strictly": {"outcome": "…"},
    "ignore_simd_vector_padding": {"outcome": "…"},
    "ensure_source_code_coherence": {"outcome": "…"},
    "verify_attacker_control_of_source": {"outcome": "…"}
  },
  "critic_reasoning": "<production-viability reasoning or omitted>",
  "history": [
    {"stage": "researcher|dedupe|reviewer|critic|reproduce|chainer|patch|calibrate|verifier", "action": "<created|merged|reviewed|evaluated|reproduced|constructed|patched|scored|re-verified>", "details": "<…>", "pass_number": <N>, "timestamp": "<ISO 8601>"}
  ]
}
```

### Risk score formula

```
Risk = (Impact + Likelihood) × ContextMultiplier   (capped at 10.0)
```

**Impact (1–5)** — CIA triad weighted by blast radius:
- 5: Systemic loss of C/I/A; RCE by an unprivileged external attacker; root-key leak. Not for attackers who already have exec privileges.
- 4: Substantial loss in one or more areas; total outage of a major service; major data exposure.
- 3: Moderate; partial exposure, partial/temporary disruption.
- 2: Minor; one user's own data only. **Cap**: findings confined to a single user's own data are 2 max, *unless* non-repudiation is broken (fraud plausible) or side-effects hit other users.
- 1: Cosmetic, fragile, theoretical hygiene. "The code is fragile" / pure defense-in-depth → 1 (forces LOW at most).
- **Security-control bypass upgrade**: a finding that directly bypasses a core security control (authn, authz, signature verification) or defeats the primary security purpose of a library → bump Impact to ≥ 4 (or 5 if systemic).
- **Privilege caps**: HIGH-privilege-only exploits (admin→super-admin, lateral move from already-compromised state) → cap Impact at 2 unless they escape the container to the host or cross-tenant. LOW-priv exploits (standard authenticated user) → cap Impact at 3 unless systemic or control-bypassing.

**Likelihood (1–5)** — proven exploitability, not theoretical difficulty:
- 5: Actively exploited in the wild, OR the audit generated a working weaponized exploit (not just a unit test).
- 4: Public PoC exists, OR the audit produced a highly plausible partially-weaponized exploit.
- 3: No exploit but trivial to automate.
- 2: Theoretical, complex (local access, strict timing).
- 1: Strictly theoretical, no known path.
- **Reachability modifier**: subtract 1–2 (floor 1.0) if the exploit relies on rare/non-default usage (uncommon API calls, admin-only configs rarely enabled in practice).

**ContextMultiplier (0.1–1.0)** — start at 1.0, multiply down:
- Drop entirely (`status=FALSE_POSITIVE` or `NON_VIABLE`) → no score.
- Network/trust exposure: Exposed interface (`EXTERNAL`) → 1.0; Internal component accepting semi-trusted parsed data → 0.8; Deeply nested in privileged/trusted zone → 0.5. Inferred default (no threat model): 0.8 (Internal). Reduce to 0.5 if reasoning suggests "rarely exposed"/"internal only".
- Align exposure with attacker position: `LOCAL` or `IN_CLUSTER` → exposure multiplier 0.8 max. `INTERNAL_NETWORK` → 0.8 max. `EXTERNAL` → 1.0 (forced EXPOSED).
- Asset criticality: high-value (PII, core secrets) → keep high; low-value (sandboxed test data) → reduce to 0.5. Availability-only findings: check `availability_tier` (`LOW_CRITICALITY` → 0.5, `STANDARD` → 0.8, `CRITICAL` → 1.0). Proven dead code → 0.2.
- User interaction: `REQUIRED` → multiply the running multiplier by 0.7 (so user-interaction findings cap below CRITICAL).
- `SAMPLE_OR_TEST` → multiply by 0.4 (severe bugs in sample code land MEDIUM).
- `CONDITIONAL_VIABLE` → multiply by 0.7.

**Outrage (not in the score)**: comment in `executive_summary` if reputational/user-sentiment fallout is materially higher than the technical score suggests (e.g., a low-impact data leak of sensitive categories). Risk = Hazard + Outrage; only Hazard is numerically scored.

### The 27 sanity caps (apply before finalizing the score)

The 27 rules enforce **marginal capability**: the final severity is bounded by what the attacker *gains* over their starting position. If the exploit grants no meaningful new control, cap or downgrade. The full list is large; the meta-rules are:

1. **Marginal capability cap** — exploit granting nothing the attacker didn't already have → LOW.
2. **High-privilege cap** — admin→admin findings cap at 2.
3. **Low-priv cap** — authenticated-user findings cap at 3 unless systemic or control-bypassing.
4. **Single-user-own-data cap** — confined to attacker's own data → 2 max (unless non-repudiation/side-effects).
5. **Self-XSS / self-CSRF** → FP.
6. **Open redirect without a chain** → LOW (chain to token theft or SSRF to elevate).
7. **Information disclosure of non-sensitive data** → LOW.
8. **Defense-in-depth gaps** → not a finding (cap at INFORMATIONAL).
9. **Theoretical race without automation path** → FP (Rule 3 of the 13).
10. **Intrinsic flaws** (rule 8 of the 13) → VALID even with no caller.
11. **Sample/test severity cap** → 0.4 multiplier.
12. **Conditional viability cap** → 0.7 multiplier.
13–27: a longer enumerated list covering CORS-without-credentials, missing-HSTS-on-already-HTTPS, self-DoS, content-type confusion that's the framework's job, OAuth state missing but client is confidential-and-CSRF-token-checked, JWT `alg:none` rejected, sandboxed-iframe-only, debug-page-gated-by-IP-allowlist, test-route-not-registered-in-prod-router, mock-auth-only, deprecated-but-not-reachable, etc. — each forces a cap or downgrade. Apply judgment: if the finding's impact doesn't survive "what would actually happen in production," cap it.

---

## Phase 6 — Independent verification (re-verify)

A fresh agent — no prior context on the finding — re-verifies every factual claim in `findings.json`:

1. Read each `code_path` and confirm the code at that line does what the finding claims.
2. Confirm the data-flow claim: trace from the cited ingress point (rule 13) to the sink.
3. Re-confirm the attacker position: is the ingress really `EXTERNAL`? Trace back through any trusted-by-design proxy/gateway/queue to the outermost boundary the untrusted actor crosses.
4. Re-confirm `production_viability`: read 15 lines of context before and after the cited line. Check for `#ifdef DEBUG`, allocator padding, debug-only flags.
5. For `reproduced` findings, re-run the PoC. For `statically_confirmed` findings, scrutinize whether dynamic confirmation was truly impossible.
6. Reconcile: if Phase 6 contradicts Phase 3, **the verification wins** — downgrade or FP the finding.

### Re-attack (when a patch has been proposed)

After a patch is applied (Phase 7 if you do it), assume the patch is flawed. Launch a fresh sub-agent to write a *new* PoC variant that aims to bypass the patch and reach the same root cause. Only if the re-attack also fails is `patch_status: VERIFIED_SECURE`. Re-attack results go into `reattack_status` / `reattack_file_path` / `reattack_run_command` / `reattack_output` — never overwrite the original `repro_*` fields.

---

## Phase 7 — Patch & re-attack (optional, when the user asks for fixes)

When the user wants fixes, generate minimal patches with **transactional isolation**:

- **Option A (recommended)**: copy the source tree to a `mktemp -d` shadow dir, edit there, run the reproducer in the shadow dir, generate the diff between shadow and original, delete the shadow dir.
- **Option B (fallback)**: per-file backups (`target.c.bak-<id>`), edit in place, diff backup vs modified, restore on completion. Requires an exclusive workspace lock; concurrency-unsafe.

Generate a unified diff, store it in `patch_diff`. Run the reproducer against the patched code → if the bug is gone, launch a re-attack. `patch_status: VERIFIED_SECURE` only if both the reproducer fails AND the re-attack fails.

Never leave the codebase in an altered state after this phase — full rollback.

---

## Anti-patterns (enforced by Phase 3 + Phase 6)

Re-stating the [SKILL.md anti-patterns](../SKILL.md) in operational terms:
- A scanner hit alone is not a finding (Rule 6 of the 13, re-verified in Phase 6).
- A defense-in-depth gap is not a finding (Rule 2, cap 8 of the 27).
- A scanner-clean run is not a clean bill of health (Phase 2 still has to hunt business logic, chains, and supply chain).
- A reproduced bug in sample/test code is `SAMPLE_OR_TEST`, not a CRITICAL.
- A "potential" finding without a concrete attack is unfinished research, not a reportable finding.
