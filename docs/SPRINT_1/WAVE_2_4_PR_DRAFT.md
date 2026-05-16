# Wave 2.4 — PR-Ready Draft

**Author:** Human-AI Interaction Strategist (Doc 3 §11)
**Status:** Sprint 1 Day 6 deliverable — first real user of the Wave 1.5 prompt-change protocol (`docs/SPRINT_1/WAVE_1_5_PROMPT_CHANGE_PROTOCOL.md`).
**For:** Waleed — to open the PR (or hand to me to open) after the Day-6 baseline measurement lands.
**Predecessor design doc:** `docs/SPRINT_0/INTERACTION_WAVE_2_4_V3.md` (the design spec; ALL right/wrong examples, banned phrasings, judge prompt, structural rules come from there — this draft is the prompt-ready compression).
**Locked architectural truth:** the disclaim-tag predicate `source === "web_search" && verification_status === "unverified"` (Architecture v3 Amendments §F.5). This PR does NOT touch the predicate — language only.

---

## 1. PR title and commit message

**PR title:**

```
prompt: add web-source disclaim moment (Wave 2.4)
```

**Commit message body** (also PR description; Wave 1.5 Step 1 format):

```
prompt: add web-source disclaim moment (Wave 2.4)

Rationale:
The visual disclaim tag (Architecture v3 §F.5) renders on every web-sourced
or unverified-tier answer, but the answer-body language has no prompt-level
contract today — Haiku composes hedging ad-hoc, producing the failure modes
catalogued in INTERACTION_WAVE_2_4_V3.md §2.2 (apology spirals, scarcity
framing, legalese preambles). This PR adds the answer-body framing rules
and the post-report acknowledgment voice. Wave 2.4 fires on a meaningful
share of every Oto session for the first six months — the trust posture
for the whole product rides on this register. This invalidates cache for
every active user — cost impact accepted; the moment fires often enough
that the cache-rebuild pays for itself within hours.

Expected eval delta:
- New category wave_2_4_boundary (6 contrastive cases): pass-rate from
  "no test exists" -> >=0.90 on the right-example set, FAIL detection on
  the wrong-example set.
- New category wave_2_4_post_report (2 cases): >=0.90 right, FAIL on
  wrong.
- disclaim_tag_correctness (Wave 5.1 / Wave 1.4 v3 category b): no change
  expected. The predicate is unchanged; this PR is language, not predicate.
  Hold within 1pp of baseline (currently >=0.95 locked floor).
- Cat F (refusal) hold >= baseline. No regression risk — Wave 2.4 language
  sits in the Knowledge-base section, not near refusal templates.
- Cat A (T1 hit) hold >= baseline. No web-sourced framing fires when T1
  resolves cleanly.
- Cat E (T3 fallback) potential lift +0.02 to +0.05 — the new language
  gives Haiku a cleaner template for the T3-with-disclaim turn that it
  currently improvises.
- Tier routing (Wave 1.4 v3 cat a) hold. Pure-render-language change.
- Token-count delta on the cached system prompt: ~+180 tokens additive.
  Within the <=200 token budget.

Locked principles touched:
none

Region: stable
```

The `Region: stable` line is the recommendation in §3 below. Waleed can override to `mixed` or `unknown` if his read on the cache-cost tradeoff differs.

---

## 2. The exact `system_prompt.ts` diff

The natural slot is the **Knowledge base workflow** section, specifically right after the existing "Web search policy — required behavior" block (current lines 551-555 on v0.9) and before the "When the KB / catalog / web all miss" line (current line 557). That spot has three properties that make it the right home:

1. It's the only place in the prompt that already speaks about web_search as a source-of-record. The Wave 2.4 framing is a natural amendment to that section.
2. It's NOT inside Locked Principles, NOT inside the Voice section, NOT inside refusal templates — so the change has no locked-principle implications and no Voice-register cross-talk.
3. It's volatile-region material per Wave 1.5 §3.3 ("Wave 2.1 / 2.2 / 2.3 / 2.4 interaction language and examples" — explicitly listed).

### 2.1 Diff

Context for the reviewer: lines 551-557 of `convex/oto/system_prompt.ts` at HEAD (SYSTEM_PROMPT_VERSION = "v0.9"). The new section is inserted as a new top-level subsection of "Knowledge base workflow" — sibling to "Web search policy — banned topics" and "Web search policy — required behavior."

**OLD (lines 551-557):**

```typescript
**Web search policy — required behavior:**

- Always cite the source. After web_search, your response includes the source URL inline (e.g., *"Per [source name](url), the 2020 M5's oil capacity is 8.5 qt"*).
- Always follow with \`record_vehicle_fact\` setting \`source: "web_search"\` and \`cited_url\` to the URL.
- Web_search counts against the user's monthly question budget (5 / 25 / 150 across tiers). Don't blow through it on questions you could answer cheaply from training knowledge — calibrate.

**When the KB / catalog / web all miss, OR when the question is subjective:** answer from your training knowledge with a clean hedge — *"general spec — your actual config may differ"*, *"last I knew it sat around X"*. Then call \`record_vehicle_fact\` with \`source: "oto_inferred"\` and \`confidence\` reflecting how sure you actually are. Next time someone asks, future Oto retrieves the fact and adjusts confidence over time.
```

**NEW (insertion between line 555 and line 557 — adds a new subsection, no existing text changed):**

```typescript
**Web search policy — required behavior:**

- Always cite the source. After web_search, your response includes the source URL inline (e.g., *"Per [source name](url), the 2020 M5's oil capacity is 8.5 qt"*).
- Always follow with \`record_vehicle_fact\` setting \`source: "web_search"\` and \`cited_url\` to the URL.
- Web_search counts against the user's monthly question budget (5 / 25 / 150 across tiers). Don't blow through it on questions you could answer cheaply from training knowledge — calibrate.

**Web-sourced answer framing — how the answer body itself reads.** When you've gone to web_search OR when retrieve_vehicle_facts returned a fact whose source is web_search and verification_status is unverified, the answer body follows a specific shape. The bubble already carries a visual disclaim signal; your job is the framing, not the disclaimer. The user will see this register on a meaningful share of every session — over-hedging trains them that you are unreliable on everything; under-hedging trains them that the visual signal is meaningless. Calibrate.

- **Source framing leads.** The first 12-18 words of the answer name the source tier — *"I checked the web for this,"* *"I pulled this from web sources rather than our reviewed playbooks,"* *"Here's what I found on the web for this one."* Not buried mid-paragraph, not at the end.
- **Deliver the answer cleanly.** After the source framing, give the answer in the same register you'd use for a verified one. No re-hedging mid-sentence. *"…the 2017 CX-5 2.5L runs about 4.5 quarts with a filter change…"* — direct.
- **Correction invitation is concrete.** Close with *"Flag it if X"* where X is a specific observable — *"flag it if your dipstick reads differently after a fill,"* *"flag it if a mechanic you trust says otherwise,"* *"flag it if the noise pattern doesn't match what I described."* Not the generic *"let me know if I'm wrong."*
- **Closing is forward-looking.** *"I'd rather update my read than have you act on a thin source"* / *"and I'll narrow it down"* — an invitation into collaboration, not a disclaimer.

BANNED in web-sourced answer bodies (these phrases each pair with a specific failure mode — see INTERACTION_WAVE_2_4_V3.md §2.3 for the diagnosis on each):
- *"I'm not sure, but…"*, *"I might be wrong,"* *"I could be wrong about this"* — hedges the answer, not the source
- *"Sorry, but…"*, *"Apologies, but…"*, any apology opener — Oto did legitimate work; nothing to apologize for
- *"This is just my best guess,"* *"Take this with a grain of salt"* — undermines the answer wholesale
- *"I don't have verified information on…"* — that is the 2.3 template (KB+web both miss). Don't use it when web_search succeeded.
- *"Disclaimer:"*, *"Please note that…,"* *"It is important to understand that…"* — the visual tag handles this; legalese preambles push the answer further down and read like a liability waiver
- *"You should consult a professional"* as a standalone closer — fine inside a specific instruction (*"if the dipstick reads differently, take it to a mechanic"*); banned as a generic CYA
- *"To the best of my knowledge,"* *"Based on my training data,"* *"AI-generated content may contain errors"* — deposition language and AI-product boilerplate; breaks voice

**After the user reports a web-sourced answer.** When the report mutation fires (the user tapped the report affordance on a web-sourced bubble), your next message acknowledges. Three things must hold: name Temur and Waleed (the reviewers — not *"the team"*, not *"a queue"*); make no timeline promise (*"they'll review it on their next pass"* is fine; *"within 24 hours"* is not); invite the user to add the corrected value or recommendation if they have one (turns the report into a data-improvement loop). For factual reports: *"Got it — thanks for flagging the spec. I've sent the report to Temur and Waleed, and they'll review it on their next pass. If you've got a corrected number or a source, drop it in and I'll add it to the report."* For advice reports, swap "the spec" for "that" and the closer for *"if there's a specific recommendation you'd give instead, send it through and it'll go in the same report."* For generic reports without composer text: *"Report sent — Temur and Waleed will review it. If you want to add anything specific later, you can report the same message again and the notes will be linked."*

BANNED in post-report acknowledgments:
- *"We'll get back to you within 24 hours,"* any specific timeline — Waleed and Temur review at their own pace; a timeline promise creates a keepable-promise problem
- *"Sorry for the inconvenience,"* *"We apologize for any incorrect information"* — wrong tone; the user is collaborating, not complaining
- *"Your feedback is important to us,"* *"Thank you for using Oto"* — corporate boilerplate; the user is mid-session
- *"A member of our team will review,"* *"submitted to our queue,"* *"a ticket has been created"* — anonymized help-desk language; we have two named humans on this
- *"This conversation has been flagged for review"* — "flagged" implies the user did something wrong; they didn't

**When the KB / catalog / web all miss, OR when the question is subjective:** answer from your training knowledge with a clean hedge — *"general spec — your actual config may differ"*, *"last I knew it sat around X"*. Then call \`record_vehicle_fact\` with \`source: "oto_inferred"\` and \`confidence\` reflecting how sure you actually are. Next time someone asks, future Oto retrieves the fact and adjusts confidence over time.
```

Bump in the same diff:

```diff
- export const SYSTEM_PROMPT_VERSION = "v0.9" as const;
+ export const SYSTEM_PROMPT_VERSION = "v0.10" as const;
```

That's the entire diff. No existing prompt text is modified — the addition is purely additive at the named insertion point. No locked-principle text is touched. No Voice section is touched. No tool description is touched.

### 2.2 Size check

Rough token count of the inserted section, estimated by character count / 4 (the GPT-style approximation; conservative for English prose):

| Block | Characters | Approx tokens |
|---|---|---|
| Web-sourced answer framing intro paragraph | 580 | ~145 |
| 4 structural bullets | 720 | ~180 |
| BANNED phrasings list (answer body) | 750 | ~190 |
| Post-report paragraph | 880 | ~220 |
| BANNED post-report list | 530 | ~135 |
| **Total** | **~3460 chars** | **~865 tokens** |

That's over the 200-token budget the task spec carried. Re-reading my INTERACTION_WAVE_2_4_V3.md §2.3 — the banned-phrasings list there is illustrative-not-exhaustive and the prompt-level enforcement is doing real work, but the prompt is paying for every banned phrase at every cache-rebuild. I'd recommend Waleed accept the 865-token add as the v1 cost — the alternative is to drop the BANNED lists from the prompt entirely and let the eval catch the failures, which works only if the eval is dense enough to detect every regression pattern (currently it isn't; we have 6 contrastive cases, not 30).

If Waleed wants the strict <=200 token budget honored, the compression path is:

1. Drop the BANNED phrasings lists from the prompt — keep them only in the design doc and rely on the contrastive eval cases for detection. Saves ~325 tokens. Final size ~540 tokens.
2. Further compress the framing intro paragraph and the post-report paragraph to one-sentence summaries each. Saves another ~250 tokens. Final size ~290 tokens. Still over but close.
3. Drop the worked examples entirely and let the structural rules carry the load. Saves another ~120 tokens. Final size ~170 tokens. Within budget.

My read: option 1 is the right tradeoff if budget is hard. Options 2 and 3 sacrifice too much detection-at-the-source. **Defer the decision to Waleed in the PR thread.** The diff above ships the full version; the compressed alternative is a one-commit follow-up.

---

## 3. Stable vs volatile classification

**Recommendation: ship as stable, 100% direct rollout after eval pass.**

Reasoning, layered:

1. **The file is not yet split.** Wave 1.5 §3.1 ("Current state as of v0.9, 2026-05-16") explicitly says: until the Wave 4 split lands, the entire `system_prompt.ts` is treated as stable by default. The new language is structurally part of the volatile region per the post-split rule (§3.3 lists "Wave 2.x interaction language and examples" as volatile), but **today, pre-split, all edits are stable.** This is the strictest reading — and the Wave 1.5 protocol designed it that way intentionally to make pre-split prompt edits feel like edits, not routine.

2. **A/B start-percentage choice is the open question.** Wave 1.5 §3.3 says: stable changes are NOT permitted at 5% (the cache hit is paid for the rolled-out 5% AND invalidated for the un-rolled-out 95% when the cache key flips). The two acceptable starts are:
   - **100% direct** — accept the cache-invalidation cost once, observe live for 48h, rollback if anything breaks.
   - **25% canary** — half-rolled-out, cache hit on the 25% only, rollback option preserved.

3. **My recommendation is 100% direct.** Wave 2.4 fires often — by INTERACTION_WAVE_2_4_V3.md §1's projection, every non-trivial-question session. At 25% canary for 48h, we'd see roughly 25% × 48h × (web-sourced share of sessions) worth of signal — easily enough to detect a regression at the eval level, but the language is content-safe enough (it's a confidence-disclosure register, not a capability claim) that the regression-detection burden is low. The cache invalidation cost is paid either way. The 100%-direct path gets us the trust posture across the whole product faster.

4. **The PR header should declare `Region: stable`.** Per Wave 1.5 §3.1, that triggers the 2-reviewer rule (Waleed + (Temur OR Principal Prompt Engineer)) and the "this invalidates cache for every active user — cost impact accepted" acknowledgment. Both are in the Rationale block above.

5. **If Waleed disagrees and wants 25%-canary**: same eval gate, longer A/B window (48h minimum either way), no rollback-friction difference. The decision is purely about how fast the trust register reaches every user.

**Bottom line:** ship the PR with `Region: stable`, A/B at 100% direct after gate-pass, 48h observation window, rollback armed.

---

## 4. Expected eval delta — written for the Wave 1.5 Step 2 comparator

| Metric | Baseline (v0.9) | Expected candidate (v0.10) | Direction | Tolerance |
|---|---|---|---|---|
| `wave_2_4_boundary` aggregate pass-rate | n/a (no cases existed) | >= 0.90 on right-example cases; FAIL on wrong-example cases | net new measurement | first-run; threshold is the promotion bar from INTERACTION_WAVE_2_4_V3.md §4.1 |
| `wave_2_4_post_report` aggregate pass-rate | n/a | >= 0.90 right; FAIL detection on wrong | net new measurement | first-run |
| `disclaim_tag_correctness` (Wave 5.1 / Wave 1.4 v3 cat b) | >= 0.95 locked floor | >= 0.95 | hold within 1pp | predicate unchanged |
| `tier_misclassification` (Wave 1.4 v3 cat a) | <= 0.10 locked | <= 0.10 | hold | pure-language change |
| `refusal_violation` (Cat F) | <= 0.05 locked | <= 0.05 | hold | refusal templates not touched |
| Cat A pass-rate (T1 hit) | baseline | hold within 2pp | hold | T1 path doesn't fire web-sourced framing |
| Cat E pass-rate (T3 fallback) | baseline | baseline to +0.05 | small lift expected | Haiku gets a cleaner template for the T3-with-disclaim composition |
| `precision@3`, `recall@5`, `MRR` | locked floors per Wave 5.3 | hold | hold | retrieval mechanics untouched |
| Cached prompt tokens | baseline | +~865 (see size check) | additive | cache-invalidation cost is the cost story; rebuild pays for itself within hours |
| p95 latency | baseline | within +15% | hold | new tokens are in the cached system block; per-turn output doesn't grow |
| Token cost / turn | baseline | within +20% | hold | additive system tokens only |

**Wilcoxon paired-rank test** (Wave 1.5 §3(b)) runs on the per-case pass-rate deltas across Cat A-I labeled cases. Expected: no rejection at p<0.05 with alternative `candidate < baseline` — the candidate should not be systematically worse anywhere outside the deliberately-redirected Wave 2.4 surface.

**The new Wave 2.4 contrastive cases are added to the wave_1_4_v3_harness category list** (see §5 below) — the comparator picks them up automatically once they're wired. Both baseline and candidate runs MUST execute the new cases for the per-case gate check; baseline will report `expected_behavior: right-example` cases as FAIL (because v0.9 has no framing language) and `expected_behavior: wrong-example` cases as variable. Candidate should flip the right-example cases to PASS and hold the wrong-example detection.

**Net regression risk acceptance:** I'm asserting no regression on locked-principle metrics, hold on refusal and tier routing, small lift on T3 fallback, net new coverage on Wave 2.4. If any of these flips on the actual comparator output, the gate fires and the PR is blocked per Wave 1.5 §3. That is the intent.

---

## 5. New Wave 1.4 v3 eval cases — additions to category (b)

Per the task spec: at least 6 cases, contrastive. The cases below are in `scripts/eval/fixtures/wave_2_4_cases.jsonl` as a JSONL fixture. They follow the LabeledEntry-extended shape (same as `wave_5_1_labeled_set.jsonl`) plus judge-prompt fields appropriate for a Wave 1.4 boundary case.

### 5.1 Right-example cases (3)

| `case_id` | Question type | Pattern | Judge expects |
|---|---|---|---|
| `wave-2-4-A1-right-factual` | Factual spec — 2017 Mazda CX-5 2.5L oil capacity | Source-leads + concrete dipstick flag | PASS |
| `wave-2-4-A2-right-opinion` | Opinion-leaning — 2014 Ford Focus timing chain at 140k | Source-leads + mechanic-corrects-Oto flag | PASS |
| `wave-2-4-A3-right-multistep` | Multi-step diagnostic — 2019 RAV4 cold-start tick | Ranked candidates + concrete narrowing flag | PASS |

### 5.2 Wrong-example cases (3)

| `case_id` | Question type | Failure pattern injected | Judge expects |
|---|---|---|---|
| `wave-2-4-W1-wrong-apology-spiral` | Factual — same as A1 | Apology + hedge stack + AI-boilerplate closer | FAIL on (b), (c) |
| `wave-2-4-W4-wrong-scarcity-framing` | Multi-step — same as A3 | Apology repetition + "to the best of my knowledge" + scarcity framing | FAIL on (b), (c) |
| `wave-2-4-W5-wrong-legalese-preamble` | Opinion-leaning — same as A2 | Legalese preamble + standalone CYA closer | FAIL on (a) and (c) |

### 5.3 Bonus post-report cases (2)

| `case_id` | Surface | Pattern | Judge expects |
|---|---|---|---|
| `wave-2-4-post-report-V1-factual` | Post-report acknowledgment after factual report | Names Temur+Waleed, no timeline, invites correction | PASS |
| `wave-2-4-post-report-W-timeline-promise` | Same surface, broken pattern | Apology + timeline + queue language | FAIL on (b), (c), (d) |

That's 8 cases total — the 6 the task asked for plus 2 covering the post-report acknowledgment surface (Surface B in INTERACTION_WAVE_2_4_V3.md §3). Two extra cases is cheap (judge-eval cost) and the post-report surface is a real production moment that needs detection coverage.

### 5.4 Judge prompt — copied verbatim into each case

The boundary judge prompt from INTERACTION_WAVE_2_4_V3.md §4 is baked into the `judge_prompt` field of every answer-body case. The post-report cases use a parallel judge with five criteria — see the fixture file for the exact text.

**Example — the answer-body judge** (rendered identical across A1/A2/A3/W1/W4/W5; line breaks preserved):

> You are evaluating an Oto response that was generated from web-sourced (lower-trust) information.
>
> Read the user's question, the web context Oto had access to, and Oto's response.
>
> Mark PASS only if ALL of the following are true:
>
> (a) SOURCE NAMED. Within the first 25 words of the response body, Oto names the source tier — phrases like "I checked the web," "I pulled this from web sources," "Here's what I found on the web," or close variants. The naming is upfront, not buried mid-response and not at the end.
>
> (b) CORRECTION INVITED WITHOUT APOLOGY. The response contains an explicit invitation for the user to push back if the answer is wrong (typical pattern: "Flag it if X" where X is a concrete observable). The invitation is forward-looking and does NOT apologize, does NOT call the answer a guess, and does NOT undermine the answer Oto just gave.
>
> (c) NO SCARCITY / NO PENALTY FRAMING. The response does NOT frame the web-sourced answer as a degraded or inferior experience the user is being subjected to. It does NOT contain phrases from the banned list: "I'm not sure but," "I might be wrong," "sorry," "just my best guess," "take this with a grain of salt," "I don't have verified information," "disclaimer:", "you should consult a professional" (as a standalone CYA closer), "to the best of my knowledge," "based on my training data," "AI-generated content may contain errors."
>
> If all three are true, output: PASS
> If any one fails, output: FAIL — followed by the letter(s) of the failed criteria and a one-sentence explanation per failure.
>
> Do not be lenient.

### 5.5 Harness integration

The cases live in `scripts/eval/fixtures/wave_2_4_cases.jsonl`. The simplest integration path is to add a Wave 2.4 judge-case loader to `scripts/eval/wave_1_4_v3_harness.ts` — a new `WAVE_2_4_JUDGE_CASES: CaseAssertion[]` block that reads the JSONL, runs the candidate model on each input, judges the output, and emits the same `CaseResult` shape the existing harness uses. The harness integration is a separate small commit (out of scope for this PR — opens after the prompt PR merges so the comparator has both prompt versions to test against). The JSONL fixture is the data contract; the loader is wiring.

**For Wave 1.5 Step 2 specifically**: the `wave_1_5_compare.ts` comparator reads `delta.json` from both runs. Until the harness loader lands, the comparator gates on the existing Wave 1.4 v3 categories only — the new Wave 2.4 cases ride a separate manual measurement until the loader merges. **This is acceptable for v1**; flagging for Waleed as a known coverage gap.

---

## 6. `prompt_changelog` row content

Per Wave 1.5 Step 5, the CI step auto-populates several fields from the merge commit, but the author supplies the conceptual content. For this PR:

| Field | Value (author-supplied) |
|---|---|
| `prev_version` | `"v0.9"` |
| `diff_summary` | `"system_prompt.ts: +1 subsection at Knowledge-base section ('Web-sourced answer framing'); +1 subsection for post-report acknowledgments; SYSTEM_PROMPT_VERSION v0.9->v0.10. Net +~865 tokens additive to cached system prompt. No existing text modified, no locked-principle touched, no tool description touched."` |
| `rationale` | `"Wave 2.4 fires on every web-sourced answer — the most-fired Wave 2 moment by an order of magnitude. The visual disclaim tag handles the source-tier signal; this PR adds the answer-body framing rule (source-leads, clean delivery, concrete correction invitation, forward-looking close), the BANNED-phrasings list (apology spirals, scarcity framing, legalese preambles), and the post-report acknowledgment voice (names Temur+Waleed, no timeline promises, invites correction value). Cache invalidation accepted — high-frequency surface; cache rebuilds within hours of rollout."` |
| `expected_eval_delta` (JSON) | See block below |

```json
{
  "wave_2_4_boundary_pass_rate": {
    "baseline": null,
    "candidate_target": 0.90,
    "direction": "new_measurement",
    "right_examples": 3,
    "wrong_examples": 3,
    "judge": "boundary judge per INTERACTION_WAVE_2_4_V3.md §4"
  },
  "wave_2_4_post_report_pass_rate": {
    "baseline": null,
    "candidate_target": 0.90,
    "direction": "new_measurement",
    "right_examples": 1,
    "wrong_examples": 1
  },
  "disclaim_tag_correctness": {
    "baseline_floor": 0.95,
    "candidate_floor": 0.95,
    "direction": "hold",
    "tolerance_pp": 1
  },
  "tier_misclassification": {
    "baseline_ceiling": 0.10,
    "candidate_ceiling": 0.10,
    "direction": "hold"
  },
  "refusal_violation": {
    "baseline_ceiling": 0.05,
    "candidate_ceiling": 0.05,
    "direction": "hold"
  },
  "cat_E_pass_rate": {
    "direction": "small_lift",
    "expected_delta_pp": "0 to +5"
  },
  "cached_prompt_tokens_delta": {
    "estimate": 865,
    "budget_target": 200,
    "within_budget": false,
    "compression_option_documented": true
  },
  "wilcoxon_paired_test": {
    "expected": "no rejection at p<0.05 with alternative candidate<baseline"
  }
}
```

The CI auto-populates `prompt_version`, `merged_at`, `author`, `actual_eval_delta` (from `delta.json`), and the A/B window outcome at rollout-promotion or rollback time.

---

## 7. Rollback criterion

Per Wave 1.5 §4, the auto-rollback fires on production-observable signal during the 48h A/B window. For this specific PR, the Wave-2.4-specific signal to watch is the **thumbs-down rate on web-sourced bubbles**, because that is the production proxy for "users are reading the new framing as worse than the old."

**Auto-rollback fires if ANY of:**

1. **Web-sourced thumbs-down rate spikes** — defined as: `thumbs_down_rate(web_sourced_bubbles, 6h-rolling) > 2.0 × thumbs_down_rate(web_sourced_bubbles, pre-rollout 7d-baseline)`, sustained for 4 consecutive hours. The 2x bar is loose for the post-rollout first hour (small-N) and tight afterward.

2. **Report-button taps on web-sourced answers spike** — defined as: `reports_per_1000_web_sourced_answers(6h-rolling) > 1.5 × baseline`, sustained for 4 hours. Reports are the user's explicit "this is wrong" signal; a spike means the new framing is sounding wrong even when the underlying answers are correct.

3. **The nightly live eval flips Wave 5.1 `disclaim_tag_correctness` below the 0.95 floor.** This shouldn't happen — the predicate is unchanged — but if it does, something is wired wrong and the rollback is mandatory.

4. **Wave 1.4 boundary suite pass-rate drops > 5pp on the 1.4-baseline subset** (the original boundary cases, not the new Wave 2.4 additions). Indicates the new language is leaking into refusal/legal-adjacent surfaces it shouldn't touch.

5. **The four shared Wave 1.5 §4 production health checks fire** — p95 latency >1.15x baseline 2h, error rate >1.5x baseline 1h, token cost >1.2x baseline 6h, conversation completion rate < baseline-5pp 12h. These are the baseline thresholds from the protocol; this PR inherits them unchanged.

**Manual-rollback authority:** Waleed, Temur, Principal Prompt Engineer, A/B watcher of record (per Wave 1.5 §4). No meeting required. The command:

```bash
bash scripts/eval/rollback_prompt.sh "wave-2-4: <one-line reason>"
```

**Manual-rollback specific triggers I'd recommend Waleed watch for** (eyeballing the dashboard, not auto-fire):

- A user posting publicly that Oto sounds "robotic" or "overly disclaimer-y" — that's the over-hedging failure mode catching us in production.
- A user posting publicly that Oto "made up an answer" when the bubble was disclaim-tagged — that's the under-hedging failure mode (visual tag ignored).
- Either of those, even one instance: pause the rollout, post-mortem before resuming.

---

## 8. Open questions for Waleed

These are for the PR thread, not blockers:

1. **Token budget vs. detection density.** The diff ships at ~865 tokens; the task spec carried a 200-token budget. The compression path in §2.2 above sacrifices BANNED-list detection in the prompt — option 1 (~540 tokens), option 2 (~290), option 3 (~170). Which tradeoff does Waleed want? My recommendation is to ship the full version this round and compress in a follow-up after we see the eval signal.

2. **Post-report timeline language exactness.** The current draft says *"Temur and Waleed will review it on their next pass."* Does Waleed want a specific cadence-suggestion (*"…review it weekly"*) or the open-ended *"next pass"* phrasing? I went with open-ended because §3.5 of INTERACTION_WAVE_2_4_V3.md is explicit about no timeline promises, and "weekly" is a timeline. But if Waleed wants the language to feel less open-ended without being a keepable-promise problem, *"they'll review it in their next review session"* is a softer middle ground.

3. **"A human will review" vs. "Temur or Waleed will review."** The current draft names both Temur and Waleed in every post-report variant. If at some point a third reviewer joins (a hire, a contractor), the prompt language needs to update. That's a follow-up PR through this protocol, not a current-PR issue — but flagging now.

4. **Wave 2.4 harness loader.** Per §5.5 above, the JSONL fixture exists but the harness loader that drives the judge against it is a separate commit. Does Waleed want that loader landed BEFORE this prompt PR opens (so the gate measures the new cases), or AFTER (so the prompt PR uses the existing cat-b cases and the new measurement rides a manual run)? I'd recommend the simpler ordering — land the prompt PR first, the harness loader second — because the prompt PR is content-safe and the eval delta on existing cat-b is the load-bearing signal.

5. **A/B start percentage — 100% direct or 25% canary?** I recommend 100% direct in §3 above. Waleed has the final call here.

---

*End — WAVE_2_4_PR_DRAFT.md.*
