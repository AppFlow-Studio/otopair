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

import { mutation, internalMutation, query } from "../_generated/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
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
    ctx: MutationCtx,
    args,
  ): Promise<Id<"conversation_facts">> => {
    // Discriminator integrity — payload.kind MUST equal fact_type.
    if (args.payload.kind !== args.fact_type) {
      throw new Error(
        `recordConversationFact: payload.kind="${args.payload.kind}" must match fact_type="${args.fact_type}"`,
      );
    }
    // user_selection is reserved for recordSelectionFact (mobile-tap).
    if (args.written_by === "user_selection") {
      throw new Error(
        `recordConversationFact: written_by="user_selection" is reserved for recordSelectionFact; use that helper for mobile-tap appends.`,
      );
    }
    if (args.source_turn < 0) {
      throw new Error(
        `recordConversationFact: source_turn must be >= 0; got ${args.source_turn}`,
      );
    }

    const now = Date.now();
    const factId = await ctx.db.insert("conversation_facts", {
      conversation_id: args.conversation_id,
      fact_type: args.fact_type,
      payload: args.payload,
      source_turn: args.source_turn,
      created_at: now,
      written_by: args.written_by,
      // retract triple intentionally unset (undefined) on insert.
    });
    return factId;
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
    ctx: MutationCtx,
    args,
  ): Promise<Id<"conversation_facts">> => {
    if (!args.entity_type.trim()) {
      throw new Error("recordSelectionFact: entity_type required");
    }
    if (!args.entity_id.trim()) {
      throw new Error("recordSelectionFact: entity_id required");
    }
    if (args.source_turn < 0) {
      throw new Error(
        `recordSelectionFact: source_turn must be >= 0; got ${args.source_turn}`,
      );
    }

    const now = Date.now();
    const factId = await ctx.db.insert("conversation_facts", {
      conversation_id: args.conversation_id,
      fact_type: "id_reference",
      payload: {
        kind: "id_reference",
        entity_type: args.entity_type,
        entity_id: args.entity_id,
      },
      source_turn: args.source_turn,
      created_at: now,
      written_by: "user_selection",
    });
    return factId;
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
  handler: async (ctx: MutationCtx, args): Promise<void> => {
    if (!args.reason.trim()) {
      throw new Error("retractConversationFact: reason required");
    }
    if (args.retracted_by_turn < 0) {
      throw new Error(
        `retractConversationFact: retracted_by_turn must be >= 0; got ${args.retracted_by_turn}`,
      );
    }

    const row = await ctx.db.get(args.fact_id);
    if (!row) {
      throw new Error(`retractConversationFact: fact ${args.fact_id} not found`);
    }
    // Idempotent guard — already retracted rows reject (D-3.2 write-once).
    if (row.retracted_at !== undefined) {
      throw new Error(
        `retractConversationFact: already retracted (idempotent guard); fact ${args.fact_id}`,
      );
    }

    const now = Date.now();
    // Atomic patch of the retract triple. The three fields are set together;
    // never split. D-3.2 hill enforced.
    await ctx.db.patch(args.fact_id, {
      retracted_at: now,
      retracted_reason: args.reason,
      retracted_by_turn: args.retracted_by_turn,
    });
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
    ctx: MutationCtx,
    args,
  ): Promise<Id<"user_semantic_facts">> => {
    if (!args.payload.trim()) {
      throw new Error("recordUserSemanticFact: payload required");
    }

    // (source, written_by) legality matrix per design doc §2.2 + §7 D3.
    // Non-chat / non-admin agents MUST NOT write source: "mechanic_confirmed"
    // (deception vector — a background agent forging a verified service
    // record is the threat we're closing).
    if (args.source === "mechanic_confirmed") {
      if (args.written_by === "health_monitor" || args.written_by === "system") {
        throw new Error(
          `recordUserSemanticFact: (source="mechanic_confirmed", written_by="${args.written_by}") is illegal; only chat_agent and admin_edit may write mechanic_confirmed facts.`,
        );
      }
    }

    const now = Date.now();
    const factId = await ctx.db.insert("user_semantic_facts", {
      user_id: args.user_id,
      vehicle_id: args.vehicle_id,
      fact_type: args.fact_type,
      payload: args.payload,
      // Initial insert: stored confidence at 1.0 (the asymptote ceiling).
      // Decay is computed at read time by the retrieval layer (Wave 5).
      confidence: 1.0,
      source: args.source,
      written_by: args.written_by,
      first_observed: now,
      last_reinforced: now,
      observation_count: 1,
      // retract triple intentionally unset (undefined) on initial insert.
    });
    return factId;
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
  handler: async (ctx: MutationCtx, args): Promise<void> => {
    const row = await ctx.db.get(args.fact_id);
    if (!row) {
      throw new Error(
        `reinforceUserSemanticFact: fact ${args.fact_id} not found`,
      );
    }
    if (row.retracted_at !== undefined) {
      throw new Error(
        `reinforceUserSemanticFact: cannot reinforce retracted fact ${args.fact_id}`,
      );
    }

    // Asymptotic confidence formula per design doc §2.2:
    //   new_confidence = 1 - (1 - old_confidence) * 0.5
    // The factor 0.5 halves the remaining gap to 1.0 on each reinforcement.
    // Asymptotes toward 1.0; never reaches it. Monotonic increase preserves
    // the D-3.2 safety property structurally.
    const current = row.confidence;
    const next = 1 - (1 - current) * 0.5;
    // Defense in depth: clamp at the [0, 1] interval. The formula never
    // exceeds 1.0 for any input in [0, 1], but the row's stored value could
    // in theory have been written outside that range by an earlier bug or
    // an admin_edit bypass. Clamping is cheap and the invariant is hard.
    const clamped = Math.max(0, Math.min(1, next));

    const now = Date.now();
    await ctx.db.patch(args.fact_id, {
      confidence: clamped,
      observation_count: row.observation_count + 1,
      last_reinforced: now,
    });
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
  handler: async (ctx: MutationCtx, args): Promise<void> => {
    if (!args.reason.trim()) {
      throw new Error("retractUserSemanticFact: reason required");
    }
    const row = await ctx.db.get(args.fact_id);
    if (!row) {
      throw new Error(
        `retractUserSemanticFact: fact ${args.fact_id} not found`,
      );
    }
    if (row.retracted_at !== undefined) {
      throw new Error(
        `retractUserSemanticFact: already retracted (idempotent guard); fact ${args.fact_id}`,
      );
    }

    const now = Date.now();
    // Set the three retract fields atomically. retracted_at_floor_ms is the
    // GC clock for the 365-day cold-cleanup cron (Day 5+); we initialize it
    // to the same value as retracted_at so the cron can scan by
    // by_retracted_floor and hard-delete rows past the floor.
    await ctx.db.patch(args.fact_id, {
      retracted_at: now,
      retracted_reason: args.reason,
      retracted_at_floor_ms: now,
    });
  },
});

// =============================================================================
// conversation_episodic_control mutations (§2.3)
// =============================================================================

// -----------------------------------------------------------------------------
// getEpisodicControl — read helper for the wire-in surfaces.
//
// commitEpisodic and commitControl require expected_turn == row.updated_by_turn
// for concurrency-detection (§7 D8 fail-loud). Callers must read the row to
// learn the current updated_by_turn BEFORE invoking the commit. This helper
// is the sanctioned read path so the wire-in lives entirely inside the
// memoryEditing surface area (no callers reach into the table directly).
//
// Returns null when no row exists (pre-init). Wire-in code paths follow the
// pattern: initEpisodicControl -> getEpisodicControl -> commit{Episodic,Control}.
// -----------------------------------------------------------------------------
export const getEpisodicControl = query({
  args: {
    conversation_id: v.id("ai_conversations"),
  },
  handler: async (
    ctx: QueryCtx,
    args,
  ): Promise<Doc<"conversation_episodic_control"> | null> => {
    const row = await ctx.db
      .query("conversation_episodic_control")
      .withIndex("by_conversation", (q) =>
        q.eq("conversation_id", args.conversation_id),
      )
      .first();
    return row;
  },
});

// -----------------------------------------------------------------------------
// initEpisodicControl — idempotent row bootstrap.
//
// Wave 3 Day 6 wire-in (chat.ts integration step 3): the schema is mutable-
// in-place, so `commitEpisodic` and `commitControl` both throw when no row
// exists for the conversation. They cannot lazily insert because the field-
// class split forbids them from touching the OTHER class's fields, and a
// schema-valid initial row needs values for BOTH classes (every field is
// non-optional except the two compression fields). This bootstrap helper
// fills that gap with defaults that mirror today's ai_conversations
// equivalents (mood/current_flow/arc unset → safe neutral seed; current_model
// → "haiku" matches the Sonnet-cascade default; counters → 0; budget_cap →
// 0 since no cost-management policy is wired yet — Wave 5 dispatch sets it).
//
// Idempotent: if a row already exists for conversation_id, returns its _id
// without modification. Multiple wire-in callers (commitEpisodic + commitControl
// landings in chat.ts) call this on every turn; only the FIRST observes an
// insert. Concurrent-call safety relies on Convex's single-mutation-at-a-time
// guarantee per document (the `by_conversation` index is queried first; a
// concurrent insert would surface as a second row, which we then prune is
// out of scope — Wave 3 §7 D8 fail-loud discipline says we'd rather see two
// rows in dev telemetry than silently merge).
//
// Field-class purity: this helper is the ONE legal place that writes BOTH
// classes in a single insert. After the row exists, the field-class split
// is enforced by the separate commit helpers as designed.
// -----------------------------------------------------------------------------
export const initEpisodicControl = mutation({
  args: {
    conversation_id: v.id("ai_conversations"),
  },
  handler: async (
    ctx: MutationCtx,
    args,
  ): Promise<Id<"conversation_episodic_control">> => {
    const existing = await ctx.db
      .query("conversation_episodic_control")
      .withIndex("by_conversation", (q) =>
        q.eq("conversation_id", args.conversation_id),
      )
      .first();
    if (existing) {
      return existing._id;
    }
    const now = Date.now();
    const rowId = await ctx.db.insert("conversation_episodic_control", {
      conversation_id: args.conversation_id,
      // Episodic-class defaults — safe-neutral seed; mood "neutral" / flow
      // "none" / arc_summary "" mirror the convention used by the envelope
      // builder when the legacy ai_conversations fields are unset.
      mood: "neutral",
      current_flow: "none",
      flow_turn_count: 0,
      arc_summary: "",
      // compression fields intentionally unset (undefined) — Wave 3.9 / D-3.4
      // populates them when compression actually runs.
      // Control-class defaults — current_model "haiku" matches the Sonnet-
      // cascade default (Locked Principle #2: HAIKU_MODEL is the chat origin);
      // counters zero; budget_cap 0 because no cost-management policy is wired
      // until Wave 5 dispatch sets a real ceiling.
      current_model: "haiku",
      budget_spent_usd: 0,
      budget_cap_usd: 0,
      escalation_count: 0,
      escalation_state: "none",
      sonnet_turns_used: 0,
      sonnet_turn_budget: 0,
      // Concurrency-detection envelope — turn 0 is the seed; the first commit
      // expects updated_by_turn=0.
      updated_at: now,
      updated_by_turn: 0,
    });
    return rowId;
  },
});

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
  handler: async (ctx: MutationCtx, args): Promise<void> => {
    const row = await ctx.db
      .query("conversation_episodic_control")
      .withIndex("by_conversation", (q) =>
        q.eq("conversation_id", args.conversation_id),
      )
      .first();
    if (!row) {
      throw new Error(
        `commitEpisodic: no conversation_episodic_control row for conversation ${args.conversation_id}`,
      );
    }
    // Concurrency-detection envelope. expected_turn MUST equal the stored
    // updated_by_turn — a mismatch means a concurrent write happened, which
    // we treat as a hard error per §7 D8 (fail-loud in v1; soften to
    // deterministic-merge only if production telemetry shows races are real).
    if (row.updated_by_turn !== args.expected_turn) {
      throw new Error(
        `commitEpisodic: turn mismatch on conversation ${args.conversation_id}; ` +
          `expected_turn=${args.expected_turn} but stored updated_by_turn=${row.updated_by_turn}`,
      );
    }
    // Monotonic guard on next_turn — turn counters never decrease.
    if (args.next_turn < row.updated_by_turn) {
      throw new Error(
        `commitEpisodic: next_turn (${args.next_turn}) must be >= updated_by_turn (${row.updated_by_turn})`,
      );
    }

    // Build the patch payload using conditional spread to avoid setting
    // optional fields to `undefined` (the Convex strict-mode idiom called
    // out in the role spec's "Convex idiosyncrasies").
    const patch: Record<string, unknown> = {
      updated_at: Date.now(),
      updated_by_turn: args.next_turn,
      ...(args.delta.mood !== undefined ? { mood: args.delta.mood } : {}),
      ...(args.delta.current_flow !== undefined
        ? { current_flow: args.delta.current_flow }
        : {}),
      ...(args.delta.flow_turn_count !== undefined
        ? { flow_turn_count: args.delta.flow_turn_count }
        : {}),
      ...(args.delta.arc_summary !== undefined
        ? { arc_summary: args.delta.arc_summary }
        : {}),
      ...(args.delta.compressed_history_summary !== undefined
        ? { compressed_history_summary: args.delta.compressed_history_summary }
        : {}),
      ...(args.delta.compressed_through_turn !== undefined
        ? { compressed_through_turn: args.delta.compressed_through_turn }
        : {}),
    };
    await ctx.db.patch(row._id, patch);
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
  handler: async (ctx: MutationCtx, args): Promise<void> => {
    const row = await ctx.db
      .query("conversation_episodic_control")
      .withIndex("by_conversation", (q) =>
        q.eq("conversation_id", args.conversation_id),
      )
      .first();
    if (!row) {
      throw new Error(
        `commitControl: no conversation_episodic_control row for conversation ${args.conversation_id}`,
      );
    }
    if (row.updated_by_turn !== args.expected_turn) {
      throw new Error(
        `commitControl: turn mismatch on conversation ${args.conversation_id}; ` +
          `expected_turn=${args.expected_turn} but stored updated_by_turn=${row.updated_by_turn}`,
      );
    }
    if (args.next_turn < row.updated_by_turn) {
      throw new Error(
        `commitControl: next_turn (${args.next_turn}) must be >= updated_by_turn (${row.updated_by_turn})`,
      );
    }
    // Monotonic-on-counters discipline (§7 D8). Counters never decrease.
    if (
      args.delta.budget_spent_usd !== undefined &&
      args.delta.budget_spent_usd < row.budget_spent_usd
    ) {
      throw new Error(
        `commitControl: budget_spent_usd monotonic violation; ` +
          `delta=${args.delta.budget_spent_usd} < stored=${row.budget_spent_usd}`,
      );
    }
    if (
      args.delta.escalation_count !== undefined &&
      args.delta.escalation_count < row.escalation_count
    ) {
      throw new Error(
        `commitControl: escalation_count monotonic violation; ` +
          `delta=${args.delta.escalation_count} < stored=${row.escalation_count}`,
      );
    }
    if (
      args.delta.sonnet_turns_used !== undefined &&
      args.delta.sonnet_turns_used < row.sonnet_turns_used
    ) {
      throw new Error(
        `commitControl: sonnet_turns_used monotonic violation; ` +
          `delta=${args.delta.sonnet_turns_used} < stored=${row.sonnet_turns_used}`,
      );
    }

    const patch: Record<string, unknown> = {
      updated_at: Date.now(),
      updated_by_turn: args.next_turn,
      ...(args.delta.current_model !== undefined
        ? { current_model: args.delta.current_model }
        : {}),
      ...(args.delta.budget_spent_usd !== undefined
        ? { budget_spent_usd: args.delta.budget_spent_usd }
        : {}),
      ...(args.delta.budget_cap_usd !== undefined
        ? { budget_cap_usd: args.delta.budget_cap_usd }
        : {}),
      ...(args.delta.escalation_count !== undefined
        ? { escalation_count: args.delta.escalation_count }
        : {}),
      ...(args.delta.escalation_state !== undefined
        ? { escalation_state: args.delta.escalation_state }
        : {}),
      ...(args.delta.sonnet_turns_used !== undefined
        ? { sonnet_turns_used: args.delta.sonnet_turns_used }
        : {}),
      ...(args.delta.sonnet_turn_budget !== undefined
        ? { sonnet_turn_budget: args.delta.sonnet_turn_budget }
        : {}),
    };
    await ctx.db.patch(row._id, patch);
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
    ctx: MutationCtx,
    args,
  ): Promise<Id<"conversation_audit">> => {
    if (args.turn_number < 0) {
      throw new Error(
        `recordTurn: turn_number must be >= 0; got ${args.turn_number}`,
      );
    }

    // Role-conditional invariants per the TODO contract.
    if (args.role === "assistant") {
      if (args.model_used === undefined) {
        throw new Error(
          "recordTurn: role=assistant requires model_used (Doc 1 §3.1 gap closed)",
        );
      }
      if (args.prompt_version === undefined || !args.prompt_version.trim()) {
        throw new Error(
          "recordTurn: role=assistant requires prompt_version (Wave 1.5 protocol)",
        );
      }
    } else if (args.role === "user") {
      // User turns are pure input; model/prompt/tool fields MUST be absent.
      if (args.model_used !== undefined) {
        throw new Error(
          "recordTurn: role=user must not carry model_used",
        );
      }
      if (args.prompt_version !== undefined) {
        throw new Error(
          "recordTurn: role=user must not carry prompt_version",
        );
      }
      if (args.tool_calls !== undefined) {
        throw new Error(
          "recordTurn: role=user must not carry tool_calls",
        );
      }
    } // role === "tool": prompt_version optional; model_used optional.

    // Uniqueness on (conversation_id, turn_number, role) — strict
    // append-only and Doc 1 §3.1's "no double-write" invariant. Convex has
    // no native unique constraint; the helper checks via the
    // by_conversation_turn index scan.
    const existingRows = await ctx.db
      .query("conversation_audit")
      .withIndex("by_conversation_turn", (q) =>
        q
          .eq("conversation_id", args.conversation_id)
          .eq("turn_number", args.turn_number),
      )
      .collect();
    for (const r of existingRows) {
      if (r.role === args.role) {
        throw new Error(
          `recordTurn: duplicate (conversation_id=${args.conversation_id}, turn_number=${args.turn_number}, role="${args.role}") — append-only invariant violation`,
        );
      }
    }

    const now = Date.now();
    const auditId = await ctx.db.insert("conversation_audit", {
      conversation_id: args.conversation_id,
      turn_number: args.turn_number,
      role: args.role,
      content: args.content,
      // Optional fields routed via conditional spread to avoid Convex's
      // optional-with-explicit-undefined edge case.
      ...(args.tool_calls !== undefined ? { tool_calls: args.tool_calls } : {}),
      ...(args.model_used !== undefined ? { model_used: args.model_used } : {}),
      ...(args.prompt_version !== undefined
        ? { prompt_version: args.prompt_version }
        : {}),
      timestamp: now,
    });
    return auditId;
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
    ctx: MutationCtx,
    args,
  ): Promise<Id<"kb_topics">> => {
    if (!args.topic_key.trim()) {
      throw new Error("registerKbTopic: topic_key required");
    }
    if (!args.display_name.trim()) {
      throw new Error("registerKbTopic: display_name required");
    }
    if (args.retrieval_priority < 0 || args.retrieval_priority > 1) {
      throw new Error(
        `registerKbTopic: retrieval_priority must be in [0, 1]; got ${args.retrieval_priority}`,
      );
    }

    // Idempotent guard — return existing id if (topic_key) already registered.
    // Convex has no native unique index; helper enforces by reading
    // by_topic_key first. Migration backfills depend on this idempotent
    // shape so re-runs are safe (the migration calls this helper per seed).
    const existing = await ctx.db
      .query("kb_topics")
      .withIndex("by_topic_key", (q) => q.eq("topic_key", args.topic_key))
      .first();
    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    const topicId = await ctx.db.insert("kb_topics", {
      topic_key: args.topic_key,
      display_name: args.display_name,
      category: args.category,
      ...(args.expected_unit !== undefined
        ? { expected_unit: args.expected_unit }
        : {}),
      retrieval_priority: args.retrieval_priority,
      created_by: args.created_by,
      created_at: now,
    });
    return topicId;
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
  handler: async (ctx: MutationCtx, args): Promise<void> => {
    if (!args.reason.trim()) {
      throw new Error("deprecateKbTopic: reason required");
    }
    const row = await ctx.db.get(args.topic_id);
    if (!row) {
      throw new Error(`deprecateKbTopic: topic ${args.topic_id} not found`);
    }
    if (row.deprecated_at !== undefined) {
      throw new Error(
        `deprecateKbTopic: already deprecated (idempotent guard); topic ${args.topic_id}`,
      );
    }
    // Write-once deprecation pair. topic_key / display_name / category /
    // created_by / created_at are NEVER patched — only the deprecation pair
    // is mutable. (CI Rule 17 — Day 3 — will defend statically.)
    const now = Date.now();
    await ctx.db.patch(args.topic_id, {
      deprecated_at: now,
      deprecated_reason: args.reason,
    });
  },
});

// =============================================================================
// Internal mutation surface (migrations + reconciliation only)
// =============================================================================
//
// Migrations (convex/oto/migrations/wave3Backfill.ts) call the public
// helpers above via ctx.runMutation(api.oto.memoryEditing.*). The
// `internalMutation` symbol is pre-imported for future internal-only
// helpers (e.g., reconciliation-driven retractions); Day 2 does not add
// any. The `Doc` type is referenced inline by helper handlers via
// ctx.db.get<...> return inference.
// =============================================================================

void internalMutation;
void (undefined as unknown as Doc<"conversation_facts">);
