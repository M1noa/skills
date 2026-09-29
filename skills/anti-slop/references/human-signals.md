# Human signals

Positive markers. Two uses, and only two:

1. **Preserve.** When you find one of these, leave it alone even if it collides with a rule elsewhere in this skill. A wordy construction, a superlative, a bare "very" — these are things models avoid. Editing them out makes the prose *more* machine-shaped, not less.
2. **Restore, when the source supports it.** You may put back a plain verb the text replaced with a fancy one, or unstack a hedge, because the information is already there. You may **not** add a first person, an opinion, a number, or an anecdote. See the never-inject rule in `SKILL.md`.

The asymmetry is the point. Preservation is nearly free; restoration is narrow; addition is forbidden.

## Syntax models avoid

Wikipedia's list, derived from *over 25 years* of article text and stated as an empirical observation: these constructions are more common in human-written prose than in machine output, and several are *preferred* by the Manual of Style.

| Marker | Examples |
|:--|:--|
| **Plain copulas** | *there is a*, *it has a*, *is*, *has*, *was* |
| **Plain verbs over stiff synonyms** | *wrote* not *authored* · *moved* not *relocated* · *used* not *utilized* · *tried* not *attempted* · *died* not *passed away* |
| **Superlative and definitive statements** | *one of the best*, *is the only*, *was the first* |
| **Bare hedges and intensifiers** | *very*, *perhaps*, *tends to* |
| **Isolated wordy constructions** | *as a result of*, *in order to*, *all of the*, *a part of*, *the fact that* |

The copula finding has a measured basis: Geng et al. recorded a **>10% drop in *is* and *are*** in academic writing in 2023, with no comparable movement before, and reproduced it by asking GPT-3.5 to revise 10,000 abstracts.

**The direct conflict this creates.** `references/vocabulary.md` Tier 1B lists *utilize → use*, *in order to → to*, *due to the fact that → because*. Those are still good edits — wordiness is wordiness. But they are **clarity edits, never evidence**, they are excluded from every density and cluster signal, and a document that fires only on Tier 1B has no finding at all. A wordiness fix must never be able to push text toward looking machine-written.

Same for hedges: *very* and *perhaps* standing alone are human markers. What clusters in machine output is the *stacked* hedge — "could potentially eventually" — and the significance-signalling adverb — "notably", "significantly", "genuinely". Don't confuse the two.

## Structural and narrative markers

From StoryScope's measurement of where human authors diverge from *every* model tested. Fiction-scoped, so translate rather than transplant.

| Human marker | Uniqueness | Prose translation |
|:--|:--|:--|
| Protagonist introduced in dialogue, unannotated | **21.4 — the strongest single marker in the study** | Open on someone speaking or acting, not on a description of them. In non-fiction: open on the claim or the event, not on the setup |
| A single focal perspective, held | | Depth over coverage. One angle worked through beats five surveyed |
| Narrator who mostly doesn't address the reader, then occasionally does | | Asides with no system to them. Machine text is either uniformly distant or uniformly chummy |
| Back-loaded revelation | | The biggest thing lands late. Machine text front-loads and then restates |
| Crossover-genre ambition | | The piece wants to be more than its category — a changelog with a real observation in it, a postmortem that's also an argument |

Two more from general prose measurement:

- **Emphasis clustered where it matters, absent elsewhere.** Machine text distributes emphasis evenly. A human piece has three bold phrases in one section and none for the next two pages.
- **Ragged paragraph lengths, including a one-sentence paragraph.** Uniformity is the tell; unevenness is the signal.

## Substance markers

From the rubric in `references/methodology.md`. These are what a strong passage has, and what a hollow one can't be given by rewording.

- **A specific over an abstraction.** "Latency dropped from 340ms to 90ms" instead of "significant improvement." A name, a number, a date, a mechanism, a consequence.
- **A position that could be wrong.** Someone reacting to the facts rather than narrating them. A claim a reader could disagree with.
- **A concession that costs something.** "This is a mitigation, not a fix." "I haven't tested it on Windows." Real disclosure, as opposed to the narrated kind.
- **Something that survives a hostile editor.** Delete it and the reader loses something.
- **A paragraph that compares, verifies, or contradicts.** LLMs produce comparison and verification discourse moves about **0.2–0.3%** of the time against ~19% for consequence and procedure. A single paragraph checking a claim against a counterexample is the rarest thing in machine prose. If you find one, it is load-bearing — do not smooth it out for flow.

## Human error patterns

Mistakes with a human shape. None of these is proof of anything, and all of them argue *against* over-flagging.

- **Typos, wrong-word substitutions, inconsistent capitalization.**
- **Broken links from a bad copy-paste**, as opposed to fabricated citations. The difference is verifiable: check whether the target exists.
- **An explainable error.** Wikipedia's framing: if an editor inserts a URL that looks fabricated, ask how the mix-up happened. If they can supply the correct link and describe it as a typo, or quote the passage from the real source, that points at ordinary human error. Someone who can account for their own choices is the strongest positive signal available, and it isn't in the text at all.
- **Register mixing.** Casual and formal in the same paragraph, or prose that reads both clinical and emotional. Wikipedia lists this among *ineffective* indicators, and names the reasons: a technical-field writer writing casually, youth, a taste for mixed registers, playfulness, neurodivergence, or simply more than one author.
- **Non-native English patterns.** Article dropping, preposition choices, unidiomatic collocations, and elegant variation (taught explicitly in some school systems — Italian schools are the documented example). Perplexity-based detectors misclassified **over half** of TOEFL essays as machine-written. Assume second language or a rushed draft before assuming a model.

## Text that predates the tools

**ChatGPT launched 30 November 2022.** Text inserted before that date is human, full stop. Wikipedia states it as a hard rule: AI use "can be safely ruled out," and notes that some older writing displays the signs on the list and may even convincingly appear generated — the corpus is just big enough for coincidences.

Practical consequences:

- Don't modernize old writing. A 2009 blog post with "delve into the rich tapestry" in it is a person's word choice.
- If you can date the text — commit history, publication date, a revision tool — do that before flagging anything.
- The reverse also holds as a weak prior: a **dramatic, not-easily-explainable** style shift in one person's writing is worth a question. Not a mild one. And the shift can run the other way, since a long-term tool user's writing tracks whichever tool they were using that year.

## When a signal conflicts with a rule

Resolution order:

1. **Forensic artifact** (`references/forensics.md`) — delete the token regardless of anything on this page.
2. **Human signal present** — preserve it. It outranks Tier V and Tier Q findings sitting on the same words.
3. **Tier S structural finding** — still valid, since structure and human word-choice markers are independent axes. A piece can have plain copulas *and* uniform paragraph lengths.
4. **Tier V / Q** — yields to any human signal on the same span.

Worked example. A paragraph reads: *"There is a well-documented problem here. The pool utilizes a fixed 8-thread cap, which in order to change requires a rebuild. It's the only workaround we found."*

- `there is a`, `is the only` → human markers, preserve.
- `utilizes` → Tier 1B clarity edit. Change to "uses" if you're editing for clarity; log it as `tier1-clarity`; it contributes nothing to any cluster or score.
- `in order to` → human marker *and* a Tier 1B entry. Awkwardly placed here, so rewriting the clause is defensible on clarity grounds alone. It is not evidence.
- Net finding: **none**. This is a person writing plainly. Leave it, or make one wordiness edit and say that's all it was.

## The trap on this page

Every marker here can be gamed, and gaming them is the failure this skill exists to prevent. Sprinkling *very* and *there is a* into machine text to launder it produces a new artifact — text with human tells applied evenly, which is its own kind of uniform. Wikipedia says it directly: *"Please do not merely treat these signs as the problems to be fixed; that could just make detection harder."*

The instruction that follows from that: **preserve these when you find them, restore them only where the source already implies them, and never install them.** The goal is prose that carries information, not prose that passes a check.
