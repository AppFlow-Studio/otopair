# WAVE_3_DESIGN — Memory Keystone (5 tables + `written_by` + 120-day exp decay)

**Date:** 2026-05-16
**Owner:** Memory Systems Engineer
**Status:** DESIGN PASS. No code/schema changes in this dispatch.
**Authority:** PM Ruling v3 §4 (D-3.2 hill), Decision Log D-2.1 / D-3.2 / D-3.4 / D-3.5 / D-3.6, North Star §3 (the memory keystone), `MEMORY_SCHEMA_V3_CONSOLIDATED §9.1`, Doc 3 §3/§5/§6/§7.
**Companion docs:** the Sprint 1 KB-consolidation work (`vehicle_facts` + `vehicle_facts_audit` + `fact_reports`) is already shipped; Wave 3 is the next memory layer above it.

---

## §1. Scope of Wave 3

Wave 3 is the **per-conversation + per-user memory layer** that sits above the v3 KB (Sprint 1's `vehicle_facts` family) and below the retrieval rebuild (Wave 5). It introduces **five new tables**, the `written_by` provenance discipline (D-3.6), and the **120-day exponential-decay** function for `user_semantic_facts` confidence (D-3.5). Wave 3 closes Doc 1's "six kinds of state collapsed into three fields" finding (the `established_facts` race in particular) and gives Wave 5 the typed substrate it needs to retrieve against.

Wave 3 IS NOT: the retrieval cascade rebuild (Wave 5), `<untrusted_input>` wrapping (Wave 7.1), the degradation ladder (Wave 7.2), or `compressHistory` (Wave 3.9 — same wave, separate dispatch). It IS NOT the `vehicle_facts` KB — that landed in Sprint 1. The append-only D-3.2 hill applies HERE on `conversation_facts` and `user_semantic_facts`; it does NOT transfer to `vehicle_facts` (which is mutable-in-place with audit, per PM Ruling v3 §4.2). The five tables here, plus the three already-shipped (`vehicle_facts` + `vehicle_facts_audit` + `fact_reports`), plus the three system tables (`oto_migrations` + `reconciliation_runs` + `prompt_changelog`), comprise the full v3 memory substrate. Wave 5 reads against this substrate; Wave 7 wraps and rate-limits it.

---

## §2. The 5 memory tables

Each section: name, purpose, schema (production-grade, paste-ready into `convex/schema.ts`), provenance rules, mutation surface (which helper file owns writes), append-only vs mutable discipline, audit-log discipline, retention rules, and cross-mandate review flags.

### §2.1 `conversation_facts` — typed structured facts per conversation

**Purpose.** Replaces `ai_conversations.established_facts: v.array(v.string())` (the worst single schema decision per Doc 1 §3.3). Holds typed structured facts the model AND the mobile app each append; the working-memory builder reads back active (non-retracted) facts on the next turn. Eliminates the Haiku/mobile race condition on a shared array.

**Schema.**

```typescript
// -------------------------------------------------------------------------
// conversation_facts — Wave 3, North Star §3.4.
//
// Append-only with soft-retract (D-3.2). One row per fact established during
// a conversation. Writers append; the working-memory builder reads active
// rows; the reasoning loop may retract a row by setting retracted_at.
//
// Mutation surface: convex/oto/memoryEditing.ts.
//   - appendConversationFact()  -- chat-agent path (Haiku reasoning loop)
//   - recordSelectionFact()     -- mobile-tap path (user selection)
//   - retractConversationFact() -- soft-retract; sets retracted_at + reason
//
// No audit-log table. The append-only discipline IS the audit log; rows are
// never edited or deleted, only flagged retracted with a timestamp.
//
// Retention: bounded by conversation lifetime. Hard-delete safe ONLY when
// the parent ai_conversations row is itself archived (out of scope for v3).
// No 120-day decay -- decay applies to user_semantic_facts, not these.
// -------------------------------------------------------------------------
conversation_facts: defineTable({
  conversation_id: v.id("ai_conversations"),

  fact_type: v.union(
    v.literal("id_reference"),  // structured: "selected mechanic k57abc"
    v.literal("preference"),    // "prefers closest over cheapest"
    v.literal("observation"),   // "brake squeal at low speed only"
    v.literal("hypothesis"),    // Oto's working theory; NOT user-stated
    v.literal("user_quote"),    // exact user phrasing, verbatim
  ),

  // Discriminated payload. The kind tag matches fact_type.
  payload: v.union(
    v.object({
      kind: v.literal("id_reference"),
      entity_type: v.string(),   // "mechanic" | "shop" | "vehicle" | "service"
      entity_id: v.string(),     // Convex id as string OR external id
    }),
    v.object({
      kind: v.literal("preference"),
      dimension: v.string(),     // "distance" | "price" | "rating" | ...
      value: v.string(),
    }),
    v.object({
      kind: v.literal("observation"),
      text: v.string(),
    }),
    v.object({
      kind: v.literal("hypothesis"),
      text: v.string(),
      confidence: v.number(),
    }),
    v.object({
      kind: v.literal("user_quote"),
      text: v.string(),
    }),
  ),

  source_turn: v.number(),
  created_at: v.number(),

  // Soft-retract (D-3.2). Set together; never split.
  retracted_at: v.optional(v.number()),
  retracted_reason: v.optional(v.string()),
  retracted_by_turn: v.optional(v.number()),

  // D-3.6 multi-agent writer attribution. Default "chat_agent" for the
  // current single-agent system; "user_selection" for mobile-tap appends.
  written_by: v.union(
    v.literal("chat_agent"),
    v.literal("user_selection"),
    v.literal("health_monitor"),
    v.literal("system"),
  ),
})
  // Hot read path: active facts for one conversation, ordered by creation.
  // retracted_at is part of the index so a single index scan returns the
  // exact non-retracted subset (Doc 1 §3.3 anti-pattern fix).
  .index("by_conversation_active", ["conversation_id", "retracted_at", "created_at"])
  // Multi-agent diagnostic: which agent wrote what for one conversation.
  .index("by_conversation_writer", ["conversation_id", "written_by", "created_at"]),
```

**Provenance.** Legal `written_by` values: `chat_agent | user_selection | health_monitor | system`. Mobile-tap facts use `user_selection` (NOT `chat_agent` — distinguishing them is the entire point of the race fix).

**Mutation surface.** `convex/oto/memoryEditing.ts` (new file). Helpers:
- `appendConversationFact(conversationId, factType, payload, sourceTurn, writtenBy)` — insert
- `recordSelectionFact(conversationId, selection, sourceTurn)` — insert with `written_by: "user_selection"`
- `retractConversationFact(factId, reason, retractedByTurn)` — patches the three retract fields atomically; nothing else mutable

**Append-only discipline.** Rows are append-only EXCEPT for the three retract fields, which are write-once (a row whose `retracted_at` is already set cannot be re-retracted). This is the D-3.2 hill — the row body is immutable; retract is a flag, not an edit.

**Audit-log discipline.** None. The table IS its own audit log. CI Rule 12 (proposed §4) enforces "no `ctx.db.patch` on `conversation_facts` outside `memoryEditing.ts`" + "no `ctx.db.replace`" + "no `ctx.db.delete`" — the three rules together pin append-only.

**Retention.** Bounded by conversation lifetime. No exponential decay (different threat model than user_semantic_facts). Hard delete only on parent-conversation archival (out of scope for v3).

**Cross-mandate flags.**
- `[REVIEW: RAG]` — Working-memory builder must read by `by_conversation_active` index with `q.eq("retracted_at", undefined)`. Confirm this matches the v3 read-cascade dispatch shape.
- `[REVIEW: QA]` — Eval case shape: multi-turn scenario where a fact is appended, retracted next turn, and the third turn asserts the retracted fact no longer steers (Doc 3 §6 second challenge).
- `[REVIEW: Multi-Agent]` — `written_by: "health_monitor"` requires the health-monitor write path to exist before it can write here. If the health monitor lands first as a Wave 7+ proactive subsystem, this enum entry is pre-provisioned per D-3.6 ("defaulted, costs nothing until used").

---

### §2.2 `user_semantic_facts` — cross-conversation personalization, 120-day decay

**Purpose.** Per-user persistent facts (preferences, mechanic anchors, vehicle quirks) that survive across conversations. Confidence decays exponentially (D-3.5, 120-day half-life), reinforces asymptotically on re-observation, floors at 0.1 (never auto-retracts on decay alone). Replaces Doc 1's "no per-user persistent memory" finding.

**Schema.**

```typescript
// -------------------------------------------------------------------------
// user_semantic_facts — Wave 3, North Star §3.6, D-3.5 + D-3.6.
//
// Append-only with soft-retract (D-3.2). One row per user-scoped fact.
// Confidence decays exponentially (120-day half-life, floor 0.1); never
// auto-retracts on decay alone -- retraction requires explicit
// contradiction. Reinforcement asymptotes toward 1.0 (never reaching it).
//
// Mutation surface: convex/oto/memoryEditing.ts.
//   - appendUserSemanticFact()       -- chat-agent or health-monitor path
//   - reinforceUserSemanticFact()    -- bumps confidence asymptotically
//   - retractUserSemanticFact()      -- soft-retract; sets retracted_at
//
// Decay is COMPUTED ON READ, not written. The stored confidence is the
// last-reinforced value; the retrieval layer applies the decay function
// against (now - last_reinforced) at query time. This avoids a write-on-
// read pattern and makes decay continuous, not discrete.
//
// Retention: 120-day exponential-decay-floored. No row is deleted on decay
// alone. A separate cold-cleanup cron (proposed §3) hard-deletes rows whose
// retracted_at is older than 365 days (compromise: keeps the audit trail
// for a year, then GCs to bound the table).
// -------------------------------------------------------------------------
user_semantic_facts: defineTable({
  user_id: v.id("users"),
  // Optional vehicle scope. null = user-level fact; set = vehicle-specific.
  // A vehicle_quirk fact ("this car pulls left when cold") is scoped to one
  // vehicle and NEVER propagates to vehicle_facts (cross-user pollution
  // guard from Doc 1 §3.4).
  vehicle_id: v.optional(v.id("vehicles")),

  fact_type: v.union(
    v.literal("mechanic_preference"),   // "books with Carlos repeatedly"
    v.literal("service_preference"),    // "always declines synthetic blend"
    v.literal("communication_style"),   // "wants terse answers"
    v.literal("vehicle_quirk"),         // "pulls left when cold"
    v.literal("history_anchor"),        // "last brake service 2026-03-14"
  ),

  // Prose payload -- consumed as context, not parsed. Distinct from
  // conversation_facts.payload which is structured/discriminated.
  payload: v.string(),

  // Stored confidence is the LAST-REINFORCED value. Retrieval applies the
  // D-3.5 decay function: effective_confidence = max(0.1, stored *
  // exp(-ln(2) * (now - last_reinforced) / 120_days_ms)).
  confidence: v.number(),

  source: v.union(
    v.literal("user_stated"),         // user said it explicitly
    v.literal("inferred_behavior"),   // derived from booking/chat patterns
    v.literal("mechanic_confirmed"),  // came from a verified service record
  ),

  // D-3.6 multi-agent attribution.
  written_by: v.union(
    v.literal("chat_agent"),
    v.literal("health_monitor"),
    v.literal("admin_edit"),
    v.literal("system"),
  ),

  first_observed: v.number(),
  last_reinforced: v.number(),
  observation_count: v.number(),

  // Soft-retract (D-3.2).
  retracted_at: v.optional(v.number()),
  retracted_reason: v.optional(v.string()),

  // GC clock for the 365-day cold-cleanup cron. Set on retract; the cron
  // hard-deletes rows whose value is older than 365 days.
  // NULL on live rows; only retracted rows have it.
  retracted_at_floor_ms: v.optional(v.number()),
})
  // Hot read path: active facts for one user, scoped by vehicle if relevant.
  .index("by_user_active", ["user_id", "retracted_at", "last_reinforced"])
  // Vehicle-scoped facts for one user.
  .index("by_user_vehicle", ["user_id", "vehicle_id", "retracted_at"])
  // Type-driven retrieval (e.g., "give me all mechanic_preferences for user X").
  .index("by_user_type_active", ["user_id", "fact_type", "retracted_at"])
  // Cold-cleanup cron scan.
  .index("by_retracted_floor", ["retracted_at_floor_ms"]),
```

**Provenance.** Legal `written_by`: `chat_agent | health_monitor | admin_edit | system`. Health-monitor writes are pre-provisioned per D-3.6 (cheap to defer; expensive to migrate later). `admin_edit` is the bypass path for support tooling.

**Mutation surface.** `convex/oto/memoryEditing.ts`. Helpers:
- `appendUserSemanticFact(userId, vehicleId?, factType, payload, source, writtenBy)` — initial insert with `confidence: 1.0, observation_count: 1`
- `reinforceUserSemanticFact(factId)` — patches `confidence = 1 - (1 - confidence) * 0.5`, increments `observation_count`, bumps `last_reinforced` (the three together = atomic reinforcement)
- `retractUserSemanticFact(factId, reason)` — sets `retracted_at, retracted_reason, retracted_at_floor_ms` together

**Append-only discipline.** Row body immutable EXCEPT for the reinforcement triple (`confidence`, `observation_count`, `last_reinforced`) and the retract pair (`retracted_at`, `retracted_reason`, `retracted_at_floor_ms`). Reinforcement is the documented exception to pure append-only — it's a write-on-existing-row, but the operation is monotonic (confidence only increases toward 1.0, observation_count only increments, last_reinforced only advances), so the safety property is preserved structurally. Decay is read-side; never a write.

**Audit-log discipline.** None. The reinforcement pattern is monotonic enough that an audit table would be O(reinforcements) ≈ O(every retrieval that matched) which dwarfs the row count and provides no safety value. Retraction is rare and explicit; observation count is the audit trail for reinforcements. CI rule (§4) enforces helper-only mutation.

**Retention.** 120-day exponential decay computed at read time, floored at 0.1, never auto-retracts. Retracted rows kept 365 days then hard-deleted by `cleanupUserSemanticFacts` cron (proposed §3). Live rows never deleted.

**Cross-mandate flags.**
- `[REVIEW: RAG]` — The retrieval reranker (Wave 5) consumes `confidence` after decay-on-read. The decay function signature lives in `convex/oto/canonicalize.ts` (next to the existing sha256 helper) or a new `convex/oto/memoryDecay.ts`; RAG needs to agree on the exact import surface.
- `[REVIEW: QA]` — Decay eval case shape: insert a fact at simulated `last_reinforced = now - 240_days`; assert effective_confidence ≈ 0.25 (two half-lives); reinforce; assert it jumps to ~0.875. Confirms the function compounds correctly.
- `[REVIEW: Multi-Agent]` — `health_monitor` written rows need a per-fact-type rule: which types can a non-chat agent write? `mechanic_confirmed source` should NEVER be a health-monitor write (that's a deception vector). The mutation helper should enforce a `(source, written_by)` legality matrix. Open question for §7.
- `[REVIEW: Security]` — `user_semantic_facts` rows contain user-personal context; the moat-rate-limit (Wave 7.3) should be extended to cover this table on the read path, lest it become a per-user-PII exfiltration surface.

---

### §2.3 `conversation_episodic_control` — merged episodic + control state (D-2.1 Fight 1)

**Purpose.** Per-conversation single-row state. Merges North Star §3.3 episodic memory (mood, arc, flow) with §3.9 control state (model, budget, escalation) per D-2.1's LOCKED ruling — same lifetime, same access pattern, field-level write-authority enforced in the mutation layer. One read per turn instead of two (the AI Infrastructure Architect's per-turn-op-count constraint). Today these fields live as optional columns on `ai_conversations` (`mood`, `arc_summary`, `last_user_intent`, `diagnostic_turn_count`, `current_model`); Wave 3 lifts them into their own typed row with single-writer discipline.

**Schema.**

```typescript
// -------------------------------------------------------------------------
// conversation_episodic_control -- Wave 3, North Star §3.3 + §3.9, D-2.1.
//
// One row per ai_conversations row. Merged episodic + control state per
// the LOCKED D-2.1 Fight 1 ruling (five tables, not six). Field-level
// write-authority enforced by separate mutation paths in
// convex/oto/episodicControlEditing.ts:
//
//   Episodic fields (model-influenced):
//     - mood, current_flow, flow_turn_count, arc_summary,
//       compressed_history_summary, compressed_through_turn
//     => written by commitEpisodic() only.
//
//   Control fields (system-only; model never touches):
//     - current_model, budget_spent_usd, budget_cap_usd,
//       escalation_count, escalation_state,
--      sonnet_turns_used, sonnet_turn_budget
//     => written by commitControl() only.
//
// Both helpers are gated on updated_by_turn matching the expected turn
// number; conflict means a concurrent write happened, and the helper
// reconciles deterministically (last-writer-wins on prose, monotonic on
// counters). This is the structural fix for the "benign" race in Doc 1.
//
// MUTABLE IN PLACE (not append-only). Lifetime = conversation lifetime;
// access pattern = read at turn start, write at turn end. Audit trail is
// derivable from conversation_audit (§2.4) which logs every turn.
//
// Retention: lifetime of parent ai_conversations row.
// -------------------------------------------------------------------------
conversation_episodic_control: defineTable({
  conversation_id: v.id("ai_conversations"),

  // ----- Episodic fields (model-influenced; commitEpisodic owns writes) -----
  mood: v.union(
    v.literal("neutral"),
    v.literal("curious"),
    v.literal("concerned"),
    v.literal("frustrated"),
    v.literal("satisfied"),
  ),

  current_flow: v.union(
    v.literal("diagnostic"),
    v.literal("booking"),
    v.literal("maintenance"),
    v.literal("education"),
    v.literal("status_check"),
    v.literal("off_topic"),
    v.literal("none"),
  ),
  flow_turn_count: v.number(),

  // Model-written prose. Allowed to be a string because it IS prose.
  arc_summary: v.string(),

  // History compression (Wave 3.9 / D-3.4). Compressed turns 1..N into a
  // single summary; recent turns stay verbatim in conversation_audit.
  // compressed_through_turn is the high-water mark; null = no compression.
  compressed_history_summary: v.optional(v.string()),
  compressed_through_turn: v.optional(v.number()),

  // ----- Control fields (system-only; commitControl owns writes) -----
  current_model: v.union(
    v.literal("haiku"),
    v.literal("sonnet"),
    v.literal("human_handoff"),
  ),
  budget_spent_usd: v.number(),
  budget_cap_usd: v.number(),
  escalation_count: v.number(),
  escalation_state: v.union(
    v.literal("none"),
    v.literal("requested"),
    v.literal("active"),
    v.literal("human"),
  ),
  sonnet_turns_used: v.number(),
  sonnet_turn_budget: v.number(),

  // ----- Concurrency-detection envelope -----
  updated_at: v.number(),
  // Which turn last wrote this row. Mutations require expected_turn ==
  // updated_by_turn; mismatch triggers deterministic reconciliation.
  updated_by_turn: v.number(),
})
  // One row per conversation. Single-row reads only.
  .index("by_conversation", ["conversation_id"]),
```

**Provenance.** No `written_by` field — single agent writes per field-class (`commitEpisodic` for episodic, `commitControl` for control). The role discipline is in the helper-file name, not a column. Multi-agent expansion would add `written_by` then; for now it's a one-writer-per-field model.

**Mutation surface.** `convex/oto/episodicControlEditing.ts` (new file). Two helpers, deliberately separated:
- `commitEpisodic(conversationId, delta: EpisodicDelta, expectedTurn)` — patches only episodic fields, validates turn counter
- `commitControl(conversationId, delta: ControlDelta, expectedTurn)` — patches only control fields, validates turn counter

Splitting the helpers is what makes field-level write-authority real. The CI rule (§4) enforces that the model-side path can only call `commitEpisodic`, never `commitControl`.

**Append-only vs mutable.** **Mutable in place.** Two reasons: (1) single-row-per-conversation means there's no audit benefit to keeping prior versions; (2) the `updated_by_turn` field is the concurrency-detection envelope, providing the safety property the audit table would. `conversation_audit` (§2.4) is the immutable record of every turn — re-deriving prior episodic state is a left-fold over the audit log, not a query against an episodic_audit table.

**Audit-log discipline.** No separate audit table. `conversation_audit` (§2.4) is the message-log audit; episodic state at turn N can be reconstructed from the (deterministic) episodic-delta function applied over messages 1..N. The reconstruction is theoretical (never run in production); the audit log exists for forensics, not for replay.

**Retention.** Lifetime of parent `ai_conversations` row. No decay. No GC during conversation. Hard-delete on conversation archival (out of scope for v3).

**Cross-mandate flags.**
- `[REVIEW: AI-Infra]` — D-2.1 was decided on per-turn-op-count grounds. Confirm the v3 turn loop reads this row via batched query alongside `user_semantic_facts` and active `conversation_facts`, NOT a separate round-trip.
- `[REVIEW: QA]` — Boundary-eval case (D-3.8): assert that a `commitControl` call from a model-driven path fails CI (the model never touches control state). Test the field-level write-authority by static analysis, not just runtime.
- `[REVIEW: Multi-Agent]` — If/when the health monitor writes, does it write to `commitEpisodic` or its own helper? Open question for §7.
- `[REVIEW: Reliability]` — The `updated_by_turn` mismatch reconciliation policy ("last-writer-wins on prose, monotonic on counters") needs a specified procedure. Out-of-band but Wave 3 owes the spec.

---

### §2.4 `conversation_audit` — append-only immutable message log

**Purpose.** Forensic record of every turn. North Star §3.9. Every assistant message stamped with `model_used`, `prompt_version`, `tool_calls`. Powers eval-time replay, the Wave 1.5 prompt-change protocol's "what did this version do" queries, and incident response. Today the equivalent data is partly in `ai_messages` (role/content) and partly absent (prompt_version is NOT stamped — Doc 1 §3.1 finding).

**Schema.**

```typescript
// -------------------------------------------------------------------------
// conversation_audit -- Wave 3, North Star §3.9. The forensic spine.
//
// APPEND-ONLY. IMMUTABLE. NO ctx.db.patch, NO ctx.db.replace, NO
// ctx.db.delete -- the only legal operation is ctx.db.insert via the
// recordTurn() helper. The CI rule (§4) enforces this.
--
// One row per turn (user, assistant, or tool). The (conversation_id,
// turn_number, role) tuple is unique. prompt_version is stamped on every
// assistant turn (Doc 1 §3.1 gap closed). tool_calls captures the full
// tool-use payload so Wave 5 retrieval debugging has a complete trace.
//
// Coexistence with ai_messages: ai_messages remains the chat-render
// substrate (mobile reads it for the message list); conversation_audit is
// the forensic record. The two are written together inside the same
// Convex mutation per turn (atomic; Convex serializes). Wave 5 reads
// conversation_audit, not ai_messages, for retrieval-context construction.
--
// Retention: permanent. Never deleted. The table is bounded by traffic, not
// by time; a one-year-old conversation's audit rows must remain readable.
// -------------------------------------------------------------------------
conversation_audit: defineTable({
  conversation_id: v.id("ai_conversations"),
  turn_number: v.number(),
  role: v.union(
    v.literal("user"),
    v.literal("assistant"),
    v.literal("tool"),
  ),
  content: v.string(),

  // Optional structured tool-call envelope (assistant role).
  tool_calls: v.optional(
    v.array(
      v.object({
        name: v.string(),
        input: v.any(),  // tool inputs vary per tool; not narrowable here
        output: v.optional(v.any()),
      }),
    ),
  ),

  // Stamped on every assistant turn. Doc 1 §3.1 gap closed.
  model_used: v.optional(
    v.union(v.literal("haiku"), v.literal("sonnet")),
  ),
  prompt_version: v.optional(v.string()),

  timestamp: v.number(),
})
  // Hot read path: ordered turn-by-turn replay for one conversation.
  .index("by_conversation_turn", ["conversation_id", "turn_number"])
  // Eval / A/B harness: scan all turns under a specific prompt version.
  .index("by_prompt_version", ["prompt_version", "timestamp"])
  // Model-routing telemetry / Wave 1.4 boundary-adherence eval queries.
  .index("by_model_timestamp", ["model_used", "timestamp"]),
```

**Provenance.** No `written_by` field at the row level — only `system` (the turn loop) ever writes. The role (user/assistant/tool) is the conceptual writer-class; mixing `written_by` in would be redundant.

**Mutation surface.** `convex/oto/conversationAuditEditing.ts` (or fold into `memoryEditing.ts` — see §7 open question). Single helper:
- `recordTurn(conversationId, turnNumber, role, content, options)` — inserts the row; THE only legal write path

**Append-only discipline.** **STRICT append-only.** This is the relocated D-3.2 safety property for the message log. No patches, no replaces, no deletes — ever. The CI rule (§4) treats `conversation_audit` like `vehicle_facts_audit`: insert-only outside the helper, no other operations anywhere.

**Audit-log discipline.** This table IS an audit log. No nested audit. Re-asserting: `conversation_audit` is the forensic spine; it does not itself need a forensic spine.

**Retention.** Permanent. Bounded by traffic. No decay. No cleanup. The table grows linearly with conversation volume; aggregation crons (Wave 6) and archive strategies are out-of-scope for Wave 3 but may eventually move cold rows to an archive table — that is a future concern, not a v3 design constraint.

**Cross-mandate flags.**
- `[REVIEW: RAG]` — Wave 5 retrieval-context construction reads `conversation_audit` to assemble the recent-history block of working memory. Confirm the index `by_conversation_turn` is sufficient or whether a `(conversation_id, turn_number)`-bounded range query needs an additional filter field.
- `[REVIEW: QA]` — `prompt_version` stamping is the Wave 1.5 protocol's substrate. Eval harness must read by `by_prompt_version` to compute per-version pass-rate deltas. Confirm the index shape.
- `[REVIEW: Context Engineering]` — `compressHistory` (Wave 3.9) reads `conversation_audit` to produce `conversation_episodic_control.compressed_history_summary`. The contract from D-3.4: facts are extracted to `conversation_facts` BEFORE compression. Wave 3.9 dispatch confirms this seam.
- `[REVIEW: Security]` — `conversation_audit.content` may contain PII (full user messages). The Wave 7.3 read-rate-limit should extend here; the audit table is a higher-PII-density surface than `vehicle_facts`.

---

### §2.5 `kb_topics` — controlled vocabulary FK target

**Purpose.** Controlled vocabulary for KB topic identifiers. North Star §3.8. Prevents the `oil_capacity` vs `oil_capacity_qts` vs `oil_cap` fragmentation Doc 1 §3.4 flagged. Currently `vehicle_facts.topic` is a free string; Wave 3 introduces `kb_topics` as the FK target, and Wave 5+ migrates `vehicle_facts.topic` references to `topic_id`.

**Schema.**

```typescript
// -------------------------------------------------------------------------
// kb_topics -- Wave 3, North Star §3.8.
//
// Controlled vocabulary. Topics are registered explicitly (one-line PR or
// admin action); the reasoning loop cannot invent a topic by writing a
// free string -- it can only reference an existing topic_id. New topics
// require a registration event; this prevents KB fragmentation.
--
// Wave 3 lands the table. Wave 5+ migrates vehicle_facts.topic to
// vehicle_facts.topic_id (carries a topic_id FK alongside the legacy free
// string for one deploy, then drops the string).
--
// Mutation surface: convex/oto/kbTopicsEditing.ts (or merge with
// memoryEditing.ts -- §7 open question). Admin-only writes.
--
// Retention: permanent. Append-only by convention (deprecation by flag,
// never delete).
// -------------------------------------------------------------------------
kb_topics: defineTable({
  topic_key: v.string(),              // "oil_capacity_quarts" -- unique
  display_name: v.string(),           // "Oil Capacity (quarts)"
  category: v.union(
    v.literal("fluids"),
    v.literal("brakes"),
    v.literal("battery"),
    v.literal("tires"),
    v.literal("filters"),
    v.literal("intervals"),
    v.literal("torque_specs"),
    v.literal("general"),
  ),
  expected_unit: v.optional(v.string()),
  retrieval_priority: v.number(),     // boosts ranking for common topics
  deprecated_at: v.optional(v.number()),  // soft-deprecate; never delete
  deprecated_reason: v.optional(v.string()),

  // Admin attribution (written_by-style but admin-only here).
  created_by: v.id("users"),          // must be Waleed or Temur
  created_at: v.number(),
})
  // Unique-by-key constraint enforced at the helper layer (Convex has no
  // native unique index; the helper checks before insert).
  .index("by_topic_key", ["topic_key"])
  // Retrieval-time category scan.
  .index("by_category", ["category", "retrieval_priority"])
  // Active-set scan (non-deprecated topics).
  .index("by_deprecated", ["deprecated_at", "topic_key"]),
```

**Provenance.** No `written_by` — only `admin_edit` ever writes (gated to Waleed + Temur). The `created_by` field stores the specific user.

**Mutation surface.** `convex/oto/kbTopicsEditing.ts` (or fold into a unified admin helper). Helpers:
- `registerKbTopic(key, displayName, category, expectedUnit?, retrievalPriority)` — admin-only insert; throws on duplicate key
- `deprecateKbTopic(topicId, reason)` — sets `deprecated_at + deprecated_reason`; preserves FKs

**Append-only vs mutable.** Mutable-in-place but only for the deprecation pair (write-once). Insert-only otherwise. CI rule should enforce that `topic_key`, `display_name`, `category`, `created_by`, `created_at` are NEVER patched.

**Audit-log discipline.** None. Volume is tiny (dozens of topics, not thousands); the audit value of tracking topic registrations is low relative to the operational cost. The created_by/created_at pair is sufficient provenance.

**Retention.** Permanent. Soft-deprecate via `deprecated_at`; never delete (foreign-key references would dangle).

**Cross-mandate flags.**
- `[REVIEW: RAG]` — `retrieval_priority` becomes a reranker weight input (Wave 5 §4.2's `topic_retrieval_priority`). Confirm the priority range (0..1? 0..100?) so reranker math is correct.
- `[REVIEW: Memory]` — Wave 5+ migration plan: `vehicle_facts.topic` (free string) → `vehicle_facts.topic_id` (FK). Two-deploy strangler (add field, dual-write, backfill, switch reads, drop legacy). Out-of-scope for Wave 3 itself but Wave 3 must land the table with the seed data ready.
- `[REVIEW: QA]` — Eval case: assert that the reasoning loop cannot invent a topic (a write that doesn't match an existing `topic_id` is rejected at the helper layer). Boundary-adherence category.

---

## §3. Migration plan

### §3.1 Idempotent backfill ordering

Wave 3 lands five new tables that are EMPTY at first. The migration's job is twofold: (a) create the tables (schema deploy, no data movement); (b) backfill from existing legacy fields where applicable.

**FK ordering** (must respect at backfill time):

```
1. kb_topics                            (no FKs in; populated by seed list)
2. conversation_episodic_control        (FK: ai_conversations only)
3. conversation_audit                   (FK: ai_conversations only)
4. conversation_facts                   (FK: ai_conversations only)
5. user_semantic_facts                  (FK: users + vehicles; no inter-Wave-3 FKs)
```

Three of the five have only legacy-source backfill (data already exists somewhere):

- `conversation_episodic_control` ← `ai_conversations.{mood, arc_summary, last_user_intent, diagnostic_turn_count, current_model}` — one row per existing conversation, defaults filled where null
- `conversation_audit` ← `ai_messages` (row-for-row replay; assigns `turn_number` by ordering); does NOT delete `ai_messages` — coexistence during the strangler window
- `conversation_facts` ← `ai_conversations.established_facts` array, parsed best-effort per item. Strings that don't parse into a typed payload land as `fact_type: "user_quote"` with `payload: {kind: "user_quote", text: <raw string>}`. Lossy but reversible.
- `user_semantic_facts` ← NEW (no legacy source; populated by the chat agent going forward)
- `kb_topics` ← seeded from a small `convex/oto/migrations/kbTopicsSeed.ts` list. Initial topics extracted from `vehicle_facts.topic` distinct values (deduplicated, normalized).

### §3.2 Strangler discipline (dual-read-safe)

Per the existing `oto_migrations` checkpoint pattern (Sprint 1 Day 2). Each backfill is an `internalMutation` with `(batchSize, cursorMs)`; the driver action loops until `processed === 0`. Re-running after partial completion is safe.

**Dual-read window** (Wave 3 ships → Wave 5 cuts over):

| Old read path | New read path | Strangler rule |
|---|---|---|
| `ai_conversations.{mood, arc_summary, ...}` | `conversation_episodic_control.{mood, arc_summary, ...}` | Both populated; reads route to new path behind a feature flag; old path read-only after Wave 5 ships. |
| `ai_messages` for envelope history | `conversation_audit` for envelope history | Both populated during dual-write; `ai_messages` remains the mobile-render substrate (permanently). |
| `ai_conversations.established_facts` (raw array) | `conversation_facts` (typed rows) | Dual-write for one deploy (Haiku writes both); read switches to `conversation_facts` immediately on Wave 5 deploy. |
| `vehicle_facts.topic` (free string) | `vehicle_facts.topic_id` (FK to `kb_topics`) | Add field, dual-write, backfill, switch reads — Wave 5+ scope. Wave 3 lands `kb_topics` with seed data but does NOT modify `vehicle_facts`. |

**Critical strangler invariant:** the legacy fields on `ai_conversations` (mood/arc/...) and the `established_facts` array stay in the schema (and stay readable) until Wave 5's read-cutover ships. Wave 3's deploy MUST NOT remove them.

### §3.3 Reconciliation invariants (extends the existing 15-minute cron)

The existing `runReconciliation` cron (Sprint 1 Day 3, `convex/oto/migrations/vehicleFactsReconciliation.ts`) checks audit-log replay-equivalence and report-counter parity for `vehicle_facts`. Wave 3 adds three new check classes:

1. **`conversation_facts` retract integrity** — no row should have `retracted_at` set without `retracted_reason` AND `retracted_by_turn`. Page on any violation.
2. **`user_semantic_facts` reinforcement monotonicity** — no row's `confidence` should be NaN, < 0, or > 1.0. No row's `observation_count` should be 0. No row's `last_reinforced < first_observed`. All three are P1 anomalies.
3. **`conversation_episodic_control` turn-counter monotonicity** — `updated_by_turn` should never decrease for a given `conversation_id`. (Detection: scan by `by_conversation` for rows where the scan order doesn't match `updated_by_turn` ascending — page on regression.)

The reconciliation runbook (`docs/SPRINT_1/RECONCILIATION_RUNBOOK.md`) gets a Wave 3 amendment with the three new checks. Alerting routes through `reconciliation_runs.anomalies` (same as Sprint 1 — no new table needed).

---

## §4. CI invariants needed

Extends `scripts/ci/vehicle-facts-grep.sh` (currently 11 rules). Proposed additions, same style:

**Rule 12 — `conversation_audit` is strictly append-only.**

```sh
# No patches, replaces, or deletes on conversation_audit anywhere.
# This table is the forensic spine; if it becomes mutable, the safety
# property collapses (same logic as vehicle_facts_audit).
rg -n 'ctx\.db\.(patch|replace|delete)\(' convex/ --type ts \
  | rg '"conversation_audit"|<"conversation_audit">' \
  || true
# Hits === 0 required.
```

**Rule 13 — `conversation_facts` mutation gates.**

```sh
# All writes to conversation_facts go through convex/oto/memoryEditing.ts.
# Direct ctx.db.patch / replace / delete outside the helper is forbidden.
rg -n 'ctx\.db\.(patch|replace|delete)\(' convex/ --type ts -B 1 -A 4 \
  | rg '"conversation_facts"|<"conversation_facts">' \
  | rg -v "^convex/oto/memoryEditing\.ts" \
  | rg -v "^convex/oto/migrations/" \
  || true
```

**Rule 14 — `user_semantic_facts` mutation gates.**

```sh
# Same pattern. user_semantic_facts only mutated via memoryEditing.ts
# (append, reinforce, retract); migrations bypass for backfills.
rg -n 'ctx\.db\.(patch|replace|delete)\(' convex/ --type ts -B 1 -A 4 \
  | rg '"user_semantic_facts"|<"user_semantic_facts">' \
  | rg -v "^convex/oto/memoryEditing\.ts" \
  | rg -v "^convex/oto/migrations/" \
  || true
```

**Rule 15 — `written_by` enum integrity.**

```sh
# Every ctx.db.insert into a Wave 3 table that has a written_by field
# must pass a written_by value. Catches the "forgot to attribute" miss
# at code-review time before it hits the schema validator.
# Heuristic: scan inserts into the three tables and confirm the same
# (or following 5 lines) contain "written_by:".
rg -n 'ctx\.db\.insert\("(conversation_facts|user_semantic_facts)"' \
  convex/ --type ts -A 8 \
  | rg -v 'written_by\s*:' \
  || true
# Per-call EXEMPT: annotation pattern same as Rule 7.
```

**Rule 16 — `conversation_episodic_control` field-class write boundary.**

```sh
# commitEpisodic and commitControl must be the only writers, and they
# must not cross field classes. Static check: any patch on this table
# from anywhere except convex/oto/episodicControlEditing.ts is illegal.
rg -n 'ctx\.db\.patch\(' convex/ --type ts -B 1 -A 4 \
  | rg '"conversation_episodic_control"|<"conversation_episodic_control">' \
  | rg -v "^convex/oto/episodicControlEditing\.ts" \
  | rg -v "^convex/oto/migrations/" \
  || true
```

**Rule 17 — `kb_topics` insert is admin-gated.**

```sh
# kb_topics inserts must come from convex/oto/kbTopicsEditing.ts (or the
# unified admin helper). Catches "the reasoning loop tried to register
# a topic" silently.
rg -n 'ctx\.db\.insert\("kb_topics"' convex/ --type ts \
  | rg -v "^convex/oto/kbTopicsEditing\.ts" \
  | rg -v "^convex/oto/memoryEditing\.ts" \
  | rg -v "^convex/oto/migrations/" \
  || true
```

Six new rules. Total becomes 17. Same exit-code semantics; same EXEMPT: annotation pattern for grandfathered sites.

---

## §5. Cross-mandate review needed (consolidated from §2)

**RAG flags (4):**
1. §2.1 — Working-memory builder reads `conversation_facts` via `by_conversation_active` index; confirm read shape matches the v3 retrieval cascade dispatch.
2. §2.2 — Decay function (D-3.5) applied at read time; reranker (Wave 5) consumes post-decay confidence. Agree on import location for `decayConfidence(confidence, lastReinforced, now)`.
3. §2.4 — `conversation_audit` index `by_conversation_turn` and the working-memory history block; confirm filter shape.
4. §2.5 — `kb_topics.retrieval_priority` numeric range and reranker weight integration.

**QA flags (5):**
1. §2.1 — Multi-turn eval: append fact → retract → assert no longer steers (Doc 3 §6 second challenge — memory-behavior eval).
2. §2.2 — Decay eval: insert at `last_reinforced = now - 240_days`; assert effective_confidence ≈ 0.25; reinforce; assert ≈ 0.875.
3. §2.3 — Field-level write-authority static check: a model-side path calling `commitControl` fails CI.
4. §2.4 — `prompt_version` stamping and Wave 1.5 protocol's per-version pass-rate query; confirm index shape.
5. §2.5 — Boundary-adherence case: a write that doesn't match an existing `topic_id` is rejected at the helper layer (no topic invention).

**Multi-Agent flags (3):**
1. §2.1 — `health_monitor` written_by pre-provisioned per D-3.6; write path doesn't exist yet but enum entry costs nothing.
2. §2.2 — `(source, written_by)` legality matrix (e.g., health_monitor MAY NOT write source=`mechanic_confirmed`); enforce in helper, not just by convention.
3. §2.3 — If/when health-monitor writes episodic, does it use `commitEpisodic` or its own helper? Open §7.

**Security flags (3):**
1. §2.2 — Wave 7.3 read-rate-limit should extend to `user_semantic_facts` (per-user PII exfiltration surface).
2. §2.4 — Wave 7.3 read-rate-limit should extend to `conversation_audit` (higher PII density than `vehicle_facts`).
3. §2.3 — `conversation_episodic_control` is per-user state but lower-PII than `conversation_audit`; lower priority.

**Context Engineering flags (1):**
1. §2.4 — `compressHistory` reads `conversation_audit` and writes `conversation_episodic_control.compressed_history_summary`. The D-3.4 contract: facts extracted to `conversation_facts` BEFORE compression. Wave 3.9 dispatch confirms.

**AI Infrastructure flags (1):**
1. §2.3 — D-2.1 (Fight 1) decided on per-turn-op-count grounds. Confirm v3 turn loop reads `conversation_episodic_control` + active `conversation_facts` + relevant `user_semantic_facts` via batched query, not separate round-trips.

**Reliability flags (1):**
1. §2.3 — `updated_by_turn` mismatch reconciliation policy: "last-writer-wins on prose, monotonic on counters" needs a specified procedure. Wave 3 owes the spec.

**Total: 4 RAG flags · 5 QA flags · plus 9 flags routed to other mandates.**

---

## §6. Implementation day-plan

Five parallel-able days, sized for one Memory Engineer dispatch each (subagent + CI verification + commit). RAG + QA cases run in parallel where flagged.

### Day 1 — Schema + helper scaffolds (mandatory, keystone)

- Append 5 table definitions to `convex/schema.ts` in FK order (§3.1).
- Brace-balance check (`awk` delta=0).
- Create empty helper files:
  - `convex/oto/memoryEditing.ts` — stub exports for `appendConversationFact`, `recordSelectionFact`, `retractConversationFact`, `appendUserSemanticFact`, `reinforceUserSemanticFact`, `retractUserSemanticFact`
  - `convex/oto/episodicControlEditing.ts` — stub exports for `commitEpisodic`, `commitControl`
  - `convex/oto/conversationAuditEditing.ts` — stub export for `recordTurn`
  - `convex/oto/kbTopicsEditing.ts` — stub exports for `registerKbTopic`, `deprecateKbTopic`
  - `convex/oto/memoryDecay.ts` — `decayConfidence(confidence, lastReinforced, now)` pure function with D-3.5 constants
- Run existing 11-rule CI; confirm 11/11 still green (no regressions).
- Deliverable: tables exist, helpers stubbed, no live mutation paths yet.

### Day 2 — Mutation helpers + CI rule additions (mandatory)

- Implement helpers from Day 1 stubs:
  - `commitEpisodic` / `commitControl` — separate paths, `updated_by_turn` validation
  - `appendConversationFact` / `recordSelectionFact` / `retractConversationFact` — append-only discipline
  - `appendUserSemanticFact` / `reinforceUserSemanticFact` / `retractUserSemanticFact` — asymptotic reinforcement formula
  - `recordTurn` — strict append-only
  - `registerKbTopic` / `deprecateKbTopic` — admin-gated
  - `decayConfidence` pure function + unit test (vitest-syntax `*.test.ts`)
- Add 6 new CI rules from §4 to `scripts/ci/vehicle-facts-grep.sh`. Test each fires correctly on a synthetic violation.
- Run CI; confirm 17/17 green.
- Deliverable: helpers live, CI defends them. No backfills yet.

### Day 3 — Migration scripts + reconciliation invariants (mandatory)

- Build five idempotent backfill mutations under `convex/oto/migrations/`:
  - `backfillConversationEpisodicControl.ts`
  - `backfillConversationAudit.ts`
  - `backfillConversationFacts.ts` (parses `established_facts` strings, best-effort)
  - `kbTopicsSeed.ts` (initial topic registration; ~30 rows)
  - No backfill for `user_semantic_facts` (greenfield)
- Each follows the Sprint 1 Day 2 pattern: `internalMutation` with `(batchSize, cursorMs)`, driver `internalAction`, checkpoint in `oto_migrations`.
- Extend `runReconciliation` cron with three new checks (§3.3).
- Update `docs/SPRINT_1/RECONCILIATION_RUNBOOK.md` with Wave 3 amendment.
- Deliverable: backfills runnable; reconciliation extended; no live cutover yet.

### Day 4 — Eval cases per QA's response to §5 flags (mandatory)

- QA Lead dispatched in parallel against the 5 QA flags.
- Author 5 eval cases:
  - `memory_retract_no_steer` (Wave 1.4 mem category — append-retract-assert)
  - `decay_function_correctness` (240-day insert + reinforce + assert)
  - `commit_control_static_check` (boundary-adherence; CI rule integration)
  - `prompt_version_stamping_present` (forensic completeness; sample 50 turns from `conversation_audit`)
  - `kb_topic_invention_rejected` (boundary-adherence; helper-layer enforcement)
- Run eval harness; confirm baseline pass rates ≥90%.
- Deliverable: 5 new eval cases live; passing.

### Day 5 — Integration + 120-day decay first dry-run + cutover gate (phase-2 candidate)

- Wire `decayConfidence` into the prototype Wave 5 retrieval reranker (Wave 5 itself is post-Wave-3; this dry-runs the integration on a labeled set).
- Run all five backfills against staging Convex. Confirm idempotency (re-run → `processed===0`).
- 24-hour soak: confirm reconciliation runs clean for all three new check classes.
- Open the Wave 5 read-cutover gate (next dispatch decides whether to flip).
- Deliverable: Wave 3 substrate live in staging; passes 24-hour soak; ready for Wave 5 to consume.

**Mandatory for the Wave-3 keystone:** Days 1–4. **Phase-2 (next sprint):** Day 5. Days 1–4 deliver an inert but production-correct substrate; Day 5 is the production cutover.

---

## §7. Open decisions for Waleed

Surfaced for explicit ruling before Day 1 dispatch. Defaulting any of these by engineering convenience would mirror the D-2.5 failure mode this engagement was commissioned to prevent.

1. **`written_by: "health_monitor"` on `conversation_facts`** — does the health-monitor write here at all, or only to `user_semantic_facts`? `conversation_facts` is per-conversation; a proactive async agent that has no conversation context might not have a legitimate write surface here. Recommend: pre-provision the enum entry (D-3.6 logic — cheap to defer), do NOT design a write path until the monitor exists.

2. **Per-user cap on `user_semantic_facts` before compression / pruning** — at what row count per user does an "all facts retrieval" stop being free? Recommend a threshold (e.g., 500 per user) at which the retrieval layer pages by `confidence` desc, NOT a deletion threshold. Open: confirm 500 is reasonable; confirm pruning is read-time pagination, not write-time deletion.

3. **`(source, written_by)` legality matrix on `user_semantic_facts`** — should `source: "mechanic_confirmed"` be writable by `written_by: "health_monitor"`? Sounds like a no (deception vector). Should it be writable by `written_by: "system"`? Same answer. The matrix needs to be enumerated explicitly so the helper enforces it; until then, the helper accepts any (source, written_by) pair.

4. **`conversation_audit` retention** — North Star §3.9 says "permanent." At Oto-bet-on traffic levels (M conversations/year), this is bounded but large. Is there a cold-archive policy after N years, or does the table grow forever? Recommend: design Wave 3 for permanent; revisit at the D-2.2 vector-DB-style tripwire (e.g., row count > 100M).

5. **`conversation_audit.tool_calls.input/output` PII exposure** — these are typed `v.any()`. The tool-use payloads may contain user PII (addresses, vehicle VINs, mechanic contact info). Should the Wave 7.3 rate-limit cover `conversation_audit` reads? Should `tool_calls` be redacted at write time (PII minimization at the State Contract layer)? Open question for the Security Analyst's parallel dispatch.

6. **Helper file consolidation** — should `memoryEditing.ts` own ALL Wave 3 mutations (one file, all five tables' helpers) or stay split into four files (per-table)? One file is easier to grep against in CI; four files match the per-table-owner pattern of `vehicleFactsEditing.ts`. Recommend: stay split (one file per table's writes); merge only if review fatigue justifies it.

7. **`compressHistory` (Wave 3.9) dispatch order vs Wave 3 keystone** — D-3.4 ordered Wave 3.9 AFTER 3.2–3.8 (facts layer authoritative first). Does Wave 3.9 dispatch as a separate Sprint 2 day (after Day 5 here) or fold into Day 5? Recommend: separate dispatch; Wave 3.9 owns its own design pass with the Context Engineering Specialist.

8. **`conversation_episodic_control` reconciliation procedure** (the `updated_by_turn` mismatch policy) — "last-writer-wins on prose, monotonic on counters" is the policy; the *procedure* (what does the helper do when it detects a mismatch?) needs specification. Recommend: throw on mismatch in v1 (fail-loud); soften to deterministic-merge only if production telemetry shows races are real.

9. **Dual-write window for `ai_conversations.established_facts` ↔ `conversation_facts`** — how many deploys do we keep both populated? Recommend: 1 deploy (Wave 3 ships → Wave 5 cuts reads → next deploy drops the legacy field). Longer is safer but increases the "two writers fighting one array" risk that Wave 3 exists to eliminate.

10. **`kb_topics` initial seed list size and source** — extract from `vehicle_facts.topic` distinct values? Curated by hand from the existing prompt's topic mentions? Recommend: extract + deduplicate + manual review pass (~30 topics expected based on KB scope today).

---

## Appendix — File-level deliverables checklist (for the implementation dispatches)

- [ ] `convex/schema.ts`: append five `defineTable(...)` blocks per §2 (FK ordering per §3.1). Brace-balance delta=0.
- [ ] `convex/oto/memoryEditing.ts`: new helper file; 6 mutation exports per §2.1 + §2.2.
- [ ] `convex/oto/episodicControlEditing.ts`: new helper file; 2 mutation exports per §2.3.
- [ ] `convex/oto/conversationAuditEditing.ts`: new helper file; 1 mutation export per §2.4.
- [ ] `convex/oto/kbTopicsEditing.ts`: new helper file; 2 mutation exports per §2.5.
- [ ] `convex/oto/memoryDecay.ts`: pure function module with `decayConfidence` + `reinforceConfidence`; unit test `memoryDecay.test.ts`.
- [ ] `convex/oto/migrations/backfillConversationEpisodicControl.ts`
- [ ] `convex/oto/migrations/backfillConversationAudit.ts`
- [ ] `convex/oto/migrations/backfillConversationFacts.ts`
- [ ] `convex/oto/migrations/kbTopicsSeed.ts`
- [ ] `convex/oto/migrations/wave3Reconciliation.ts`: extends `runReconciliation` cron with §3.3 checks.
- [ ] `scripts/ci/vehicle-facts-grep.sh`: append Rules 12–17 per §4 (six new rules; total 17).
- [ ] `docs/SPRINT_1/RECONCILIATION_RUNBOOK.md`: amendment section for Wave 3 reconciliation checks.
- [ ] Eval cases (post-QA-dispatch): 5 case files per §6 Day 4.

— End of WAVE_3_DESIGN.
