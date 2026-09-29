#!/usr/bin/env node
// checks coverage-ledger.json state table (structural only).
// usage: node validate-coverage-ledger.cjs <coverage-ledger.json>
const fs = require("fs");

const STATUSES = ["planned", "in_progress", "blocked", "covered", "candidate", "deferred", "out_of_scope", "not_applicable"];
const AGENT = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const WINDEV = new Set(["con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9"]);
const errs = [];
const err = (m) => { errs.push(m); };

const [,, file] = process.argv;
if (!file) { console.error("usage: node validate-coverage-ledger.cjs <coverage-ledger.json>"); process.exit(2); }
let data;
try { data = JSON.parse(fs.readFileSync(file, "utf8")); }
catch (e) { console.error("parse error: " + e.message); process.exit(2); }
if (!Array.isArray(data)) { console.error("top level must be an array"); process.exit(1); }

const ids = new Set();
data.forEach((u, i) => {
  const at = `unit[${i}]`;
  if (!u.coverage_id) { err(`${at}: missing coverage_id`); return; }
  if (ids.has(u.coverage_id)) err(`${at}: duplicate coverage_id ${u.coverage_id}`);
  ids.add(u.coverage_id);
  if (!STATUSES.includes(u.status)) { err(`${at}: bad status ${u.status}`); return; }
  const paths = Array.isArray(u.reviewed_paths) ? u.reviewed_paths : [];
  const fps = Array.isArray(u.result_fingerprints) ? u.result_fingerprints : [];
  const unres = Array.isArray(u.unresolved) ? u.unresolved : u.unresolved;
  switch (u.status) {
    case "planned":
      if (u.agent_id !== null && u.agent_id !== undefined) err(`${at}: planned must have null agent_id`);
      if (paths.length || fps.length) err(`${at}: planned must have empty evidence`);
      break;
    case "in_progress":
      if (!u.agent_id || !AGENT.test(u.agent_id) || WINDEV.has(u.agent_id)) err(`${at}: bad agent_id`);
      if (paths.length || fps.length) err(`${at}: in_progress must have empty evidence`);
      break;
    case "blocked":
      if (!u.agent_id) err(`${at}: blocked needs owner`);
      if (!paths.length) err(`${at}: blocked needs reviewed_paths`);
      if (fps.length) err(`${at}: blocked must have no fingerprints`);
      if (!unres || !unres.length) err(`${at}: blocked needs unresolved blocker`);
      break;
    case "covered":
      if (!u.agent_id) err(`${at}: covered needs owner`);
      if (!paths.length) err(`${at}: covered needs reviewed_paths`);
      if (fps.length) err(`${at}: covered must have no fingerprints`);
      if (unres && unres.length) err(`${at}: covered must have no unresolved`);
      break;
    case "candidate":
      if (!u.agent_id) err(`${at}: candidate needs owner`);
      if (!paths.length) err(`${at}: candidate needs reviewed_paths`);
      if (!fps.length) err(`${at}: candidate needs fingerprints`);
      break;
    default: // deferred / out_of_scope / not_applicable
      if (u.agent_id) err(`${at}: ${u.status} must have null agent_id`);
      if (paths.length || fps.length) err(`${at}: ${u.status} must have empty evidence`);
      if (!unres || !unres.length) err(`${at}: ${u.status} needs reason in unresolved`);
  }
});

if (errs.length) {
  console.error(errs.slice(0, 100).join("\n"));
  console.error(`${errs.length} error(s)`);
  process.exit(1);
}
console.log(`ok: ${data.length} unit(s)`);
