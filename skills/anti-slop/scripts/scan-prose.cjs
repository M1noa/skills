#!/usr/bin/env node
// prose slop scanner for the anti-slop skill.
// counts and locations only, never an authorship verdict. that rule outranks
// every other rule in this skill, so there is deliberately no "slop" exit code.
//
// usage: node scan-prose.cjs <file-or-dir> [--json] [--quiet]
// exit 0 = scan ran. exit 2 = usage or io error.

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------- marks
// find    mechanical, no carve-out applies. tier f artifacts and literal
//         strings a tool emitted. the fix is always delete-the-token.
// review  countable, but a carve-out exists somewhere. the script cannot tell
//         a default from a decision, so it reports and does not decide.
// clarity tier 1b wordiness. never evidence, excluded from every cluster and
//         density signal below by design.
// metrics document-level numbers. never findings on their own.

// ------------------------------------------------- tier f: forensics
// references/forensics.md. fix for every row: delete the token.
const FORENSICS = [
  ["chatgpt.citation_markup", /contentReference\[oaicite:\d+\](?:\{index=\d+\})?/g],
  ["chatgpt.oai_citation", /\boai_citation[:\d]/g],
  ["chatgpt.citeturn", /citeturn\d+(?:search|news|file)\d/g],
  ["chatgpt.ref_search_name", /<ref name="\d+search\d+/g],
  ["chatgpt.image_turn", /iturn\d+image\d/g],
  ["chatgpt.attribution_blob", /\{"attribution":\{"attributableIndex":/g],
  ["chatgpt.source_badge", /\b(?:Wikipedia|IT Governance)\+\d/g],
  ["gemini.cite", /\[cite:\s*\d+(?:\s*,\s*\d+)*\]/g],
  ["gemini.span", /\[span_\d+\]\(start_span\)/g],
  ["grok.card", /<grok-card\b|grok_render_citation_card_json=/g],
  ["deepseek.lenticular", /【\d+†L\d+(?:-\d+)?】/g],
  ["perplexity.attached_file", /\[attached_file:\d+\]|\[web:\d+\]/g],
  ["perplexity.s3_bucket", /ppl-ai-file-upload/g],
  ["unclassified.writing_variant", /:::\s*(?:writing|écriture)\s*\{/g],
  ["tracking.utm", /\b(?:utm_source)=(?:chatgpt\.com|openai|copilot\.com)\b|\breferrer=grok\.com\b/g],
  ["placeholder.date_xx", /=\d{4}-XX-XX\b/g],
  ["placeholder.bracketed", /\[\s*(?:Your Name|Company|Insert [^\]]{1,60}here)\s*\]/gi],
  ["placeholder.insert_tag", /\b(?:INSERT_[A-Z0-9_]+|PASTE_[A-Z0-9_]+|SOURCE_PUBLISHER|SOURCE_URL)\b/g],
  ["placeholder.url_slot", /\burl=URL\b|\(add [^)]{1,60}here\)/gi],
  ["placeholder.editor_note", /<!--\s*(?:Add if available|EDIT BELOW)/gi],
  ["placeholder.eq_eq_comment", /==\s*<!--/g],
  ["assistant.prompt_ack", /\bCertainly!\s+(?:Here|Let|I)\b|\bGreat question!\s+(?:I|Let|Here)\b/g],
  ["assistant.ai_disclaimer", /\bAs an AI language model\b|\bas an AI assistant\b/g],
  ["assistant.offer_to_format", /\bWould you like me to\b|\bWould you like help formatting\b|\bI can guide you step-by-step\b/gi],
  ["assistant.trailing_offer", /\bLet me know if you'd like me to\b|\bLet me know if you need anything else\b/gi],
];

// --------------------------------------------- tier v: vocabulary lists
// references/vocabulary.md. weights are set in the tier table in SKILL.md:
// three or more in a cluster or nothing, tier 1b never joins a cluster.

// tier 1a frequency markers. rows ending in * carry a documented carve-out
// (metaphorical / technical / literal sense) that no regex can apply.
const TIER_1A = [
  "delve", "delve into", "landscape", "tapestry", "realm", "paradigm", "embark",
  "beacon", "testament to", "robust", "comprehensive", "cutting-edge",
  "leverage", "pivotal", "underscores", "meticulous", "meticulously", "seamless",
  "game-changer", "hit differently", "watershed moment", "the future looks bright",
  "only time will tell", "nestled", "vibrant", "thriving", "showcasing",
  "deep dive", "dive into", "unpack", "unpacking", "bustling", "intricate",
  "intricacies", "complexities", "ever-evolving", "enduring", "daunting",
  "holistic", "actionable", "impactful", "learnings", "thought leader",
  "best practices", "at its core", "synergy", "interplay", "keen", "genuinely",
  "symphony", "embrace", "load-bearing", "marking a pivotal moment",
];

// tier 1b clarity edits. wordiness only, never evidence about anything.
const TIER_1B = [
  "utilize", "utilizes", "in order to", "due to the fact that", "serves as",
  "features", "boasts", "presents", "commence", "ascertain", "endeavor",
];

// tier 2 cluster words. flagged at 2+ inside one paragraph.
const TIER_2 = [
  "harness", "navigate", "navigating", "foster", "fostering", "elevate",
  "unleash", "streamline", "empower", "bolster", "bolstered", "spearhead",
  "resonate", "revolutionize", "facilitate", "underpin", "underpinning",
  "underpinnings", "nuanced", "crucial", "multifaceted", "myriad", "plethora",
  "encompass", "catalyze", "reimagine", "galvanize", "augment", "cultivate",
  "illuminate", "elucidate", "juxtapose", "paradigm-shifting", "transformative",
  "transformation", "cornerstone", "paramount", "burgeoning", "nascent",
  "quintessential", "overarching", "quietly", "deeply", "ecosystem", "poised",
];

// tier 3 density words. flagged at 3% of total words, not per instance.
const TIER_3 = [
  "significant", "significantly", "innovative", "innovation", "effective",
  "effectively", "dynamic", "dynamics", "scalable", "scalability", "compelling",
  "unprecedented", "exceptional", "remarkable", "sophisticated", "instrumental",
  "world-class", "state-of-the-art", "best-in-class", "verbatim",
];

// tier 3 phrases. 2+ of one phrase, or 3+ distinct phrases in one piece.
const TIER_3_PHRASES = [
  "emerging sector", "emerging space", "emerging category", "the integration of",
  "the intersection of", "community-driven", "long-term sustainability",
  "user engagement", "decentralized compute", "reward emissions",
  "tokenized incentive structures",
];

// reviewed-but-not-flagged by default: carve-outs documented in vocabulary.md.
const CARVE_STRUCTURAL = new Set([
  "wall", "beam", "column", "joist", "truss", "member", "footing", "slab",
  "stud", "partition", "masonry", "lintel", "pier", "rafter", "girder",
  "capacity",
]);
const CARVE_VERBATIM = new Set([
  "transcript", "transcripts", "response", "responses", "quote", "quotes",
  "recording", "text", "passage", "answer", "answers",
]);
// deeply counts only in significance collocations; vocabulary.md names three.
const CARVE_DEEPLY = new Set(["integrated", "committed", "rooted"]);

// ---------------------------------------- static phrases worth counting
// pulled from references/patterns.md and vocabulary.md wikipedia sections.
// every row is review-class: a quotation, a comedic beat, or a genuine
// dialogue exchange can produce the same string.
const STATIC_PHRASES = [
  ["register.assistant_turn", "Let me think step by step|Here's my thought process|Breaking this down|First, let's consider|Working through this logically|To approach this systematically"],
  ["register.lets_construct", "Let's explore|Let's dive in|Let's break this down|Let's take a look|Let's examine|In this article, we will explore"],
  ["register.ack_loop", "That's a great question|To answer your question|You're asking about|The question of whether"],
  ["register.sycophancy", "Great question!|Excellent point!|You're absolutely right!|I hope this helps|Feel free to reach out|Absolutely!"],
  ["register.different_from_but", "Not just .{2,60}, but|Not only .{2,60} but|It's not .{2,60}, it's|no .{2,40}, no .{2,40}, just"],
  ["confidence.calibration", "It's worth noting (?:that )?|Interestingly,|Surprisingly,|Importantly,|Notably,|Undoubtedly|Without a doubt"],
  ["confidence.rhetorical_opener", "But what does this mean|So why should you care|What's next\\?"],
  ["confidence.self_label", "That last move is the|This is the interesting part|Here's where it gets clever|the punchline is|that's not nothing"],
  ["confidence.hook", "The catch\\?|The kicker\\?|Here's the thing\\.|The best part\\?|Plot twist:|The result\\?"],
  ["scaffold.section_summary", "In summary|In conclusion|Overall$|To summarize"],
  ["scaffold.generic_closer", "The future looks bright|Only time will tell|One thing is certain|As we move forward"],
  ["scaffold.scenario_opener", "Imagine a world where|Picture a future in which|Envision a world where"],
  ["scaffold.speculative_gap", "maintains a relatively low public profile|is believed to have|not widely documented|based on available information"],
  ["scaffold.cutoff_disclaimer", "As of my last update|I don't have access to real-time data|While specific details are limited"],
  ["attribution.vague", "Experts believe|Studies show|Research suggests|Industry leaders agree|Observers have cited|several sources|independent coverage|Trade publications"],
  ["attribution.name_drop", "Industry reports|such as .{4,60}and |cited in .{2,40}BBC|featured in .{2,40}Times"],
  ["promo.brochure", "nestled within|breathtaking|a vibrant hub|thriving ecosystem|diverse array|groundbreaking|renowned"],
  ["rhetoric.aphorism", "is the language of|is the currency of|is the architecture of|is not a tool but|becomes a trap"],
  ["rhetoric.significance", "marking a pivotal moment|a watershed moment|represents a broader shift|setting the stage for|underscores its importance|plays a (?:crucial|pivotal|vital|significant|key) role"],
  ["rhetoric.ing_analysis", ", (?:highlighting|underscoring|emphasizing|ensuring|reflecting|symbolizing|contributing to|cultivating|fostering|encompassing|enhancing) "],
  ["rhetoric.popular", "What surprised me most|I was fascinated to discover|What struck me was|I was excited to learn|The most interesting part"],
  ["rhetoric.lingering", "the line I keep coming back to|I can't stop thinking about this|still thinking about this one|has been rattling around in my head"],
  ["rhetoric.candor", "I want to be upfront|To be fully transparent|Rather than bury this|I would rather flag than let you discover"],
  ["rhetoric.real_adjective", "\\b(?:real|actual|genuine|true) (?:on-chain|revenue|utility|product-market fit|customers|engagement|adoption)"],
  ["rhetoric.template_pair", "Whether you're .{3,50} or |I recently had the pleasure of"],
  ["hedge.stack", "\\b(?:could potentially|may eventually|might ultimately|may ultimately|could ultimately)\\b"],
  ["hedge.parenthetical", "\\(and,? (?:increasingly|perhaps|more importantly|more precisely)"],
  ["copy.generic_tagline", "Transform your|Launch faster|Build your dreams|Create without limits|Where ideas become|The future of|Supercharge|Unlock your potential"],
];

// transitions for the >30%-of-paragraphs-opening rule (tier q / tier s).
const TRANSITIONS = [
  "moreover", "furthermore", "additionally", "however", "nevertheless",
  "therefore", "consequently", "in conclusion", "in summary", "to summarize",
  "that said", "that being said", "in today", "in an era where",
  "when it comes to", "at the end of the day", "importantly", "notably",
  "interestingly", "finally", "instead", "meanwhile", "otherwise", "besides",
  "thus", "hence", "likewise", "similarly", "on the other hand", "in fact",
];

// minimal verb set for the bare-noun-phrase bullet heuristic. 5+ consecutive
// bullets under 6 words with none of these reads as noun-phrase soup.
const BULLET_VERBS = new Set([
  "is", "are", "was", "were", "has", "have", "had", "will", "would", "can",
  "could", "should", "must", "may", "do", "does", "did", "make", "makes",
  "keep", "keeps", "return", "returns", "uses", "give", "gives", "runs",
  "stays", "stores", "adds", "removes", "reads", "writes", "takes", "needs",
]);

const MINOR_WORDS = new Set([
  "a", "an", "the", "of", "and", "or", "to", "in", "for", "on", "with", "at",
  "by", "from", "as", "is", "vs", "via", "per", "into", "over", "under", "no",
]);

// ------------------------------------------------ protected regions
// preservation invariants from references/methodology.md. masked lines keep
// their length and count so reported line numbers still point at the source.
function maskProtected(src) {
  const lines = src.split("\n");
  const out = [];
  let inFence = false;
  let inFront = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (i === 0 && raw.trim() === "---") { inFront = true; out.push(""); continue; }
    if (inFront) {
      if (raw.trim() === "---" || raw.trim() === "...") inFront = false;
      out.push("");
      continue;
    }
    if (/^\s*(```|~~~)/.test(raw)) { inFence = !inFence; out.push(""); continue; }
    if (inFence) { out.push(""); continue; }
    if (/^\s*>/.test(raw)) { out.push(""); continue; }
    if (/^\s*\|/.test(raw)) { out.push(""); continue; }
    out.push(raw.replace(/`[^`]*`/g, (m) => " ".repeat(m.length)));
  }
  return out.join("\n");
}

function splitIntoParts(masked) {
  const lines = masked.split("\n");
  const headings = [];
  const bullets = [];
  const proseLines = [];

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const h = /^(#{1,6})\s+(.*?)\s*$/.exec(raw);
    if (h) {
      headings.push({ level: h[1].length, text: h[2], line: lineNo });
      proseLines.push({ text: "", line: lineNo, blank: true });
      return;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(raw)) {
      bullets.push({ text: raw.replace(/^\s*([-*+]|\d+[.)])\s+/, ""), line: lineNo });
      proseLines.push({ text: "", line: lineNo, blank: true });
      return;
    }
    proseLines.push({ text: raw, line: lineNo, blank: raw.trim() === "" });
  });

  // paragraphs = runs of non-blank prose lines, blank-line delimited.
  const paragraphs = [];
  let cur = null;
  proseLines.forEach((pl) => {
    if (pl.blank || pl.text.trim() === "") {
      if (cur) { paragraphs.push(cur); cur = null; }
      return;
    }
    if (!cur) cur = { text: "", start: pl.line };
    cur.text += (cur.text ? " " : "") + pl.text.trim();
    cur.end = pl.line;
  });
  if (cur) paragraphs.push(cur);

  return { headings, bullets, paragraphs };
}

const wordsOf = (s) => (s.toLowerCase().match(/[a-z0-9][a-z0-9'-]*/g) || []);

function splitSentences(text) {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return [];
  return t.split(/(?<=[.!?])\s+(?=["“(])/).filter((s) => s.trim().length);
}

// returns {text, line} matches, skipping anything inside inline code already
// masked out and any match that sits inside a URL or path.
function scanRegex(body, rx, maskFn) {
  const hits = [];
  let m;
  rx.lastIndex = 0;
  while ((m = rx.exec(body)) !== null) {
    if (m[0].length === 0) { rx.lastIndex++; continue; }
    if (maskFn && maskFn(body, m.index, m[0])) continue;
    hits.push({ text: m[0], index: m.index });
  }
  return hits;
}

function lineLookup(body) {
  const starts = [0];
  for (let i = 0; i < body.length; i++) if (body[i] === "\n") starts.push(i + 1);
  return (idx) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= idx) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

function wordRe(term) {
  return new RegExp("(?<![a-z0-9'-])" + term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![a-z0-9'-])", "gi");
}

// surrounding word, used by the three documented carve-outs.
function tailWord(s, end) {
  const m = /^\s*([a-z][a-z-]{2,})/i.exec(s.slice(end));
  return m ? m[1].toLowerCase() : "";
}

// ------------------------------------------------------------ the scan
function scanSource(src, name) {
  const masked = maskProtected(src);
  const { headings, bullets, paragraphs } = splitIntoParts(masked);
  const srcLines = src.split("\n");
  const at = lineLookup(masked);

  const out = { file: name, find: [], review: [], clarity: [], metrics: {} };

  const push = (bucket, id, hits, note) => {
    if (!hits.length) return;
    const lines = [...new Set(hits.map((h) => h.line))].sort((a, b) => a - b);
    const samples = [...new Set(hits.map((h) => h.text.replace(/\s+/g, " ").trim()))].slice(0, 3);
    bucket.push({ id, count: hits.length, lines: lines.slice(0, 8), samples, ...(note ? { note } : {}) });
  };

  // --- tier f -------------------------------------------------------------
  for (const [id, rx] of FORENSICS) {
    const hits = scanRegex(masked, rx).map((h) => ({ text: h.text, line: at(h.index) }));
    push(out.find, id, hits);
  }

  // --- tier v, per paragraph so cluster rules apply -----------------------
  const words = paragraphs.reduce((n, p) => n + wordsOf(p.text).length, 0);

  const clusterHits = (list, minPerParagraph) => {
    const flagged = [];
    for (const p of paragraphs) {
      const hits = [];
      for (const term of list) {
        for (const h of scanRegex(p.text, wordRe(term))) {
          if (term === "load-bearing" && CARVE_STRUCTURAL.has(tailWord(p.text, h.index + h.text.length))) continue;
          if (term === "verbatim" && CARVE_VERBATIM.has(tailWord(p.text, h.index + h.text.length))) continue;
          hits.push({ text: h.text, line: p.start });
        }
      }
      if (hits.length >= minPerParagraph) flagged.push(...hits);
    }
    return flagged;
  };

  push(out.review, "tier1a.cluster3", clusterHits(TIER_1A, 3), "3+ tier 1a in one paragraph (vocabulary.md rule 1)");

  const tier2hits = [];
  for (const p of paragraphs) {
    const hits = [];
    for (const term of TIER_2) {
      for (const h of scanRegex(p.text, wordRe(term))) {
        if (term === "deeply") {
          // vocabulary.md: deeply counts only in significance collocations.
          if (!CARVE_DEEPLY.has(tailWord(p.text, h.index + h.text.length))) continue;
        }
        hits.push({ text: h.text, line: p.start });
      }
    }
    if (hits.length >= 2) tier2hits.push(...hits);
  }
  push(out.review, "tier2.cluster2", tier2hits, "2+ tier 2 words in one paragraph");

  // tier 1b: report, but never let it join a cluster or a density signal.
  const clarityHits = [];
  for (const p of paragraphs) {
    for (const term of TIER_1B) {
      for (const h of scanRegex(p.text, wordRe(term))) {
        clarityHits.push({ text: h.text, line: p.start });
      }
    }
  }
  push(out.clarity, "tier1b.wordiness", clarityHits, "wordiness only, excluded from every cluster and density signal");

  // tier 3 density: 3% of total prose words.
  let tier3 = 0;
  const tier3Hits = [];
  for (const p of paragraphs) {
    for (const term of TIER_3) {
      for (const h of scanRegex(p.text, wordRe(term))) {
        if (term === "verbatim" && CARVE_VERBATIM.has(tailWord(p.text, h.index + h.text.length))) continue;
        tier3++;
        tier3Hits.push({ text: h.text, line: p.start });
      }
    }
  }
  const tier3Rate = words ? tier3 / words : 0;
  if (tier3Rate >= 0.03) push(out.review, "tier3.density", tier3Hits, `${(tier3Rate * 100).toFixed(1)}% of prose words, threshold 3%`);

  // tier 3 phrases: 2+ of one phrase, or 3+ distinct in the piece.
  const phraseCounts = new Map();
  for (const p of paragraphs) {
    for (const term of TIER_3_PHRASES) {
      for (const h of scanRegex(p.text, wordRe(term))) {
        if (!phraseCounts.has(term)) phraseCounts.set(term, []);
        phraseCounts.get(term).push({ text: h.text, line: p.start });
      }
    }
  }
  const repeated = [...phraseCounts.entries()].filter(([, v]) => v.length >= 2);
  const distinct = [...phraseCounts.entries()].filter(([, v]) => v.length >= 1);
  if (repeated.length) {
    push(out.review, "tier3.phrase_repeat", repeated.flatMap(([, v]) => v), "2+ uses of the same phrase");
  } else if (distinct.length >= 3) {
    push(out.review, "tier3.phrase_variety", distinct.flatMap(([, v]) => v), "3+ distinct tier 3 phrases in one piece");
  }

  // --- static phrases -----------------------------------------------------
  // density-gated rows follow thresholds documented in patterns.md; a hit
  // below threshold is a metric, not a finding.
  const DENSITY_GATED = {
    "register.different_from_but": { per: 500, min: 2, minCount: 3, why: "tier q: >2 per 500 words" },
    "confidence.calibration": { per: 500, min: 3, minCount: 3, why: "density rule: 3 in 500 is stacking, 1 in 2000 is fine" },
  };
  for (const [id, body] of STATIC_PHRASES) {
    const rx = new RegExp("(?:^|(?<=\\s))" + body + (body.includes("$") ? "" : "\\b"), "gim");
    const hits = scanRegex(masked, rx).map((h) => ({ text: h.text, line: at(h.index) }));
    if (!hits.length) continue;
    const gate = DENSITY_GATED[id];
    if (!gate) { push(out.review, id, hits); continue; }
    // density is extrapolated on short documents, which manufactures hits out
    // of a single instance. require the documented absolute count first.
    const per500 = words ? (hits.length / words) * gate.per : 0;
    if (hits.length >= gate.minCount && per500 >= gate.min) {
      push(out.review, id, hits, `${per500.toFixed(1)} per ${gate.per} words, ${gate.why}`);
    } else {
      out.metrics[id] = `${hits.length} hit(s), under the ${gate.minCount}-hit / ${gate.min}-per-${gate.per} threshold`;
    }
  }

  // --- structure and formatting -------------------------------------------
  const headingHits = (pred, id, note) => {
    const hits = headings.filter(pred).map((h) => ({ text: h.text, line: h.line }));
    if (hits.length) push(out.review, id, hits, note);
  };

  if (words >= 100 && headings.length > words / 100) {
    out.review.push({
      id: "structure.header_density",
      count: headings.length,
      lines: headings.slice(0, 8).map((h) => h.line),
      samples: [],
      note: `${headings.length} headings in ${words} prose words, ${((headings.length / words) * 300).toFixed(1)} per 300 (rule of thumb: >3 per 300)`,
    });
  }
  if (bullets.length >= 8 && words < bullets.length * 25) {
    out.review.push({
      id: "structure.list_density",
      count: bullets.length,
      lines: bullets.slice(0, 8).map((b) => b.line),
      samples: [],
      note: `${bullets.length} bullets in ${words} words (rule of thumb: 8+ bullets in under 200 words)`,
    });
  }

  headingHits(
    (h) => /^(?:Overview|Key Points|Summary|Conclusion|Introduction|Challenges and Legacy|Future Outlook|Future Prospects|Awards and recognition|Recognition)$/.test(h.text),
    "structure.scaffold_header",
    "scaffolding header; replace with a heading that says what follows"
  );

  headingHits((h) => {
    const w = h.text.replace(/[^\w\s-]/g, "").split(/\s+/).filter(Boolean);
    if (w.length < 3) return false;
    return w.filter((w2) => !MINOR_WORDS.has(w2.toLowerCase())).every((w2) => w2[0] === w2[0].toUpperCase());
  }, "format.title_case_headings", "sentence case for subheadings");

  const l1 = headings.filter((h) => h.level === 1);
  if (l1.length > 1) headingHits((h) => h.level === 1, "format.level1_overuse", "multiple level-1 headings in one body");
  for (let i = 1; i < headings.length; i++) {
    if (headings[i].level > headings[i - 1].level + 1) {
      out.review.push({
        id: "format.skipped_heading_level",
        count: 1,
        lines: [headings[i].line],
        samples: [headings[i].text],
        note: `h${headings[i].level} follows h${headings[i - 1].level}`,
      });
      break;
    }
  }

  const mlines = masked.split("\n");
  const breaks = [];
  mlines.forEach((ln, i) => {
    if (!/^\s*---+\s*$/.test(ln)) return;
    const prev = i > 0 ? mlines[i - 1].trim() : "";
    if (prev === "" || /^#{1,6}\s/.test(prev)) breaks.push(i + 1);
  });
  if (breaks.length >= 4) push(out.review, "format.thematic_breaks", breaks.map((l) => ({ text: "---", line: l })), `${breaks.length} standalone --- rules`);

  // carve-out: when the label span is a full sentence, the period is correct.
  // a 4+ word bold span is at the boundary, and a verb test without a lexicon
  // cannot separate "Removal test." from "Carve-outs outrank triggers." — so
  // the boundary sits short, because over-flagging is the priority failure mode.
  const AUX = new Set(["to", "is", "are", "was", "were", "has", "have", "had", "will", "would", "can", "could", "should", "must", "may", "might", "do", "does", "did"]);
  const inlineHeader = bullets.filter((b) => {
    const m = /^\*\*([^*]{1,60})\.\*\*\s+\S/.exec(b.text);
    if (!m) return false;
    return wordsOf(m[1]).length <= 3 && !wordsOf(m[1]).some((w) => AUX.has(w));
  });
  if (inlineHeader.length) push(out.review, "format.list_label_period", inlineHeader.map((b) => ({ text: b.text, line: b.line })), "period after a short label reads as a sentence the gloss then contradicts; 4+ word spans were treated as sentences and left alone");

  // 5+ consecutive short bullets with no auxiliary and near-identical length.
  // the tell is symmetry (patterns.md), not the missing verb, so the test is
  // shape-based; a genuine list of parallel items still lands here and the
  // note says so because the carve-out is documented.
  const bare = (b) => {
    const ws = wordsOf(b.text);
    return ws.length > 0 && ws.length <= 6 && !ws.some((w) => AUX.has(w)) && !ws.some((w) => BULLET_VERBS.has(w));
  };
  let run = [];
  const runs = [];
  bullets.forEach((b) => {
    if (bare(b)) run.push(b);
    else { if (run.length >= 5) runs.push(run); run = []; }
  });
  if (run.length >= 5) runs.push(run);
  if (runs.length) {
    push(out.review, "structure.bare_noun_bullets", runs.flat().map((b) => ({ text: b.text, line: b.line })),
      "5+ short same-shape bullets with no auxiliary; carve-out is genuine list content (changelogs, todos, parameter docs), so convert to prose only if the bullets summarize claims");
  }

  const emojiRx = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
  const decorated = [...headings.map((h) => ({ t: h.text, l: h.line })), ...bullets.map((b) => ({ t: b.text, l: b.line }))].filter((x) => emojiRx.test(x.t));
  if (decorated.length) push(out.review, "format.emoji_as_formatting", decorated.map((x) => ({ text: x.t, line: x.l })), "emoji decorating headings or bullets");

  // hashtag stuffing, with the subtraction rules from patterns.md.
  const stripTags = (s) => s
    .replace(/https?:\/\/\S*#\S*/g, " ")
    .replace(/\b[\w.-]+\/[\w.-]+#\d+/g, " ")
    .replace(/#\d+\b/g, " ")
    .replace(/#[0-9a-f]{6,8}\b/gi, (m) => (/\d/.test(m.slice(1)) ? " " : m))
    .replace(/#include\b/g, " ");
  const tagHits = [];
  for (const p of paragraphs) {
    const found = stripTags(p.text).match(/#[A-Za-z][\w-]*/g) || [];
    for (const t of found) tagHits.push({ text: t, line: p.start });
  }
  if (tagHits.length >= 6) push(out.review, "copy.hashtag_stuffing", tagHits, "six is the empirical floor; organic posts plateau past 3-5");

  // --- tier q and structure metrics --------------------------------------
  const sentences = paragraphs.flatMap((p) => splitSentences(p.text).map((s) => ({ s, line: p.start })));
  const sentLens = sentences.map((x) => wordsOf(x.s).length).filter((n) => n > 0);
  const paraLens = paragraphs.map((p) => wordsOf(p.text).length).filter((n) => n > 0);
  const uniq = new Set();
  paragraphs.forEach((p) => wordsOf(p.text).forEach((w) => uniq.add(w)));

  const m = out.metrics;
  m.words = words;
  m.sentences = sentLens.length;
  m.paragraphs = paraLens.length;
  m.headings = headings.length;
  m.bullets = bullets.length;
  if (words >= 200) m.type_token_ratio = `${(uniq.size / words).toFixed(2)} (human general prose ~0.50-0.65; below 0.40 worth a second look)`;

  if (sentLens.length) {
    const sorted = [...sentLens].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const inBand = sentLens.filter((n) => n >= 15 && n <= 25).length / sentLens.length;
    m.sentence_length = `min ${sorted[0]} / median ${med} / max ${sorted[sorted.length - 1]} words; ${(inBand * 100).toFixed(0)}% in the 15-25 band`;
    if (sentLens.length >= 8 && inBand >= 0.7) {
      out.review.push({
        id: "tierq.sentence_uniformity",
        count: sentLens.filter((n) => n >= 15 && n <= 25).length,
        lines: [],
        samples: [],
        note: `${(inBand * 100).toFixed(0)}% of sentences in the 15-25 word band across ${sentLens.length} sentences (editorial rule of thumb, no published false-positive rate)`,
      });
    }
    const longest = sentences.filter((x) => wordsOf(x.s).length > 30);
    if (longest.length) m.over_30_word_sentences = `${longest.length} (reference and API docs legitimately sit in a narrow band)`;
  }

  if (paraLens.length >= 6) {
    const mean = paraLens.reduce((a, b) => a + b, 0) / paraLens.length;
    const spread = (Math.max(...paraLens) - Math.min(...paraLens)) / mean;
    m.paragraph_spread = `range/mean = ${(spread * 100).toFixed(0)}% (uniformity rule of thumb: all within ~15%)`;
    if (spread <= 0.15) {
      out.review.push({
        id: "tierq.paragraph_uniformity",
        count: paraLens.length,
        lines: [],
        samples: [],
        note: `all ${paraLens.length} paragraphs within ${(spread * 100).toFixed(0)}% of each other; meaningless under 6 paragraphs`,
      });
    }
  }

  const openers = paragraphs.map((p) => wordsOf(p.text)[0]).filter(Boolean);
  const transitionCount = openers.filter((w) => TRANSITIONS.includes(w)).length;
  const transitionRate = openers.length ? transitionCount / openers.length : 0;
  m.transition_openings = `${(transitionRate * 100).toFixed(0)}% of ${openers.length} paragraphs (${transitionCount}); >30% is a structure finding, a transition word in isolation is nothing`;
  if (openers.length >= 4 && transitionRate > 0.3) {
    out.review.push({
      id: "tierq.transition_density",
      count: transitionCount,
      lines: [],
      samples: [],
      note: `${(transitionRate * 100).toFixed(0)}% of paragraphs open on a transition word (editorial rule of thumb)`,
    });
  }

  let sameRun = 0;
  let bestRun = 0;
  let prev = "";
  openers.forEach((w) => {
    sameRun = w === prev ? sameRun + 1 : 1;
    prev = w;
    if (sameRun > bestRun) bestRun = sameRun;
  });
  m.same_opener_run = `longest run of paragraphs opening on the same word = ${bestRun} (3+ is a hit)`;
  if (bestRun >= 3) {
    out.review.push({
      id: "tierq.same_opener_run",
      count: bestRun,
      lines: [],
      samples: [],
      note: `${bestRun} consecutive paragraphs open on the same word`,
    });
  }

  const dashes = (masked.match(/—/g) || []).length;
  m.em_dashes = `${dashes} (frequency plus misuse, never existence; July 2026 comparison found only Claude exceeds professional writers on em-dash rate)`;
  const curly = (masked.match(/[“”‘’]/g) || []).length;
  m.curly_quotes = `${curly} (weak prior at best: Word smart quotes, macOS defaults, and typesetting tools produce the same)`;
  const bold = (masked.match(/\*\*[^*\n]+\*\*/g) || []).length;
  m.bold_spans = `${bold} (count only; excessive boldface is mechanical emphasis, not a lexical tell)`;
  const parallel = (masked.match(/\bnot (?:just|only) .{2,60} but\b|\bit's not .{2,60}, it's\b|\brather than\b/gi) || []).length;
  m.contrasting_parallelisms = `${parallel} (rule of thumb: >2 per 500 words)`;
  m.code = "fenced code, inline code, blockquotes, tables and frontmatter were skipped (preservation invariants)";

  return out;
}

// --------------------------------------------------------------- render
const EXT = new Set([".md", ".markdown", ".mdx", ".txt", ".rst", ".adoc"]);

function collect(target) {
  const st = fs.statSync(target);
  if (st.isFile()) return [target];
  const found = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (["node_modules", ".git", "vendor", "dist", "build"].includes(ent.name)) continue;
        walk(p);
      } else if (EXT.has(path.extname(ent.name).toLowerCase())) found.push(p);
    }
  };
  walk(target);
  return found.sort();
}

const fmtLines = (r) => (r.lines.length ? r.lines.map((l) => "L" + l).join(", ") : "-");
const row = (mark, r) =>
  `    ${mark} ${r.id.padEnd(34)} x${String(r.count).padEnd(4)} ${fmtLines(r)}${r.samples.length ? "  " + r.samples.join(" | ") : ""}` +
  (r.note ? `\n        ${r.note}` : "");

function render(rep) {
  const out = [];
  out.push(`${rep.file}`);
  if (rep.find.length) {
    out.push(`  find (${rep.find.length})   mechanical, fix is always delete-the-token`);
    for (const r of rep.find) out.push(row("!", r));
  }
  if (rep.review.length) {
    out.push(`  review (${rep.review.length}) carve-outs apply; a hit is not a finding until one is ruled out`);
    for (const r of rep.review) out.push(row("?", r));
  }
  if (rep.clarity.length) {
    out.push(`  clarity (${rep.clarity.length}) wordiness only, excluded from every cluster and density signal`);
    for (const r of rep.clarity) out.push(row("-", r));
  }
  const metricKeys = Object.keys(rep.metrics);
  if (metricKeys.length) {
    out.push("  metrics (document level, never findings on their own)");
    for (const k of metricKeys) out.push(`      ${k}: ${rep.metrics[k]}`);
  }
  if (!rep.find.length && !rep.review.length && !rep.clarity.length) out.push("  nothing counted");
  return out.join("\n");
}

const FOOTER = [
  "",
  "counts only. this is not an authorship verdict and carries no probability:",
  "every pattern above is also just bad writing, which is why fixing it helps.",
  "if a flagged pattern is the content, a named decision, or house style, say so",
  "and name the alternative you rejected instead of editing it away.",
].join("\n");

// ------------------------------------------------------------------ main
function main(argv) {
  const args = argv.slice(2);
  const json = args.includes("--json");
  const quiet = args.includes("--quiet");
  const targets = args.filter((a) => !a.startsWith("--"));

  if (!targets.length) {
    console.error("usage: node scan-prose.cjs <file-or-dir> [--json] [--quiet]");
    return 2;
  }

  const files = [];
  for (const t of targets) {
    if (!fs.existsSync(t)) { console.error("no such file or directory: " + t); return 2; }
    files.push(...collect(t));
  }
  if (!files.length) { console.error("no prose files found"); return 2; }

  const reports = [];
  for (const f of files) {
    let src;
    try { src = fs.readFileSync(f, "utf8"); }
    catch (e) { console.error(`${f}: ${e.message}`); return 2; }
    reports.push(scanSource(src, f));
  }

  if (json) {
    console.log(JSON.stringify({
      tool: "anti-slop/scan-prose",
      verdict: null,
      note: "counts and locations only; no authorship verdict is expressed or implied.",
      files: reports,
    }, null, 2));
    return 0;
  }

  if (!quiet) {
    console.log(`anti-slop scan — ${reports.length} file(s)`);
    console.log("protected and skipped: fenced code, inline code, blockquotes, tables, frontmatter");
    console.log("");
    for (const r of reports) console.log(render(r) + "\n");
    const totalF = reports.reduce((n, r) => n + r.find.length, 0);
    const totalR = reports.reduce((n, r) => n + r.review.length, 0);
    const totalC = reports.reduce((n, r) => n + r.clarity.length, 0);
    console.log(`totals: find ${totalF} · review ${totalR} · clarity ${totalC} across ${reports.length} file(s)`);
    console.log(FOOTER);
  }
  return 0;
}

if (require.main === module) process.exit(main(process.argv));
module.exports = { scanSource, maskProtected, splitIntoParts };



