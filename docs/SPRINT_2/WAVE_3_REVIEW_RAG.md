# WAVE_3_REVIEW_RAG — RAG-side resolutions for the Wave 3 memory keystone

**Date:** 2026-05-16
**Owner:** RAG Optimization Specialist
**Status:** REVIEW PASS. Read-only. No code/schema/design-doc changes.
**Authority:** PM Ruling v3 §3 (three-tier cascade), `RAG_WAVE_5_1_V3_CONSOLIDATED` (labeled-set spec + cascade-tier vocabulary), `ARCHITECTURE_v3_AMENDMENTS` §F.5 (locked `render_disclaim_tag` predicate).
**Companion docs:** `docs/SPRINT_2/WAVE_3_DESIGN.md` (Memory Engineer's keystone design — the doc this review answers).

---

## §1. Orientation

`WAVE_3_DESIGN.md` (commit `176f070`) is the Memory Engineer's design pass for the five-table memory keystone that sits above the v3 KB and below the Wave 5 retrieval rebuild. Day 1 (schema + helper stubs) shipped at HEAD `1aa36ea`; Day 2 (helper bodies + migration) is in parallel dispatch alongside this review. The design doc surfaces four cross-mandate flags marked `[REVIEW: RAG]` in §2 — one each on §2.1 (`conversation_facts`), §2.2 (`user_semantic_facts`), §2.4 (`conversation_audit`), and §2.5 (`kb_topics`). This doc resolves all four from the retrieval side. Consumers: Memory Engineer (Day 3+ — picks up any helper-shape changes); PM (escalation surface for the open questions in §5); the future Wave 5 retrieval rebuild (will inherit the read-path contracts pinned below).

This is the RAG ANSWER to the design's questions. It does not restate the design; read both side-by-side.

---

## §2. Per-flag resolutions

### §2.1 Flag — `conversation_facts` working-memory read index

**Quoted question (WAVE_3_DESIGN §2.1, line 126):**
> "[REVIEW: RAG] — Working-memory builder must read by `by_conversation_active` index with `q.eq("retracted_at", undefined)`. Confirm this matches the v3 read-cascade dispatch shape."

**Retrieval-side concern.** This is a RAG decision because the working-memory builder is a retrieval-shaped operation: it gathers context the model sees on every turn. If the index access pattern is wrong, every turn pays the cost forever; if `retracted_at: undefined` is not addressable as an index-key prefix in Convex, the query falls back to a table scan and a single conversation with 50 retracted-and-active facts pays a 50-row read instead of a 5-row read. Equally, the read shape needs to compose cleanly with the broader v3 cascade contracts (every Tier-2 sub-strategy filters `verification_status != "retracted"` before mapping) — the conversation_facts read should follow the same "filter before map" convention, not the inverse.

**Resolution.** **Confirmed with one structural amendment.** The shape Memory Engineer proposed is correct but the predicate must use `q.eq("retracted_at", undefined)` as the second index-key component, not a post-fetch filter — Convex supports `undefined` as an index-key value and the existing `by_conversation_active` index `["conversation_id", "retracted_at", "created_at"]` is designed precisely for this. Concretely the read path Day 3 helpers should implement is:

```ts
const active = await ctx.db
  .query("conversation_facts")
  .withIndex("by_conversation_active", (q) =>
    q.eq("conversation_id", convoId).eq("retracted_at", undefined)
  )
  .order("desc")           // by created_at — descending so newest first
  .take(50);               // working-memory cap; Wave 5 may revisit
```

This matches the existing Tier 2 sub-strategy convention in `vehicleFactsKB.ts::lookupFactsByCanonicalHash` where retracted-row filtering happens via the same explicit index predicate (not a `q.filter` post-hoc). Day 2's `appendConversationFact` helper does NOT need to change for this — the read happens on the retrieval side, not the write side. The Memory Engineer's helper bodies in flight today are unaffected.

**Conversation_facts does NOT enter the Tier 2 cascade.** This is the single most important read-side disambiguation in this review. `conversation_facts` is per-conversation personalization memory; it is read into the working-memory block of the prompt **alongside** the cascade's Tier 1/2/3 output, not **inside** it. The cascade's job is "given a factual question, find the answer"; the working-memory builder's job is "given the next turn, surface what we already learned about this user/conversation". Conflating them would re-introduce exactly the established_facts-style mixing that Doc 1 §3.3 flagged. See §3 below.

**Reversal cost.** Low. If we discover the explicit `undefined` index predicate doesn't compose with Convex's query planner the way expected, the helper falls back to `q.eq("conversation_id", convoId)` + `.filter(q.eq(q.field("retracted_at"), undefined))` at one helper boundary. No schema change required.

**Cross-mandate dependency.** Memory Engineer's `appendConversationFact` writes (Day 2) must NOT silently set `retracted_at: null` on insert — must leave the field truly `undefined` so the index predicate matches. The validator already declares it `v.optional`, so this is purely a helper-body discipline; flagging here so Day 2 doesn't ship a `retracted_at: null` default.

---

### §2.2 Flag — `user_semantic_facts` decay-on-read function placement

**Quoted question (WAVE_3_DESIGN §2.2, line 238):**
> "[REVIEW: RAG] — The retrieval reranker (Wave 5) consumes `confidence` after decay-on-read. The decay function signature lives in `convex/oto/canonicalize.ts` (next to the existing sha256 helper) or a new `convex/oto/memoryDecay.ts`; RAG needs to agree on the exact import surface."

**Retrieval-side concern.** The decay function will be called on every retrieval that touches `user_semantic_facts`, plus possibly in a Wave 5 reranker pass. Its location dictates two things RAG owns: (a) whether the import graph stays clean (the canonicalize.ts module today is the home of `canonicalQuestionKey()` — a pure hash; co-locating an unrelated decay function muddies the module's contract and makes future "find anything to do with retrieval normalization" greps return false positives), and (b) whether the function can be reached cheaply from both an internal query (synchronous, Convex `ctx.runQuery`) and from the eval harness (which lives outside the chat-tool surface and must import without dragging in any Convex-runtime dependencies).

**Resolution.** **New file: `convex/oto/memoryDecay.ts`.** Do NOT fold into `canonicalize.ts`. Concretely the exports Day 2 should ship (and Day 1's stub already targets per the design doc Appendix):

```ts
// convex/oto/memoryDecay.ts
export const HALF_LIFE_MS = 120 * 24 * 60 * 60 * 1000;  // 120 days, locked to D-3.5
export const CONFIDENCE_FLOOR = 0.1;                    // never auto-retract on decay alone

// Pure. No Convex imports. Eval harness, query, action all consume it.
export function decayConfidence(
  storedConfidence: number,
  lastReinforced: number,
  now: number,
): number {
  const elapsed = Math.max(0, now - lastReinforced);
  const decayed = storedConfidence * Math.exp(-Math.LN2 * elapsed / HALF_LIFE_MS);
  return Math.max(CONFIDENCE_FLOOR, decayed);
}

// Asymptotic reinforcement formula (helper-side write).
export function reinforceConfidence(currentConfidence: number): number {
  return 1 - (1 - currentConfidence) * 0.5;
}
```

Three reasons memoryDecay.ts wins over canonicalize.ts:

1. **Module-contract integrity.** `canonicalize.ts` is the home of question-normalization-then-hash; it has one responsibility and a tight test surface (`canonicalize.test.ts`). Adding decay math gives it two unrelated responsibilities and weakens the abstraction.
2. **Eval-harness reach.** The Wave 5.1 labeled-set harness (`scripts/eval/`) will need to apply the same decay math when checking that a `user_semantic_facts`-influenced retrieval ranks correctly. A standalone `memoryDecay.ts` with zero Convex-runtime deps imports cleanly from `scripts/eval/lib/`. A canonicalize-co-located function would force the eval to pull in the broader `oto/` graph.
3. **Symmetry with the reinforcement formula.** Day 2's `reinforceUserSemanticFact` helper applies an asymptotic `1 - (1 - c) * 0.5` bump. That math IS in the same domain as decay (both manipulate the confidence field); decay and reinforce belong in the same file. canonicalize-co-location would split a closely-related pair across two files.

**Reranker integration.** Wave 5's reranker will compute `effective_confidence = decayConfidence(row.confidence, row.last_reinforced, Date.now())` then sort the working-memory facts by `effective_confidence DESC`. The reranker doesn't need a `Convex Doc<>` shape — it just needs the three numbers — so the pure-function design lands the right import boundary.

**Reversal cost.** Trivial. If Day 2 ships with decay co-located in canonicalize.ts, moving it to memoryDecay.ts is a one-file rename + import updates at 2-3 call sites. But getting it right on Day 2 saves the rename.

**Cross-mandate dependency.** None additive. Memory Engineer's Day 1 helper stub already proposes `memoryDecay.ts` per WAVE_3_DESIGN §6 Day 1 ("`convex/oto/memoryDecay.ts` — `decayConfidence(...)` pure function"). This resolution merely confirms the proposal AND pins the export surface.

---

### §2.4 Flag — `conversation_audit` history-block read index

**Quoted question (WAVE_3_DESIGN §2.4, line 441):**
> "[REVIEW: RAG] — Wave 5 retrieval-context construction reads `conversation_audit` to assemble the recent-history block of working memory. Confirm the index `by_conversation_turn` is sufficient or whether a `(conversation_id, turn_number)`-bounded range query needs an additional filter field."

**Retrieval-side concern.** Wave 5's working-memory builder reads `conversation_audit` once per turn to assemble the recent-history block (typically last N=10-20 turns, with compression after `compressed_through_turn`). The read shape is a bounded range scan, not a point lookup. If the existing index is insufficient (e.g., requires a `role IN {user, assistant}` filter — excluding `tool` rows from the renderable history), the read pays a post-filter cost on every turn. At expected scale (M conversations × hundreds of turns each), the index choice affects the per-turn op-count budget the AI Infrastructure Architect locked.

**Resolution.** **`by_conversation_turn` is sufficient for Wave 5's history-block read — with the additional convention that the working-memory builder applies the role filter in-process, not via index.** Concretely:

```ts
// Wave 5 working-memory builder, ~recent-history block.
const compressedThrough = epCtrl?.compressed_through_turn ?? 0;
const recent = await ctx.db
  .query("conversation_audit")
  .withIndex("by_conversation_turn", (q) =>
    q.eq("conversation_id", convoId).gt("turn_number", compressedThrough)
  )
  .order("desc")
  .take(40);  // over-fetch to absorb tool-row attrition; trim in-process
const renderable = recent
  .filter((r) => r.role !== "tool")
  .slice(0, 20);
```

Why not add a new index? Three reasons:

1. **Tool rows are small fraction.** At expected ratios (~1 tool turn per ~3 assistant turns), over-fetching by 2x absorbs the filter without breaking the op-count budget.
2. **Adding `role` to the index key would forbid range scans on `turn_number`.** Convex indexes are prefix-evaluated; `["conversation_id", "role", "turn_number"]` would force a per-role scan and lose the "recent N turns regardless of role" shape the prompt-renderer actually wants for forensic traces (which DO need tool rows).
3. **`by_prompt_version` already exists for the orthogonal eval-time scan.** The QA Lead's Wave 1.5 protocol scans by prompt_version across conversations; that read uses a different index entirely. The history-block read and the eval-scan read have different shapes; doing them on different indexes is correct, not duplication.

**Note on the secondary `compressHistory` consumer.** Wave 3.9's `compressHistory` action reads `conversation_audit` to write `compressed_history_summary`. That read uses the SAME `by_conversation_turn` index but with a different bound (`turn_number <= compressed_through_turn`, scanning all turns being compressed). Both consumers share the index without conflict.

**Reversal cost.** Low. If production telemetry shows over-fetch attrition is worse than expected (e.g., tool rows dominate in late-stage diagnostic conversations), Wave 5+ can add a `by_conversation_role_turn` covering index without invalidating Wave 3's schema. No write-side change required.

**Cross-mandate dependency.** Inherits from Wave 3.9 / Context Engineering Specialist. If the compressHistory contract changes (e.g., the watermark is stored differently than `compressed_through_turn`), this resolution needs revisiting. As of WAVE_3_DESIGN §2.3 the watermark IS `compressed_through_turn`, so no change needed today.

---

### §2.5 Flag — `kb_topics.retrieval_priority` numeric range and reranker weight

**Quoted question (WAVE_3_DESIGN §2.5, line 517):**
> "[REVIEW: RAG] — `retrieval_priority` becomes a reranker weight input (Wave 5 §4.2's `topic_retrieval_priority`). Confirm the priority range (0..1? 0..100?) so reranker math is correct."

**Retrieval-side concern.** `retrieval_priority` is a per-topic constant that Wave 5's reranker will read once and reuse across many ranking decisions. The numeric range it lives on determines whether the reranker can multiply it into a confidence score directly (works iff range is [0, 1]), needs normalization (works iff range is known constant), or has to be empirically calibrated against fact-text relevance scores (works only if the range is documented). Worst case is a doc-less range — then Wave 5 has to assume something and ship a reranker that silently weights some topics by 50x what was intended.

**Resolution.** **Lock the range at `[0.0, 1.0]` with the convention `0.5 = default / un-prioritized`, `1.0 = maximum boost`, `0.0 = effectively-deprecated alternative to soft-deprecate.** Concretely:

- Day 3's `kbTopicsSeed.ts` should seed ~30 initial topics with `retrieval_priority: 0.5` as the default. Specific high-priority topics (e.g., `oil_capacity_quarts`, `recommended_tire_pressure_front_psi` — the long-tail of "every owner asks this") may be seeded at `0.7-0.8`.
- The `registerKbTopic` helper should default `retrieval_priority` to `0.5` when omitted, and reject values outside `[0.0, 1.0]` at the helper boundary (Convex's `v.number()` won't enforce this; the helper must).
- Wave 5's reranker math (NOT in scope for Wave 3): a draft formula is `combined_score = base_relevance * (1 + 0.4 * (retrieval_priority - 0.5))` — i.e., the priority bias is centered at 0.5 and modulates the base score by up to ±20%. The exact coefficient (`0.4` here) is a Wave 5 tunable measured against the labeled set.

Why `[0, 1]` over `[0, 100]`:

1. **Multiplicative composition.** Most reranker math is multiplicative (confidence × priority × decay × recency). A [0, 1] range composes cleanly without intermediate normalization steps.
2. **Mental model parity with confidence.** `vehicle_facts.confidence` is `[0, 1]`. `user_semantic_facts.confidence` is `[0, 1]`. Adding a third [0, 100] dimension makes the reranker's per-input narration ("priority 0.7 boosted the score by 4%") less legible than "priority 0.7 boosted the score by 4%, same as confidence 0.7 weighting the answer by 70%."
3. **Floor / ceiling are operationally useful.** `0.0` means "this topic is alive but never boosts" — semantically distinct from `deprecated_at` (which removes the topic entirely). `1.0` is the boost ceiling and the helper can sanity-check inserts.

**Reversal cost.** Medium. If Day 2/3 ships rows with `retrieval_priority` interpreted as `[0, 100]` (e.g., priority `50` for default), Wave 5's reranker either has to special-case the [0, 100] range or migrate-and-divide-by-100. A schema migration via `oto_migrations` is the obvious fix but Wave 3 ships ~30 rows total — manual update is cheap. Still, pinning the range now is materially cheaper than after seed data lands.

**Cross-mandate dependency.** Inherits Memory Engineer's `registerKbTopic` helper validation (Day 2). The range-check should live in that helper; the schema validator cannot enforce numeric ranges. Flagging here so Day 2 doesn't ship a helper that accepts `retrieval_priority: 47`.

---

## §3. Wave 3's interaction with the existing three-tier cascade

**The boundary, stated directly: the five Wave 3 tables sit BESIDE the cascade, not INSIDE it.** Conversation_facts and user_semantic_facts are personalization-scoped (per-conversation, per-user) — they answer "what do we already know about THIS user / THIS conversation" and feed the working-memory block of the prompt. The Tier 1/2/3 cascade is vehicle-scoped — it answers "what is the factual answer to a factual question, regardless of who's asking." Mixing the two would re-introduce the established_facts-style scope confusion that PM Ruling v3 §3 explicitly drew the line against (the KB is "multi-tenant by vehicle config, not by asking user").

Practically: the v3 chat loop will compose the prompt from two retrieval-shaped inputs per turn:

1. **Cascade output** (T1 → T2_HASH → T2_STRUCT → T2_TEXT → T3) — surfaces facts in answer to the user's current question. Render-disclaim-tag predicate applies. Cross-tenant by design.
2. **Working-memory block** (`conversation_facts` active rows + `user_semantic_facts` post-decay rows + `conversation_audit` recent-history range) — surfaces personalization context. NO disclaim-tag predicate. NEVER cross-tenant (user_semantic_facts is per-user; conversation_facts is per-conversation).

Two pipelines, two indexes, two policies. They compose in the prompt template, not in the retrieval graph. The eval harness's `runFullCascade` continues to test (1) only; the working-memory builder is a separate component Wave 5 will own.

**`kb_topics` is the one exception** — it eventually feeds the cascade (the Wave 5+ migration replaces `vehicle_facts.topic` free-string with `vehicle_facts.topic_id` FK). But Wave 3 itself does NOT modify `vehicle_facts`; `kb_topics` lands inert in Wave 3 and gets wired into Tier 2 ranking only in Wave 5+. So Wave 3's cascade impact is zero today; the kb_topics→cascade integration is a future-RAG-mandate problem to be solved when the strangler-cutover ships.

---

## §4. Labeled-set implications for Wave 5.x

The current `RAG_WAVE_5_1_V3_CONSOLIDATED` labeled set has 9 categories (A-I) all scoped to the **factual-retrieval cascade** — every entry pins an `expected_source_tier ∈ {T1, T2_HASH, T2_STRUCT, T2_TEXT, T3, REFUSE}` against vehicle scope. Wave 3's introduction of personalization-scoped memory creates a new evaluable surface that the existing 9 categories cannot express. Wave 5.x's labeled set will need a new category family — call it **Cat M (memory-scoped retrieval)** — with sub-categories for the new shapes:

- **Cat M.1 — `conversation_facts` recall.** Multi-turn entry: turn 1 asserts a fact via `appendConversationFact`; turn 2's expected behavior is that the working-memory block surfaces it. Tests the `by_conversation_active` index in production shape.
- **Cat M.2 — `conversation_facts` retract no-steer.** Three-turn entry: turn 1 appends, turn 2 retracts, turn 3 asserts the retracted fact does NOT influence the response. Mirrors QA Lead's flag §2.1 case but from the retrieval side.
- **Cat M.3 — `user_semantic_facts` decay correctness.** Simulated-time entry: a fact at `last_reinforced = now - 240_days` should rank below a fact at `last_reinforced = now - 30_days` of equal stored confidence, because the decay function downgrades it. Tests reranker integration without testing the chat loop end-to-end.
- **Cat M.4 — `user_semantic_facts` cross-conversation persistence.** A fact recorded in conversation A should be retrievable when the same user starts conversation B. Tests the by_user_active read shape and absence of conversation-id leakage.
- **Cat M.5 — boundary: `user_semantic_facts` user-scope isolation.** User A's facts MUST NOT surface to user B (the per-user-PII isolation guard the Security Analyst is also flagging). Boundary-adherence case; pass means refusal, not exfiltration.

Volume estimate for Wave 5.x proper: 10-15 entries per sub-category, total ~50-75 new Cat M entries. The starter set Wave 5.1 currently has 36 entries — Cat M would be 5.x scope, not 5.1 starter. The shape (JSONL entry schema) extends from the current entry schema by adding `memory_scope: "conversation" | "user" | null` and `expected_memory_tables: ("conversation_facts" | "user_semantic_facts")[]`. Pure additive — no breakage to existing 36-entry starter.

---

## §5. Open questions back to PM

Five items I can't resolve solo because they cross mandate boundaries or require explicit ruling:

1. **Cat M labeled-set authoring authority.** Who authors Cat M entries — RAG Specialist alone, or jointly with QA Lead (since the multi-turn shape overlaps QA's memory-behavior eval per WAVE_3_DESIGN §2.1)? Recommend: RAG owns the labeled-set shape; QA Lead's eval cases ARE Cat M entries (one-to-one mapping); coordinate authoring on the same JSONL file in Wave 5.1 proper. **Who weighs in:** QA Lead. **Why flagged:** prevents parallel-author drift on overlapping eval surfaces.

2. **`compressed_through_turn` watermark semantics in the working-memory builder.** If `compressed_through_turn = 5` and the user references turn-3 content, does the working-memory builder fetch turn-3 verbatim (re-decompressing) or rely solely on `compressed_history_summary`? Wave 5's read pattern needs to know. **Who weighs in:** Context Engineering Specialist (Wave 3.9 owner). **Why flagged:** affects index-bound `gt("turn_number", compressed_through_turn)` semantics in §2.4 resolution.

3. **Working-memory budget allocation between conversation_facts, user_semantic_facts, and conversation_audit recent-history.** At a fixed prompt-token budget (say 2000 tokens for memory), what's the split? 60/20/20? Dynamic? The Memory Engineer designed the substrate; RAG owns the read; Context Engineering owns the prompt template. **Who weighs in:** Context Engineering + AI Infra. **Why flagged:** the per-turn op-count constraint (AI Infra §2.3 flag) needs this resolved before Wave 5 ships.

4. **`kb_topics.retrieval_priority` value-curation responsibility.** Day 3's `kbTopicsSeed.ts` seeds ~30 topics with priorities. Who decides "oil_capacity gets 0.7, not 0.5"? RAG Specialist's domain-prior or Waleed/Temur's domain authority? Recommend: RAG proposes from the labeled set's category-A frequency; Waleed signs off. **Who weighs in:** Waleed. **Why flagged:** these values directly bias future ranker math; the bias should be deliberate, not engineering-defaulted (the D-2.5 failure mode this engagement was commissioned to prevent).

5. **conversation_audit PII exposure on retrieval reads.** WAVE_3_DESIGN §2.4 Security flag notes PII density. Wave 5's working-memory read of recent history will inevitably surface PII into the prompt context. Does that read need rate-limiting/auditing of its own (extending Wave 7.3), or does the Wave 7.3 moat-rate-limit already cover it transparently? **Who weighs in:** Security Analyst + AI Infra. **Why flagged:** this is the same surface (conversation_audit read) but two different threat models (exfiltration vs. prompt-injection-via-history); both mandates need to confirm.

— End of WAVE_3_REVIEW_RAG.
