# What the evidence actually supports

Read this before you write a report. It sets the ceiling on every claim in this skill.

## The short version

1. Trained classifiers with a large private corpus can separate machine from human text well, in-domain, at low false-positive rates.
2. Reading style tells cannot. Humans do it at roughly chance. Skills built on word lists and structure heuristics measure near chance at paragraph level.
3. Therefore: no authorship verdicts. The patterns here are worth fixing because they are bad writing, and that justification stands even if the text was written by hand.

## Detectors that work, and their limits

### Pangram (Emi & Spero, Pangram Labs, arXiv:2402.14873, 29 Jul 2024)

The strongest published system in this space. Method: a training pool of ~28 million confirmed human documents, all from **2021 and earlier** to avoid mislabeled AI text, plus **synthetic mirrors** — machine text generated to imitate each human document's topic and form — plus iterative **hard negative mining**. Performance saturates around 40,000 examples per domain (~400k total); pushing to 1M examples still won't converge above 98% without the mining loop.

Reported results: 99%+ accuracy on a 1,976-document / 10-domain / 8-model benchmark, against commercial competitors under 95%; a claimed 38× lower error rate. Competitors' failure modes are asymmetric and instructive — **GPTZero's false negative rate 10.02%** (biased toward calling machine text human), **Originality's false positive rate 9.24%** (biased the other way, which is unusable when almost all real documents are human). Both "completely fail" on GPT-4 output.

**Per-domain false-positive rate, before and after hard negative mining:**

| Domain | Base | After mining |
|:--|--:|--:|
| Creative writing | 1.51% | 0.02% |
| Reviews | 1.81% | 0.02% |
| Books | 0.85% | 0.01% |
| Scientific papers | 1.54% | 0.04% |
| Wikipedia | 5.34% | 0.05% |
| News | 0.55% | 0.001% |
| Q&A | 2.52% | 0.009% |
| ESL | 1.44% | 0.01% |
| Student writing | 0.75% | 0.04% |
| Email | 6.60% | 0.00% |
| **Domain-weighted total** | **2.29%** | **0.02%** |

Generalization: >99.6% recall at a fixed 1% FPR on open-source models never seen in training; GPT-4o 100.0%, Claude 3 99.76%, LLaMA 3 99.97%.

**ESL — the important part.** Liang et al. found commercial detectors systematically biased against non-native writers. Pangram, holding out the same 91-essay TOEFL benchmark, reports **0% FPR**; **0 false positives across 3,907 ELLIPSE essays** (8th–12th grade ESL); **0.09% on 5,600 ICNALE essays** (Asian undergraduates learning English). GPTZero's updated model still measured 7.7% on the TOEFL set.

Their own ethics statement, verbatim: *"We strongly discourage the use of our classifier as a sole arbiter of academic integrity and plagiarism checking. All AI detection tools have a nonzero false positive rate, and should be used in conjunction with other evidence."*

**What this means for you:** the thing that works is a supervised classifier with a proprietary 28M-document corpus and a mining loop. This skill has none of that. Do not borrow Pangram's confidence.

### Where detectors break

- **Adversarial paraphrase** cuts detection accuracy by roughly 88% across every method tested (arXiv:2506.07001, 2025).
- **Non-native English.** Liang et al. (Stanford, *Patterns*, 2023) measured false-positive rates above 60% on non-native writing. This is the single most consequential failure mode and the reason for the ESL guardrail in `SKILL.md`.
- **Open-source detectors** misclassify at rates above 70% overall (Jabarian & Imas, BFI Working Paper 2025-116, 2025).
- **Robustness generally.** RAID (Dugan et al., ACL 2024, arXiv:2405.07940) shows detectors are sensitive to paraphrasing, markup changes, spacing changes, and any model not seen during training.
- **GPTZero specifically**: Dik, Erdem & Dik 2025 (arXiv:2506.23517) on accuracy in identifying AI vs human essays.

Wikipedia's guidance follows from all of this: *"Do not solely rely on artificial intelligence content detection tools (such as GPTZero and Pangram). While they perform better than random chance, these tools have non-trivial error rates."* A high detector score is explicitly **not** a valid criterion for speedy deletion there.

## Humans reading style

| Study | Finding |
|:--|:--|
| **Russell, Karpinska & Iyyer, ACL 2025** (arXiv:2501.15654) | *Heavy* LLM users identify AI-generated articles correctly about **90%** of the time. Tag 10 pages and you've probably made 1 false positive. Participants who don't use LLMs much did only slightly better than chance, in both directions |
| **Cheng et al. 2025** (*Advances in Simulation* 10:66) | Human ability to distinguish LLM text from human text is **no better than random chance** |
| **Fiedler & Döpke 2025** (*Int. Review of Economics Education* 49) | On German theses, humans achieved a recognition rate of **57% for AI texts and 64% for human-generated texts** |

Read together: expertise matters enormously and general intuition is worthless. "It felt like AI" is not evidence. Anyone reporting a verdict should assume they're in the second group.

## The honest self-measurement of a skill like this one

The most rigorous source in this genre (`conorbronsdon/avoid-ai-writing`, v3.22.0, measured 2026-07-31) published its own numbers against **875 human and 779 machine paragraphs**:

- At its own threshold `score >= 5`: **4.2% FPR (95% CI 3.1–5.8) against 7.2% TPR.**
- **Paragraph-level ROC-AUC 0.501 pooled** — a coin flip. **0.623 at document level.**
- Its own conclusion: *"the composite score cannot reliably separate machine text from human text, and no threshold on it buys a useful true-positive rate at a tolerable false-positive cost."*
- Its publication gate required n≥100, confidence intervals, and more than one modern register. It **fails the register test**: HC3 is ChatGPT-only, RAID is a different task shape. *"A rate measured on 2022–2024 assistant prose is an upper bound on performance against current models, not an estimate of it."*
- And the line worth memorizing: *"A low score means the text carries no surface pattern hits. It does not mean the writing is good, and it does not mean the writing is human."*

That is the ceiling on the pattern catalog in `references/patterns.md`. Use it as an editing checklist, which is what it's good for.

## What does hold up

The signals that survive scrutiny are structural and positional, not lexical.

- **Position tells survive paraphrase and become *more* visible after it** (Russell et al., ACL 2025). Paraphrasing rewrites words; it doesn't move where information sits.
- **The middle of a document is the choke point** (Tripto et al., EMNLP 2025) — measured on news, essays, and email, not only fiction. Machine text loses distinctiveness in body paragraphs first.
- **Discourse-move distribution is skewed.** Using QUD analysis (QUDsim, COLM 2025), LLMs use consequence and procedure moves about **19%** of the time and comparison or verification moves about **0.2–0.3%**. One paragraph that actually checks a claim against a counterexample changes the profile more than a page of rewording.
- **QUD sequences repeat across models.** Two different models independently produced the same question sequence — scene briefing → justifying the deception → social consequences → the weight of responsibility. Surface rewording leaves that sequence intact.
- **Noun-heavy informational density.** Instruction-tuned models favor nominalized, information-dense phrasing and fail to match genre-appropriate variation (Reinhart et al., PNAS 2025).
- **Narrative-feature attribution** reaches 68.4% macro-F1 across six sources, and StoryScope reports 93.2% macro-F1 for binary human/AI separation on narrative features (arXiv:2604.03136). Better than chance by a wide margin, still nowhere near a verdict.

## Vocabulary evidence, and its expiry date

- **Kobak et al., *Science Advances* 2025** — excess-vocabulary analysis of biomedical abstracts, the cleanest published method for finding words whose frequency jumped after LLM adoption.
- **Juzek & Ward, ACL 2025** — the "delve" case specifically.
- **Geng et al., Findings of ACL 2025** — over a **10% decrease in usage of *is* and *are*** in academic writing in 2023, with no comparable change before that. In a controlled test, GPT-3.5 asked to "revise the following sentence" across 10,000 abstracts produced *is*/*are* less often. This is why plain copulas count as a human signal.

Then the co-evolution problem, which decays all of the above:

- **Yakura et al. 2024** (arXiv:2409.01754) — measurable LLM influence on *spoken* communication, including conversational podcasts, already in 2024.
- **Geng et al. 2025** — confirms the influence on academic language.
- **Galpin, Anderson & Juzek 2025** (arXiv:2506.21817) — the change reaches semantics and word choice, not just surface frequency.

Consequence: a word list is a depreciating asset. Structure heuristics depreciate slower. Weight the tiers accordingly, and be suspicious of any list that hasn't been re-measured since the model generation it was built on.

Wikipedia adds a behavioral caveat that cuts both ways: *"writers may adjust their behavior to avoid accusations of AI, or may be defensive about using AI tropes."*

## Things that are asserted here without measurement

Stated plainly so nobody cites them as findings.

| Claim | Status |
|:--|:--|
| "AI uses this word 5–20× more than humans" (Tier 1A ratios) | **Inherited convention.** Traces back through the humanizer-skill lineage with no published method or dataset attached. Directionally plausible for a few words with independent support (*delve*, *underscore*); unsupported as a general table |
| Structural thresholds — paragraphs within 15% of each other, no sentence under 8 or over 30 words in a 500-word block, 3+ distinct syntactic patterns per 100 words for humans vs ≤1.5 for AI, >30% of paragraphs opening with a transition, 3+ consecutive same-opening paragraphs, >2 contrasting parallelisms per 500 words, segmental entropy varying <10% across intro/body/conclusion | **Editorial rules of thumb.** Useful for spotting monotony. Not measured, not validated, no published FPR |
| TTR bands (human 0.50–0.65, second look below 0.40) | Reasonable for general prose; strongly register-dependent. Technical documentation legitimately repeats terms |
| Per-model prose tells (bullet-heavy GPT, conciliatory Claude) | Observation, not measurement. Weakest material in the skill |
| Any severity score or 0–100 humanness band | A communication device for ranking your own findings. Not a probability, and not comparable across documents |

## Full citations

- Emi, B. & Spero, M. (2024). *Technical Report on the Pangram AI-Generated Text Classifier*. arXiv:2402.14873.
- Liang, W. et al. (2023). "GPT detectors are biased against non-native English writers." *Patterns*.
- Dugan, L. et al. (2024). *RAID: A Shared Benchmark for Robust Evaluation of Machine-Generated Text Detectors*. ACL 2024, pp. 12463–12492. arXiv:2405.07940.
- Russell, J., Karpinska, M. & Iyyer, M. (2025). *People who frequently use ChatGPT for writing tasks are accurate and robust detectors of AI-generated text*. ACL 2025, pp. 5342–5373. arXiv:2501.15654. doi:10.18653/v1/2025.acl-long.267.
- Cheng, A. et al. (2025). "Ability of AI detection tools and humans to accurately identify different forms of AI-generated written content." *Advances in Simulation* 10(1):66. doi:10.1186/s41077-025-00396-6.
- Fiedler, A. & Döpke, J. (2025). "Do humans identify AI-generated text better than machines? Evidence based on excerpts from German theses." *International Review of Economics Education* 49:100321.
- Dik, S., Erdem, O. & Dik, M. (2025). "Assessing GPTZero's Accuracy in Identifying AI vs. Human-Written Essays." arXiv:2506.23517.
- Jabarian, B. & Imas, A. (2025). BFI Working Paper 2025-116.
- Reinhart, A. et al. (2025). PNAS. Instruction-tuned model style and informational density.
- Kobak, D. et al. (2025). *Science Advances*. Excess vocabulary in biomedical abstracts.
- Juzek, T. S. & Ward, Z. (2025). ACL 2025. Lexical overrepresentation.
- Yakura, H. et al. (2024). "Empirical evidence of Large Language Model's influence on human spoken communication." arXiv:2409.01754.
- Geng, M. et al. (2025). "The Impact of Large Language Models in Academia: From Writing to Speaking." Findings of ACL 2025, pp. 19303–19319.
- Galpin, R., Anderson, B. & Juzek, T. S. (2025). "Exploring the Structure of AI-Induced Language Change in Scientific English." arXiv:2506.21817.
- Tripto, N. et al. (2025). EMNLP 2025. Positional detectability.
- StoryScope (2026). arXiv:2604.03136. 304-feature narrative taxonomy.
- QUDsim (2025). COLM 2025. Discourse-move similarity across models.
- *Wikipedia:Signs of AI writing* (WP:AISIGNS), rev. 2026-08-29.
- Anti-slop skill lineage, self-reported: `conorbronsdon/avoid-ai-writing` PROOF.md v3.22.0.
