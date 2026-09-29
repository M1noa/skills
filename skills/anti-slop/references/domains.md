# Domains

A domain is **what the register demands**. It's independent of voice (how it sounds) and context (how strict you are). A praise opener is the top tell in a PR reply and irrelevant in a changelog; a three-line document is correct for a patch release and a failure in a postmortem.

## Read the venue first

Before editing, sample two or three recent human-written artifacts from the same place — the repo's past release notes, this maintainer's other replies, the team's last postmortem — and match their register, length norms, and formatting habits. Instruction-tuned models favor noun-heavy informational density and fail to match genre-appropriate variation (Reinhart et al., PNAS 2025), so the venue corpus is a better target than any profile in this skill.

When there's no corpus to sample, the domain baseline below applies.

## Whitelist — conventional is not slop

The single most important table on this page. Formulaic containers are formulaic *by agreement*. Slop is the filler inside the container, not the container.

| Do not flag | Why |
|:--|:--|
| Changelog categories (Added / Changed / Fixed / Removed / Security), issue and PR templates, RFC sections, runbook formats, ADR headings | Conventional by community expectation. The reader is scanning for a known shape |
| Formal register in a formal venue | Register match beats forced casualness. Never "humanize" a compliance document into a blog voice |
| Bullets for genuinely enumerable items | Tables and lists are correct for enumerable facts. Bare noun-phrase bullets are only a tell when they're *summarizing claims* |
| Terse, unadorned replies | Brevity is the human default in dev venues, not a tell. "nit: typo" is a complete comment |
| The author's own verified habits | Edit toward their voice, not toward a generic "human" one. If the repo's release notes have always had jokes in them, the jokes stay |
| Version-scoped change narration | Changelogs, release notes, migration guides, and decision records are *supposed* to describe what changed. Diff-anchored writing is only a tell in documentation of current behavior |

## Weighting by document shape

Which checks dominate depends on shape, not topic.

| Shape | Weight first | Weight less |
|:--|:--|:--|
| **Article-like** — postmortem, tech article, announcement, docs page | Relevance, density, stance, coherence, the outline and QUD tests | — |
| **Short answers** — PR and issue replies, review comments, tickets, chat | Factuality, specificity, templatedness | Density and tone matter less at short length |

Weighting sets order and depth of attention, not exemption. A three-sentence reply drowning in filler still fails on density.

Run checks **one at a time**. A combined pass goes blind — that was measured on the slop taxonomy itself.

---

## Release notes and announcements

Changelogs, GitHub Releases, version announcements, short launch posts.

**Baseline.** Terse, factual, user-impact-first. The reader is deciding **whether to upgrade and what will break**. Everything serves that decision.

| Tell | Fix |
|:--|:--|
| Marketing inflation: "We're thrilled to announce", "powerful new features", "seamless experience", "supercharge your workflow" | State what changed. The feature is the news |
| Benefit claims with no mechanism: "improved performance", "enhanced stability" | The number or the change: "cold start 1.8s → 0.4s", "fixed a race in the retry queue (#412)" |
| Every change narrated as a sentence-long story | One line per change, verb-first, no adjectives |
| Emoji headers and exclamation marks throughout | Match the repo's existing notes; default to none |
| An intro about the journey and a closer about the road ahead | Delete both. Version, date, changes |
| Symmetric prose for every item regardless of importance | Order by user impact: breaking changes first, one-word fixes last |

**Rules.** Breaking changes first with the exact migration step (the command, the config key, the renamed flag). Every claim carries its artifact — issue and PR numbers, commit ranges, exact version strings, benchmark numbers with conditions; no artifact, no claim. Credit people plainly ("thanks @name for #398"), never a gratitude paragraph. Length follows the release: a patch release is three lines and inflating it to look substantial is the failure. Humor is allowed if the repo's history has it; never inject it into a repo that doesn't.

---

## Dev replies

PR and issue replies, code-review comments, discussion threads.

**Baseline.** Direct, specific, proportional. Maintainers answer the point in the first sentence, quote the exact code or error, disagree plainly, and say "I don't know" or "won't fix" when that's true. Terseness is the norm, not rudeness. Read the thread and this maintainer's other replies first and match *that* register, not a universal politeness standard.

| Tell | Fix |
|:--|:--|
| Praise or thanks opener by reflex: "Great catch!", "Thanks for the detailed report!" | Open with the answer. Thank people when it's genuinely warranted — a first contribution, unusual effort — not by default |
| Restating the question before answering | Delete. The thread contains it |
| A wall of bullets for a one-sentence answer | One sentence |
| Hedged non-answers: "There could be several factors…", both-sides mush | Commit: the most likely cause, the check that confirms it, or an honest "I don't know" |
| Boilerplate empathy: "I understand how frustrating this must be" | Ask for the repro detail you actually need |
| Sign-offs: "Hope this helps!", "Let me know if you have any questions!" | End at the content |
| Promising work instead of doing it — "I'll look into this" when the fix is at hand | Do it, link the commit |
| Uniform comment structure across a review: every comment praise + issue + suggestion | Vary. Some comments are one word, some are paragraphs |
| Recap-flattery: summarizing the contributor's own work back at them with praise | Substance first |
| Wall-of-text: a 120-word reply as one unbroken paragraph | Break at thought boundaries. This is the one register where "no line breaks" is itself the tell |

**Rules.** Answer first — verdict in sentence one, reasoning after and only as needed. Cite artifacts: `file.py:214`, the commit SHA, the error text verbatim, the doc link. Disagree plainly with a reason ("this breaks the retry path — see #388") and no praise sandwich. State uncertainty cheaply: "not sure — does it reproduce on 2.4?" beats three hedged paragraphs. For wontfix, say so with one reason and a link to where it was decided; don't soften it into ambiguity the reporter has to decode. Distinguish blocking from nit the way the repo already does.

---

## Postmortems

Incident reports, outage retrospectives, RCA documents.

**Baseline.** Blameless toward people, merciless toward mechanisms. Absolute timestamps, exact failure mechanics (the query, the config line, the race window), honest dead ends, and action items someone owns. The team's incident template is a fine container.

| Tell | Fix |
|:--|:--|
| Agentless fog: "mistakes were made", "the change was deployed" with no actor | Blameless ≠ agentless. Name systems and roles: "the deploy pipeline promoted the config before validation ran" |
| Generic lessons: "we will improve monitoring and communication" | An action item is a change with an owner and a date: "alert on queue depth > 10k (owner: infra, due 09-15)" |
| Every template section filled to similar length | Sections earn their length. "What went well" gets one honest line or gets deleted |
| Self-praise adverbs: "the team swiftly identified…" | Timestamps carry the speed judgment |
| Hedged root cause: "a combination of factors may have contributed" | Commit to the causal chain you believe; mark the genuinely unknown part unknown |
| Moralizing conclusion about reliability culture | End at the action items |
| Round, sourceless numbers | Real duration, real blast radius, real request counts, from incident data. Never estimated to sound complete |

**Rules.** Timeline in absolute times with a timezone, **including the wrong turns** — the 40 minutes spent on a bad hypothesis is the most instructive part of the document, and models systematically omit failure-within-the-failure. Give the mechanism at code or config level: the exact query, flag, limit, or race. If you as the editor don't know it, that's a question for the team, not a blank to write prose over. State counterfactuals honestly: what would have caught this, and why it didn't exist. No "the system worked as designed." Contributing factors as a causal chain where each factor says what it enabled, not a bullet cloud. Impact in numbers first. And the stance check: **a postmortem that admits no wrong judgment anywhere hasn't been written yet.**

---

## Tickets

Issue tickets, tasks, work orders, bug reports you file. (Replies belong in dev replies.)

**Baseline.** Imperative, minimal, complete enough that the assignee can start without asking a question and can tell when they're done. A tracker's field template is a container, not a tell.

| Tell | Fix |
|:--|:--|
| Novel-length background before the ask | Context is only what the assignee doesn't already know. Link the rest |
| A description restating the title in sentences | The description starts where the title stops |
| Obvious steps enumerated: "1. Open the repository. 2. Locate the file…" | Only the non-obvious steps and the exact commands |
| Vague acceptance: "works correctly", "improved performance" | Testable: the command to run and the output that means done ("p95 < 200ms on the staging load test") |
| Every template field filled with prose for completeness | Empty is a valid value. "N/A" beats a paragraph of nothing |
| Round scope words: "refactor the module", "clean up" | The concrete boundary — which files and functions are in, which are explicitly out |

**Rules.** Title is the outcome, not the activity: "Retry queue drops jobs on redeploy", not "Investigate queue issue". Bug tickets get exact repro (versions, commands, input), expected vs actual with real output pasted, and frequency; if you can't reproduce it, say what you tried. Acceptance criteria are testable or they aren't criteria. Link, don't repeat — one source of truth. Priority and estimate bare, with no justification paragraph.

---

## Technical articles

Engineering blog posts, tutorials, architecture write-ups, experience reports. The richest domain, and the one where every check applies.

**Baseline.** Motivated by a real problem the author hit. Uneven by design: deep where it got interesting, one line where it didn't. At least one dead end, at least one opinion a reader could disagree with, numbers with their conditions attached. First person and contractions are normal here.

| Tell | Fix |
|:--|:--|
| Topic-survey opening: "In the world of distributed systems…", or defining the thing every reader already knows | Open at the incident, the bug, the number that made you look |
| Listicle in a trench coat: prose that's secretly "The first… The second… The third…" | Either honest structure — a real list or table — or real prose with an argument |
| Fractal summaries: every section announces, tells, recaps | Say it once, at the level where it lives |
| Invented concept labels: "the observability paradox", "configuration drift syndrome" coined mid-post | Plain description, or an established term |
| Symmetric coverage: every alternative gets a paragraph, none gets a verdict | Commit to a recommendation and name the case that would change your mind |
| No failure anywhere: every step worked, benchmarks confirm the thesis | Include what broke and what you tried first. Models systematically omit the dead end, and it's the part readers trust |
| Generic code examples (`foo`, `my_service`) that were never run | Real, runnable snippets from the actual work — or say explicitly they're sketches |
| Benchmarks with no conditions | Machine, version, dataset size, number of runs. Or don't print the number |
| Both-sides conclusion plus future outlook | End on the recommendation or the open question you actually have |

**Rules.** The problem before the topic: first paragraph is the concrete situation that forced the question. If there is no real situation, the honest genre is "notes on X" — **never fabricate the incident.** One opinion minimum, stated as yours, with its disagreement condition ("if your writes are under 1k/s, ignore all of this"). Depth budget by interest, not symmetry: the section that surprised you gets five times the words of the setup steps. Numbers carry conditions, claims carry links, code carries a "this runs" guarantee or a disclaimer. Run the QUD check — if the section-question sequence reads *what is X → why X matters → how to X → conclusion*, restructure around what actually happened.

---

## Docs and reference

API references, README files, guides, runbooks, configuration docs.

**Baseline.** Plain, present tense, second person or imperative, no personality. This is the register most likely to be **over-flagged**, because everything that makes docs good looks like something on a tell list.

**Explicitly not tells here:**
- Plain copulas. "The function returns null" is correct.
- Repeated terminology. Docs must call the same thing the same name every time. Synonym cycling is the bug, not the fix, and low type-token ratio is expected.
- Narrow sentence-length band. Reference material legitimately sits in one.
- Bare noun-phrase bullets in parameter lists, option tables, and feature lists.
- Uniform structure across pages. That's the navigation working.

**Still tells:**
| Tell | Fix |
|:--|:--|
| Diff-anchored writing: "This function was added to replace the previous approach of…" | Describe current behavior and why. Version-scoped documents are exempt; a reference page isn't one |
| Scaffolding headers: Overview, Introduction, Key Points, Conclusion | Headers that say what's in the section |
| A heading followed by a line restating it | Cut the restatement |
| "It's important to note that", "Please note that", "Keep in mind" | State the thing. If it's a warning, use the docs system's warning callout |
| Marketing in reference material: "seamlessly integrates", "powerful and flexible" | The mechanism, or nothing |
| Speculative gap-filling where behavior is undocumented | Say it's undocumented, or find out |

---

## Social

LinkedIn, X, Mastodon, Bluesky, share posts.

**Baseline.** One idea, one voice, no scaffolding. This is where the loudest tells live and where over-correction does the most damage, because "punchy" is both the platform norm and the humanizer fingerprint.

| Tell | Fix |
|:--|:--|
| Hashtag stuffing — 6+ tags, one project tag plus broad category tags | Two or three specific tags, or none. See the counting carve-outs in `references/patterns.md` |
| Social endorsement closers: "This one's a must-read", "Bookmark this", "Thank me later" | Say what the thing is and who it's for, then stop |
| Engagement-bait framing: "The catch?", "Plot twist:", "Here's the thing." | Delete the hook, state the thing |
| Lingering-attention claims: "I can't stop thinking about this" | Delete the frame, open on the thing |
| Manufactured staccato: three same-shape fragments in a row engineered to land | Keep the one that earns emphasis |
| Emoji as bullet markers, arbitrary line breaks after every sentence | Match how this account actually posts |
| "I recently had the pleasure of…" | "I talked to", "I read", "I attended" |
| Novelty inflation: "a failure mode nobody talks about" | If it has a conference talk from last year, it isn't novel |

**Note on the platform.** LinkedIn's native register overlaps heavily with slop, so a post can be conventional *and* empty. The fix is substance, not de-punchifying: give it a number, a name, or a position someone could argue with. Stripping the rhythm out of a post that had nothing in it produces a shorter empty post.

---

## Casual

Chat, DMs, personal email, Discord, comment replies.

**Baseline.** Fragments, lowercase, typos, no structure. Almost nothing in this skill applies, and the highest-value action is usually to leave the text alone.

| Tell | Fix |
|:--|:--|
| Assistant register in a chat message: "Certainly!", "I hope this helps", "Let me know if you need anything else" | Delete |
| Headers and bullets in a two-paragraph message | Prose |
| Wall-of-text: a short reply with zero line breaks | Break at thought boundaries |
| Sycophancy: "Great question!", "You're absolutely right!" | Delete |
| Formal register where the thread is casual | Match the thread |

**Not tells here:** lowercase, missing punctuation, fragments, typos, one-word replies, an emoji, an em dash. Don't tidy a chat message into a memo.

---

## Resolving conflicts

Domain conventions beat generic rules. When a domain says "this convention is expected," it wins — changelog categories, issue templates, RFC sections, and runbook formats are containers. When voice and context disagree, resolve toward the **stricter**. When domain and context disagree, the domain's whitelist still wins: `investor-email` strictness does not license flagging a changelog category.
