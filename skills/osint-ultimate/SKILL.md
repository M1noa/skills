---
name: osint-ultimate
version: 3.0
description: >
  Universal OSINT skill. Feed any seed (name, handle, email, domain, IP, phone, company, crypto
  address, image, or fragment) and get an intelligence dossier built on the ESRC method: extract
  micro-data, search a candidate pool by similarity, reason over a shortlist to select and verify a
  match, then calibrate a confidence score. Covers search engine recon, username enumeration, breach
  intelligence, social media, image geolocation and reverse search, people-search and corporate
  registries, domain/IP recon, web archives, crypto tracing, dark web monitoring, OpSec detection,
  entity graphs. Outputs a Markdown report bucketed by confidence
  (CONFIRMED/PROBABLE/TENTATIVE/NOISE) with a coverage map, difficulty estimate, and explicit
  abstentions; every finding spawns pivots until stopping criteria are met.
  Triggers: "OSINT [anything]", "investigate", "find everything on", "build a profile", "trace
  online", "who is", "background check", "digital footprint", "dossier on", "lookup [email/phone/
  username/domain/image]", "research [person/company]".
  LEGAL: Passive recon of public data only. No unauthorized access. No doxxing use cases.
---

# OSINT Ultimate

Collection discipline for building a defensible dossier from public data. The method is **ESRC**
(Extract, Search, Reason, Calibrate), the four-stage pipeline from Lermen et al., *Large-scale
online deanonymization with LLMs* (2026). That paper measures how reliably LLM pipelines link
pseudonymous accounts to identities. The reliability numbers are the point: they tell you when a
match is evidence and when it is a coincidence.

## Scope gate

Read this before collecting anything.

- **Passive public data only.** No authentication bypass, no credential use, no scraping behind a
  login, no purchasing of breached data. Reading a public page and reading a stolen dump are not the
  same act even when they describe the same person.
- **No doxxing.** Do not identify a private individual who is not a public figure and has not
  published the link themselves. If the request is "who is this pseudonymous poster", stop.
- **Legitimate targets.** Threat actors, fraud infrastructure, your own footprint, public companies
  and their officers, leaked credentials that belong to you or your org, scam infrastructure.
- **Stop-list.** Activists, abuse survivors, whistleblowers, journalists, minors, dissidents. The
  paper's own ethical analysis names these groups as the people this technique endangers most. A
  technique that works does not make the target fair.

## The four stages

| Stage | What it does | Failure it prevents | Rule |
|:--|:--|:--|:--|
| **Extract** | Turn unstructured material into semi-structured micro-data | Losing the distinctive detail inside a wall of text | Extract facts, not prose. Record stated and inferred separately |
| **Search** | Retrieve a shortlist by similarity | Committing to the first plausible thing you see | Never accept rank 1. Work a shortlist of 15 to 100 |
| **Reason** | Select one candidate, then verify it adversarially | Confusing "looks like" with "is" | Cheap selector picks, capable verifier confirms or kills |
| **Calibrate** | Produce a confidence score, or abstain | Reporting a guess at the same volume as a fact | Abstention is a valid output. Score every claim |

Drop any stage and the pipeline degrades to what the paper calls the classical baseline: rarity-
weighted similarity over structured attributes, which ranked the true match first only **5.1%** of
the time and hit near-zero recall at usable precision. The LLM half is not decoration.

## Extract: micro-data beats biography

Micro-data is information at the level of one person: "gave Twilight five stars", "lives in Texas",
"never capitalizes sentences", "walks a dog named Biscuit". Individually, none of it identifies
anyone. Stacked and matched against a pool, it does. Sweeney showed **87%** of the US population is
uniquely identified by zip code, birth date, and gender. De Montjoye showed **four spatiotemporal
points** identify 95% of individuals in a mobility dataset. You are not looking for a name. You are
looking for the small facts that are jointly rare.

Practices:

- **Strip before you search.** Remove names, handles, emails, and unique IDs from the search prompt.
  If removing them makes the query find nothing, you were searching a direct identifier, not
  building a match. Both attacks in the paper run on sanitized input by design.
- **Separate stated from inferred.** "Works at Nexus AI" is stated. "Is a senior IC at a 20-person
  startup" is your inference. Tag them differently. Inferences compound error and are the first
  thing to cut when a match fails.
- **Filter generic before extracting.** Two-stage filter: drop empty, deleted, very short, and
  URL-only fragments mechanically, then label the rest relevant or generic and keep the relevant
  set. Pure sentiment posts carry no micro-data.
- **Weight by rarity.** Shared interest in a top-100 subreddit is weak. Shared interest in a
  subreddit with 400 members is strong. Downweight the popular, upweight the distinctive.
- **More material wins, sharply.** Recall went from **3.1%** for a subject with one shared data
  point to **48.1%** for a subject with ten or more. A thin footprint is genuinely hard, and saying
  so is a finding.

## Search: retrieve, do not decide

- Embed the extracted summary, run nearest-neighbour over the candidate pool, retrieve top-K.
- **K = 15 to 100.** Around **80%** of true matches land inside the top 15, so a shortlist that size
  contains the answer when an answer exists. Cosine similarity ranks but does not discriminate: the
  correct candidate frequently is not first.
- Prefer LLM embeddings of your extracted summary over a hand-built attribute vector. On the same
  task the embedding approach beat the Netflix-Prize-style baseline on every metric.
- **Never treat the similarity score as your confidence.** The paper tested this directly. Cosine
  similarity is a poor confidence measure at high precision, so high-similarity pairs are not
  reliably correct. Confidence comes from the Reason stage, not from here.

## Reason: select cheap, verify expensive

Two-stage, in this order:

1. **Select.** Give the shortlist to a cheap model and ask which candidate best matches, or
   abstain. Inputs are short, so this is cheap.
2. **Verify.** Take the single selected pair and run it through the strongest reasoning available,
   on the full text of both sides. Ask for contradictions, not for agreement.

Verification prompt shape: list every attribute the two profiles share, then every attribute they
disagree on, then decide. A candidate with four matches and one hard contradiction is weaker than a
candidate with three matches and none. Specifically hunt: conflicting cities, conflicting
employment dates, conflicting education, mutually exclusive timelines, physical details that cannot
both be true.

**Reasoning effort is a real variable, not a vibe.** At 90% precision, high reasoning reached 8.5%
recall against 5.2% for low, a 63% relative improvement. At 99% precision it was 2.8% versus 1.4%.
When the stakes are high, run the expensive model. The paper's agentic runs cost roughly **$1 to $4
per subject**, which is the honest price of a careful pass.

## Calibrate: say how sure you are, or say nothing

The output of this skill is a confidence-graded claim set, not a list of facts.

| Bucket | Meaning | Bar |
|:--|:--|:--|
| **CONFIRMED** | Match verified, no live contradiction | Two independent sources, or one source plus an adversarial verification pass that found no conflict |
| **PROBABLE** | Strong single-source match | Multiple distinctive micro-data points align; no contradiction found; one source |
| **TENTATIVE** | Pattern match, uncorroborated | Plausible but thin. Every TENTATIVE needs a named pivot that would settle it |
| **NOISE** | Considered and eliminated | Keep it. Record why. Negative results stop the next analyst repeating the work |

Rules:

- **Threshold, do not average.** Pick an operating point and hold it. Recall at 90% precision and
  recall at 99% precision are different products; do not blend them into one "confidence".
- **The false-positive rate is the number that transfers.** The paper is explicit that its ground
  truth overstates real-world recall, because profiles that expose an identity link are easier than
  average. But a wrong guess is a wrong guess anywhere. Bias hard toward abstention.
- **Gap between top two is a weak tiebreak, not a score.** A large similarity gap suggests the
  leader stands out. Use it to decide what to verify next, never as the headline confidence.
- **Sorting works only in batch.** Pairwise comparison with Bradley-Terry ratings across many
  query-candidate pairs beat raw similarity scores as a confidence measure, but it needs many
  queries. For a single subject, fall back to verification-stage confidence. Do not fake a
  tournament on n=1.

## Difficulty estimate before you collect

Two parameters set how hard the job is. State both up front, in the report.

1. **Candidate pool size.** Matching against 10 people is nearly free. Matching against 10,000
   requires a strong method. Write down how many candidates you are actually discriminating between.
2. **Prior probability of a match existing.** If it is low, any non-abstention is probably wrong.
   Say what you believe the prior is, and why.

When the pool is large and the prior is low, the correct output is often "no match found" plus the
coverage map showing what you searched. That is a successful investigation.

## Collection by seed

| Seed | First moves | Pivots out |
|:--|:--|:--|
| Username / handle | Cross-platform username enumeration, spelling variants, archived profiles | Email patterns, linked sites, posting-time timezone |
| Email | Breach corpus lookup, Gravatar-style hashes, registration confirmations, PGP keys | Username reuse, domain ownership, commit metadata |
| Domain / IP | WHOIS history, passive DNS, cert transparency, ASN neighbours, favicon and header hashing, archived copies | Registrar and hosting accounts, sibling infrastructure, code fingerprints |
| Phone | Carrier and line-type lookup, reverse search, messenger account discovery | Area-of-origin, linked social accounts |
| Image | Reverse search, EXIF and metadata, geolocation from landmarks, weather and shadow angle, reflection and sign reading | Camera and phone model, posting history, location clusters |
| Person name | Corporate and charity registries, court records, professional profiles, press | Employer domain, colleagues, event attendance |
| Company | Registry filings, officer and director lists, address clustering, trademark records | Shell-company webs, shared addresses, common agents |
| Crypto address | Ledger tracing, exchange deposit clustering, tagged-entity databases, on-chain heuristics | Forum posts, mixer use, reuse across services |
| Breach corpus | Which breaches contain the identifier, password-reuse surface | Handles used at each breach's origin site |

## Pivot graph

Every finding is a node. Every node is a new seed until it stops producing.

- For each finding, write the pivot before you run it. If you cannot name the pivot, the finding is
  terminal.
- **Two independent paths to the same conclusion** is what promotes a claim to CONFIRMED. Two paths
  that both start from the same source are one path.
- Track dead ends explicitly. Record the negative result and why it failed.
- Cap breadth before depth only when the pool is unknowable; otherwise depth first.

## Stopping criteria

Stop when any of these holds:

- Every CONFIRMED and PROBABLE claim has two independent paths, or is marked as single-source.
- Every TENTATIVE claim has a named, unrun pivot plus the reason it was not run.
- The remaining candidates are below your confidence threshold, and you have recorded the threshold.
- Cost or legality blocks further collection. Say which.

Do not stop because the story feels complete. A tidy narrative with one source is a hypothesis.

## Report format

```markdown
# <seed>
Scope: <what was in bounds> | Difficulty: pool=<n> candidates, prior=<high|low>
Method: ESRC | Threshold: <operating precision> | Sources: <n>

## coverage map
<what was searched, what came back empty, what was out of reach>

## CONFIRMED
- <claim> — <evidence> — paths: [a, b]

## PROBABLE
- <claim> — <evidence> — single source: <which> — missing: <what would confirm>

## TENTATIVE
- <claim> — why plausible — pivot not yet run: <pivot>

## NOISE / ruled out
- <claim> — eliminated because <reason>

## abstentions
<what you declined to conclude, and the threshold that made you abstain>
```

The coverage map and the abstention list are not filler. They are what makes the report usable by
someone who will act on it.

## Anti-patterns

- **Accepting rank 1.** The correct match is usually in the shortlist and often not at the top.
- **Treating the model's memory as evidence.** An LLM "recognising" a profile is not corroboration.
  The paper notes reasoning effort raised performance, which argues against memorisation as the
  mechanism, but a plausible-sounding recollection with no citation is still unsourced.
- **Similarity as certainty.** Documented failure mode. Do not ship it.
- **One-source promotion.** If a single page says it, it is PROBABLE at best, no matter how specific.
- **Blending the buckets.** A mixed list of verified and speculative claims will be read as if it
  were all verified. Separate them or the report is worse than silent.
- **Ignoring the pool.** A match against eight candidates is worth much less than the same match
  against eight thousand, and the reader cannot tell unless you say.
- **Running the expensive model everywhere.** Select cheap, verify expensive. Budget goes on the one
  pair that matters.
