# WAVE_3_REVIEW_QA — QA-side resolutions for the 5 [REVIEW: QA] flags

**Date:** 2026-05-16
**Owner:** AI QA & Evaluation Lead (subagent, Doc 3 §6)
**Status:** REVIEW DOC. No code, schema, or design changes in this dispatch.
**Authority:** `docs/SPRINT_2/WAVE_3_DESIGN.md` §2 (the 5 QA flags), `docs/SPRINT_0/QA_WAVE_1_4_V3.md` (Wave 1.4 v3 chartered categories a–f), Doc 3 §6, Wave 1.5 §3 graduation-bar floors.

---

## §1. Orientation

This doc resolves the **5 [REVIEW: QA] flags** the Memory Systems Engineer surfaced in `WAVE_3_DESIGN.md` §2 (one flag per table: `conversation_facts`, `user_semantic_facts`, `conversation_episodic_control`, `conversation_audit`, `kb_topics`). Each flag asks a design-time question about case **shape**, **assertion pattern**, or **threshold** that affects whether the Memory Engineer's helper/schema decisions are eval-defensible.

Readers:
- **Memory Engineer (Day 3+)** — to confirm that the eval-side answers don't require helper-body changes beyond what's already in the Day 2 PM-lean dispatch.
- **Eval-cases dispatch (Day 4)** — to use this as the case-spec prior for the 5 mandatory Wave 3 cases (memory_retract_no_steer, decay_function_correctness, commit_control_static_check, prompt_version_stamping_present, kb_topic_invention_rejected) plus the case-category extensions proposed in §3.

Out-of-scope:
- **No actual eval-case JSON.** That is Wave 3 Day 4, dispatched separately. This doc commits to case **shape**, **threshold**, **N**, and **assertion patterns** only — the JSONL/case-asssertion-factory wiring is Day 4's deliverable.
- **No design-doc edits.** Memory Engineer's design is accepted as-shipped; this is the QA-side overlay.
- **No new Wave 1.5 graduation-bar floors.** The 7 floors (precision@3, recall@5, MRR, tier_misclass, disclaim_correct, under_disclaim, refusal_violation) are unchanged.

---

## §2. Per-flag resolutions

### §2.1 — `conversation_facts` retract eval (`WAVE_3_DESIGN.md` §2.1, line 127)

**Flag verbatim:**
> `[REVIEW: QA]` — Eval case shape: multi-turn scenario where a fact is appended, retracted next turn, and the third turn asserts the retracted fact no longer steers (Doc 3 §6 second challenge).

**Eval-side concern.** This is the **memory-behavior** eval (Doc 3 §6 second challenge): the helper layer says "soft-retract sets `retracted_at`," but the load-bearing property is that the next turn's reasoning loop **does not consider the retracted fact when constructing working memory**. That is a behavioral assertion on the read path (`by_conversation_active` with `q.eq("retracted_at", undefined)`), not just a mutation assertion on the write path. If the read path queries `by_conversation` without the `retracted_at` filter, the helper's append-only discipline is correct AND the user-visible behavior is wrong — exactly the kind of two-sides-mismatch bug v3 is built to catch.

**Resolution.**
- **Case shape:** Three-turn synthetic conversation. Turn 1: chat agent records a fact (e.g., `preference: closest mechanic`). Turn 2: agent retracts via `retractConversationFact(reason: "user changed mind")`. Turn 3: agent receives a query whose decision branches on that preference. Assertion: the turn-3 system-prompt assembly contains zero references to the retracted fact AND the turn-3 response does not cite/imply it.
- **Assertion pattern:** Hybrid — programmatic on prompt-assembly (`expected_working_memory_excludes_fact_id: <fact_id>`) + LLM-judge on the response body (binary: "does the response use the preference?"). Two-stage to defend the seam: programmatic catches the read-path filter regression; judge catches a prompt that includes the fact but is told to ignore it (which would still violate the working-memory contract).
- **Threshold + N:** **≥95% N=10.** Mirrors cat-C report-flow shape (≥95% deterministic on the programmatic stage, ≥90% on the judge stage; the case fails iff EITHER stage fails). The retract operation is deterministic so the programmatic stage is structurally ≥99%; the judge stage admits the LLM-nondeterminism floor of ≥90% from Wave 1.4 boundary cases.
- **Acceptable false-positive rate:** `under_steering ≤ 0.02` (≤2% of repeats may falsely steer despite the retract). Same envelope as `under_disclaim` from the graduation-bar floors — same brand-risk class (silent over-confidence on stale state).
- **Analog in Wave 1.4 v3:** Mirrors cat-C `report-c-001` shape (multi-step write, then query against the resulting DB state) **plus** cat-(f) judge gating (the prose-side check). Closest hybrid in the existing harness is `disclaim-b-005` (programmatic predicate + UI-render check).
- **Reversal cost.** Low. New case category in §3 (cat-`g`); helper untouched.

---

### §2.2 — `user_semantic_facts` decay eval (`WAVE_3_DESIGN.md` §2.2, line 239)

**Flag verbatim:**
> `[REVIEW: QA]` — Decay eval case shape: insert a fact at simulated `last_reinforced = now - 240_days`; assert effective_confidence ≈ 0.25 (two half-lives); reinforce; assert it jumps to ~0.875. Confirms the function compounds correctly.

**Eval-side concern.** The D-3.5 decay function is a **pure function** (`decayConfidence(confidence, lastReinforced, now)`) but it is the load-bearing math behind the retrieval reranker (Wave 5). A 1-line typo (e.g., `* 120` vs `/ 120`, `Math.log` vs `Math.LN2`, day-ms vs hour-ms) silently breaks every personalization downstream. Pure-function unit tests in `memoryDecay.test.ts` cover the math; the eval case covers the **integration** — that the stored confidence is what's reinforced, the reinforced confidence is what the next decay computes against, and the reinforcement formula `1 - (1 - c) * 0.5` is asymptotically idempotent.

**Resolution.**
- **Case shape:** Programmatic. Three sub-cases in one assertion:
  1. **Decay correctness.** Insert `user_semantic_facts` row with `last_reinforced = now - 240d, confidence = 1.0`. Read via the retrieval path. Assert `effective_confidence ∈ [0.24, 0.26]` (two half-lives = `1.0 * 0.5^2`).
  2. **Reinforce-then-decay.** Same row; call `reinforceUserSemanticFact`. Assert `confidence` jumps to `1 - (1 - 0.25) * 0.5 = 0.625` stored. Then simulate read at `now + 120d` (one more half-life). Assert `effective_confidence ∈ [0.31, 0.32]`.
  3. **Floor.** Insert row with `last_reinforced = now - 3600d` (10 years). Assert `effective_confidence == 0.1` (floored), not `~0`.
- **Assertion pattern:** Fully programmatic. Reuses the same `passRateWithConfidence` Wilson 95% CI utility as cat-(a–e). New assertion field `expected_confidence_in_range: [number, number]` (see §4).
- **Threshold + N:** **≥99% N=10.** This is pure-math correctness, not behavior — variance comes only from clock skew during the test, which a 0.01 epsilon (0.24, 0.26) absorbs. The graduation-bar floor for `tier_misclass` is `≤0.10`; this case's failure mode (decay-math-broken) is in the same tier-misroute category since wrong decay → wrong rerank → wrong tier. **N=10 is sufficient** (no LLM judge, no API jitter).
- **Acceptable false-positive rate:** 0% drift on the decayed-floor case (sub-case 3 must be 10/10); ≤1% on sub-cases 1+2 (the time-arithmetic admits 1 cycle of clock-drift if the test happens at a 120-day boundary).
- **Analog in Wave 1.4 v3:** No direct analog — this is closer to a `metrics.test.ts` unit-test pattern than a chat-cascade case. Closest is cat-(a) `tier-a-001` (deterministic, no judge, programmatic on a known-good fixture). Suggest authoring it as **both** a unit test in `convex/oto/memoryDecay.test.ts` (covers the function) **and** an integration case in the harness (covers the storage round-trip).
- **Reversal cost.** Low. Pure additive; helper untouched if the existing `reinforceUserSemanticFact` formula matches the design's stated `1 - (1 - c) * 0.5`. If the helper formula differs, that's a design-doc bug, not a QA-side issue.

---

### §2.3 — `conversation_episodic_control` field-class write-authority (`WAVE_3_DESIGN.md` §2.3, line 358)

**Flag verbatim:**
> `[REVIEW: QA]` — Boundary-eval case (D-3.8): assert that a `commitControl` call from a model-driven path fails CI (the model never touches control state). Test the field-level write-authority by static analysis, not just runtime.

**Eval-side concern.** This is a **CI-level static-analysis check**, not a runtime eval case. The Memory Engineer's helper splits `commitEpisodic` and `commitControl` to enforce the field-class boundary at code-review time. A model-driven path (anywhere a `chat_agent` `written_by` value is set, or any call from `convex/oto/chat.ts`, or any path that the reasoning loop invokes) **must not** import `commitControl`. The defensible test is grep-style, identical to the existing 11 CI rules — NOT a runtime case in the harness, because runtime can only test that a wrong call **fails**; static can test that the wrong call **doesn't exist anywhere in the source**.

**Resolution.**
- **Case shape:** **Two-pronged.** (A) CI grep rule (Rule 16 from the design doc §4 — already proposed by Memory Engineer; this confirms the QA-side concurs). (B) Optional secondary runtime case: instantiate a mock model-driven path, attempt `commitControl`, expect throw. The CI rule is load-bearing; the runtime case is a defense-in-depth nicety.
- **Assertion pattern:** CI rule (existing pattern from `scripts/ci/vehicle-facts-grep.sh`). The runtime case (if authored) uses programmatic `expected_throw_code: "WRITE_AUTHORITY_VIOLATION"`.
- **Threshold + N:** **CI rule fires on any violation (0 tolerance).** Same semantics as Rule 12 (`conversation_audit` strict append-only). For the runtime case: **≥99% N=10** — the throw is structural, deterministic; N=10 is statistical floor.
- **Acceptable false-positive rate:** 0% on the CI rule (any hit fails the build). 0% on the runtime case (any non-throw fails the eval).
- **Analog in Wave 1.4 v3:** Closest is cat-(e) `audit-e-005` (non-admin attempts verify, asserts throw). This is the same shape: a privilege-boundary check enforced at the helper.
- **Reversal cost.** Zero on the CI rule (Memory Engineer already proposed it). Low on the runtime case (Wave 3 Day 4 case spec).

**Stronger concur:** I endorse the design's Rule 16 verbatim. The runtime-case overlay is recommended but not blocking — if Day 4 dispatch runs out of time, the CI rule alone closes the gap.

---

### §2.4 — `conversation_audit.prompt_version` stamping (`WAVE_3_DESIGN.md` §2.4, line 442)

**Flag verbatim:**
> `[REVIEW: QA]` — `prompt_version` stamping is the Wave 1.5 protocol's substrate. Eval harness must read by `by_prompt_version` to compute per-version pass-rate deltas. Confirm the index shape.

**Eval-side concern.** Wave 1.5's prompt-change protocol (the graduation-bar gate) is "every prompt-version transition must show no regression on the 7 graduation-bar floors via the harness." The harness computes per-version pass rates **from `conversation_audit`** by filtering on `prompt_version`. If `prompt_version` is `v.optional()` and the turn loop forgets to stamp it on some path, the per-version delta is incomputable and the Wave 1.5 gate becomes advisory rather than enforceable. The QA concern is twofold: (1) stamping is **structurally complete** (every assistant turn has a non-null `prompt_version` in production); (2) the index `by_prompt_version` returns the right shape for the harness's per-version-aggregation query.

**Resolution.**
- **Case shape:** **Two cases.**
  1. **Stamping completeness.** Programmatic. Sample 50 recent assistant-role rows in `conversation_audit`; assert `model_used !== undefined && prompt_version !== undefined` on **all 50**. Failure mode: a non-stamped row reveals a turn-loop bug where some path skips the `recordTurn` envelope-options.
  2. **Index correctness.** Programmatic. Seed 30 assistant rows split across 3 prompt versions (10 each). Query `by_prompt_version` for one version; assert exactly 10 rows returned, all with the queried version. Asserts the index shape matches the harness's expected access pattern.
- **Assertion pattern:** New assertion shape `expected_audit_rows_written: N` (see §4) for the seeding case; existing programmatic-equality for stamping.
- **Threshold + N:** **≥99% N=10** on stamping (any miss is a turn-loop bug); **≥99% N=10** on index correctness (structural). The Wave 1.5 graduation-bar protocol depends on this; **N=20** is acceptable if Day 4 wants a tighter Wilson CI on stamping (~93%–100% at 19/20 vs 89%–100% at 10/10).
- **Acceptable false-positive rate:** 0% on completeness (a single un-stamped row breaks the Wave 1.5 gate); 0% on index correctness.
- **Analog in Wave 1.4 v3:** Closest is cat-(e) `audit-e-001` (mutation writes an audit row with the right fields). Same shape: assert the audit-row envelope is structurally complete.
- **Reversal cost.** Low. New case category in §3 (cat-`h`). The `prompt_version: v.optional()` is locked by the design; QA reads it as "optional at schema level, required by convention on assistant turns, enforced at the helper layer." If Memory Engineer disagrees on the enforcement seam, the resolution is to **make `prompt_version` required at the helper-arg layer** on assistant-role inserts — design-doc-level change, not a QA decision.

---

### §2.5 — `kb_topics` invention-rejection (`WAVE_3_DESIGN.md` §2.5, line 519)

**Flag verbatim:**
> `[REVIEW: QA]` — Eval case: assert that the reasoning loop cannot invent a topic (a write that doesn't match an existing `topic_id` is rejected at the helper layer). Boundary-adherence category.

**Eval-side concern.** This is a **boundary-adherence** case in the strict Wave 1.4 sense: the reasoning loop is trying to do something it should not (write a free-string topic instead of referencing a registered `topic_id`). The brand-killer failure mode is the model inventing `"oil_capacity_qts"` parallel to the existing `"oil_capacity_quarts"` — fragmenting the KB silently. The defense is helper-layer rejection: any insert into `vehicle_facts.topic_id` (Wave 5+ migration target) or `vehicle_facts.topic` (Wave 3 strangler period) that does not match a registered `kb_topics.topic_key` is thrown.

**Resolution.**
- **Case shape:** Programmatic. Two sub-cases:
  1. **Invention rejected.** Attempt to write a `vehicle_facts` row with `topic_id = <non-existent-id>` (or with `topic = <free-string-not-in-kb_topics>` during the strangler window). Assert: helper throws `TOPIC_NOT_REGISTERED`. No fact row written.
  2. **Registered topic accepted.** Seed `kb_topics` with `("oil_capacity_quarts", "fluids")`. Write a `vehicle_facts` row referencing it. Assert: succeeds.
- **Assertion pattern:** Programmatic. New assertion field `expected_throw_code: string` (see §4); reuses existing `expected_fact_substrings` for the success path.
- **Threshold + N:** **≥99% N=10** on rejection (structural; same envelope as cat-(e) `audit-e-005`); **≥99% N=10** on acceptance. Boundary cases run at the strictest threshold because the Wave 1.5 floor `refusal_violation ≤ 0.05` covers the inverse (false refusal); the QA-side concern here is the *true-refusal* axis (model-side discipline), which should be ≥99% deterministic.
- **Acceptable false-positive rate:** 0% on rejection (any accepted invention is a P0). 0% on acceptance (any false rejection breaks legitimate writes).
- **Analog in Wave 1.4 v3:** Closest is cat-(e) `audit-e-005` (auth-throw on unauthorized actor) and the broader Wave 1.4 boundary suite (out-of-scope refusal). This is a **helper-layer** boundary, not a **prompt-layer** boundary, which is why it's programmatic and not LLM-judge-based.
- **Reversal cost.** Low. New case category in §3 (cat-`i`) OR fold into the existing `g` (memory-write-discipline) category — see §3.

**Stronger concur:** The reasoning loop **must not** have a code path that writes a free-string topic into `vehicle_facts.topic`. The strangler window (`vehicle_facts.topic` free string ↔ `vehicle_facts.topic_id` FK, per design doc §3.2) is the risky surface. CI Rule 17 from the design doc is necessary but not sufficient — it greps for `ctx.db.insert("kb_topics"` outside the helper, but does NOT catch a Haiku tool that writes a `recordVehicleFact` with an unregistered `topic` string. Recommend: **extend `recordVehicleFact` in `vehicleFactsEditing.ts` to validate `topic` against `kb_topics`** once the seed list ships. Until then (Wave 3 ships seed, Wave 5 cuts over), the case is shape-defined but **mock-only** — flag for Day 4 dispatch to confirm the helper boundary is testable.

---

## §3. Proposed new Wave 1.4 case categories for Wave 3

Wave 1.4 v3 currently runs cats `a` (tier routing), `b` (disclaim render), `c` (report flow), `d` (cross-tenant), `e` (audit-log invariant), `f` (Wave 2.4 answer-body judge). Wave 3 introduces three new behavioral surfaces that need their own cat letters. Categories are scoped tight — each covers one read/write seam with 3–5 cases.

### Category (g) — Memory write-discipline cases

**Purpose.** Verify that the helper layer rejects illegal writes to the five Wave 3 tables (write-authority, write-source legality matrix, topic invention). Mirrors the spirit of cat-(e) audit-invariant but extends to the Wave 3 memory substrate.

**Threshold + N:** ≥99% N=10. Boundary-class — structural rejection should be 10/10 by construction.

**Helpers / read-paths exercised:** `memoryEditing.ts::{recordConversationFact, recordUserSemanticFact, retractConversationFact}`, `episodicControlEditing.ts::{commitEpisodic, commitControl}`, `kbTopicsEditing.ts::{registerKbTopic}`, `vehicleFactsEditing.ts::recordVehicleFact` (for §2.5 topic-validation path).

**Case sketches (3–5):**
- `g-memwrite-001 commit_control_static_check` — model-driven path attempts `commitControl`; CI rule fires (static); runtime throws `WRITE_AUTHORITY_VIOLATION`. (Resolves §2.3.)
- `g-memwrite-002 kb_topic_invention_rejected` — `recordVehicleFact` with unregistered topic string; helper throws `TOPIC_NOT_REGISTERED`. (Resolves §2.5.)
- `g-memwrite-003 source_writer_legality_matrix` — `recordUserSemanticFact({source: "mechanic_confirmed", written_by: "health_monitor"})`; helper throws `SOURCE_WRITER_ILLEGAL` (per the design doc §7 open question 3 once Waleed rules — fix the matrix before this case can land cleanly).
- `g-memwrite-004 retract_idempotency` — call `retractConversationFact` twice on the same row; first succeeds, second throws `ALREADY_RETRACTED` (or no-ops, per Memory Engineer's helper choice). Asserts the retract-triple is write-once.
- `g-memwrite-005 episodic_control_turn_mismatch` — call `commitEpisodic(conversationId, delta, expectedTurn: N)` when `updated_by_turn = N+1`; helper throws `TURN_COUNTER_MISMATCH`. Asserts the concurrency envelope.

### Category (h) — Forensic-completeness cases

**Purpose.** Verify that `conversation_audit` is structurally complete on every assistant turn (`model_used`, `prompt_version` stamped; `tool_calls` envelope shape correct when present). The Wave 1.5 prompt-change protocol depends on this; cat-(h) is the safety-net.

**Threshold + N:** ≥99% N=10 (≥99% N=20 acceptable for Day 4 if they want tighter CI on stamping). Structural — completeness should be near-100%.

**Helpers / read-paths exercised:** `conversationAuditEditing.ts::recordTurn` (write side), the turn loop in `chat.ts` (caller side), `by_prompt_version` and `by_conversation_turn` indices (read side).

**Case sketches (3–5):**
- `h-forensic-001 prompt_version_stamping_present` — sample 50 assistant rows; assert 50/50 have non-null `prompt_version` AND `model_used`. (Resolves §2.4 case 1.)
- `h-forensic-002 by_prompt_version_index_correctness` — seed 30 rows across 3 versions; query `by_prompt_version` for one; assert exactly 10 returned. (Resolves §2.4 case 2.)
- `h-forensic-003 tool_calls_envelope_shape` — write a turn with `tool_calls: [{name, input, output}]`; read back; assert the structured envelope round-trips. (Catches a Convex codec drift on `v.any()` payloads.)
- `h-forensic-004 conversation_audit_strict_append_only` — attempt `ctx.db.patch` on a `conversation_audit` row outside the helper; assert it fails CI grep (Rule 12) AND throws at runtime. (Covers the D-3.2 hill structurally.)

### Category (i) — Asymptotic-reinforcement + decay cases

**Purpose.** Verify the `user_semantic_facts` decay/reinforce math is correct end-to-end (storage round-trip, not just the pure function). Closest to a pure-math test but in the harness shape so per-PR delta picks up regressions.

**Threshold + N:** ≥99% N=10. Pure math — no LLM, no API jitter. Failures imply a code bug, not flake.

**Helpers / read-paths exercised:** `memoryEditing.ts::{recordUserSemanticFact, reinforceUserSemanticFact}`, `memoryDecay.ts::decayConfidence`, and the Wave 5 reranker's consumption path (once it lands; placeholder for now).

**Case sketches (3–5):**
- `i-decay-001 decay_function_two_half_lives` — insert at `last_reinforced = now - 240d, confidence = 1.0`; assert `effective_confidence ∈ [0.24, 0.26]`. (Resolves §2.2 sub-case 1.)
- `i-decay-002 reinforce_then_decay_compounds` — same row; reinforce; advance 120d; assert `effective_confidence ∈ [0.31, 0.32]`. (Resolves §2.2 sub-case 2.)
- `i-decay-003 decay_floor_at_0_1` — insert at `last_reinforced = now - 3600d`; assert `effective_confidence == 0.1` exactly (or within `0.1 ± 0.001`). (Resolves §2.2 sub-case 3.)
- `i-decay-004 reinforce_asymptotic_idempotence` — call `reinforceUserSemanticFact` 10 times on a fresh row (`confidence: 1.0`); assert final `confidence ∈ [0.999, 1.0]` (asymptote, never exceeds 1.0). Catches a `+=` typo where reinforcement would clamp incorrectly.
- `i-decay-005 cross_conversation_persistence` — insert a `user_semantic_facts` row in conversation A; read it in conversation B (same user); assert it's returned by `by_user_active`. (Confirms the cross-conversation property the table is designed for.)

**Total new cases:** ~13. Day 4 dispatch authors them; this doc commits to the shape but not the JSONL/factory wiring.

---

## §4. Assertion-pattern extensions to `LabeledEntry`

The current `LabeledEntry` interface (`scripts/eval/lib/cascadeClient.ts:47`) supports `expected_source_tier`, `expected_render_tag`, `expected_fact_substrings`. Wave 3 cases need 4 new optional assertion fields, none of which conflict with existing usage:

```typescript
export interface LabeledEntry {
  // ... existing fields ...

  // Wave 3 extensions (all optional; existing cases unaffected):

  /** Cat-(h)-001 / Cat-(g): count of audit rows expected after the test. */
  expected_audit_rows_written?: number;

  /** Cat-(i): tolerance window for decayed confidence. [min, max] inclusive. */
  expected_confidence_in_range?: [number, number];

  /** Cat-(g): for negative-path cases, the error code the helper should throw. */
  expected_throw_code?: string;

  /** Cat-(g) §2.1: working-memory exclusion check for retracted facts. */
  expected_working_memory_excludes_fact_id?: string;
}
```

**Rationale.** Each new field corresponds to one assertion pattern surfaced by exactly one (sometimes two) of the 5 QA flags. Optional means zero migration cost — existing cat-(a–f) cases compile and run unchanged. The harness-side change is in the new cat-(g/h/i) case factories that read these fields; the `cascadeClient` mock-mode shim adds matching fields to `CascadeResponse` (`actual_audit_rows_written: number`, `actual_confidence: number`, `actual_throw_code?: string`, `actual_working_memory_fact_ids: string[]`). This is the same pattern cat-(a–e) used to extend the original Wave 1.4 schema for v3.

---

## §5. Threshold rationale

The Memory Engineer's design defaults to **≥95% N=10** (matching Sprint 1 Day 7 patterns). Wave 3 needs **mostly tighter, not looser**:

- **≥95% N=10** is correct for cat-(g) §2.1 (`memory_retract_no_steer`) — the only Wave 3 case with an LLM-judge stage. ≥95% admits the model-nondeterminism floor on the judge sub-assertion. Cat-C report-flow's ≥95% threshold is the same envelope.
- **≥99% N=10** is recommended for the other 12 cases (cat-(g) §2.3, §2.5, retract idempotency, turn-mismatch; cat-(h) all 4 cases; cat-(i) all 5 cases). Reasoning: these are **structural / pure-math** — no LLM judge, no API jitter, no Convex cold-start surface beyond the live-mode infrastructure already covered by the Sprint 1 budget. Failures imply code bugs.
- **N=20** is acceptable but not required for cat-(h)-001 if Day 4 wants a tighter Wilson 95% CI on the "every assistant turn has prompt_version" check (95% CI of 20/20 is [83.2%, 100%] vs 10/10's [69.2%, 100%]). PM may rule whether the extra 10 runs are worth the harness time.
- **N=5 / ≥90%** is **not appropriate** for any Wave 3 case. Wave 3 is the memory keystone — relaxing the floor would invert the trust posture. Reject if proposed.

**Net:** I do **not** concur with the design's default ≥95% N=10 across the board; I propose **≥99% N=10 default** with the ≥95% N=10 exception for the one hybrid-judge case (cat-(g) §2.1). Memory Engineer's design is correct that ≥95% is the floor; the QA-side overlay tightens it where the assertion shape allows.

---

## §6. Open questions back to PM

1. **§2.3 runtime case (defense-in-depth vs YAGNI).** Should Day 4 author the runtime `commit_control_static_check` case in addition to CI Rule 16, or is the CI rule sufficient? My recommendation: author both (the runtime case catches a class of bugs Rule 16 can't — dynamic dispatch). PM ruling welcome.
2. **§2.5 topic-validation seam.** When does `recordVehicleFact` start validating `topic` against `kb_topics`? Wave 3 ships the table with seed data but doesn't (per the design doc §3.2) modify `vehicle_facts`. If validation is deferred to Wave 5, cat-(g)-002 is **mock-only** until then. Memory Engineer should confirm the strangler-window position of this check.
3. **`expected_working_memory_excludes_fact_id` plumbing.** This assertion field requires the harness to inspect the system-prompt assembly OR have the cascade return a `working_memory_fact_ids: string[]` for the case to filter on. Does `runFullCascade` (the existing live cascade) need a new return field, or is the working-memory check done in-mock-only for cat-(g) §2.1? Day 4 dispatch needs to know whether to extend `evalHarness.ts` or stay mock-only.
4. **Cat-(i)-005 cross-conversation read.** This case needs **two synthetic conversations** for the same user (analogous to cat-(d)'s multi-tenant seed but multi-conversation). Does `multiTenantSetup.ts::seedTenants` need a `seedConversations(userId, n)` extension, or does cat-(i)-005 ship mock-only? Mock-only is acceptable for Wave 3 keystone; live-mode is a Wave 5 follow-on.
5. **`(source, written_by)` legality matrix (cat-(g)-003).** This case depends on the design-doc §7 open question 3 being resolved before it can be authored. If Waleed rules that the matrix is enforced at the helper, cat-(g)-003 lands at ≥99% N=10. If he defers, cat-(g)-003 is removed from the Wave 3 cut.

---

**End of WAVE_3_REVIEW_QA.md.**
