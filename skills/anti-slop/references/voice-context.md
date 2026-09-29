# Voice and context

Two independent axes. **Voice** sets how the prose should sound. **Context** sets how hard to enforce. Domain (`references/domains.md`) is the third and sets what the register demands.

A voice profile can bring out what the source already has. It can never manufacture what the source lacks — the never-inject list at the bottom of this page is not optional, and it is the rule most likely to be broken by a well-meaning voice pass.

---

## Voice profiles

Voice is **optional**. If the writer doesn't name one, infer it from the input's existing register and don't impose a persona on text that already has one. Each profile is a set of concrete targets, not a vibe.

### `casual`

Blog posts, social, community writing.

- Contractions throughout; their absence reads stiff.
- Short sentences — average around 14 words or below. Fragments allowed.
- Keep first person and concrete touches **where the source has them**. Never add one it lacks.
- Near-zero jargon.
- Keep warm hedges ("honestly", "I think"); cut corporate ones ("it's worth noting").

### `professional`

LinkedIn, investor email, sponsor pitches, external announcements.

- Active voice for most sentences.
- Vary sentence length; avoid three in a row within a few words of each other.
- One concrete claim per paragraph — a number, a name, a date — **when the source provides one.** Never "experts say."
- Keep the ask explicit where the source makes one. Never invent an ask.
- Low tolerance for hedging.

### `technical`

Docs, technical blog, architecture write-ups.

- Prefer plain copulas ("X is Y") over inflated substitutes ("serves as", "stands as a testament to").
- One idea per sentence. Imperative mood for instructions.
- Jargon is fine; define it on first use.
- Tables and lists only where the content is genuinely list-shaped, never for decoration.

### `warm`

Mentorship, onboarding, thank-yous, community moderation.

- Address the reader directly **where the source already speaks to them** ("you"), and keep its acknowledgment rather than adding one.
- Cut intensifiers ("very", "truly", "incredibly") in favor of stronger verbs.
- No performative-empathy openers: "I completely understand how you feel."
- Medium sentences, 15–20 words, for an unhurried cadence.

### `blunt`

Decision memos, hard feedback, position pieces.

- Lead with the claim. Cut "it's important to note that" windups.
- Em dashes are rare here; use periods for emphasis.
- No padding to reach a rule of three.
- Near-zero hedging; flag "may / could / potentially" stacks.
- Short declaratives with the occasional long sentence for contrast.

### Calibrating from a sample instead

If the writer hands you their own writing — "match my voice, here's a post" — analyze it and match *that*, not a named profile. What to measure:

| Measure | What to match |
|:--|:--|
| Sentence-length pattern | Their range and their rhythm, including whatever is unusual about it |
| Contraction rate | If they never contract, don't start |
| Paragraph openings | Do they open on the subject, a transition, a question, a fragment |
| Recurring word choices | Their words, at their register |
| Formatting habits | Headers or none, lists or prose, bold or plain |
| Punctuation habits | Their dash rate, their parentheses, their semicolons |

**Do not upgrade their vocabulary.** If they write "stuff" and "things", keep "stuff" and "things". Replacing a plain word with a better one is the single most common way a voice-matching pass destroys a voice.

Sample calibration outranks every named profile. When someone gives you two or three samples, that corpus is the target.

---

## Context profiles

Context sets strictness for an audience. Rules not listed in the matrix apply at full strength in every profile.

| Profile | What it is |
|:--|:--|
| `blog` | **Default.** Standard long-form prose. All rules at full strength |
| `linkedin` | Short-form social. Punchy fragments and visual formatting are the register |
| `technical-blog` | Long-form with code, architecture, APIs. Technical terms get a pass |
| `investor-email` | **Strictest.** High-trust audience; promotional language is the biggest risk |
| `docs` | Documentation, READMEs, guides. Clarity over voice |
| `casual` | Chat, internal notes, quick replies. Only the worst offenders |
| `academic` | Papers, theses, literature reviews. Disciplinary convention outranks this skill |

### Tolerance matrix

`strict` = flag normally. `relaxed` = flag only egregious cases. `skip` = don't audit this category here. `extra strict` = flag borderline instances too.

| Rule | linkedin | blog | technical-blog | investor-email | docs | casual | academic |
|:--|:--|:--|:--|:--|:--|:--|:--|
| Em dashes | relaxed (2/post OK) | strict | strict | strict | relaxed | skip | relaxed |
| Bold overuse | relaxed (bold hooks OK) | strict | strict | strict | relaxed | skip | strict |
| Emoji in headers | relaxed (1–2 end-of-line) | strict | strict | strict | skip | skip | strict |
| Excessive bullets | skip (lists work there) | strict | relaxed (technical lists) | strict | skip (lists are docs) | skip | strict |
| Hedging | strict | strict | relaxed ("may" is accurate) | strict | relaxed | skip | **skip** (hedging is disciplinary norm) |
| Tier 1A word table | strict | strict | **partial** (see below) | strict | relaxed | P0 only | strict |
| Promotional language | relaxed (some sell expected) | strict | strict | **extra strict** | strict | skip | strict |
| Significance inflation | strict | strict | strict | **extra strict** | relaxed | skip | **extra strict** (this is the field's own worst habit) |
| Copula avoidance | skip | strict | relaxed | strict | skip | skip | relaxed |
| Uniform paragraph length | skip (short-form) | strict | strict | strict | relaxed | skip | relaxed (section conventions) |
| Numbered list inflation | relaxed | strict | relaxed | strict | skip | skip | strict |
| Rhetorical questions | relaxed (1 as hook) | strict | strict | strict | strict | skip | strict |
| Transition phrases | skip (short-form) | strict | strict | strict | relaxed | skip | relaxed (*Moreover* is house style in some fields) |
| Generic conclusions | skip | strict | strict | **extra strict** | skip | skip | strict (a Conclusion section is fine; an empty one isn't) |
| Hashtag stuffing | strict | strict | strict | **extra strict** | skip | skip | skip |
| Bare noun-phrase bullet lists | strict | strict | relaxed (option lists) | strict | relaxed (parameter lists) | skip | relaxed |
| Tier 3 phrase clustering | strict | strict | strict | **extra strict** | relaxed | skip | strict |
| Future-narrative closers | strict | strict | strict | **extra strict** | skip | skip | relaxed (*Future work* is a real section) |
| Social endorsement closers | strict — the share-post tell | strict | strict | strict | skip | relaxed (1 OK in a DM) | skip |
| Hedge-stacked predictions | strict | strict | relaxed ("could" is hedged accuracy) | **extra strict** | relaxed | skip | relaxed |
| Real/actual inflation | strict | strict | strict | **extra strict** | relaxed | skip | strict |
| Moral-adjective category errors | strict | strict | relaxed | strict | relaxed | skip | strict |
| Invented contrast-pair mirroring | strict | strict | relaxed | strict | relaxed | skip | strict |
| Subjectless fragments, agentless passives | relaxed (the register) | strict | relaxed | strict | skip (fragment lists are docs) | skip | **relaxed** (passive voice is conventional in methods) |
| Vague attribution | strict | strict | strict | **extra strict** | strict | relaxed | **extra strict** (an uncited claim is a defect here) |
| Chatbot artifacts, cutoff disclaimers | extra strict | extra strict | extra strict | extra strict | extra strict | strict | extra strict |
| Wall-of-text (no line breaks) | strict | strict | strict | strict | strict | strict | skip |
| Repeated terminology / low TTR | relaxed | strict | skip (term consistency required) | relaxed | **skip** | skip | skip |

**Technical-blog Tier 1A exceptions.** These have legitimate technical meaning and don't flag in a technical context: `robust`, `comprehensive`, `seamless`, `ecosystem`, `leverage` (when it's actual platform leverage or an API), `facilitate`, `underpin`, `streamline`. Still flag: `delve`, `tapestry`, `beacon`, `embark`, `testament to`, `game-changer`, `harness`.

**Academic-specific note.** Hedging, passives, formal register, and section scaffolding are disciplinary requirements, not tells. What remains flaggable is real: uncited claims, significance inflation ("this study underscores the critical importance of…"), the challenges-and-future-directions filler section, and the vocabulary that Kobak et al. measured *in this exact corpus*. Never edit toward informality here.

**Forensic artifacts are exempt from the whole matrix.** `citeturn0search0` and "As of my last training update" get deleted in a casual DM as fast as in an investor email.

### Auto-detection cues

When no context is specified, infer:

| Signal | Inferred |
|:--|:--|
| Under 300 words + hashtags or @-mentions | `linkedin` |
| Code blocks, API references, architecture discussion | `technical-blog` |
| Salutation ("Hi \[name\]", "Dear") + investor or fundraising language | `investor-email` |
| Step-by-step instructions, parameter documentation, README structure | `docs` |
| Citations, abstract, methods/results structure, reference list | `academic` |
| Chat transcript shape, lowercase, no structure | `casual` |
| No strong signal | `blog` — the safest default, all rules apply |

Say which profile you picked and why. If the guess feels wrong, the user overrides.

---

## How the axes compose

**Voice sets the target; context sets enforcement.** A voice target always applies, even where a context profile would skip that category — `technical` voice still prefers plain copulas in a `casual` context that otherwise ignores copula avoidance.

**Where they agree, they reinforce.** `blunt` voice wants near-zero em dashes and `blog` context is already strict on them, so it stays a hard edit.

**Where they disagree, resolve toward the stricter.** A `warm` voice on `docs` still doesn't get decorative tables.

**Where a domain says a convention is expected, the domain wins over both.** `investor-email` strictness does not license flagging Keep a Changelog categories in a release note.

Sensible default pairings: casual↔casual, professional↔linkedin / investor-email, technical↔docs / technical-blog, blunt↔blog.

---

## Severity tiers for triage

For quick passes and large documents, work in this order. This is a priority ranking, not an evidence ranking — the F/S/V/Q tiers in `SKILL.md` are the evidence axis.

**P0 — credibility killers.** Cutoff disclaimers. Chatbot artifacts. Vague attribution with no source. Significance inflation on a routine event. Every forensic artifact in `references/forensics.md`.

**P1 — obvious slop.** Tier 1A vocabulary hits. Template phrases and slot-fill constructions. "Let's" openers. Synonym cycling inside a paragraph. Formulaic openings. Bold overuse. Em dash frequency above roughly 1 per 1,000 words. Generic future-narrative closers. Social endorsement closers. Lingering-attention claims. Narrated candor. Hedge-stacked predictions. Real/actual inflation. Moral-adjective category errors. Invented contrast-pair mirroring. Bare noun-phrase bullet lists of 5+ items. Three or more distinct Tier 3 phrases.

**P2 — polish.** Generic conclusions. Compulsive rule of three. Uniform paragraph length. Copula avoidance. Transition phrase density. Tier 3 phrase repetition. Unnecessary hyphenation. Tier 1B wordiness — and note that these are clarity edits that carry no evidentiary weight at all.

A quick pass covers P0 and P1. A full audit covers all three.

---

## Self-reference escape hatch

When the text is *about* AI writing patterns — a blog post on slop, a style guide, a skill file like this one — quoted examples are exempt. Text inside quotation marks, code blocks, tables of bad examples, or anything explicitly marked illustrative ("a model might write…") is never rewritten. Only the author's own prose is in scope.

This page and every reference file in this skill quote tells constantly. None of them is a live instance.

---

## Never inject

The instruction "put voice back on purpose" has a predictable failure mode: reaching for a stock kit of human-sounding moves and installing a personality the author never had. That trades one detectable register for a louder one. An independent stress test of `blader/humanizer` found precisely this — generic model phrasing replaced by a recognizable *humanizer* voice of fragments and staccato rhythm. A new fingerprint, not the absence of one.

None of the following may be **added** to a text that didn't contain it. Each is a rewrite failure even when the result scores clean.

| Never add | What it looks like |
|:--|:--|
| **Fake first person** | "I've seen this a hundred times", "in my experience", "I'll admit" dropped into prose with no author presence. If the source has no *I*, the rewrite has no *I* |
| **Manufactured stakes** | "In a world where", "now more than ever", "the stakes have never been higher" |
| **Forced contrarianism** | "Everyone says X, but they're wrong", "the conventional wisdom is backwards". Legitimate only when the source actually argued it. Inventing a foil is inventing a claim |
| **Performed candor** | "Let's be honest", "real talk", "here's the thing". A rewrite that adds one fails two rules at once |
| **Em-dash theatrics** | Dashes staged for drama the content hasn't earned. The detection rule is a rate ceiling; this is about *adding* them during a rewrite, which should never happen |
| **Staccato conversion** | Chopping ordinary sentences into fragments to manufacture rhythm. Vary sentence length by varying the sentences, not by breaking them |
| **Invented specifics** | Any number, name, date, tool, or mechanism the source never contained. The most tempting fix, because specificity always reads better — and a fabricated specific is worse than the vague phrasing it replaced. Flag the gap. Leave it empty |

**The test.** For each edit, ask whether the information came from the source. Subtraction and sharpening are in scope: cutting filler, making an existing claim concrete, surfacing a buried point. Adding stance, personality, or fact is not.

**Why this lives here and not in the pattern catalog.** These are constraints on the editor, not detections on the text. A first-person aside isn't a flag when the author wrote it; it's a failure when the tool inserted it. The difference is provenance, which no pattern can see — so it belongs with the instructions where the decision actually gets made.

---

## Tone calibration

The goal is prose that sounds like a specific person wrote it. Direct, specific, confident by demonstration rather than assertion.

1. **Vary sentence length.** Mix short with long. Fragments are fine.
2. **Be concrete** — but only with material the source supplies.
3. **Have a voice** where the genre carries one: first person, a stated preference, a visible reaction.
4. **Cut the neutrality** if the piece is supposed to take a position. Take it.
5. **Earn your emphasis.** Don't tell the reader something is interesting; make it interesting.

Removal is half the job. A rewrite that clears every flag but reads sterile — even sentence lengths, no stance, no first person where one belongs — is still recognizably machine output.

And the counterweight, which matters just as much: for encyclopedic, reference, legal, or academic text, neutral and plain **is** the correct human voice. Don't inject personality there. If the original writing is already strong, say so and make only the necessary cuts. The replacement tables are defaults, not mandates: a flagged word that is clearly right in context stays.
