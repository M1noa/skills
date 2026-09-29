# Pattern catalog

Tier F lives in `references/forensics.md`. Tier V word lists live in `references/vocabulary.md`. This file is everything else: structure, substance, rhetoric, and formatting.

## How to read an entry

**Trigger** — what you can point at. **Why** — what the pattern costs the reader. **Fix** — the edit. **Carve-out** — when the same surface form is correct and must be left alone.

Three standing rules:

- **Clusters, not hits.** One instance of most patterns here is a style choice. The catalog earns its keep when three or more fire in one passage.
- **Carve-outs outrank triggers.** If a carve-out applies, there is no finding. Don't log it as "flagged but excused" — that's how a report drifts into an accusation.
- **Judgment-only entries are marked.** Some patterns were implemented as regexes upstream and reverted, because every rule tight enough to spare the carve-outs stopped matching the tell. Those are marked *judgment-only*, and you should not try to mechanize them.

---

# Tier S — structure and substance

The strongest tier. These survive paraphrase; word-level tells don't. Russell et al. found position tells become *more* visible after a full paraphrase, not less.

## The four writer-side diagnostics

Run these before reading a single word closely. They catch what no word list can.

### The removal test
Delete the sentence or paragraph. Does the reader lose anything? If nothing is lost, it's slop regardless of how polished it reads. This is also how you separate REWORDABLE from HOLLOW — see the triage in `SKILL.md`.

### The outline test
Extract the first sentence of every paragraph and read them as a list. If they form a clean summary of the piece, the structure is machine-shaped. A human outline has gaps, jumps, and sentences that make no sense out of context.

### Paragraph-reshuffle immunity
Swap two body paragraphs. Does anything break? If the order doesn't matter, you have a list of points, not an argument that builds. Each paragraph is a self-contained module with no load-bearing connection to its neighbours.

**Fix** is structural, not lexical: give each paragraph a dependency on the one before it. If the paragraphs really are independent, decide whether the piece should be an explicit list, or whether it's missing a thesis.

### The treadmill effect
Read each paragraph and ask what is new here. Machine prose restates the premise in fresh words instead of advancing it — motion without distance. The tell: you could cut 40–60% and lose no information.

**Fix:** for each paragraph, name the one fact, claim, or turn it contributes. If there isn't one, cut it. If there is, lead with it and drop the throat-clearing.

## Discourse moves (QUD)

Every paragraph implicitly answers a question. Listing those questions in order exposes the shape of the piece.

| Flag | Symptom |
|:--|:--|
| **Linear interview** | Each question follows administratively from the last: what happened → why → what resulted → what it means |
| **The reflection tail** | Final paragraphs answer "what does this mean" or "how do we feel about it now" |
| **Missing move types** | No paragraph *compares* two things, none *verifies* or contradicts an earlier claim, none *digresses* in a way that pays off later |

Measured basis: using QUD analysis (QUDsim, COLM 2025), models use consequence and procedure moves about **19%** of the time and comparison or verification moves about **0.2–0.3%**. Two different models given the same premise independently produced the same question sequence — scene briefing → justifying the deception → social consequences → the weight of responsibility. Rewording leaves that sequence intact.

**Fix:** reorder so at least one question arrives before its setup. Replace one consequence paragraph with a comparison or a contradiction. A single paragraph that checks a claim against a counterexample moves the profile more than a page of synonym swapping.

## The middle is the choke point

Detectors and human judges find machine text most identifiable in the **body**, least in openings and endings (Tripto et al., EMNLP 2025 — measured on news, essays, and email, not just fiction). Models imitate formulaic bookends well and expose themselves across the long middle.

**Fix, aimed at the middle third:**
- Put at least one thing there that the opening does not predict.
- Vary texture between adjacent sections: a dense one, then a fast one.
- Let one thread slow down instead of resolving on schedule. The failure mode is acceleration past the interesting part.

## Position tells

| Tell | Machine habit | Human habit |
|:--|:--|:--|
| Paragraph lengths | Uniform | Ragged, including a one-sentence paragraph |
| Quoted lines | Always closing a paragraph | Anywhere, including mid-paragraph |
| Lists of qualities or reasons | Exactly three items | Two, four, one — three sometimes |
| Section transitions | Same connective formula each time | Hard cut, time skip, pickup mid-thought |
| Emphasis | Evenly distributed | Clustered where it matters, absent elsewhere |
| Citations | Clustered at paragraph ends | Wherever the claim needs support |

## Rhythm and uniformity

**Structure is the strongest available signal.** Trained classifiers weight structural regularity above vocabulary. Fix every Tier 1A word and leave the rhythm untouched, and nothing has changed.

- **Sentence-length uniformity.** Most sentences landing in the 15–25 word band reads as metronomic. Mix short (3–8 words) with long (20+). Fragments work. A question breaks monotony.
- **Paragraph-length uniformity.** Every paragraph at 3–5 sentences and roughly the same size. Some paragraphs should be one sentence.
- **Repetition vs. synonym cycling.** Machine text either repeats mechanically or cycles synonyms conspicuously. Human writers repeat when the word is right and vary when it's natural. No formula.
- **Read-aloud test.** If a text-to-speech engine could deliver it without sounding strange, it's too even.
- **Missing first person, where the genre expects one.** Relentless neutrality in a piece that's supposed to have an opinion is itself a tell. Do not treat this as licence to insert an "I" — see the never-inject rule.
- **Over-polishing.** Editing out every irregularity pushes human writing *toward* the machine profile. Natural disfluency and uneven pacing are the thing keeping text out of it. Applying every rule in this catalog at maximum strictness produces the uniformity you're trying to remove.

## Openings

The machine opening establishes time, place, and conditions, introduces the subject with description, then starts. Scene-setting leads ("On a drab November morning…") and broad-context leads ("In the rapidly evolving world of…") are the same move in different registers.

**Fix:** open inside the situation. Lead with the news or the claim; context comes second. Ground the setting with one working detail, not an establishing shot.

## Excessive structure

| Trigger | Threshold | Fix |
|:--|:--|:--|
| Header density | More than 3 headings in under 300 words | Merge sections, use prose transitions |
| List density | 8+ bullets in under 200 words | It's a paragraph |
| Scaffolding headers | "Overview", "Key Points", "Summary", "Conclusion", "Introduction" | Headers that say something specific about what follows |
| Fragmented headers | A heading followed by a one-line warm-up restating it (`## Performance` → "Speed matters.") | Cut the warm-up; the heading did that job |
| Numbered-list inflation | "Three key takeaways", "Five things to know", "Here are the top seven" | Only number a list when the content genuinely has that many discrete parallel items |
| Headings containing only headings | A heading whose entire body is more headings | Add content or flatten |
| Section summaries | "In summary", "In conclusion", "Overall" restating the body | Cut the label and the paragraph |

Wikipedia notes that an *Awards and recognition* header (and bare *Recognition*) is "nearly ubiquitous in AI generated articles." Headers formatted "X and Y" generally are common.

## Bullet lists of bare noun phrases

**Trigger.** Five or more consecutive bullets, each a short (≤6 word) adjective-plus-noun phrase with no finite verb. "Stable mining efficiency / Reliable pool connectivity / Optimized RandomX performance / Low failed share rates / Effective hardware utilization."

**Why.** The tell is *symmetry*: every item the same grammatical shape, every item parallel in length, none asserting anything checkable. A real list of observations varies in length, has occasional verbs, and contains at least one item that doesn't fit the pattern.

**Fix.** Convert to prose, or rewrite items as full claims. "Failed shares stayed under 1% across a 12-hour run" beats "Low failed share rates."

**Carve-out.** Genuine list content — changelog entries, todo lists, parameter docs, ingredient lists — where bare noun phrases are the correct form. Ask whether the bullets are summarizing claims (rewrite) or enumerating items (leave).

## When to rewrite instead of patch

Five or more flagged vocabulary hits across multiple categories, three or more distinct pattern categories triggered, and uniform sentence and paragraph length. At that point the structure itself is the problem and patching phrases won't reach it. State the core point in one sentence and rebuild.

---

# Significance and profundity manufacturing

The family Wikipedia describes as regression to the mean: *"the highly specific 'inventor of the first train-coupling device' might become 'a revolutionary titan of industry'… The subject becomes simultaneously less specific and more exaggerated."*

### Significance inflation
**Trigger.** "marking a pivotal moment in the evolution of…", "a watershed moment for the industry", "represents a broader shift".
**Fix.** State what happened; let the reader judge. **If the sentence still works after you delete the inflation clause, delete it.**

### Aphorism formulas
**Trigger.** Slot-fill profundity: "X is the language of Y", "the currency of Z", "the architecture of trust", "X becomes a trap", "X is not a tool but a mirror".
**Why.** The shape does the persuading instead of the evidence. Distinct from significance inflation (which puffs an event) — this manufactures a general law out of a specific observation.
**Fix.** Replace the formula with the concrete claim it gestures at. "Symmetry is the language of trust" → "symmetric layouts feel more predictable to users."
**Carve-out.** Quotations and established idioms ("time is money").

### Superficial -ing analyses
**Trigger.** Strings of present participles as pseudo-analysis: "symbolizing the region's commitment to progress, reflecting decades of investment, and showcasing a new era of collaboration."
**Why.** Trailing participial clauses assert a connection without arguing one. Usually unattributed opinion. RAG models attach them to real named sources regardless of whether the source says anything close — "Roger Ebert highlighted the lasting influence."
**Fix.** Replace with a specific consequence, or cut. The declarative form does the same job: "this represents a broader shift", "the decision symbolizes a commitment to excellence", "it speaks to a larger trend."

### Self-labeling significance
**Trigger.** Pointing back at an item and labelling it: "That last move is the contrarian one", "This is the interesting part", "That third bullet is the real story", "Here's where it gets clever". Signal adjectives: contrarian, clever, surprising, counterintuitive, interesting, key, important, unusual, smart, brilliant, real, actual.
**Why.** The label does the work the content was supposed to do. If the move is genuinely contrarian, the reader recognizes it; if it isn't recognizable without the label, the label is unearned.
**Fix.** Cut the labelling sentence, or restructure so the item carries the weight itself. *Before:* "→ Two separate indexes for tiered storage. That last move is the contrarian one. Co-locating related data usually helps cache locality." *After:* "→ Two separate indexes for tiered storage. Co-locating related data usually helps cache locality, but splitting the indexes is what makes the hot path cheap."

### Performed-insight phrases *(judgment-only in part)*
**Trigger.** "sit with that for a moment", "that's not nothing", "you already know the answer", "the punchline is", "worth naming", "don't take my word for it", "that's the whole point", "is the entire business model", "that's the part nobody mentions", "the only metric that matters", "X is dead; long live X", "that's why it mattered", sentence-initial "Turns out".
**Why.** Each stages a reveal; none adds a fact.
**Fix.** State the claim the phrase was gesturing at. "That's not nothing" becomes the actual size of the thing.
**Carve-out.** Quoted speech and genuinely comedic writing. "The punchline" and "worth naming" cannot be separated from their literal senses by pattern; judge them by hand.

### Persuasive-authority tropes
**Trigger.** "the real question is", "at its core", "fundamentally", "make no mistake", "the truth is".
**Why.** Announces that what follows is important instead of showing it.
**Fix.** Cut the trope, lead with the substance.

### Novelty inflation
**Trigger.** Treating established concepts as discoveries: "He introduced a term", "She coined the phrase", "a concept nobody's naming", "a failure mode nobody talks about", "the insight everyone's missing", "what nobody tells you about".
**Why.** Factually risky — if the idea has a Wikipedia page and conference talks from last year, the novelty claim makes the writer look uninformed. And it flatters the subject in a way that reads promotional rather than analytical.
**Fix.** Describe what the person *did with* the concept. "Michel walked through how context poisoning works in practice" instead of "Michel introduced a term I hadn't heard before: context poisoning." When unsure whether something is novel, assume it isn't.
**Related — invented labels.** Pseudo-analytical compound terms coined mid-sentence and never defined: "the supervision paradox", "the context-collapse problem", "a coordination tax". Naming a concept is not explaining it.

### Generic future-narrative closers
**Trigger.** Modal (may / could / will / is poised to) + "become" + "one of the most [adjective]" + narrative / story / trend / theme / chapter / movement / force.
**Why.** Grammatically a prediction, containing no testable content.
**Fix.** Pick the falsifiable version. "DePIN compute may exceed AWS spot pricing for embarrassingly parallel workloads by 2027" is a prediction. "The intersection of AI and DePIN may become one of the most important narratives of the next market cycle" is not.

### Generic conclusions
**Trigger.** "The future looks bright", "Only time will tell", "One thing is certain", "As we move forward".
**Fix.** Cut. If the piece needs a closing thought, make it specific to the argument.

### Moral-adjective category errors
**Trigger.** Moral or character adjectives (`honest`, `genuine`, `faithful`, `truthful`) attached to non-agentic nouns (`shape`, `number`, `representation`, `accuracy`, `curve`, `output`). "An honest shape." Adverb form hides the missing subject: "described honestly", "flagged honestly".
**Fix.** State the concrete property. "An honest shape" → "a more realistic curve." "A more honest representation" → "a clearer picture." Cut moral adverbs from passive constructions entirely: "flagged honestly" → "noted."
**Related — ontological slop.** "The assumption stops being true." Assumptions degrade in adequacy; they don't flip truth value. Write "the assumption breaks down."
**Related — gratuitous universal quantifiers.** "Taught in every first-year biochemistry course" instead of "taught in introductory biochemistry." The universal borrows authority from a scope the writer cannot check.

---

# False balance and manufactured structure

### False concession structure
**Trigger.** "While X is impressive, Y remains a challenge." "Although X has made strides, Y is still an open question."
**Why.** Sounds balanced without weighing anything. Both halves vague.
**Fix.** Name what's impressive and name the actual challenge, or pick a side.

### Formulaic challenges
**Trigger.** "Despite its [positive adjective], [subject] faces several challenges…", ending in a vaguely positive assessment. Section headers *Challenges and Legacy*, *Future Outlook*, *Future Prospects*.
**Why.** The sign is the **rigid formula**, not the mention of challenges. Naming a real difficulty is good writing.
**Fix.** Name the actual challenge and the actual response, or cut.

### Negative parallelisms
Three subtypes, per Wikipedia:
1. **Not just X, but also Y** — "Not only… but…", "It is not just…, it's…"
2. **Not X, but Y** — "It's not…, it's…", "no…, no…, just…"
3. **X rather than Y** — reversed, and *particularly common in Grok output*.

**Fix.** Say what the thing is. One negation earns its place when the reader would otherwise assume the opposite.

### Negation chains
**Trigger.** Two or more "no …" items in a row ("No fluff, no filler, no jargon."), stacked "didn't …" clauses ("It didn't ask. It didn't wait."), or the negated-then-repeated verb ("Don't call it a pivot. Call it a correction.").
**Why.** The chain performs decisiveness; the items are rarely load-bearing.
**Carve-out.** Mid-sentence factual inventories ("the endpoint takes no arguments, no headers, and no body") and sequential narration with restated subjects ("I did not sleep well. I did not eat breakfast."). Only sentence-initial chains of three or more short items, and comma-joined subject-elided "did not" chains, are reliable. Two-item chains are judgment calls.

### Invented contrast-pair mirroring
**Trigger.** One half of a contrast is a real term of art; the other is invented to balance the sentence. "False precision rather than genuine accuracy" — *false precision* is a real statistical term, *genuine accuracy* is a phantom counterpart.
**Why.** The asymmetry is invisible unless you know which half is real.
**Fix.** Reach for an actual opposite, or drop the contrast and state the positive claim. "May create a misleadingly exact number rather than a more accurate one" works because both halves are real.

### The rule of three
**Trigger.** "adjective, adjective, adjective" and "short phrase, short phrase, and short phrase". Wikipedia: models "often use this structure to make superficial analyses appear more comprehensive."
**Related — colon into a triple.** A colon opening onto exactly three comma-separated items: "separate ports, processes, and local state."
**Fix.** Audit the list. If there are really two things, or four, write that.
*Judgment-only, and noisy in technical writing where three-item lists are frequently just true. Weigh by genre, not per hit.*

### False ranges
**Trigger.** Breadth manufactured by pairing unrelated extremes: "from the Big Bang to dark matter", "from ancient civilizations to modern startups".
**Fix.** List the actual topics, or pick the one that matters.

### Template phrases
**Trigger.** Slot-fill constructions — if a phrase has a blank where a noun or adjective could go and still sound the same, it's too generic.

| Template | Fix |
|:--|:--|
| "a [adjective] step towards [adjective] AI infrastructure" | Name the capability, benchmark, or outcome |
| "a [adjective] step forward for [noun]" | Say what changed |
| "Whether you're [X] or [Y]" | False breadth. "Whether you're a startup founder or an enterprise architect" means "everyone." Pick the real audience or cut |
| "I recently had the pleasure of [verb]-ing" | "I talked to", "I read", "I attended" |

---

# Attribution and credibility manufacturing

### Vague attributions
**Trigger.** "Experts believe", "Studies show", "Research suggests", "Industry leaders agree", "Observers have cited", "several sources".
**Why.** Models may present one or two sources as widely held views, mention multiple "reviewers" or "scholars" while citing one person, or imply a list is non-exhaustive when the sources give no indication other examples exist.
**Fix.** Name the source, or drop the attribution and state the claim directly.

### Vague third-party validation
**Trigger.** An **unnamed** external authority plus a generic superlative: "an outside party measuring the same models everyone runs and putting us on top", "independent testing confirms", "third-party benchmarks show we lead".
**Fix.** Name the source, the test, and the result. "On Stanford's HELM leaderboard (April 2026 run), we ranked first on reasoning latency." If you can't name it, cut the claim.
**Carve-out.** Specifically attributed, checkable validation — a named benchmark, a linked report, a dated audit ("SOC 2 Type II, audited by Prescient Assurance"). The tell is vagueness, not the act of citing outside proof.
**Distinct from** notability name-dropping, which is the inverse move.

### Notability name-dropping
**Trigger.** Piling prestigious citations to manufacture credibility: "cited in The New York Times, BBC, Financial Times, and The Hindu." Also *independent coverage*, *media outlets*, *trade publications*, *maintains an active social media presence* (rare on Wikipedia before ~2024).
**Why.** In 2025-and-later model output the focus lands on *the sources themselves* — their contents, their availability in public search, their standing in the media landscape — as if the model collapsed the context between the edit and its justification.
**Fix.** One specific reference with context beats four name-drops: "In a 2024 NYT interview, she argued…"
**Related — historical analogy stacking.** "like the printing press, the telegraph, and the internet before it." The montage substitutes for the argument. Name the one parallel that does analytical work.

### Promotional language
**Trigger.** Tourism-brochure prose: "nestled within the breathtaking foothills", "a vibrant hub of innovation", "a thriving ecosystem".
**Why.** Models have serious trouble holding a neutral tone. Wikipedia records the diagnostic failure mode: an edit summary claiming a rewrite "removed promotional tone" while actually introducing it. Older models (GPT-4) output more blatantly positive text; newer ones are subtly positive and avoid obvious superlatives like "the best."
**Two subtypes.** Cultural-heritage importance reminders; press-release tone for people and companies.
**Fix.** Plain description. "is a town in the Gonder region", "has 12 startups". If you wouldn't say it in conversation, cut it.

### Speculative gap-filling
**Trigger.** Hedged speculation dressed as background: "maintains a relatively low public profile", "is believed to have", "likely began his career in", "appears to have studied", "keeps personal details private".
**Why.** Worse than a cutoff disclaimer, which at least *admits* the gap. This hides it, so the reader can't separate what's known from what's invented. RAG models produce the specific variant of claiming information is "not publicly available" and then speculating about what it likely is — including the claim that it's undocumented.
**Fix.** Cut the speculation or replace it with a sourced fact.

### Cutoff disclaimers
**Trigger.** "As of my last update", "While specific details are limited based on available information", "I don't have access to real-time data", "not widely documented".
**Fix.** Find the information or remove the hedge. Never publish a sentence admitting the writer didn't look something up.

---

# Assistant-register residue

Pasted conversational turns are Tier F (`references/forensics.md`). These are the stylistic descendants that survive editing.

### Chatbot artifacts
"I hope this helps!", "Certainly!", "Absolutely!", "Great question!", "Feel free to reach out", "Let me know if you need anything else". Also meta-narration: "In this article, we will explore…", "Let's dive in!"

### Sycophantic tone
"Great question!", "Excellent point!", "You're absolutely right!", "That's a really insightful observation." Distinct from chatbot artifacts: sycophancy validates *the reader* rather than performing helpfulness generally.

### "Let's" constructions
"Let's explore", "Let's take a look", "Let's break this down", "Let's examine". False-collaborative openers that delay the point. Flag any "let's + verb" functioning as a transition rather than a genuine invitation to act.

### Acknowledgment loops
"You're asking about", "The question of whether", "To answer your question", "That's a great question. The…". Also: opening a section by summarizing the previous one.

### Reasoning chain artifacts
"Let me think step by step", "Breaking this down", "To approach this systematically", "Step 1:", "Here's my thought process", "First, let's consider", "Working through this logically". Chain-of-thought scaffolding leaking into published prose. State the conclusion, then the evidence.

### Narrated candor *(judgment-only)*
**Trigger.** Announcing your disclosure instead of disclosing: "Two caveats I would rather flag than let you discover later:", "I want to be upfront:", "To be fully transparent:", "Rather than bury this, I'll say it plainly:".
**Why.** Assistant training rewards visible transparency, so the model narrates being forthcoming rather than being it. Completes a set: chatbot artifacts perform *helpfulness*, sycophancy validates *the reader*, this performs *candor about oneself*. The shape is usually a matched antithesis — flag rather than let you discover, say plainly rather than bury — and that symmetry is its own tell.
**The deletion test.** Cut the frame. "Two caveats I would rather flag than let you discover later: X and Y" and "Two caveats: X and Y" carry the same information.
**Carve-out — the disclosure itself.** "I haven't tested this on Windows", "the numbers in the commit message don't reproduce on my hardware", "this is a mitigation, not a fix". Those carry information.
**Carve-out — conflict-of-interest disclosure.** "In the interest of full disclosure, I own shares in the company discussed here" is the conventional label that makes a disclosure legible in journalism, academia, finance, and open-source governance. Leave it. The same words with nothing behind them are the tell.
**Not the ordinary comparative.** "I'd rather fix it than let you inherit the mess" is a preference about work.
*Implemented upstream as a detector and reverted: every regex tight enough to spare those carve-outs stopped matching the tell.*

### Recap-flattery opener
**Trigger.** Replying to someone by summarizing their own work back at them with praise: "Thanks for all the legwork here — the migration script and the rollback plan you worked through are what made this possible."
**Why.** The reader already knows what they did. The recap performs appreciation instead of conveying information. Distinct from sycophancy (generic validation) and acknowledgment loops (restating the prompt): this echoes the other person's *own work* back at them.
**Fix.** Substance first. "Thanks for the legwork — this looks right to me, one comment below."

### Wall-of-text replies
**Trigger.** In conversational registers — issue and PR comments, chat, DMs, casual email — a reply-length text (roughly under 150 words) with four or more sentences delivered as one unbroken paragraph, with no line break anywhere.
**Why.** Humans break a reply at thought boundaries. A maintainer calling out an assisted-sounding GitHub reply with "I prefer to talk human to human" was reacting to the dense block shape, not to any word in it.
**Carve-out.** A single dense paragraph is the *correct* shape in formal long-form registers: a blog intro, a docs paragraph, a deliberately tight one-paragraph email. This fires only in conversational reply registers. Never flag continuous long-form prose for lacking internal breaks — that false-positive class is why the structural detector for it was reverted upstream.
**Distinct from** paragraph-length uniformity, which is about long-form text where every paragraph is the same size. This is about short text having *zero* breaks.

---

# Emotion and attention theatrics

### Emotional flatline
**Trigger.** Claiming emotion as a structural crutch: "What surprised me most", "I was fascinated to discover", "What struck me was", "I was excited to learn", "The most interesting part". Bare header variant: "Interesting part of the project:", "Interesting thing here:".
**Why.** Tell-don't-show. If the thing is surprising, the reader should feel that from the content. And these are massively overused as list introductions.
**Note.** Not always machine output — also a sign of lazy human writing on autopilot. Flag either way, which is the whole justification for this skill.
**Fix.** Not "never say surprised". If you claim an emotion, the writing around it should earn it. Otherwise present the thing directly.
**Related.** "hit differently" / "hits different" — a trendy colloquialism used as a shortcut to relatability.

### Lingering-attention claims
**Trigger.** "the line I keep coming back to", "I can't stop thinking about this", "still thinking about this one", "this has been rattling around in my head all week".
**Why.** The claim is about the writer's attention, not the thing, and it arrives before the reader has a reason to care. Distinct from emotional flatline, which claims a *feeling*: this claims *duration*, which is unfalsifiable and self-flattering in a way a feeling isn't.
**Carve-out — reason attached.** "I keep coming back to Hirschman's exit-voice framing because it predicts which engineers quit and which ones file the RFC." That's a claim about the idea's explanatory reach. The tell is the bare frame with the reason missing.
**Fix.** Delete the frame, open on the thing. "The line I keep coming back to: agents are teenagers." → "Jeetu describes AI agents as teenagers."

### Infomercial engagement hooks
**Trigger.** Punchy fragment-hooks teeing up a reveal: "The catch?", "The kicker?", "Here's the thing.", "The best part?", "Plot twist:", "The result?".
**Fix.** Delete the hook and state the thing. "The catch? It only works on weekends." → "It only works on weekends."
**Fake-candid register variant.** "Honestly?", "Look,", "Real talk:", "Let's be honest —" as standalone openers staging a pause before an ordinary point. The tell is the theatrical setup-and-reveal; "honestly" or "look" mid-sentence in casual prose is ordinary English.

### Social endorsement closers
**Trigger.** The curatorial sign-off on a share post: "This one is worth your time:", "This one's a must-read:", "Do yourself a favor and read this.", "Don't sleep on this one.", "Bookmark this.", "Thank me later."
**Why.** Performs a recommendation without giving a reason to click. Generic and demonstrative-anchored ("THIS one is worth your time") — it could sit under any link.
**Fix.** Say what the thing is and who it's for, then drop the CTA. "Sarah's breakdown of why context windows leak — the clearest explanation I've found for anyone debugging RAG pipelines." If you can't name a reason, the share doesn't need a sign-off.

### Speculative scenario openers
**Trigger.** "Imagine a world where…", "Picture a future in which…", "Envision a world where…"
**Why.** Opens an argument with a hypothetical listing desirable outcomes instead of making a claim. The scenario does the persuading; no evidence is offered.
**Fix.** "Imagine a world where every deploy is instant" → "Instant deploys would cut our release cycle from a day to minutes."
**Carve-out.** Fiction; a thought experiment with a stated payoff; instructional "imagine you have a sorted array", which points at a concrete example rather than a speculative world.

### Rhetorical question openers
**Trigger.** "But what does this mean for developers?", "So why should you care?", "What's next?"
**Fix.** If you know the answer, say it. Rhetorical questions are earned by strong setup, not dropped as section transitions.
**Stacked form.** Two or more questions in a row, usually fragments after the first: "Do I know how it works? Where it breaks? Which corners it cut?" Keep at most one, answer it, convert the rest to statements. *Judgment-only — interviews, FAQs, and dialogue stack questions legitimately.*

### Hashtag stuffing
**Trigger.** Six or more hashtags on a single short post, usually mixing one project tag with broad category tags (#AI #Crypto #Web3 #Innovation #FutureTech #Technology).
**Why six.** Empirical floor. Organic engagement on LinkedIn and X plateaus past 3–5 tags; human posts exceeding 5 are usually launch posts trading reach for engagement, while generated posts default to 10–15. Six is where false positives on human use drop below false negatives on machine output. Treat 5+ as a soft tell on `linkedin` and `investor-email`.
**What doesn't count.** A `#` in technical prose is usually not a tag. Subtract before counting: issue and PR references (`#88`, `owner/repo#88`), 6- and 8-character hex colours containing a digit (`#1a2b3c`), preprocessor directives (`#include`), URL fragments, Markdown headings, and anything inside a code span or fence. Short hex-shaped words stay counted — `#fff`, `#dad`, `#b2b`, `#decade` are also real tags. Channel names (`#general`) stay counted, since separating them needs a guess about intent.
**Fix.** Two or three specific tags, or none.

---

# Hedging, evasion, and padding

### Confidence calibration phrases
**Trigger.** "It's worth noting that", "Interestingly", "Surprisingly", "Importantly", "Significantly", "Notably", "Certainly", "Undoubtedly", "Without a doubt".
**Why.** Signals how the reader should feel about a fact instead of letting the fact speak.
**Density rule.** One "notably" in 2,000 words is fine. Three in 500 is emphasis stacking. **Flag by density, never by instance.**
**Reader-steering variant.** "Here's what's interesting", "Here's the interesting part", "Here are the parts I found interesting". Works when followed by genuinely surprising data; fails when it introduces a restatement of the obvious.

### Hedge-stacked predictions
**Trigger.** A modal plus a hedge adverb: "could potentially create", "may eventually unlock", "might ultimately transform".
**Why.** Either word alone is fine; the stack is the tell. Each hedge cancels the next, leaving a sentence that asserts nothing while sounding cautious.
**Fix.** Pick one.

### Parenthetical hedging
**Trigger.** "(and, increasingly, Z)", "(or, more precisely, Y)", "(and perhaps more importantly, W)".
**Fix.** If the aside matters, give it a sentence. If it doesn't, cut it.

### "Real / actual" adjective inflation
**Trigger.** `real` / `actual` / `genuine` / `true` as an empty intensifier on an abstract noun: "real on-chain tokenomics", "actual reward sustainability", "genuine utility", "true product-market fit".
**Why.** Implies the rest of the field is fake without naming what makes this instance the real one. Distinct from hollow sentence-level intensifiers — this is the noun-modifier form, where the unsaid contrast does the work.
**Carve-out — named contrast.** "Real on-chain settlement, not bridged IOUs" and "actual revenue from paying customers, not grants" are honest contrastive writing. The tell is the *unsaid* contrast.
**Fix.** Drop the adjective, add the claim. "Reward sustainability" → "rewards funded from $X/mo in fees rather than emissions."

### Filler phrases
"It is important to note that" → state it. "In terms of" → rewrite. "The reality is that" → cut. Didactic asides — "it's worth noting", "may vary" — are almost always deletable with no loss.

### Transition phrases
| Phrase | Fix |
|:--|:--|
| "Moreover" / "Furthermore" / "Additionally" | Restructure so the connection is obvious, or "and" / "also" / "on top of that" |
| "In today's [X]" / "In an era where" | Cut or state the specific context |
| "It's worth noting that" / "Notably" | State the fact |
| "Here's what's interesting" / "Here's what stood out" | Reader-steering. If you need a lead-in, make it specific: "The revenue number matters because…" |
| "In conclusion" / "In summary" / "To summarize" | Your conclusion should be obvious |
| "When it comes to" | Talk about the thing |
| "At the end of the day" | Cut |
| "That said" / "That being said" | Cut, or "but" / "yet" / "however" — and don't lean on any one |

**Threshold.** A transition word in isolation is nothing; Wikipedia lists it among ineffective indicators. More than roughly 30% of paragraphs opening with one is a structure finding.

### Copula avoidance
**Trigger.** Substituting fancier verbs for *is* and *has*: "serves as", "features", "boasts", "presents", "represents", "stands as", "marks", "functions as", "operates as", "maintains", "offers", "refers to". Elaborate recent forms read as biography: "ventured into politics as a candidate" for "was a candidate".
**Why.** Geng et al. measured a >10% drop in *is* and *are* in academic writing in 2023 and reproduced it by asking GPT-3.5 to revise 10,000 abstracts. Observed in GPT and Gemini output.
**Fix.** Default to "is" or "has" unless a more specific verb genuinely adds meaning.
**Carve-out.** The perfect: "has been featured" is a tense, not a dodge.

### Subjectless fragments and agentless passives
**Trigger.** "No configuration file needed." "The results are preserved automatically." "Support for nested queries was added."
**Fix.** Name the actor when it clarifies: "You don't need a configuration file. The CLI preserves results automatically."
**Carve-out.** Terse reference registers where the fragment is correct — README feature lists, changelog entries, parameter docs, commit subjects ("No breaking changes"). A single deliberate fragment for emphasis is rhythm, not a tell.

### Synonym cycling
**Trigger.** Rotating synonyms to avoid repeating a word: "developers… engineers… practitioners… builders" in one paragraph. Wikipedia's version (WP:AIELEVAR) chains referents: "Soviet artistic constraints" → "Non-conformist artists" → "Their creativity".
**Fix.** If the same noun appears three times and it's the right word, keep all three.
**Carve-out.** Avoiding repetition is explicitly taught in some school systems — Italian schools are the documented example. This is a native marker of a particular education as much as a machine one. Weak, never standalone.

### Vague connection
"in connection with", "in connection to", "associated with", "in association with". Each hides the actual relationship. Name it: funded by, sued by, employed at, cited in.

---

# Rhythm tics

### Same-opener sentence runs *(judgment-only)*
Three or more consecutive sentences opening on the same word ("Maybe nobody needed it. Maybe it solved the wrong problem. Maybe the timing was off."), and the repeated-skeleton cousin ("A cart is an object in the system. A chat room is an object in the system."). Deliberate anaphora is a rhetorical device; the tell is a run that isn't doing persuasive work. Pronoun-opener runs ("He… He… He…") are ordinary narration.

### Stranded auxiliary contrast *(judgment-only)*
Landing a reversal on a bare auxiliary: "The tool died; the data didn't." "Reading mostly passed. Writing didn't." One is a fine sentence. As a recurring rhythm it's a signature move — the clipped contrast poses as earned insight. Ration it: if the piece already has one, write the next contrast out in full.

### Manufactured punchlines and staccato drama
**Trigger.** Three or more same-shape fragments in a row, each engineered to land like a quotable closer: "It had no preference for symmetry. No aesthetic prior. No nostalgia for human taste. The old rules were gone."
**Important interaction.** This composes with the rhythm advice above, which *encourages* fragments and varied length. Variation is the human signal, and one short sentence landing a point is exactly that. The tell here is the opposite of variation.
**Fix.** Keep the one fragment that earns its emphasis; fold the rest into ordinary sentences with the claim stated.

### Dev-blog boilerplate
"batteries included", "it just works", "zero config", "sane defaults", "small enough to fit in your head". Each substitutes a slogan for a demonstrable property. "installs with no config file" beats "zero config"; "the whole API is six functions" beats "fits in your head". **Carve-out:** quoting a product's own tagline, or discussing the phrase itself.

### Diff-anchored writing
**Trigger.** Documentation narrating a change instead of describing the thing: "This function was added to replace the previous approach of iterating through all items."
**Why.** Assistants write docs in the context of the edit they just made, so the prose anchors to the diff. A person documenting later writes from the artifact. A reader without the commit history gets archaeology.
**Fix.** Describe current behaviour and why: "This function uses a hash map for O(1) lookups."
**Carve-out.** Inherently version-scoped documents — changelogs, release notes, migration guides, decision records — narrate change correctly.

---

# Formatting

Markdown-to-target conversion artifacts and default chat formatting. Cheap to check, weak individually, and easy to over-read: a person using a visual editor produces some of these too.

| Pattern | Detail |
|:--|:--|
| **Title heading** | A heading repeating the document title before all content. Models don't assume the title header already exists |
| **Title case headings** | Strong tendency to capitalize all main words: "Strategic Negotiations And Key Partnerships" → "Strategic negotiations and key partnerships". Sentence case for subheadings |
| **Skipped heading levels** | Starting sections at `###` and skipping `##`. Against most style conventions, so unlikely to be hand-formatted |
| **Level-1 heading overuse** | Multiple `#` headings in a body document. Likely an artifact of translating Markdown into another markup |
| **Thematic breaks between sections** | `---` or `----` between every section. Common in Markdown output |
| **Excessive boldface** | Emphasis applied mechanically to every instance of a chosen word, key-takeaways style. Inherited from readmes, fan wikis, how-tos, sales pitches, slide decks, listicles. Some newer models are instructed to suppress it |
| **Inline-header vertical lists** | A list marker followed by a bold inline header, colon, then descriptive text. Markers vary: •, `-`, `–`, `#`, emoji. Sometimes no punctuation separates label from gloss. **Fix:** strip the bold header and write the point; if items need headers they should probably be paragraphs |
| **Emoji as formatting** | Emoji decorating section headings or bullets. Rarer now than in 2023–2024 |
| **Unnecessary tables** | Small tables for content better carried as prose or a definition list |
| **Hyphenated modifier stacking** | "a high-quality, well-architected, future-proof solution". Individual hyphens may be correct; the density is the tell |

### List-label periods
**Trigger.** A bullet leading with a short label terminated by a period, then a gloss as a separate sentence. Strongest with bold labels: `**Intros.** Years of conferences and operator network.` where a person writes `**Intros:** years of conferences and operator network.` Weaker unbolded: `- Intros. Years of conferences and operator network.`
**Why.** The colon reads as "here's what this label means." The period reads as a sentence that the following clause then contradicts by continuing.
**Fix.** Period → colon, lowercase the gloss. Or drop the label and write a plain sentence.
**Carve-outs.** When the label span is a full sentence on its own, the period is correct. For the unbolded form, only flag when the leading fragment is clearly a label — a 1–4 word noun phrase with no verb.

### Unnecessary hyphenation
Copyediting, **P2 at most**, never evidence of anything.
- Welded open noun phrases: "research-impact aggregator" → "research impact aggregator"; "data-source strategy" → "data source strategy".
- Close compounds whose standard form is one word: "code-base", "data-set", "time-frame", "road-map" → codebase, dataset, timeframe, roadmap.
- Attributive hyphens used adverbially or nominally: "in real-time" → "in real time"; "works out-of-the-box" → "works out of the box". Keep them before a noun: "real-time analytics", "long-term plan".
- **Preserve** established and technical compounds: high-quality, open-access, third-party, machine-readable, server-side, field-normalized, family-owned.
- Spelling varies by dialect and house style. Ambiguous pairs are judgment calls. Exclude code, quoted material, URLs, paths, filenames, and command flags.

### Em dashes
Covered in `SKILL.md`. The short version: flag **frequency plus misuse**, never existence. Wikipedia's own framing is that model output "uses them more often than nonprofessional human-written text of the same genre, and uses them in places where humans are more likely to use commas, parentheses, colons, or misused hyphens and en dashes." Machine-generated em dashes are usually **surrounded by spaces**, against the typographic convention most habitual em-dash users know. And the guide's own caveat, verbatim: *"This sign is most useful when taken in combination with other indicators, not by itself. It is much more common on discussion pages than in article text."*

### Curly quotes
ChatGPT and DeepSeek typically emit curly quotation marks and apostrophes; Gemini and Claude typically don't. Heavily confounded: Chicago Manual of Style house rules, Word smart quotes, macOS and iOS defaults, LanguageTool, professional typesetting, and citation tools copying page titles all produce them. Weak prior at best.

---

# Tier Q — quantitative

Document-level only. Never flag a paragraph on Q alone. **Every threshold below is an editorial rule of thumb with no published false-positive rate.** Label them that way if you report them.

| Measure | Rule of thumb | Caveats |
|:--|:--|:--|
| **Type-token ratio** | Human general prose ~0.50–0.65 over 200+ words. Below 0.40 is worth a second look | Strongly register-dependent. Narrow topics, technical reference material, and second-language writing all legitimately compress vocabulary. The fix is never to thesaurus the text — it's to broaden the *what*: name specific things, replace a reused abstract noun with the concrete instance |
| **Paragraph-length spread** | All paragraphs within ~15% of each other | Meaningless under ~6 paragraphs |
| **Sentence-length range** | No sentence under 8 or over 30 words across a 500-word block | Reference and API docs legitimately sit in a narrow band |
| **Syntactic variety** | 3+ distinct sentence patterns per 100 words in human prose; ≤1.5 in machine prose | Asserted, not measured |
| **Transition density** | More than 30% of paragraphs opening with a transition word | |
| **Same-opening runs** | 3+ consecutive paragraphs opening the same way | |
| **Contrasting parallelisms** | More than 2 per 500 words | |
| **Segmental entropy** | Varying less than 10% across intro / body / conclusion | Hardest to eyeball; treat as a description of the middle-choke-point finding rather than a measurement |

Three further stylometric signals exist but need a POS tagger or a reference distribution and are not implemented anywhere in this lineage: sentence-length burstiness as a continuous measure, function-word z-scores against a human-prose reference, and POS-bigram log-odds.

---

# Not patterns

Adopted wholesale from Wikipedia's ineffective-indicators list, plus this skill's own additions. None of these is a finding, ever.

- **Perfect grammar.** Also: unexpectedly flawless grammar compared to someone's other writing. A style shift raises a question only when it is dramatic and not easily explainable.
- **Formal, academic, or "fancy" prose.** The measured correlation is to *specific words*, not to formality.
- **Bland or robotic feel.** If you can't name the hit, there isn't one.
- **Mixed casual and formal registers.** May indicate a technical-field writer, a young writer, playfulness, neurodivergence, or simply more than one author.
- **A transition word in isolation.**
- **Unsourced content.** Wikipedia alone has over 570,000 articles tagged for it.
- **Bizarre markup or stray HTML.** Points at browser extensions or editor bugs.
- **Correct, complex formatting.** Normal for anyone using a visual editor and a preview button.
- **Abrupt cut-offs.** A botched copy-paste does this too.
- **American English from a non-American writer.** Real prior — several models default to American English — but non-native speakers mix varieties and code-switch constantly.
- **Adverbs as a class.** "Kill all adverbs" is craft advice from Strunk & White and Stephen King, decades older than any of this.
- **An em dash.**

Wikipedia's framing sentence is worth keeping in view while you work: *"False accusations of AI use can drive away new editors and foster an atmosphere of suspicion… consider whether the Dunning–Kruger effect or confirmation bias may be clouding your judgement."*
