# Methodology

How to run a pass, what to return, what may be claimed, and where every piece of this skill came from.

---

## The procedure

Run checks **one at a time**. A combined pass goes blind, and that was measured on this very taxonomy.

1. **Scope.** Identify the artifact type, then resolve domain, context, and voice. Say which you picked and why if any were inferred. For `edit` mode on a large file, confirm scope before touching anything.
2. **Protect.** Mark the regions that are off-limits before reading for tells: fenced code blocks, inline code, YAML frontmatter, blockquotes, tables, URLs, file paths, quoted text, and anything explicitly illustrative. See the preservation invariants below.
3. **Date it.** If the text can be dated to before **30 November 2022**, stop looking for machine tells. Commit history, publication date, and revision tools all count.
4. **Tier F sweep.** Scan for forensic artifacts (`references/forensics.md`). These are mechanical deletions and need no cluster.
5. **Tier S pass.** The four writer-side diagnostics — removal test, outline test, paragraph-reshuffle immunity, treadmill effect — plus position tells, rhythm, and structure (`references/patterns.md`).
6. **Substance triage.** For each weak span, classify **rewordable** or **hollow**. Rewordable spans get rewritten by subtraction. Hollow spans get flagged and left empty.
7. **Tier V pass.** Vocabulary, requiring 3+ in a cluster. Keep Tier 1B separate and unweighted.
8. **Tier Q, document level only.** Never flag a paragraph on stylometry alone.
9. **Apply the domain and context filters.** Drop everything the matrix says to skip. Reduce severity next to real specifics.
10. **Write.** Subtract and sharpen. Nothing from the never-inject list.
11. **Second pass** on your own output. Then run the self-check in `SKILL.md`.

---

## The humanness score, and what it is not

A 0–100 number is useful for one thing: ranking your own findings so a reader knows what to fix first. It is **not** a probability, **not** comparable across documents, and **not** evidence of authorship. Say that whenever you print one.

The honest calibration: the most rigorously self-measured skill in this lineage found its composite score had a paragraph-level ROC-AUC of **0.501** — indistinguishable from a coin flip — and 0.623 at document level. Its own conclusion: *"the composite score cannot reliably separate machine text from human text, and no threshold on it buys a useful true-positive rate at a tolerable false-positive cost."*

So the score below is a **communication device**, deliberately built on substance rather than surface hits, because substance is what an editor can act on.

### Four dimensions, 25 points each

| Dimension | 0–6 | 7–13 | 14–19 | 20–25 |
|:--|:--|:--|:--|:--|
| **Specificity** — names, numbers, dates, mechanisms, consequences | Abstractions throughout; no checkable fact | A few specifics, mostly decorative | Specifics carry most claims | Every claim anchored; the details are the argument |
| **Restraint** — is the emphasis earned | Significance asserted constantly; adjectives doing the work | Inflation in the openings and closings | Occasional overreach | Emphasis clusters where it matters and is absent elsewhere |
| **Voice** — is someone reacting to the facts | Nobody is home; pure narration | A stance implied but never stated | A position present, hedged | A position that could be wrong, held, with a costly concession |
| **Structure** — does it build | Paragraph-reshuffle immune; treadmill throughout | Order matters loosely; some restatement | A through-line with soft spots | Each paragraph depends on the one before it |

Bands: **0–39** rewrite from scratch · **40–59** substantial restructuring · **60–79** targeted edits · **80–100** leave it alone or make two cuts.

**Register override.** A reference page or a three-line changelog scores low on Voice by design. Score those documents on Specificity and Structure only, and say you did. A rubric that penalizes correct plain writing is worse than no rubric.

**Never report the score alone.** It's a ranking, and it means nothing without the findings under it.

---

## Preservation invariants

A rewrite must not alter any of these. If it did, it's a bug in the edit, not a stylistic choice.

- Fenced code blocks and their content
- Inline code spans
- YAML frontmatter
- Blockquotes
- Table cell contents
- URLs and file paths
- Heading structure — the levels and the nesting

Two carve-outs, because this skill instructs both: rewording a heading to fix Title Case, and stripping an AI tracking parameter from a URL.

**Idempotence.** Run the pass twice; the second run should return the same text. A strong paragraph must come back unchanged. If your second pass keeps finding new things to change, you are churning style, not removing slop — stop at `--iterate 2`.

**Fidelity.** No claim in the output that wasn't in the input. This is the same test as never-inject, stated as a property of the artifact rather than a rule for the editor.

---

## Output templates

### `detect`

**1. Issues found.** Every hit with its location and the offending text quoted. Group by severity (P0 / P1 / P2) and label the evidence tier (F / S / V / Q). Keep Tier 1B clarity edits visually separate and say which they are — a wordiness fix is a writing suggestion, not evidence about who wrote the text.

**2. Assessment.** For each flag, whether it's a clear problem or a judgment call. Some patterns on the list are effective writing techniques: uniform paragraph length is a problem, a well-placed "however" isn't. Split definitely-fix from worth-a-second-look. If the text is clean, say so and stop.

No verdict. No score without findings. No probability.

### `rewrite` (default)

**1. Issues found.** As above.

**2. Rewritten version.** The full text. Preserve structure, intent, and every specific technical detail. Change only what the guidelines require.

**3. What changed.** The meaningful edits, not every word.

**4. Second-pass audit.** Re-read section 2 as if someone else wrote it. Find what survived — recycled transitions, lingering inflation, copula avoidance, filler. Fix it, return the corrected text inline, and note what changed.

> If this pass changed anything, say in as many words: **use this version, not section 2.** A reader skimming for the finished text will otherwise copy section 2 and ship the tells you just fixed.

### `edit`

After editing the file in place, return a short report — **not the full file**.

**1. Edits made.** A list of changes, each with the file location and before → after. Only the spans you touched.

**2. Verification.** Confirm you re-read the file and the flagged patterns are resolved. Name anything you deliberately left alone because it was already human or intentional.

Refuse source code, config files, and generated data. Prose files only.

### Report header, all modes

State the resolved axes up front so the reader knows what governed the pass:

```
anti-slop — <mode>
Domain:  <domain>            (inferred / specified)
Context: <context profile>   (inferred / specified)
Voice:   <voice or "source"> (inferred / specified / sample-matched)
Venue corpus: <what you sampled, or "none available">
```

---

## What may and may not be claimed

| May say | May not say |
|:--|:--|
| "This passage has 6 slop patterns; here they are" | "This is AI-generated" |
| "These are the fixes, and here's why each improves the writing" | Any probability or percentage of machine authorship |
| "Tier F artifact present — a tool touched this text at some point" | "Therefore the author didn't write it" |
| "Humanness 44/100 on this rubric, which ranks findings and nothing else" | "44% likely AI" |
| "Vocabulary hits are the weakest tier and the ratios behind them are inherited convention" | The 5–20× ratios as measured findings |
| "Structure tells survive paraphrase (Russell et al. 2025)" | That any tell here has a validated false-positive rate |

A Tier F artifact establishes that a tool was involved somewhere in the document's history. It does not establish who wrote the surrounding sentence, and a person pasting one citation into their own paragraph produces the same artifact.

---

## Verification log

What was checked before shipping this version.

| Check | Result |
|:--|:--|
| Every reference file named in `SKILL.md` exists | 8 named, 8 present |
| No broken internal links | All `references/*.md` paths resolve |
| YAML frontmatter parses | Valid; `description` quoted with escaped inner quotes |
| No fabricated homepage or repository URL in frontmatter | Removed |
| Every numeric claim traceable to a named source | Yes, or explicitly labeled unmeasured in `references/evidence.md` |
| Inherited ratios labeled as convention | Yes, `references/vocabulary.md` rule 5 |
| Carve-outs preserved from upstream rather than compressed | Yes — over-flagging is the priority failure mode |
| Authorship verdicts absent from every template | Yes |

Two detectors from the upstream lineage were **reverted** rather than ported, because no rule could spare their legitimate uses: narrated candor as a regex (a genuine conflict-of-interest disclosure reads identically), and structural wall-of-text (long single paragraphs are correct in several registers). Both survive here as judgment-only entries in `references/patterns.md`. That is the right outcome — a detector that can't respect its own carve-out should not ship.

Known upstream gap carried forward: the `load-bearing` construction carve-out misses predicative use ("the wall is load-bearing"), because the modified noun isn't adjacent. Documented in `references/vocabulary.md`.

---

## Provenance

Ten open skills and repositories, plus two research corpora, were read for this version. What each contributed:

| Source | Contribution |
|:--|:--|
| **Wikipedia:Signs of AI writing** (WP:AISIGNS) | The backbone. Words-to-watch by failure mode, the human-signals list from 25 years of article text, the ineffective-indicators list, historical indicators, and the epistemics — including *"No one is taking your em-dashes away"* and *"a word being overused by AI does not imply that its synonyms are also overused"* |
| **Pangram technical report** (arXiv:2402.14873) | The FPR tables, the hard-negative-mining method, the ESL benchmark results, and the sole-arbiter warning that anchors the no-verdict rule |
| `conorbronsdon/avoid-ai-writing` | The most rigorous of the skills: the honest self-measurement (ROC-AUC 0.501), the severity tiers, the context tolerance matrix, voice profiles with numeric targets, the never-inject list, and the preservation invariants |
| `Nanako0129/sepia` | Domain routing and the professional pass: venue-corpus calibration, the one-at-a-time check order, the conventional-is-not-slop whitelist, per-model fingerprints |
| `isatimur/de-slop` | Substance triage — rewordable vs hollow — and the "subtract and sharpen, never add" rule |
| `Aboudjem/humanizer-skill` | Paragraph-reshuffle immunity (P38) and the treadmill effect (P43) |
| `blader/humanizer` | The "personality and soul" instruction — and, via an independent stress test, the humanizer-fingerprint failure that produced the never-inject list |
| `brandonwise/humanizer`, `hardikpandya/stop-slop`, `jalaalrd/anti-ai-slop-writing`, `petergyang/no-ai-slop`, `realrossmanngroup/no_ai_slop_writing_rules` | Pattern coverage, phrase lists, and the wall-of-text and sycophancy entries |

Full citations for all research claims: `references/evidence.md`.

---

## What this skill does not do

- **It does not detect AI.** It audits prose for patterns that are also bad writing. That justification holds regardless of who wrote the text, which is why it's the only one used.
- **It does not score authorship.** Every number here ranks findings.
- **It does not launder documents.** Wikipedia says it directly: *"Please do not merely treat these signs as the problems to be fixed; that could just make detection harder."* Fix them because the writing improves.
- **It does not install a voice.** It preserves the one that's there and removes what's covering it.
- **It does not fill gaps.** A hollow span gets flagged. A missing specific stays missing.
