# Tier V — vocabulary

The weakest tier, and the one everyone starts with. Read the rules before the lists.

## Rules that govern every list on this page

1. **Three or more in a cluster, or nothing.** A single "crucial" in 800 words is a word choice. Six significance words in one paragraph is a pattern.
2. **A word being overused by AI does not implicate its synonyms.** Wikipedia states this as bluntly as possible: *"This section is to be taken as literally as possible: a word being overused by AI does *not* imply that its synonyms are also overused."* `delve` is measured. `burrow` is not. Do not generalize a list into a vibe.
3. **Reduce severity next to real specifics.** "the pivotal March 2024 ruling" is anchored. "a pivotal moment for the industry" is not.
4. **Literal senses never count.** `underscore` is a typographic mark and a kind of film music. `deeply nested` is a data structure. `verbatim` is a term of art in law, research, and QA. `load bearing` unhyphenated is ordinary construction English.
5. **Ratios are inherited, not measured.** The familiar "AI uses this 5–20× more often than humans" figures behind Tier 1A trace back through the humanizer-skill lineage with no published method or dataset. A few words have independent support (`delve`, `underscore`, `tapestry`); the table as a whole does not. If you cite a ratio, label it as convention.
6. **This list is descriptive, not prescriptive.** Wikipedia again: *"Please do not merely treat these signs as the problems to be fixed; that could just make detection harder."* Fix them because the writing improves, not to launder a document.

---

## Tier 1A — frequency markers

Strongest lexical evidence available. Still evidence *about the prose*, never about the author.

| Word or phrase | Replace with |
|:--|:--|
| delve, delve into | explore, dig into, look at |
| landscape *(metaphorical)* | field, space, industry, market |
| tapestry | describe the actual complexity |
| realm | field, area, world |
| paradigm | model, approach |
| embark | start, begin |
| beacon | rewrite the sentence entirely |
| testament to | shows, proves, demonstrates |
| robust *(outside engineering)* | strong, reliable, well-built |
| comprehensive | thorough, complete, full |
| cutting-edge | new, current, or name the actual technique |
| leverage *(verb)* | use |
| pivotal | key, decisive, or name the effect |
| underscores | shows, emphasizes, points to |
| meticulous, meticulously | careful, carefully, or cut |
| seamless | smooth, or describe what doesn't break |
| game-changer | name what changed |
| hit differently | cut |
| watershed moment | cut or name the shift |
| marking a pivotal moment | cut |
| the future looks bright | cut |
| only time will tell | cut |
| nestled | sits, is located, is in |
| vibrant | busy, loud, colorful — pick the real attribute |
| thriving | growing, profitable, or give a number |
| despite challenges… continues to thrive | cut the whole construction |
| showcasing | showing, or cut |
| deep dive, dive into | look at, examine, walk through |
| unpack, unpacking | explain, break down |
| bustling | busy, crowded |
| intricate, intricacies | complicated, details |
| complexities | what specifically is complicated |
| ever-evolving | changing, or cut |
| enduring | lasting, or cut |
| daunting | hard, large, or cut |
| holistic | whole, complete, end-to-end |
| actionable | usable, or cut |
| impactful | name the impact |
| learnings | lessons, findings, what we learned |
| thought leader | cut |
| best practices | name the practice |
| at its core | cut |
| synergy | how the two things actually combine |
| interplay | how they interact |
| keen *(as intensifier)* | cut |
| genuinely, genuine *(as intensifier)* | cut |
| symphony *(metaphorical)* | rewrite |
| embrace *(metaphorical)* | adopt, accept, use |
| load-bearing *(metaphorical)* | central, essential |

**Hyphen rule for `load-bearing`.** Only the hyphenated compound counts. "load bearing" without the hyphen is ordinary construction English and never flags.

**Construction carve-out.** `load-bearing` is literal — not a metaphor — when it modifies a structural noun: *wall, beam, column, joist, truss, member, footing, slab, stud, partition, masonry, lintel, pier, rafter, girder, capacity*. Abstract-capable nouns are deliberately excluded from that list — *structure, element, frame, foundation* — so "the load-bearing structure of his argument" still flags. Known gap in the upstream implementation (issue #56): predicative use ("the wall is load-bearing") still flags, because the modified noun isn't adjacent.

## Tier 1B — clarity edits, not evidence

These are wordy. They are also normal professional English. Measured against **257 paragraphs of verified pre-2023 human prose**, every row below fires on real human writing at a meaningful rate.

Emit them as `tier1-clarity`, weight them like Tier 2, and **exclude them from any density or cluster signal**. A wordiness fix must never be able to push a document toward looking machine-written.

| Wordy | Direct |
|:--|:--|
| utilize | use |
| in order to | to |
| due to the fact that | because |
| serves as | is |
| features *(verb)* | has, includes |
| boasts | has |
| presents *(inflated)* | is, shows, gives |
| commence | start |
| ascertain | find out |
| endeavor | effort, attempt |

## Tier 2 — cluster words

Flag at **2 or more in the same paragraph**. One is fine.

`harness` · `navigate`, `navigating` · `foster` · `elevate` · `unleash` · `streamline` · `empower` · `bolster` · `spearhead` · `resonate` · `revolutionize` · `facilitate` · `underpin` · `nuanced` · `crucial` · `multifaceted` · `ecosystem` *(metaphorical)* · `myriad` · `plethora` · `encompass` · `catalyze` · `reimagine` · `galvanize` · `augment` · `cultivate` · `illuminate` · `elucidate` · `juxtapose` · `paradigm-shifting` · `transformative`, `transformation` · `cornerstone` · `paramount` · `poised (to)` · `burgeoning` · `nascent` · `quintessential` · `overarching` · `quietly` · `deeply` · `underpinning`, `underpinnings`

**`deeply` rule:** counts only in significance collocations — "deeply integrated," "deeply committed," "deeply rooted." Literal and emotional uses never count toward a cluster: "deeply nested," "cares deeply," "breathed deeply."

## Tier 3 — density words

Individually harmless. Flag only when they reach roughly **3% or more of total words** in a piece, which means the writing is running on evaluative adjectives instead of facts.

`significant`, `significantly` · `innovative`, `innovation` · `effective`, `effectively` · `dynamic`, `dynamics` · `scalable`, `scalability` · `compelling` · `unprecedented` · `exceptional` · `remarkable` · `sophisticated` · `instrumental` · `world-class`, `state-of-the-art`, `best-in-class` · `verbatim`

**`verbatim` carve-out:** term of art in legal, research, and QA contexts ("verbatim transcript," "verbatim responses"). Never flags there.

## Tier 3 phrases

Flag at **2+ uses of the same phrase**, or **3+ distinct phrases** in one piece. That second trigger is the useful one: it catches a model varying its own boilerplate rather than repeating it.

`emerging sector`, `emerging space`, `emerging category` · `the integration of` · `the intersection of` · `community-driven` · `long-term sustainability` · `user engagement` · `decentralized compute` · `(sustainable) reward emissions` · `tokenized incentive structures` · `designed for long-term [X]`

Worst offenders by domain: crypto, web3, DePIN, and AI-infrastructure reviews. In those spaces the phrases are simultaneously house style and empty, which is why the 2-and-3 thresholds matter more than the individual entries.

---

## Wikipedia words-to-watch

Independent lineage from the tier lists above, organized by *what the phrasing is doing* rather than by word frequency. This is the more useful axis for editing, because each group names a failure mode.

Source: Wikipedia:Signs of AI writing (WP:AISIGNS) §1, rev. 2026-08-29.

### 1.1 Undue significance

Claims importance instead of showing it.

*stands as* · *serves as* · *is a testament to* · *is a reminder* · *plays a crucial / pivotal / vital / significant / key role* · *a crucial / pivotal moment* · *underscores its importance* · *highlights its significance* · *reflects broader [trends]* · *symbolizing its ongoing / enduring / lasting [legacy]* · *setting the stage for* · *represents a shift* · *marks a shift* · *evolving landscape* · *focal point* · *indelible mark* · *deeply rooted*

### 1.2 Canned attribution

Sourcing language that names no source.

*independent coverage* · *media outlets* · *trade publications* · *cited in* · *featured in* · *profiled in* · *active social media presence*

### 1.3 Superficial analysis

Present participles that assert a connection without arguing one.

*highlighting* · *underscoring* · *emphasizing* · *ensuring* · *reflecting* · *symbolizing* · *contributing to* · *cultivating* · *fostering* · *encompassing* · *enhancing* · *valuable insights* · *align with* · *resonate with*

The structural version of this is the trailing participial clause — "…, highlighting the importance of community engagement." Cut it or convert it into a claim someone could disagree with.

### 1.4 Puffery

*boasts a* · *vibrant* · *rich* · *profound* · *enhancing* · *showcasing* · *exemplifies* · *commitment to* · *natural beauty* · *nestled* · *in the heart of* · *groundbreaking* · *renowned* · *featuring* · *diverse array*

### 1.5 Weasel attribution

Attributes a view to a group that is never identified.

*Industry reports* · *Observers have cited* · *Experts argue* · *Some critics argue* · *several sources* · *several publications* · *such as* introducing what is actually an exhaustive list

### 1.6 Challenges-and-future scaffolding

Section shapes that exist to fill an outline slot.

*Despite its [X], it faces several challenges* · *Despite these challenges* · a *Challenges and Legacy* heading · a *Future Outlook* heading

Related: *Awards and recognition* as a section header is, per Wikipedia, "nearly ubiquitous in AI generated articles."

### 1.7 The 26-word list, with attributions

Each word here has at least one source behind it. Words with multiple independent attributions are the strongest; two entries have none and are marked.

| Word | Attributed to |
|:--|:--|
| Additionally | Geng, Huang |
| align with | Juzek, Kobak |
| boasts | Juzek |
| bolstered | Kobak |
| crucial | Russell, Geng, Huang |
| deep dive | *Economist*, Jul 2026 |
| delve | Juzek, Kobak, Russell, Kriss |
| emphasizing | Juzek, Kobak |
| enduring | Kobak |
| enhance | Kobak, Russell |
| fostering | Kobak, Russell |
| garner | Juzek, Kobak |
| highlight | Russell, Kriss |
| interplay | Kobak |
| intricate | Juzek, Kobak, Reinhart, Kriss |
| key | *no citation* |
| landscape | Russell |
| meticulous | Juzek, Kobak |
| pivotal | Kobak, Russell |
| robust | *no citation* |
| showcase | Juzek, Kobak, Kriss |
| tapestry | Russell, Reinhart, Kriss |
| testament | Russell |
| underscore | Juzek, Kobak, Russell, Kriss |
| valuable | Geng |
| vibrant | Reinhart |

`delve`, `underscore`, `intricate`, `tapestry`, and `showcase` carry four, four, four, three, and three attributions respectively. Those five are the only lexical items in this skill with anything close to a solid base. `key` and `robust` have none — they ride on convention.

### 1.8 Copula avoidance

Models replace *is* with a more active-sounding verb. Geng et al. measured a **>10% drop in *is* and *are*** in academic writing in 2023, and reproduced it directly: GPT-3.5 asked to "revise the following sentence" across 10,000 abstracts produced fewer copulas. Observed in GPT and Gemini output.

*serves as* · *stands as* · *marks* · *functions as* · *operates as* · *represents* · *boasts* · *features* · *maintains* · *offers* · *refers to*

Elaborate recent forms are harder to spot because they read as biography: "*ventured into politics as a candidate*" for "*was a candidate*"; "*began his career as*" for "*was*."

Don't confuse this with the perfect: "has served two terms" is a tense, not a dodge.

### 1.9 Vague connection

*in connection with* · *in connection to* · *associated with* · *in association with*

Each hides the actual relationship. Name it: funded by, sued by, employed at, cited in.

### 1.10 Collaborative-assistant register

Conversational turns that belong to a chat, not a document.

*I hope this helps* · *Of course!* · *Certainly!* · *You're absolutely right!* · *Would you like…* · *let me know* · *here is a*

Cross-reference: `references/forensics.md` treats pasted assistant turns as Tier F, since they're residue rather than style.

### 1.11 Knowledge-cutoff disclaimers

*Up to my last training update* · *While specific details are limited* · *While specific details are scarce* · *not widely available* · *not widely documented* · *not publicly disclosed* · *based on available information*

### 1.12–1.14 Edit-summary and metadata tells

Wikipedia-specific: assistant-voiced edit summaries, summaries describing the *prompt* rather than the change, and summaries in a register no editor uses. The transferable version is a commit message or PR description written as if narrating to a client.

### 1.15 Didactic asides

*it's important to note* · *it's worth noting* · *may vary*

Almost always deletable with no loss. If the note matters, promote it to a sentence that says the thing.

### 1.16 Section summaries

*In summary* · *In conclusion* · *Overall*

A closing paragraph that restates the body without adding a claim. Cut the label and the paragraph both, unless the piece is long enough that a reader needs a recap — which is rarer than models assume.

### 1.17 Prompt refusal

*as an AI language model* — and any sentence in that family. Forensic, not stylistic; delete on sight.

---

## Era drift

The same word rises and falls with model generations. A list built on one generation misfires on the next, in both directions.

| Era | Model | Overused |
|:--|:--|:--|
| 2023 – mid-2024 | GPT-4 | Additionally, boasts, bolstered, crucial, delve, emphasizing, enduring, garner, intricate/intricacies, interplay, key, landscape, meticulous/meticulously, pivotal, underscore, tapestry, testament, valuable, vibrant |
| mid-2024 – mid-2025 | GPT-4o | align with, bolstered, crucial, emphasizing, enhance, enduring, fostering, highlighting, pivotal, showcasing, underscore, vibrant |
| mid-2025 onward | GPT-5 | emphasizing, enhance, highlighting, showcasing — plus the notability and attribution vocabulary in §1.1–1.2 |

GPT-4o was ChatGPT's model from **May 2024 to August 2025** and, per Reinhart et al., "produces output with more variation from human writing than other contemporaneous language models." Text from that window is the easiest to spot on style alone; text from 2026 models is the hardest.

**The `delve` arc** is the clearest illustration of why this tier expires. Famously overused in 2023 and early 2024, less frequent later in 2024, then dropped off sharply in 2025. A skill still leading with `delve` in 2026 is calibrated to a model nobody is running.

**Grok** overuses superficially scientific vocabulary — `causal`, `empirical`, `correlate` — and continues to overuse `underscore` as of 2026.

**Direction of decay.** Human writing is absorbing this vocabulary (Yakura 2024 on spoken language, Geng 2025 on academic writing, Galpin 2025 on semantics). So Tier V hits weaken every year from both ends: models drop the tells, and humans pick them up. Structure tells decay more slowly. Weight accordingly, and treat any list that hasn't been re-measured since its source generation as expired.

## Lexical diversity as a tell (WP:AIELEVAR)

Elegant variation — swapping in a fresh synonym for each mention of the same subject rather than repeating the plain noun. The Wikipedia example chain, from the *Vladimir Yankilevsky* article: "Soviet artistic constraints" → "Non-conformist artists" → "Their creativity," each standing in for the same referent.

**Counter-note that matters:** avoiding repetition is explicitly taught in some school systems — Italian schools are the cited example. Elegant variation is a native marker of a particular education, not only of a model. Treat it as weak and never as standalone.

## What is not vocabulary evidence

- **Formal or academic register.** The measured correlation is to *specific words*, not to formality. Wikipedia lists "fancy prose" among its ineffective indicators.
- **Transition words in isolation.** "Moreover" is a word. Thirty percent of paragraphs opening with one is a structure finding, and it belongs in Tier S.
- **Perfect grammar.**
- **Bland or robotic prose** as a felt impression. If you can't name the hit, there isn't one.
