#!/usr/bin/env node
// fixtures for scan-prose.cjs. every case here is a bug that shipped at some
// point during development: a false positive, a false negative, or a verdict
// leaking into the output.
//
// usage: node scan-prose.test.cjs

const assert = require("assert");
const { spawnSync } = require("child_process");
const path = require("path");
const { scanSource } = require("./scan-prose.cjs");

const ids = (rep, bucket) => rep[bucket].map((r) => r.id);
const has = (rep, bucket, id) => ids(rep, bucket).includes(id);
const go = (src) => scanSource(src, "fixture.md");

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.log("  FAIL " + name + "\n       " + e.message); process.exitCode = 1; }
};

// --- protected regions ---------------------------------------------------
test("blockquote, fenced code, table and frontmatter produce no hits", () => {
  const rep = go([
    "---",
    "title: x",
    "---",
    "> This quoted passage uses delve, leverage, and robust in a row.",
    "",
    "```",
    "citeturn0search0 [cite: 1] utm_source=chatgpt.com",
    "```",
    "",
    "| delve | landscape | tapestry |",
    "|---|---|---|",
    "| realm | paradigm | beacon |",
    "",
    "Prose outside the protected regions that says nothing interesting.",
  ].join("\n"));
  assert.strictEqual(rep.find.length, 0, "forensics leaked out of a protected region");
  assert.strictEqual(rep.review.length, 0, "vocabulary leaked out of a protected region");
});

test("inline code is masked but the surrounding prose is not", () => {
  const rep = go([
    "The macro is `#include <stdio.h>` and the citeturn0search0 token leaked.",
  ].join("\n"));
  assert.strictEqual(rep.find.length, 1, "prose outside inline code should still be scanned");
  assert.strictEqual(rep.find[0].id, "chatgpt.citeturn");
});

test("line numbers survive masking", () => {
  const rep = go(["# heading", "", "```", "```", "", "", "", "citeturn0search0 here"].join("\n"));
  assert.strictEqual(rep.find[0].lines[0], 8, "line number drifted after masked lines");
});

// --- tier v cluster thresholds ------------------------------------------
test("tier 1a needs 3+ in one paragraph, 2 is a word choice", () => {
  const two = go("The landscape of the storage system turned out to be robust.");
  assert.ok(!has(two, "review", "tier1a.cluster3"), "two tier 1a words must not form a cluster");
  const three = go("The landscape of the realm of storage turned out to be robust.");
  assert.ok(has(three, "review", "tier1a.cluster3"), "three tier 1a words in one paragraph should cluster");
});

test("tier 1a clusters do not span paragraphs", () => {
  const rep = go([
    "Only one marker here: the landscape.",
    "",
    "And one marker here: the realm.",
    "",
    "And one more marker here: robust.",
  ].join("\n"));
  assert.ok(!has(rep, "review", "tier1a.cluster3"), "cluster rule is per paragraph, not per document");
});

test("tier 2 needs 2+ in one paragraph", () => {
  const one = go("This is crucial for the rollout.");
  assert.ok(!has(one, "review", "tier2.cluster2"));
  const two = go("This is crucial for the rollout and the nuanced detail matters.");
  assert.ok(has(two, "review", "tier2.cluster2"));
});

test("tier 1b lands in clarity and never joins a cluster", () => {
  const rep = go("We utilize this in order to due to the fact that serves as the outcome.");
  assert.ok(has(rep, "clarity", "tier1b.wordiness"), "tier 1b should be reported");
  assert.ok(!has(rep, "review", "tier1b.wordiness"), "tier 1b must not be review-class");
  assert.ok(!has(rep, "review", "tier1a.cluster3"), "tier 1b must not be able to form a tier 1a cluster");
});

// --- documented carve-outs ----------------------------------------------
test("load-bearing on a structural noun is literal", () => {
  const rep = go("The load-bearing wall carries the second floor of the warehouse.");
  assert.ok(!has(rep, "review", "tier1a.cluster3"), "structural use must not flag");
});

test("load-bearing on an abstract noun still flags", () => {
  const rep = go("the load-bearing argument and the landscape and the realm of it all");
  assert.ok(has(rep, "review", "tier1a.cluster3"), "metaphorical use must flag");
});

test("verbatim as a term of art does not count", () => {
  const rep = go("We keep a verbatim transcript of every call and verbatim responses from every reviewer.");
  assert.ok(!has(rep, "review", "tier3.density"), "legal/QA term of art must not count");
});

test("deeply outside a significance collocation does not count", () => {
  const rep = go("She cares deeply and breathed deeply and slept deeply all night long.");
  assert.ok(!has(rep, "review", "tier2.cluster2"), "literal and emotional deeply must not flag");
  const sig = go("deeply integrated and deeply rooted and deeply committed to the plan");
  assert.ok(has(sig, "review", "tier2.cluster2"), "significance collocations must flag");
});

// --- density gating ------------------------------------------------------
test("one confidence marker in a short doc is a metric, not a finding", () => {
  const rep = go("Notably, the deploy finished. It took nine minutes overall.");
  assert.ok(!has(rep, "review", "confidence.calibration"), "a single marker must not extrapolate into a density hit");
  assert.ok(rep.metrics["confidence.calibration"], "it should still be counted as a metric");
});

test("three confidence markers in 400 words is a finding", () => {
  const filler = Array.from({ length: 40 }, (_, i) => "Sentence number " + i + " carries some ordinary words here.").join(" ");
  const rep = go("Notably, one. Surprisingly, two. Importantly, three. " + filler);
  assert.ok(has(rep, "review", "confidence.calibration"), "3+ markers in a short document is stacking");
});

test("hashtag subtractions leave real tags alone", () => {
  const rep = go("#include and #1a2b3c and owner/repo#88 and https://x.test/a#frag but #AI #Crypto #Web3 #Innovation #Tech");
  assert.ok(!has(rep, "review", "copy.hashtag_stuffing"), "subtracted forms must not inflate the count");
  const real = go("#AI #Crypto #Web3 #Innovation #FutureTech #Technology");
  assert.ok(has(real, "review", "copy.hashtag_stuffing"), "six real tags should fire");
});

// --- shape checks --------------------------------------------------------
test("five symmetric noun-phrase bullets fire", () => {
  const rep = go([
    "- Stable mining efficiency.",
    "- Reliable pool connectivity.",
    "- Optimized RandomX performance.",
    "- Low failed share rates.",
    "- Effective hardware utilization.",
    "",
    "Prose padding follows so the document has more than a list in it.",
  ].join("\n"));
  assert.ok(has(rep, "review", "structure.bare_noun_bullets"));
});

test("a short bullet list does not fire", () => {
  const rep = go([
    "- Fixed the crash on startup.",
    "",
    "Prose padding follows so the document has more than a list in it.",
  ].join("\n"));
  assert.ok(!has(rep, "review", "structure.bare_noun_bullets"));
});

test("a full-sentence bold label is left alone", () => {
  const rep = go([
    "- **A single tell is nothing.** Only clusters count in practice.",
    "- **Perfect grammar is not evidence.** Neither is formal register here.",
    "",
    "Prose padding follows so the document has more than a list in it.",
  ].join("\n"));
  assert.ok(!has(rep, "review", "format.list_label_period"), "full-sentence labels are the documented carve-out");
});

test("a short noun-phrase bold label fires", () => {
  const rep = go([
    "- **Intros.** Years of conferences and operator network.",
    "- **Setup.** Install the package and export the key.",
    "- **Fix.** Cut the label and write the point instead.",
    "",
    "Prose padding follows so the document has more than a list in it.",
  ].join("\n"));
  assert.ok(has(rep, "review", "format.list_label_period"));
});

test("a four-word bold span is treated as a sentence, not a label", () => {
  const rep = go([
    "- **Carve-outs outrank triggers, always.** If one applies there is no finding.",
    "",
    "Prose padding follows so the document has more than a list in it.",
  ].join("\n"));
  assert.ok(!has(rep, "review", "format.list_label_period"), "the boundary is 4+ words, because a verb test without a lexicon cannot tell a verb from a noun here");
});

// --- verdict discipline --------------------------------------------------
test("a clean document reports nothing", () => {
  const rep = go([
    "# How we cut p99 from 480ms to 92ms",
    "",
    "The proxy was doing a DNS lookup on every request. We cached the resolver",
    "for 30 seconds and p99 dropped the same afternoon. Full numbers are in the",
    "PR, along with the two things that broke: retries doubling on the cache",
    "node, and a health check that kept passing while the node was gone.",
  ].join("\n"));
  assert.strictEqual(rep.find.length, 0, "clean prose must not produce find hits");
  assert.strictEqual(rep.review.length, 0, "clean prose must not produce review hits");
  assert.strictEqual(rep.clarity.length, 0, "clean prose must not produce clarity hits");
});

test("the report carries no verdict field", () => {
  const rep = go("delve into the landscape and the realm of robust findings");
  assert.strictEqual(rep.verdict, undefined, "per-file reports must not carry a verdict");
  assert.ok(!("score" in rep), "per-file reports must not carry a score");
  assert.ok(!("probability" in rep), "per-file reports must not carry a probability");
});

test("--json emits verdict: null and a machine-readable file list", () => {
  const self = path.join(__dirname, "scan-prose.cjs");
  const r = spawnSync(process.execPath, [self, path.join(__dirname, "..", "SKILL.md"), "--json"], { encoding: "utf8" });
  assert.strictEqual(r.status, 0, "a successful scan must exit 0");
  const parsed = JSON.parse(r.stdout);
  assert.strictEqual(parsed.verdict, null);
  assert.ok(/no authorship verdict/.test(parsed.note));
  assert.ok(Array.isArray(parsed.files) && parsed.files.length === 1);
});

test("there is no slop exit code", () => {
  const self = path.join(__dirname, "scan-prose.cjs");
  const usage = spawnSync(process.execPath, [self], { encoding: "utf8" });
  assert.strictEqual(usage.status, 2, "usage error should be 2");
  const missing = spawnSync(process.execPath, [self, "/does/not/exist"], { encoding: "utf8" });
  assert.strictEqual(missing.status, 2, "missing path should be 2");
  const ok = spawnSync(process.execPath, [self, path.join(__dirname, "..", "SKILL.md"), "--quiet"], { encoding: "utf8" });
  assert.strictEqual(ok.status, 0, "scanning a heading-dense file must still exit 0, never a slop code");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
