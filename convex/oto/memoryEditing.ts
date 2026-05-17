// =============================================================================
// Oto AI — Wave 3 memory mutation helpers (consolidated)
// =============================================================================
//
// Sprint 2 Day 1 (2026-05-16). Authority: docs/SPRINT_2/WAVE_3_DESIGN.md §2,
// PM Ruling v3 §4, Decision Log D-2.1 / D-3.2 / D-3.4 / D-3.5 / D-3.6,
// North Star §3.3 / §3.4 / §3.6 / §3.8 / §3.9.
// Owner: Memory Systems Engineer. Mirrors Sprint 1's vehicleFactsEditing.ts
// pattern (audit-row-atomic mutations, written_by validation, EXEMPT-pattern
// adherence, narrow contract enforcement at the helper boundary).
//
// THIS FILE IS THE ONLY SANCTIONED PATH TO MUTATE THE FIVE WAVE 3 TABLES.
//   - conversation_facts            (append-only + soft-retract triple)
//   - user_semantic_facts           (append-only + reinforcement triple + retract triple)
//   - conversation_episodic_control (mutable-in-place with field-class split)
//   - conversation_audit            (STRICTLY append-only — insert only)
//   - kb_topics                     (admin-gated append + write-once deprecate pair)
//
// Day 1 scope: SKELETON ONLY. Each helper has its signature + validators
// committed (the API surface), but the body throws "not yet implemented".
// Day 2 fills the bodies. Day 3 adds CI Rules 12-17 (which reference this
// file path as the canonical mutation surface).
//
// Helper file consolidation (§7 D6): all five tables' mutations in ONE file
// per the Day 1 dispatch ruling. The design doc's split-file recommendation
// (§7 D6) is overridden — one file is easier to grep against in CI and
// matches the dispatch's "canonical mutation surface" framing. Reversibility:
// extract per-table helpers into separate files; ~1hr refactor; CI rule
// patterns update.
//
// CI defense (Day 3): Rules 12-15 will be added to scripts/ci/vehicle-facts-grep.sh.
//   12. conversation_audit is strictly append-only (no patch/replace/delete anywhere)
//   13. conversation_facts mutation gates (ctx.db.patch/replace/delete restricted to this file)
//   14. user_semantic_facts mutation gates (same pattern)
//   15. written_by enum integrity (every insert with the field passes a value)
//   (16. conversation_episodic_control field-class write boundary)
//   (17. kb_topics admin-gated insert)
//
// Mutation surface (12 helpers per the design doc §2):
//
//   --- conversation_facts (§2.1) -----------------------------------------
//   - recordConversationFact     — chat-agent / health-monitor / system append
//   - recordSelectionFact        — mobile-tap (written_by: "user_selection")
//   - retractConversationFact    — soft-retract; sets retract triple atomically
//
//   --- user_semantic_facts (§2.2) ----------------------------------------
//   - recordUserSemanticFact     — initial insert (confidence: 1.0, count: 1)
//   - reinforceUserSemanticFact  — asymptotic bump (1 - (1 - c) * 0.5) + count++
//   - retractUserSemanticFact    — soft-retract; sets retract triple atomically
//
//   --- conversation_episodic_control (§2.3) ------------------------------
//   - commitEpisodic             — model-influenced fields only; expected_turn gate
//   - commitControl              — system-only fields; expected_turn gate
//
//   --- conversation_audit (§2.4) -----------------------------------------
//   - recordTurn                 — THE only legal write path (strict append-only)
//
//   --- kb_topics (§2.5) --------------------------------------------------
//   - registerKbTopic            — admin-gated insert; throws on duplicate key
//   - deprecateKbTopic           — write-once deprecation pair
//
// =============================================================================

import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

// -----------------------------------------------------------------------------
// Shared validators — mirror the schema unions so a typo here surfaces at
// codegen rather than at runtime. One validator per enum used by the helpers.
// -----------------------------------------------------------------------------

// conversation_facts.fact_type
const conversationFactTypeValidator = v.union(
  v.literal("id_reference"),
  v.literal("preference"),
  v.literal("observation"),
  v.literal("hypothesis"),
  v.literal("user_quote"),
);

// conversation_facts.payload — discriminated union; kind tag matches fact_type.
const conversationFactPayloadValidator = v.union(
  v.object({
    kind: v.literal("id_reference"),
    entity_type: v.string(),
    entity_id: v.string(),
  }),
  v.object({
    kind: v.literal("preference"),
    dimension: v.string(),
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
);

// conversation_facts.written_by
const conversationFactWrittenByValidator = v.union(
  v.literal("chat_agent"),
  v.literal("user_selection"),
  v.literal("health_monitor"),
  v.literal("system"),
);

// user_semantic_facts.fact_type
const userSemanticFactTypeValidator = v.union(
  v.literal("mechanic_preference"),
  v.literal("service_preference"),
  v.literal("communication_style"),
  v.literal("vehicle_quirk"),
  v.literal("history_anchor"),
);

// user_semantic_facts.source
const userSemanticSourceValidator = v.union(
  v.literal("user_stated"),
  v.literal("inferred_behavior"),
  v.literal("mechanic_confirmed"),
);

// user_semantic_facts.written_by
const userSemanticWrittenByValidator = v.union(
  v.literal("chat_agent"),
  v.literal("health_monitor"),
  v.literal("admin_edit"),
  v.literal("system"),
);

// conversation_episodic_control.mood
const moodValidator = v.union(
  v.literal("neutral"),
  v.literal("curious"),
  v.literal("concerned"),
  v.literal("frustrated"),
  v.literal("satisfied"),
);

// conversation_episodic_control.current_flow
const flowValidator = v.union(
  v.literal("diagnostic"),
  v.literal("booking"),
  v.literal("maintenance"),
  v.literal("education"),
  v.literal("status_check"),
  v.literal("off_topic"),
  v.literal("none"),
);

// conversation_episodic_control.current_model
const modelValidator = v.union(
  v.literal("haiku"),
  v.literal("sonnet"),
  v.literal("human_handoff"),
);

// conversation_episodic_control.escalation_state
const escalationStateValidator = v.union(
  v.literal("none"),
  v.literal("requested"),
  v.literal("active"),
  v.literal("human"),
);

// conversation_audit.role
const auditRoleValidator = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("tool"),
);

// conversation_audit.model_used
const auditModelValidator = v.union(
  v.literal("haiku"),
  v.literal("sonnet"),
);

// kb_topics.category
const kbTopicCategoryValidator = v.union(
  v.literal("fluids"),
  v.literal("brakes"),
  v.literal("battery"),
  v.literal("tires"),
  v.literal("filters"),
  v.literal("intervals"),
  v.literal("torque_specs"),
  v.literal("general"),
);

// -----------------------------------------------------------------------------
// Day 2 sentinel — every stub throws this until the body lands. Avoids the
// silent-no-op risk a `return undefined` body would carry if a caller mis-
// imports the stub before Day 2 ships.
// -----------------------------------------------------------------------------

const NOT_IMPLEMENTED_MSG =
  "Wave 3 Day 2 — not yet implemented. See docs/SPRINT_2/WAVE_3_DESIGN.md §2.";

// =============================================================================
// conversation_facts mutations (§2.1)
// =============================================================================

// -----------------------------------------------------------------------------
// recordConversationFact — chat-agent / health-monitor / system append path.
//
// Inserts a new conversation_facts row. NO audit table — the row IS its own
// creation record (append-only discipline IS the audit log).
//
// Caller contract:
//   - fact_type and payload.kind MUST match (helper validates Day 2)
//   - written_by MUST be one of the four legal values (validator-enforced)
//   - "user_selection" is reserved for recordSelectionFact; recordConversationFact
//     rejects written_by: "user_selection" at the body level (Day 2)
//   - source_turn must be >= 0
//
// Day 2 TODO: validate payload.kind matches fact_type, write the row.
// -----------------------------------------------------------------------------
export const recordConversationFact = mutation({
  args: {
    conversation_id: v.id("ai_conversations"),
    fact_type: conversationFactTypeValidator,
    payload: conversationFactPayloadValidator,
    source_turn: v.number(),
    written_by: conversationFactWrittenByValidator,
  },
  handler: async (
    _ctx: MutationCtx,
    _args,
  ): Promise<Id<"conversation_facts">> => {
    // TODO: Day 2 — validate payload.kind matches fact_type, reject
    // written_by: "user_selection" (use recordSelectionFact), insert row.
    throw new Error(NOT_IMPLEMENTED_MSG);
  },
});

// -----------------------------------------------------------------------------
// recordSelectionFact — mobile-tap path.
//
// Specialization of recordConversationFact for user-selection events.
// Forces written_by: "user_selection" and fact_type: "id_reference".
// Distinguishing user-selection from chat-agent appends is the entire point
// of the established_facts race fix (Doc 1 §3.3).
//
// Day 2 TODO: build the payload from (entity_type, entity_id), insert.
// -----------------------------------------------------------------------------
export const recordSelectionFact = mutation({
  args: {
    conversation_id: v.id("ai_conversations"),
    entity_type: v.string(),    // "mechanic" | "shop" | "vehicle" | "service"
    entity_id: v.string(),
    source_turn: v.number(),
  },
  handler: async (
    _ctx: MutationCtx,
    _args,
  ): Promise<Id<"conversation_facts">> => {
    // TODO: Day 2 — build id_reference payload + insert with
    // written_by: "user_selection".
    throw new Error(NOT_IMPLEMENTED_MSG);
  },
});

// -----------------------------------------------------------------------------
// retractConversationFact — soft-retract.
//
// Sets the three retract fields atomically:
//   retracted_at, retracted_reason, retracted_by_turn
// A row whose retracted_at is already set CANNOT be re-retracted (idempotent
// guard rejects). The row body itself is immutable — retract is a flag, not
// an edit. D-3.2 hill enforced here.
//
// Day 2 TODO: read row, check not already retracted, patch the triple.
// -----------------------------------------------------------------------------
export const retractConversationFact = mutation({
  args: {
    fact_id: v.id("conversation_facts"),
    reason: v.string(),
    retracted_by_turn: v.number(),
  },
  handler: async (_ctx: MutationCtx, _args): Promise<void> => {
    // TODO: Day 2 — read, validate not already retracted, patch retract triple.
    throw new Error(NOT_IMPLEMENTED_MSG);
  },
});

// =============================================================================
// user_semantic_facts mutations (§2.2)
// =============================================================================

// -----------------------------------------------------------------------------
// recordUserSemanticFact — initial append.
//
// Inserts a new user_semantic_facts row at confidence 1.0, observation_count
// 1, first_observed == last_reinforced == now.
//
// (source, written_by) legality matrix (§7 D3, helper-enforced Day 2):
//   - health_monitor MUST NOT write source: "mechanic_confirmed"
//   - system        MUST NOT write source: "mechanic_confirmed"
//   - admin_edit    MAY write any combination
//   - chat_agent    MAY write any source observed in chat
//
// Day 2 TODO: validate the (source, written_by) matrix, insert row.
// -----------------------------------------------------------------------------
export const recordUserSemanticFact = mutation({
  args: {
    user_id: v.id("users"),
    vehicle_id: v.optional(v.id("vehicles")),
    fact_type: userSemanticFactTypeValidator,
    payload: v.string(),
    source: userSemanticSourceValidator,
    written_by: userSemanticWrittenByValidator,
  },
  handler: async (
    _ctx: MutationCtx,
    _args,
  ): Promise<Id<"user_semantic_facts">> => {
    // TODO: Day 2 — enforce (source, written_by) matrix, insert with
    // confidence: 1.0, observation_count: 1, first_observed/last_reinforced: now.
    throw new Error(NOT_IMPLEMENTED_MSG);
  },
});

// -----------------------------------------------------------------------------
// reinforceUserSemanticFact — asymptotic confidence bump.
//
// Patches three fields atomically:
//   confidence       = 1 - (1 - confidence) * 0.5    (asymptotes toward 1.0)
//   observation_count = observation_count + 1
//   last_reinforced  = now
//
// All three writes are monotonic (confidence only increases toward 1.0;
// observation_count only increments; last_reinforced only advances), so the
// D-3.2 safety property is preserved structurally. Reinforcing a retracted
// row is illegal and rejected at the helper layer (Day 2).
//
// Day 2 TODO: read row, validate not retracted, compute new confidence,
// patch the triple.
// -----------------------------------------------------------------------------
export const reinforceUserSemanticFact = mutation({
  args: {
    fact_id: v.id("user_semantic_facts"),
  },
  handler: async (_ctx: MutationCtx, _args): Promise<void> => {
    // TODO: Day 2 — read, validate not retracted, compute 1 - (1 - c) * 0.5,
    // patch (confidence, observation_count, last_reinforced).
    throw new Error(NOT_IMPLEMENTED_MSG);
  },
});

// -----------------------------------------------------------------------------
// retractUserSemanticFact — soft-retract.
//
// Sets the three retract fields atomically:
//   retracted_at, retracted_reason, retracted_at_floor_ms
// Per-user-cap pagination handled at the read layer (§7 D2: 500-row read-
// time pagination, NOT a write-time deletion threshold).
//
// retracted_at_floor_ms is the GC clock for the 365-day cold-cleanup cron
// (Day 5+). Set to retracted_at here.
//
// Day 2 TODO: read row, validate not already retracted, patch the triple.
// -----------------------------------------------------------------------------
export const retractUserSemanticFact = mutation({
  args: {
    fact_id: v.id("user_semantic_facts"),
    reason: v.string(),
  },
  handler: async (_ctx: MutationCtx, _args): Promise<void> => {
    // TODO: Day 2 — read, validate not already retracted, patch
    // (retracted_at, retracted_reason, retracted_at_floor_ms).
    throw new Error(NOT_IMPLEMENTED_MSG);
  },
});

// =============================================================================
// conversation_episodic_control mutations (§2.3)
// =============================================================================

// -----------------------------------------------------------------------------
// commitEpisodic — model-influenced fields only.
//
// Patches ONLY episodic fields (mood, current_flow, flow_turn_count,
// arc_summary, compressed_history_summary, compressed_through_turn).
// MUST NOT touch control fields — that's commitControl's exclusive surface.
// Field-class write-authority enforced by separate helpers (D-2.1 LOCKED).
//
// Concurrency: expected_turn must equal the stored updated_by_turn. Mismatch
// triggers reconciliation per §7 D8 policy (throw in v1; fail-loud; soften
// to deterministic-merge only if production telemetry shows races are real).
//
// Day 2 TODO: read row, validate expected_turn == updated_by_turn, patch
// episodic delta + bump updated_at + updated_by_turn.
// -----------------------------------------------------------------------------
export const commitEpisodic = mutation({
  args: {
    conversation_id: v.id("ai_conversations"),
    expected_turn: v.number(),
    delta: v.object({
      mood: v.optional(moodValidator),
      current_flow: v.optional(flowValidator),
      flow_turn_count: v.optional(v.number()),
      arc_summary: v.optional(v.string()),
      compressed_history_summary: v.optional(v.string()),
      compressed_through_turn: v.optional(v.number()),
    }),
    next_turn: v.number(),
  },
  handler: async (_ctx: MutationCtx, _args): Promise<void> => {
    // TODO: Day 2 — find row by conversation_id, validate expected_turn ==
    // updated_by_turn, patch delta + (updated_at, updated_by_turn).
    throw new Error(NOT_IMPLEMENTED_MSG);
  },
});

// -----------------------------------------------------------------------------
// commitControl — system-only fields.
//
// Patches ONLY control fields (current_model, budget_spent_usd,
// budget_cap_usd, escalation_count, escalation_state, sonnet_turns_used,
// sonnet_turn_budget). MUST NOT touch episodic fields. The model NEVER
// reaches this helper — CI Rule 16 (Day 3) defends statically.
//
// Day 2 TODO: read row, validate expected_turn, patch control delta + bump
// updated_at + updated_by_turn.
// -----------------------------------------------------------------------------
export const commitControl = mutation({
  args: {
    conversation_id: v.id("ai_conversations"),
    expected_turn: v.number(),
    delta: v.object({
      current_model: v.optional(modelValidator),
      budget_spent_usd: v.optional(v.number()),
      budget_cap_usd: v.optional(v.number()),
      escalation_count: v.optional(v.number()),
      escalation_state: v.optional(escalationStateValidator),
      sonnet_turns_used: v.optional(v.number()),
      sonnet_turn_budget: v.optional(v.number()),
    }),
    next_turn: v.number(),
  },
  handler: async (_ctx: MutationCtx, _args): Promise<void> => {
    // TODO: Day 2 — find row, validate expected_turn, patch control delta.
    throw new Error(NOT_IMPLEMENTED_MSG);
  },
});

// =============================================================================
// conversation_audit mutations (§2.4)
// =============================================================================

// -----------------------------------------------------------------------------
// recordTurn — THE only legal write path for conversation_audit.
//
// STRICT APPEND-ONLY. No patch, no replace, no delete anywhere — CI Rule 12
// (Day 3) enforces. Same logic as vehicle_facts_audit (Sprint 1): if the
// forensic spine becomes mutable, the safety property collapses.
//
// Stamping discipline: prompt_version MUST be passed on every assistant
// turn (Doc 1 §3.1 gap closed). model_used MUST be passed on every
// assistant turn. tool_calls captures the full tool-use payload so Wave 5
// retrieval debugging has a complete trace. Empty content allowed (e.g.,
// an assistant turn that is pure tool_calls).
//
// Coexistence: ai_messages is the mobile-render substrate (chat list);
// conversation_audit is the forensic record. Both written together in the
// same Convex mutation per turn (atomic). Day 2 wires this into the
// chat-loop dispatch so the writes happen together.
//
// Day 2 TODO: enforce role-conditional invariants (prompt_version /
// model_used required for assistant), insert.
// -----------------------------------------------------------------------------
export const recordTurn = mutation({
  args: {
    conversation_id: v.id("ai_conversations"),
    turn_number: v.number(),
    role: auditRoleValidator,
    content: v.string(),
    tool_calls: v.optional(
      v.array(
        v.object({
          name: v.string(),
          input: v.any(),
          output: v.optional(v.any()),
        }),
      ),
    ),
    model_used: v.optional(auditModelValidator),
    prompt_version: v.optional(v.string()),
  },
  handler: async (
    _ctx: MutationCtx,
    _args,
  ): Promise<Id<"conversation_audit">> => {
    // TODO: Day 2 — role-conditional invariants:
    //   role === "assistant" => model_used + prompt_version required
    //   role === "user"      => model_used + prompt_version + tool_calls must be undefined
    //   role === "tool"      => content represents tool output; prompt_version optional
    // Validate (conversation_id, turn_number, role) uniqueness via index scan.
    // Insert.
    throw new Error(NOT_IMPLEMENTED_MSG);
  },
});

// =============================================================================
// kb_topics mutations (§2.5)
// =============================================================================

// -----------------------------------------------------------------------------
// registerKbTopic — admin-gated topic registration.
//
// Inserts a new kb_topics row. Throws on duplicate topic_key (Convex lacks
// native unique indexes; helper enforces by reading by_topic_key first).
// Admin-only: created_by must be Waleed or Temur (enforced via the user_id
// allowlist at the helper layer, Day 2).
//
// retrieval_priority range: agreed with RAG Specialist as a 0..1 ranking
// weight (final coordination in Wave 5 dispatch). Helper validates [0, 1]
// at insert time (Day 2).
//
// Day 2 TODO: check admin allowlist, check duplicate key, insert.
// -----------------------------------------------------------------------------
export const registerKbTopic = mutation({
  args: {
    topic_key: v.string(),
    display_name: v.string(),
    category: kbTopicCategoryValidator,
    expected_unit: v.optional(v.string()),
    retrieval_priority: v.number(),
    created_by: v.id("users"),
  },
  handler: async (
    _ctx: MutationCtx,
    _args,
  ): Promise<Id<"kb_topics">> => {
    // TODO: Day 2 — admin allowlist gate, duplicate-key check, [0,1] range
    // check on retrieval_priority, insert.
    throw new Error(NOT_IMPLEMENTED_MSG);
  },
});

// -----------------------------------------------------------------------------
// deprecateKbTopic — write-once deprecation pair.
//
// Patches deprecated_at + deprecated_reason. Idempotent guard: a row whose
// deprecated_at is already set rejects. topic_key / display_name / category
// / created_by / created_at are NEVER patched after insert — only the
// deprecation pair is mutable. CI Rule 17 (Day 3) defends statically.
//
// Day 2 TODO: read row, validate not already deprecated, patch the pair.
// -----------------------------------------------------------------------------
export const deprecateKbTopic = mutation({
  args: {
    topic_id: v.id("kb_topics"),
    reason: v.string(),
  },
  handler: async (_ctx: MutationCtx, _args): Promise<void> => {
    // TODO: Day 2 — read, validate not already deprecated, patch
    // (deprecated_at, deprecated_reason).
    throw new Error(NOT_IMPLEMENTED_MSG);
  },
});

// =============================================================================
// Internal mutation surface (migrations + reconciliation only)
// =============================================================================
//
// Day 2-3 may add `internalMutation` exports for the backfill drivers
// (e.g., backfillConversationFacts dual-writes through a sanctioned
// internal entrypoint). Pre-imported here so the migration scaffolding
// has a stable import target. No internal helpers in the Day 1 skeleton.
// =============================================================================

// Pre-imported for Day 2-3 use. Silence the unused-import warning until then.
void internalMutation;
void NOT_IMPLEMENTED_MSG;
// Pre-imported types kept available for Day 2 (Doc<...> snapshots for
// pre-write reads in retract/reinforce paths).
type _UnusedAtDay1 = Doc<"conversation_facts"> | Doc<"user_semantic_facts">;
void (undefined as unknown as _UnusedAtDay1);
