#!/usr/bin/env node
// checks findings.json against report-schema.json (structural only, not truth).
// usage: node validate-findings.cjs <findings.json>
const fs = require("fs");

const ENUMS = {
  severity: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFORMATIONAL"],
  privileges_required: ["NONE", "LOW", "HIGH"],
  attacker_position: ["EXTERNAL", "INTERNAL_NETWORK", "IN_CLUSTER", "LOCAL", "HOST_SYSTEM", "SUPPLY_CHAIN", "PHYSICAL_TEMPORARY", "PHYSICAL_LONG_TERM"],
  user_interaction: ["NONE", "REQUIRED"],
  status: ["VALID", "PROVISIONALLY_VALID", "FALSE_POSITIVE", "NEEDS_RESEARCH", "NEEDS_VALIDATION", "DUPLICATE"],
  production_viability: ["VIABLE", "CONDITIONAL_VIABLE", "SAMPLE_OR_TEST", "NON_VIABLE"],
  repro_status: ["reproduced", "failed_to_reproduce", "statically_confirmed", "not_attempted"],
  patch_status: ["VERIFIED_SECURE", "MITIGATION_PROPOSED", "VERIFICATION_INCOMPLETE", "VERIFICATION_FAILED", "ERROR"],
  reattack_status: ["bypassed_patch", "failed_to_bypass"],
  inferred_exposure: ["EXPOSED", "INTERNAL", "PRIVILEGED"],
};
const FP = /^[A-Za-z0-9][A-Za-z0-9._:/@+#-]*$/;
const CP = /^.+:[0-9]+$/;
const errs = [];
const err = (m) => { errs.push(m); };

const [,, file] = process.argv;
if (!file) { console.error("usage: node validate-findings.cjs <findings.json>"); process.exit(2); }
let data;
try { data = JSON.parse(fs.readFileSync(file, "utf8")); }
catch (e) { console.error("parse error: " + e.message); process.exit(2); }
if (!Array.isArray(data)) { console.error("top level must be an array"); process.exit(1); }

const seen = new Set();
data.forEach((f, i) => {
  const at = `finding[${i}]`;
  for (const k of ["id", "title", "description", "code_paths", "status"]) {
    if (f[k] === undefined || f[k] === "") err(`${at}: missing ${k}`);
  }
  if (f.id) { if (seen.has(f.id)) err(`${at}: duplicate id ${f.id}`); seen.add(f.id); }
  if (f.fingerprint && !FP.test(f.fingerprint)) err(`${at}: bad fingerprint ${f.fingerprint}`);
  for (const [k, vals] of Object.entries(ENUMS)) {
    if (f[k] !== undefined && !vals.includes(f[k])) err(`${at}: bad ${k}=${f[k]}`);
  }
  if (f.code_paths) {
    if (!Array.isArray(f.code_paths) || !f.code_paths.length) err(`${at}: code_paths must be nonempty array`);
    else f.code_paths.forEach((c) => { if (!CP.test(c)) err(`${at}: bad code_path ${c}`); });
  }
  if (f.status === "NEEDS_VALIDATION" && (!Array.isArray(f.blockers) || !f.blockers.length))
    err(`${at}: NEEDS_VALIDATION needs nonempty blockers`);
  if (f.status === "NEEDS_VALIDATION" && f.severity !== undefined)
    err(`${at}: NEEDS_VALIDATION must not carry severity`);
  if (f.status === "DUPLICATE" && !f.duplicate_of) err(`${at}: DUPLICATE needs duplicate_of`);
  for (const n of ["risk_score", "impact_score", "likelihood_score", "context_multiplier"]) {
    if (f[n] !== undefined && typeof f[n] !== "number") err(`${at}: ${n} must be number`);
  }
  if (typeof f.risk_score === "number" && (f.risk_score < 1 || f.risk_score > 10))
    err(`${at}: risk_score out of 1-10`);
});

if (errs.length) {
  console.error(errs.slice(0, 100).join("\n"));
  console.error(`${errs.length} error(s)`);
  process.exit(1);
}
console.log(`ok: ${data.length} finding(s)`);
