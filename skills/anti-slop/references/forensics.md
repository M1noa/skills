# Tier F — forensic artifacts

Literal strings that leak from a tool's internal formatting into pasted output. These are the only near-definitive signals in the whole skill, and even they have a hard limit:

> **They prove tool involvement, not authorship.** Someone can use a chatbot to find a citation for a paragraph they wrote themselves, paste the link, and carry the `utm_source` with it. Wikipedia's guide states this explicitly for utm params: *"While this near-definitively proves ChatGPT's involvement, it doesn't prove, on its own, that ChatGPT also generated the writing."*

**Fix for everything on this page: delete the token.** No rewriting, no judgment call. If the artifact sits inside a citation, verify the citation still resolves after you strip it.

Provenance for this page: Wikipedia:Signs of AI writing (WP:AISIGNS), rev 2026-08-29, §5.3 Markup and §6 Citations. Strings are reproduced as observed there.

## ChatGPT / OpenAI

| Artifact | Notes |
|:--|:--|
| `:contentReference[oaicite:0]{index=0}` | Index increments; one Wikipedia article carried indices 16–25 |
| `oai_citation`, `[oai_citation:0‡wellington.scoop.co.nz]`, `[oai_citation:1‡en.wikipedia.org]` | Note the `‡` separator before the domain |
| `citeturn0search0`, `citeturn0search1` | Surrounded by Unicode Private Use Area code points; the number after `search` increases through the document. First observed **February 2025**. Sometimes only the bare increasing number survives, still wrapped in PUA points |
| `<ref name="0search12">` | Same artifact leaking into a reference name |
| `iturn0image0turn0image1turn0image4turn0image5` | Image-set render, concatenated |
| `citeturn0news0`, `citeturn1file0`, `cite*generated-reference-identifier*` | Rarer variants |
| `({"attribution":{"attributableIndex":"1009-1"}})` | JSON attribution blob. Real observed indices: `1009-1`, `1009-2`, `3795-0` |
| `Example+1`, bare `+1`, `Wikipedia+1`, `IT Governance+3ISO+3ISO+3`, `Ignyte+3Microsoft Learn+3Google Cloud+3` | Source-count badges rendered as text |

## Gemini

`[cite: 1]` · `[cite: 3, 12, 13]` · `[cite: 17]` · `[cite: 19, 20, 21]` · `[span_1](start_span)` · `[span_1](end_span)` · through `[span_4](start_span)`.

## Grok

`<grok-card data-id="e8ff4f" data-type="citation_card">` — XML-styled card tag after a citation.
`[](grok_render_citation_card_json={"cardIds":["3bb883"]})` — card JSON standing in for a reference link.

## DeepSeek

Lenticular brackets with a dagger, first seen **June 2025**, specific to DeepSeek and derivatives:
`【85†L261-269】` · `【85†L269-274】` · `【29†L582-L589】` · `【32†L142-L149】` · and long-ID forms like `【854140639155648†L119-L123】`, `【331835262276082†L127-L149】`, `【695032903925577†L42-L52】`.

Same source article also showed **concatenated bare domains**: `prioritiesmedway.gov.ukmedway.gov.uk`.

## Perplexity

`[attached_file:1]` and `[web:1]` at sentence end, seen from **fall 2025**. Also citations pointing at an S3 bucket URL containing `ppl-ai-file-upload`.

## Unclassified (first seen 1 June 2026)

`:::writing{variant="document" id="68427"}` — the id is a random 5-digit number, and a bare trailing `:::` usually pairs with it. Localized variants exist: `:::écriture{variante="document" id="28471"}`. Curly-quote variant observed: `:::writing{variant=“document” id=“51724”}`.

## Tracking parameters

| Parameter | Tool |
|:--|:--|
| `utm_source=chatgpt.com`, `utm_source=openai` | ChatGPT |
| `utm_source=copilot.com` | Microsoft Copilot |
| `referrer=grok.com` | Grok |

Gemini and Claude use UTM parameters less often. Rare legitimate route: Google has occasionally indexed URLs already containing the parameter, so a person clicking that search result inherits it.

## Unfilled placeholders

Fill-in-the-blank scaffolding the writer never replaced.

Dates: `access-date=2025-XX-XX`, `date=2022-11-XX`.
Fields: `INSERT_SOURCE_URL_30`, `SOURCE_PUBLISHER`, `PASTE_SPOTIFY_TRACK_URL_HERE`, `PASTE_YOUTUBE_VIDEO_URL_HERE`, `url=URL`, `(Add your channel URL here)`, `(If available)`.
Editorial comments left in: `<!-- Add if available with citation -->`, `== <!-- EDIT BELOW THIS LINE --> ==`.
Generic slots in business or personal writing: `[Your Name]`, `[Company]`, `[Insert metric here]`.

**Carve-out:** real templates ship placeholders on purpose. A published article-creation template or an issue template that says "Add spouse if reliably sourced" is doing its job. The tell is a placeholder in *finished* prose.

## Chatbot residue addressed to the user

Conversational turns pasted along with the content. These are unambiguous and always deleted:

- "Would you like me to turn this into actual Wikipedia markup format (`wikitext`)?"
- "Would you like help formatting and submitting this, or do you plan to post it yourself? I can guide you step-by-step through that too."
- "As an AI language model, I can't directly add content for you, but I can help you draft…"
- Opening acknowledgements of the prompt: "Certainly! Here's a…", "Great question!"
- Trailing offers: "Let me know if you'd like me to expand any section."
- Footnote arrows some interfaces emit: `↩`, `↩2`.

## Fabricated-citation signals

Not string artifacts, but the same forensic register — cheap to verify, expensive to fake.

- **Several broken external links in one new document**, especially with no Internet Archive capture. Confounds: paywalled university-library links that work for others, links mangled by bots, links truncated by a bad copy-paste.
- **Invalid ISBN checksums; DOIs that don't resolve.**
- **DOIs that resolve to an unrelated paper.** The canonical example: a fabricated *Proceedings of the IEEE* citation attributed to C. L. Fortescue in 1967, more than 30 years after he died.
- **Book citations with no page number or URL**, or with pages that don't verify the claim. Watch for a general-topic book that's frequently cited in its field.
- **List-defined references never used inline**, producing "Cite error: A list-defined reference named "X" is not used in the content." Escaped quotes in ref names (`<ref name=\"fiercebiotech\">`) are a related paste artifact — though this can also come from copying between documents.
- **Non-existent categories, templates, or policy shortcuts** that look plausible. Corroborating evidence only; human editors make the same mistakes.

**Confound worth knowing:** from 2018 to 2023 a VisualEditor bug (T198456) made editors accidentally insert citations to very low PubMed IDs, which is why a 2020 revision of *List of Disney television films* cited a paper about rat livers (PMID 9). Irrelevant citations predate LLMs.

## Model fingerprints — priors, not evidence

Two separate bodies of work, with different scopes. Neither belongs in a report as a finding. Use them to decide *what to look for* in a draft, then verify against the text.

### Fiction and narrative (StoryScope, arXiv:2604.03136 §5 Table 17)

Measured on Sonnet 4.6, GPT-5.4, Gemini 3 Flash, DeepSeek V3.2, Kimi K2.5 in 2026. Six-way attribution reaches 68.4% macro-F1 from narrative features alone — which means it's also wrong about a third of the time. **Fiction-scoped; do not carry these into technical prose.**

| Model | Signature defaults |
|:--|:--|
| **Claude** | Most identifiable (26 fingerprint features). Flattest event escalation, uniform voice throughout. Reverent toward literary tradition (62% of stories vs 39–56%). Favors epilogues and flash-forward endings. Avoids dream sequences entirely. Setting mood drifts uncanny |
| **GPT** | Gossip/rumor as plot mechanism (64% vs 44–55%). Distant retrospective narrator ("years later, she would…"). Most twist-prone (41%). Habitually partial reconciliations. Ensemble-heavy social webs |
| **Gemini** | Tidiest endings, extended denouements. Bleak settings in 88% of stories. Flashback reflex, over-indexes on dreams. Protagonist's social circle always expands. Direct speech dominates |
| **DeepSeek** | Front-loads crucial context before the story moves. Visible present narrator. Emotion almost exclusively via behavioral cue. Backstory interleaved metronomically |
| **Kimi** | Only 3 fingerprints. Sits at the centroid of AI narrative space — the genericness is the tell |

### Prose and technical writing

Editorial observation, not measurement. Treat as much weaker than the table above.

| Family | Tendencies |
|:--|:--|
| GPT-4o / 4.5 | Bullet-heavy, staccato contrast, rhetorical colon abuse ("Here's the thing:"), over-numbering |
| Claude 3.5 / 4 | Better sentence-length variation than peers but flat segmental entropy; conciliatory transitions ("To be fair", "That said"); reaches for "nuanced" and "complexities"; loses the thread in long documents; hedges diplomatically on documented facts |
| Grok | Overuses `causal`, `empirical`, `correlate`, `underscore`, and the "X rather than Y" construction |
| Shared across families | Uniform paragraph length, a fixed section order (Background → Details → Impact → Response), citations clustered at paragraph ends, excessive boldface |

### Punctuation and typography priors

- **Em dashes.** A July 2026 comparison found only Claude exceeds professional human writers on em-dash rate. ChatGPT uses *fewer* than professionals, and GPT-5.1 actively suppresses them. So a high em-dash count points at one model and away from another — which is exactly why it can't carry a case alone.
- **Curly quotes.** ChatGPT and DeepSeek emit typographic quotes and apostrophes; Gemini and Claude typically don't. Confounded by every word processor with smart-quote substitution on, which is most of them.

### Era drift in vocabulary

The same word rises and falls with model generations, so a "classic AI word" list ages badly. See `references/vocabulary.md` for the full era table.

## What is *not* a forensic signal

Wikipedia's own list of ineffective indicators, which this skill adopts wholesale:

- **Bizarre wikitext or stray HTML.** Misplaced `<span>` tags point at browser extensions or the content-translation bug (T113137), not at a model. Errors like `''Catch-22 i''s a satirical novel.` point at VisualEditor.
- **Correct formatting.** Getting complex templates right is normal for anyone using a visual editor and the preview button.
- **Abrupt cut-offs.** Older tools truncated at a token limit, but a botched copy-paste does the same thing, and so does a copyright-violation paste.
- **Outdated `access-date` values.** Legitimate causes: copied citations, offline work, batch merges. Newer chatbots rarely produce the error at all.
