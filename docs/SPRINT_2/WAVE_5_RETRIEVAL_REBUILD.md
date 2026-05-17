# WAVE_5_RETRIEVAL_REBUILD — Signal-Calibrated Reranker Contract

**Date:** 2026-05-17 (Sprint 2 Day 11 — sprint-close Pass B, design-only)
**Owner:** RAG Optimization Specialist
**Status:** DESIGN PASS. No code/schema changes in this dispatch. Implementation defers to Sprint 3.
**Authority:** Day 8 cross-mandate flag ("fact_type weighting deferred — needs eval signal to calibrate"), Day 10 §6 open items (fact_type weighting, confidence + age envelope annotation, B0 outlier handling), `WAVE_3_DESIGN §2.2` (retrieval-layer floor + decay contract), `WAVE_3_REVIEW_RAG §4` (Cat M labeled-eval category extension to the existing A-I cascade-scoped labeled set).
**Companion docs:** `docs/SPRINT_2/WAVE_3_DESIGN.md`, `docs/SPRINT_2/WAVE_3_REVIEW_RAG.md`, `docs/SPRINT_2_DAY_8_LOG.md §2.3`, `docs/SPRINT_2_DAY_10_LOG.md §6`.

---

## §0. The contract this doc establishes

Wave 5 is the **retrieval rebuild** that replaces Day 8's MVP 2-pool reranker (`conversation_facts` at fixed base score 0.7 + `user_semantic_facts` at decay-weighted score floored 0.1 + recency tie-break + top_K=5) with a **signal-calibrated reranker** whose `fact_type` weights, recency boost, and adversarial penalty are empirically derived against a labeled Cat M eval set (memory-scoped retrieval-quality). Cat M cases are the **measurement substrate** Sprint 3 implements the reranker against. This doc is the contract those cases ratify or revise; the 5-10 starter cases shipped alongside this doc (Deliverable B) are SPEC cases — `disabled: true` until Sprint 3 implements reranker v2.

---

## §1. Current state (Day 10 EOD)

The 2-pool reranker MVP shipped in Day 8 commit `f097c0d` and was fixed in Day 8 commit `105f18e` (ReturnsValidationError on the reranker-internal `score` field; resolved via `.map(({score: _score, ...rest}) => rest)` projection at the return boundary of `getCrossConversationMemory` in `convex/oto/memoryEditing.ts` line ~1588). Subsequent Day 10 work (reinforce/retract equivalence v2 in commit `3aa3c8f`) preserved the fix through downward line-shifts in `memoryEditing.ts`.

| Aspect | Day 10 EOD state |
|---|---|
| Pool A (`conversation_facts`) | Score = `CONVERSATION_FACT_BASE_SCORE = 0.7` (fixed). No decay. |
| Pool B (`user_semantic_facts`) | Score = `decayConfidence(stored, last_reinforced, now)` (D-3.5 120-day half-life, computed via the pure function in `convex/oto/memoryDecay.ts`). Floor 0.1 applied AFTER decay in the consumer. |
| Sort | `score DESC`, then `created_at DESC` (Pool A) / `last_reinforced DESC` (Pool B) as tie-break. |
| Top-K | Caller-supplied (chat.ts dispatch uses 5). |
| Over-fetch cap | `top_K * 4 = 20` per pool. Assumes per-user live count < 50 per WAVE_3_DESIGN §7 D2. |
| fact_type weighting | **DEFERRED.** Day 8 RAG cross-mandate flag — needs eval signal to calibrate. |
| Confidence + age envelope annotation | **DEFERRED.** Day 8 RAG cross-mandate flag — envelope rendering is structurally Security's surface; Sprint 3 envelope work owes the `(confidence: 0.42, age: 87d)` annotation. |
| Adversarial-payload defense at READ | Implicit: Day 7 `sanitizeSemanticPayload` rejects at INSERT. No defense-in-depth at READ today. |
| Eval coverage | No Cat M cases exist (this dispatch creates the starter set). Day 8's 3 `cross_conv_*` cases cover positive surfacing + negative control, not reranker math. |
| Known data state | 4+ near-duplicate `communication_style` rows on test user (`md7fjepfczgwtpn0vpas2y3rrh83ggb3`); equivalence v2 prevents NEW duplicates from accumulating but pre-existing rows persist. Day 10 §6 flagged as one-time manual cleanup. |
| B0 outlier | Day 10 Memory dispatch found a "text-only / no-images" preference distinct from "terse-but-no-modality-constraint" under v2 equivalence. Acceptance: legitimately distinct. If PM wants those collapsed, that's a prompt-rule change (canonical paraphrase to Haiku), not the reranker's job. |

The Day 8 ReturnsValidationError fix is load-bearing. The reranker's internal `ScoredRow` type carries a `score` field that the public `returns` validator does not allow; any return path that re-exposes `score` will re-trigger the silent-empty-envelope failure mode. Sprint 3 reranker v2 MUST preserve the `.map` projection at the return boundary.

---

## §2. Design goals

Seven measurable goals, ordered by priority:

1. **Top-K retrieval recall ≥ 0.8** — for every Cat M case where a specific fact SHOULD surface, that fact appears in the envelope's `<recent_context>` top-K at least 80% of N=3 repeats.
2. **Negative-control precision ≥ 0.95** — for every Cat M case where NO seeded fact exists or seeded facts have been retracted, the envelope's `<recent_context>` does NOT surface phantoms / accumulated-row leakage at least 95% of N=3 repeats. (Tighter than recall because false positives are higher-cost: they steer the model toward stale/wrong context.)
3. **fact_type weighting empirically derived** — base weights for each of the 5 `user_semantic_facts.fact_type` enum values + `conversation_facts` lineage are calibrated against Cat M pass rates, NOT hand-picked by domain intuition. The initial weights in §3 are starting points; Sprint 3's tuning protocol revises them based on observed pass-rate deltas.
4. **Decay-aware** — stale rows with high stored confidence (e.g., `confidence=1.0` reinforced 240 days ago) do NOT crowd out fresh rows with moderate stored confidence (e.g., `confidence=0.7` reinforced last week). The reranker math composes decay multiplicatively with `fact_type` weight, so a 0.7 × `communication_style` (1.2 weight) at fresh decay (~1.0) beats a 1.0 × `history_anchor` (0.7 weight) at 240d decay (~0.25).
5. **Adversarial-resistant at READ** — defense-in-depth against payloads that should have been rejected at INSERT by Day 7's `sanitizeSemanticPayload` but somehow landed (admin_edit bypass, future health_monitor write path, migration backfill error). Reranker applies an `adversarial_penalty = 0` if `isAdversarialEither` (from `convex/oto/memoryEquivalence.ts`) returns true on the payload — drops the row from candidates entirely.
6. **Deterministic + eval-reproducible** — same query against same DB state returns same ordering. Tie-breaks are total-ordered (no `Map` iteration leakage, no `Set` iteration leakage). Cat M cases at REPEAT=3 should have variance = 0 from the retrieval side; any observed variance is model-side envelope-rendering variance, not retrieval variance.
7. **Latency ≤ 50ms additional per turn** — the current 2-pool reranker already meets this (single indexed scan per pool, in-process merge). Reranker v2 adds at most one multiply-and-clamp per candidate (constant factor); should remain within budget. If Sprint 3 observes >50ms p95 delta, the over-fetch cap (`top_K × 4`) is the lever to tune.

---

## §3. Reranker math v2 specification

The signal-calibrated reranker computes a unified score per candidate row from four signals: base weight (per fact_type), decay factor (D-3.5 pure function), recency boost (small advantage for recently-reinforced rows), and adversarial penalty (defense-in-depth at READ).

### §3.1 The formula

```
score(row) =
  base_weight(fact_type)
  × decay_factor
  × recency_boost
  × adversarial_penalty

clamp to [0, 1.5]
```

Each signal is composed multiplicatively; the clamp keeps the score in a bounded range so envelope-annotation (Day 8+ deferred work to render `(confidence: 0.42, age: 87d)` per fact) can show humans a legible value.

### §3.2 Base weights per fact_type

Initial values; Sprint 3 calibrates against Cat M pass rate. These are starting points NOT final.

| fact_type | Initial weight | Justification |
|---|---|---|
| `communication_style` | **1.2** | Highest. Affects EVERY response style (terse vs verbose, technical vs plain). Per-turn impact is unconditional, so the reranker should bias toward keeping these in `<recent_context>`. |
| `mechanic_preference` | **1.0** | Default. Recurring trust signal — if a user has stated mechanic preferences, they should surface when the conversation turns to service routing. |
| `service_preference` | **1.0** | Default. Recurring service signal (declines synthetic blend, prefers OEM parts, etc.) — surfaces when the conversation turns to maintenance/service. |
| `vehicle_quirk` | **0.9** | Slightly below default. Vehicle-specific facts ("pulls left when cold", "third gear hard shift in winter"). Rendered when relevant to the query; less broadly applicable than communication_style. Sprint 3 §6 open question: should this weight depend on whether the current chat is about that vehicle? Context-aware weighting is a v3 candidate. |
| `history_anchor` | **0.7** | Lowest of `user_semantic_facts`. Timeline reference ("last brake service 2026-03-14"); not always salient. Useful when the user mentions "I just did X" or asks "when did I last do X." Lower weight prevents these from crowding out preferences in non-historical queries. |
| `conversation_facts` (Pool A) | **0.5** | In-conversation context; lower weight than durable preferences because the cross-conversation memory should bias toward user-level state, not prior-conversation echoes. (Open: §6 question on whether this should scale with conversation age.) |

The weights sum to 5.3 across the 5 `user_semantic_facts` types + Pool A. The reranker does NOT normalize them (they're multiplied into the decay × recency product, not used as a softmax). The relative ratios are what matter — `communication_style` is 1.71× `history_anchor`, `vehicle_quirk` is 1.29× `history_anchor`, etc.

### §3.3 Decay factor

```ts
decay_factor = decayConfidence(row.confidence, row.last_reinforced, now)
```

Imports `decayConfidence` from `convex/oto/memoryDecay.ts` (the Day 6 pure function; 120-day half-life D-3.5; clamps output to [0, 1]; handles clock skew). For Pool A (`conversation_facts`), decay does not apply — Pool A rows are intrinsically fresh (same conversation lifetime, no multi-day horizon), so the reranker substitutes `decay_factor = 1.0` for them. This is the spiritual successor to the MVP's `CONVERSATION_FACT_BASE_SCORE = 0.7` but with `base_weight` and `decay_factor` properly separated.

The **0.1 retrieval-layer floor** still applies AFTER the full score is computed (not just after decay) — the floor is the consumer's policy choice, NOT the math's. A row whose final score is below 0.1 is dropped from candidates entirely.

### §3.4 Recency boost

```ts
const age_ms = now - row.last_reinforced;
const FRESH_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days
const recency_boost = age_ms < FRESH_THRESHOLD_MS ? 1.1 : 1.0;
```

Small +10% bump for rows reinforced in the last week. Justification: a user who restated a preference recently gets a tiny extra push to ensure it surfaces; this resists the failure mode where a 6-month-old preference (decayed to ~0.35) ranks against a fresh re-statement of the same preference (decayed to ~1.0) and the equivalence-v2 collapse failed — the recency boost makes the freshly-reinforced row a clear winner.

For Pool A, recency boost is also 1.0 (no boost) because Pool A is intrinsically fresh.

### §3.5 Adversarial penalty

```ts
import { isAdversarialEither } from "./memoryEquivalence";
const adversarial_penalty = isAdversarialEither(row.payload, row.payload) ? 0 : 1.0;
```

`isAdversarialEither` is the Day 10 Memory dispatch's helper (in `convex/oto/memoryEquivalence.ts`) that checks for the 10-entry envelope-tag forbidden list (mirrors Day 7's `sanitizeSemanticPayload` list). A row whose payload contains adversarial tag-smuggling substrings gets `penalty = 0`, which zeroes the final score and drops the row from candidates entirely (sub-floor).

This is defense-in-depth — the row SHOULD have been rejected at INSERT by `sanitizeSemanticPayload` in `recordUserSemanticFact` (Day 7 wire-in). The READ-side penalty handles:
- `admin_edit` bypass writes that didn't go through the sanitizer
- Future `health_monitor` write paths where the sanitizer may not be invoked
- Migration backfill errors that bypass mutation helpers
- Pre-Day-7 rows that were never sanitized (none currently exist, but defense-in-depth is cheap)

### §3.6 Final clamp

```ts
score = Math.max(0, Math.min(1.5, base × decay × recency × adversarial));
```

Clamp to `[0, 1.5]`. Upper bound 1.5 allows the recency-boosted `communication_style` (1.2 × 1.0 × 1.1 × 1.0 = 1.32) to exceed the unboosted max (1.2). Lower bound 0 because the adversarial penalty can drop the score to zero.

The retrieval-layer floor (0.1) is then applied: rows with `score < 0.1` are dropped from candidates before merge.

### §3.7 Final sort

```ts
candidates.sort((a, b) => {
  if (b.score !== a.score) return b.score - a.score;          // score DESC
  return b.created_at - a.created_at;                         // recency DESC tie-break
});
```

Same as MVP. Top_K = 5 caller-supplied; over-fetch cap = `top_K × 4 = 20` per pool. The `created_at` field for Pool A rows is the conversation_fact's `created_at`; for Pool B rows it's `last_reinforced` (matches the Day 8 implementation).

### §3.8 Eval-tuning protocol

Sprint 3 runs the following protocol once per weight change:

1. Set initial weights from §3.2.
2. Run all Cat M cases at REPEAT=3 (deterministic from retrieval side; variance is from model-side envelope rendering).
3. Compute per-case PASS rate. Aggregate by `fact_type` to find which type is over- or under-weighted.
4. If `fact_type X` has < 0.8 recall (i.e., its rows do NOT surface when they should), bump weight up by 0.1 and re-run.
5. If `fact_type X` has > 0.05 false-positive rate (i.e., its rows surface when they shouldn't), bump weight DOWN by 0.1 and re-run.
6. Iterate until per-fact-type recall ≥ 0.8 AND per-fact-type false-positive rate ≤ 0.05.
7. Lock weights. Add to CI: Cat M pass rate ≥ 0.9 aggregate (across all cases) on every commit.

---

## §4. Cat M labeled eval methodology

### §4.1 What is Cat M

**Cat M (memory-scoped retrieval-quality)** is the labeled-eval category that measures the reranker's ability to surface the RIGHT fact in the envelope's `<recent_context>`, NOT the cascade's ability to surface the right fact in the knowledge-base section. Cascade-scoped retrieval is categorized A-I per `RAG_WAVE_5_1_V3_CONSOLIDATED`; memory-scoped retrieval is the missing M.

Cat M cases use the existing eval runner primitives:
- `pre_seed_mutations` (Day 8): seeds competing rows into `user_semantic_facts` via the `recordUserSemanticFact` public mutation. Optional second/third seed mutations stage stale-vs-fresh `last_reinforced` differences or pre-retract rows.
- `envelope_contains` / `envelope_not_contains` (Day 8): assertion primitives over `result.trace.envelope` — the load-bearing assertion for Cat M is "the expected row is in `<recent_context>`" (envelope_contains the distinctive substring) AND "the excluded competitors are not" (envelope_not_contains those competitors' substrings).
- `text_contains` / `text_not_contains` (existing): secondary assertion when the model's RESPONSE should reflect the surfaced fact (e.g., "specialists" in `cross_conv_recent_mechanic_preference_recalled_in_chat`).
- `REPEAT` env var (Day 8): N=3 minimum for Cat M cases — retrieval is deterministic but envelope rendering order may be model-sensitive, so REPEAT exposes any non-determinism.

### §4.2 Fixture pattern

A typical Cat M case:

1. **Seed 3-5 user_semantic_facts** via `pre_seed_mutations`: a mix of fact_types, some fresh, some stale (Sprint 3 needs to add `last_reinforced` overrides — see §6), some that will be retracted before the turn runs.
2. **Trigger turn**: trivial user message ("Hey what's going on with my car") so the envelope's `<recent_context>` is the dominant signal.
3. **Assert envelope_contains** the distinctive substring of the EXPECTED winning row.
4. **Assert envelope_not_contains** the distinctive substrings of the LOSING competitors.
5. **Optional**: assert `text_contains` of a model-response token if the case tests both retrieval AND model use of the surfaced fact.

### §4.3 Scoring rigor

A Cat M case PASSES iff:
- The expected row's distinctive substring is in the envelope (top-K placement confirmed).
- ALL excluded rows' distinctive substrings are NOT in the envelope (no false positives).
- (Optional) the model's response reflects the surfaced fact via `text_contains`.

Repeats at REPEAT=3: all 3 must pass for the case to be marked PASS (consistent with the existing `_doc` field's `REPEAT` semantics).

### §4.4 Statistical handling

Retrieval is deterministic from the reranker side. Any observed variance at REPEAT=3 is from one of three sources:
1. **Model-side envelope-rendering variance**: Haiku occasionally truncates the envelope or re-orders sections at randomization in tool_use response. Mitigation: REPEAT=3 exposes this; if a case fails 1/3 attempts, the variance is real and the case needs sharpening (more distinctive substrings, less ambiguous fixtures).
2. **Pre-existing test-user pollution**: as Day 8 §3.3 caveat noted, the test user has 13+ accumulated `user_semantic_facts` rows from prior smoke tests. Cat M fixture isolation requires the Day 11 PM mechanical cleanup hook (currently being developed in parallel with this dispatch) OR per-case bulk-retract via the future `retractAllForUserSemanticFacts` mutation flagged in §7 cross-mandate implications.
3. **Migration / equivalence-v2 collapse**: if a seed mutation's payload accidentally collapses with an existing row (Day 10 equivalence v2 threshold 0.6), the seed reinforces instead of inserts — and the test's expected state may diverge from actual DB state. Mitigation: use distinctive-by-design payload strings in Cat M cases (e.g., `"User strongly prefers terse single-sentence responses with no preamble whatsoever (cat-m-seed)"` rather than `"User prefers terse"`).

---

## §5. Implementation plan (Sprint 3)

Five steps, sized for one RAG Specialist dispatch.

**Step 1: Author 20-30 Cat M cases.** This dispatch ships 5-10 STARTERS (Deliverable B) marked `disabled: true` because reranker v2 isn't implemented yet. Sprint 3 first task: author the remaining 10-20 cases covering the full fact_type matrix + edge cases (decay boundary, recency boundary, adversarial-at-read, top_K cap, sub-floor drop).

**Step 2: Implement reranker v2 in `convex/oto/memoryEditing.ts:getCrossConversationMemory`.** Add a `BASE_WEIGHT_BY_FACT_TYPE: Record<string, number>` const at module scope. Compute `score` per §3.1 formula. Preserve the Day 8 `.map(({score: _score, ...rest}) => rest)` projection at the return boundary — this is load-bearing. Add `isAdversarialEither` import from `./memoryEquivalence`.

**Step 3: Tune weights against Cat M pass rate.** Run the §3.8 eval-tuning protocol. Settle weights when per-fact-type recall ≥ 0.8 AND per-fact-type FP rate ≤ 0.05. Record the final weights in a code comment with the calibration table (mirror the Day 10 equivalence-v2 threshold calibration table pattern).

**Step 4: Add Cat M to CI.** Update `scripts/ci/vehicle-facts-grep.sh` or add a new `scripts/ci/cat-m-eval.sh` that runs `CASE_FILTER="cat_m_" REPEAT=3 npx tsx scripts/eval/runs/_run-eval-cases.ts` and fails the build if aggregate pass rate < 0.9. (This requires the runner to exit non-zero on pass-rate-below-threshold, which it does NOT do today — runner currently always exits 0. Sprint 3 also needs to add a `EVAL_FAIL_THRESHOLD` env var to the runner.)

**Step 5: Deprecate fixed-base-score MVP.** Once Cat M pass rate ≥ 0.9 in CI for 7 consecutive days, remove the `CONVERSATION_FACT_BASE_SCORE = 0.7` const and the per-row `score: CONVERSATION_FACT_BASE_SCORE` assignment in `memoryEditing.ts` Pool A. The new formula handles Pool A via `base_weight = 0.5` × `decay_factor = 1.0` × `recency_boost = 1.0` × `adversarial_penalty = 1.0` = 0.5. Verify CI stays green on the deprecation commit.

---

## §6. Open questions / design checkboxes

Surfaced for PM review before Sprint 3 dispatch. Each defaults to a recommended answer; PM may revise.

1. **Context-aware vehicle_quirk weighting.** Should `vehicle_quirk` weight depend on whether the current chat is about that vehicle? E.g., a quirk for vehicle A should not surface when the chat is about vehicle B. Currently the `getCrossConversationMemory` query already scopes by user_id but does NOT scope by current chat's vehicle. Recommend: add `vehicle_id` to the args, filter `user_semantic_facts` by `vehicle_id == current OR vehicle_id == undefined` (user-level facts always surface; vehicle-scoped facts only if matching). v2 fold-in.

2. **conversation_facts weight scaling with conversation age.** Should `conversation_facts` weight depend on whether the source conversation is in-progress or concluded? In-progress (likely within last 24h, perhaps same day) might warrant 0.8 weight; concluded (>7 days old) drops to 0.5. Recommend: defer until Sprint 3 telemetry shows whether this distinction materially affects pass rate.

3. **Retracted-then-reinforced facts.** A user who retracts a preference and then re-states the same preference creates a row pattern: original retracted_at set; new row inserted (under equivalence v2, this collapses iff Jaccard ≥ 0.6). If they collapse, the row gets reinforced (confidence asymptotes back toward 1.0). If they don't collapse, two rows exist — one retracted, one fresh. The reranker handles both transparently (retracted rows are filtered out by `by_user_active` index; fresh row scores normally). Open question: should a "re-stated" fact (i.e., a row whose `observation_count > 1` AND whose payload is paraphrased equivalent of a retracted row) get a special weight? Semantic significance: user took it back, then put it back. Recommend: NO — observation_count is already a reinforcement signal; bolting on retraction-history weighting is premature optimization.

4. **Per-user fact_type weights.** Some users may emphasize vehicle quirks heavily ("car person" archetype) while others emphasize communication style ("just give me the answer" archetype). Should fact_type weights be user-personalized via observation? Recommend: NO for Sprint 3. Per-user weights are a Sprint 5+ research project; v3 substrate ships with global weights.

5. **Per-turn weighting (engagement-aware decay).** Should decay penalty intensify when the user hasn't engaged with a topic recently? E.g., a `vehicle_quirk` mentioned in conversation 6 months ago and never re-referenced decays faster than the D-3.5 120-day half-life. Recommend: NO for Sprint 3. The existing decay function handles this via `last_reinforced` — if the user re-engages, the helper bumps `last_reinforced` to now. If they don't, the decay does its job. Adding engagement-aware decay adds state that the Memory Engineer would have to provision and the reranker would have to query, increasing per-turn op count.

6. **Cross-vehicle fact aggregation.** A user with multiple vehicles may have conflicting preferences (e.g., "I prefer dealership service for the BMW" and "I prefer independent shop for the Honda"). Should the reranker surface BOTH when the chat doesn't mention a specific vehicle? Currently `vehicle_id` scoping is at the query layer (see #1 above). Recommend: surface user-level facts (vehicle_id undefined) regardless; surface vehicle-scoped facts ONLY when the current chat's vehicle matches. Cross-vehicle aggregation is out-of-scope (the user explicitly didn't ask "which vehicle should I take to the dealership").

7. **Cat M fixture isolation strategy.** The Day 11 PM mechanical cleanup hook (in parallel with this dispatch) is the v1 isolation primitive. Sprint 3 may need a tighter per-case teardown: after each Cat M case, bulk-retract all `user_semantic_facts` rows seeded by `pre_seed_mutations`. This requires either (a) a `retractAllForUserSemanticFacts` mutation that takes a payload-substring filter, or (b) a fixture-tag column on `user_semantic_facts` that the cleanup hook can target. Recommend: (a) is the smaller change; flag for Sprint 3 Memory Engineer dispatch.

---

## §7. Cross-mandate implications

**Memory Engineer.** Bulk-retract test helper (Day 11 PM mechanical) enables Cat M fixture isolation. Sprint 3 may need a tighter primitive (§6 #7 — `retractAllForUserSemanticFacts` with payload-substring filter) for per-case teardown. Also: the §3.5 adversarial-at-READ penalty imports `isAdversarialEither` from `memoryEquivalence.ts`; this couples Wave 5 to Memory's existing module, which is acceptable but should be documented in the dispatch contract.

**Prompt Engineer.** The `<recent_context>` render format may need annotation per Day 8 cross-mandate flag: `(confidence: 0.42, age: 87d)` per fact. Sprint 3 envelope work owes this; the reranker provides the `effective_confidence` and the age can be computed at envelope-render time from `last_reinforced`. The envelope renderer is in `convex/oto/envelope.ts` (currently does not consume `effective_confidence` per Day 8 §2.3 note).

**Security Analyst.** Weight calibration MUST NOT enable PII inference attacks. Specifically: if `mechanic_preference` weight is set very high (e.g., 1.5), a malicious actor who can write user_semantic_facts (admin_edit bypass) could surface a target user's mechanic relationships across all conversations. Mitigation: Wave 7.3 read-rate-limit (already shipped Day 10) caps the surface; weights cap at 1.2 per §3.2 to bound the inference gain per row. Security to confirm.

**QA Lead.** Cat M cases ride alongside golden cases in the runner; same primitives (`pre_seed_mutations`, `envelope_contains`, REPEAT). Per Day 11 dispatch, the cross-conv fixture-isolation cleanup hook PM is shipping in parallel covers Cat M as well. QA to confirm the hook's targeting strategy works for the larger Cat M case-count Sprint 3 will introduce (20-30 cases vs the existing 3 `cross_conv_*`).

---

## §8. Out of scope

- **Wave 6 deterministic router.** Separate wave; routes user queries to scenarios/tools based on classifier signals. Not retrieval.
- **Multi-language fact_type handling.** All Cat M cases assume English. Non-English Cat M is Sprint 5+ scope.
- **Cross-user fact aggregation.** A user's facts MUST NOT surface to other users (per WAVE_3_REVIEW_RAG §2.5 — the per-user-PII isolation guard). This is enforced at the query layer (`by_user_active` index scopes by user_id) and Wave 7.3 (read-rate-limit). Wave 5 reranker MUST NOT add a code path that crosses this boundary.
- **Wave 5+ KB integration via `kb_topics.retrieval_priority`.** Per WAVE_3_REVIEW_RAG §2.5, `kb_topics` lands inert in Wave 3 and wires into Tier 2 ranking only in Wave 5+. Wave 5 IS that integration but it's a separate Sprint 3+ dispatch from the memory-scoped reranker described here.
- **Envelope token budget.** WAVE_3_REVIEW_RAG §5 #3 flagged the 60/20/20 split between conversation_facts / user_semantic_facts / conversation_audit recent-history. This is the Context Engineering Specialist's mandate, not the reranker's. The reranker outputs top_K=5 rows; the envelope renderer decides budget allocation.

— End of WAVE_5_RETRIEVAL_REBUILD.
