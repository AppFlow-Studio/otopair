// =============================================================================
// Oto AI — Reliability observability substrate (Wave 7.2 sibling)
// =============================================================================
//
// Sprint 2 Day 9 (2026-05-17). Authority: Doc 3 §10 (Failure modes and
// graceful degradation); Day 8 EOD ReturnsValidationError post-mortem
// (every static check passed but the chat-turn cross-conv read was broken
// silently for ~12 hrs); Day 6 cross-mandate consultation flag ("21 swallow
// points silent to ops"). Owner: LLM Reliability Engineer.
//
// THIS FILE IS THE ONLY SANCTIONED WRITE PATH FOR reliability_events.
//
// What this file IS:
//   - recordReliabilityEvent: internalMutation that fire-and-forget callers
//     in chat.ts invoke from their catch blocks. Inserts ONE row into
//     reliability_events, truncating error_message at 200 chars.
//   - getRecentEventsBySurface: small internalQuery the future Wave 7.2
//     ladder-state-decision logic (Day 10+) consumes. Indexed trailing-
//     window scan; no aggregation in v1.
//
// What this file IS NOT (yet):
//   - The ladder state machine. See docs/SPRINT_2/WAVE_7_2_DEGRADATION_LADDER.md
//     for the contract; the state machine lives in a future
//     getCurrentDegradationState internalQuery (Day 10+).
//   - A cron-driven GC. The table grows unboundedly today; Day 11+ adds
//     a cron that deletes rows > 7 days old.
//   - Aggregated metrics. v1 returns raw rows; consumers aggregate.
//
// Fire-and-forget pattern (critical):
//   Every caller in chat.ts uses .catch() on the recordReliabilityEvent
//   promise to swallow its own failure. This is the bottom of the
//   reliability stack: observability failure must NEVER break the chat turn.
//   If the table itself becomes unavailable, the chat path continues
//   degraded as today (with stdout warns); we just lose the metric/alert
//   substrate for the duration.
//
// Surface + kind enums (canonical list — keep in sync with schema.ts header):
//   See `KNOWN_SURFACES` and `KNOWN_KINDS` below. New surfaces are added
//   here when a new swallow site is introduced; new kinds when a new
//   failure mode is discovered. Both are documented constants rather than
//   enforced unions so we can extend without schema migration.
//
// PII rules:
//   error_message is truncated to 200 chars. user_id and conversation_id
//   are Convex ids (opaque) — no email / VIN / clerk_user_id ever in this
//   table. metadata is a v.any() bag; callers MUST NOT include PII fields.
//   Day 11+ CI rule will defend the metadata bag.
//
// =============================================================================

import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Canonical surface + kind enums. Documented constants rather than schema
// unions; extending = adding a string here. The schema's v.string validator
// accepts any string but consumers (the Wave 7.2 ladder, future alerts)
// only know about these.
// ---------------------------------------------------------------------------

export const KNOWN_SURFACES = [
  // Anthropic call paths
  "anthropic_call_main",
  "anthropic_call_forced",
  "anthropic_retry_exhausted",
  // Wave 3 wire-ins (one per swallow site in chat.ts)
  "wave3_record_turn",
  "wave3_record_conversation_fact",
  "wave3_commit_episodic",
  "wave3_commit_control_sonnet",
  "wave3_commit_control_haiku",
  "wave3_record_selection_fact",
  "wave3_get_cross_conv_memory",
  "wave3_record_semantic_fact",
  "wave3_record_semantic_fact_reinforce",
  "wave3_retract_semantic_fact",
  "wave3_retract_conversation_fact",
  // Sprint 2 strangler + control-class
  "cascade_strangler_full_cascade",
  "setCurrentModel_sonnet_handoff",
  "setCurrentModel_haiku_handback",
  // Outer boundaries
  "chat_action_uncaught",
  // The self-monitor (bottom of the stack — recorded when the recorder
  // itself fails; we ALSO console.error in chat.ts so this is doubled, but
  // the row is the structured signal)
  "recordReliabilityEvent_itself",
] as const;

export const KNOWN_KINDS = [
  "success",
  "transient_error",
  "validation_error",
  "auth_error",
  "rate_limited",
  "fallback_fired",
  "swallowed",
] as const;

// Max length for the error_message column. 200 chars is enough to identify
// the failure class (the typical Convex error message starts with the
// helper name + a short reason). Longer is wasted bytes; consumers should
// rely on `surface` + `kind` for classification, not free text parsing.
const ERROR_MESSAGE_MAX_CHARS = 200;

// ---------------------------------------------------------------------------
// recordReliabilityEvent — the canonical write path.
//
// Called from chat.ts swallow sites inside `.catch()` so the recorder's own
// failure mode (e.g., Convex transport hiccup the moment we try to record
// an Anthropic transport hiccup) does NOT propagate. The caller's .catch()
// wraps THIS .catch() — defense-in-depth.
//
// Args mirror the schema 1:1 except error_message which we truncate here.
// The chat.ts caller does not need to pre-truncate; centralizing the rule
// keeps it consistent across all swallow sites.
// ---------------------------------------------------------------------------

export const recordReliabilityEvent = internalMutation({
  args: {
    surface: v.string(),
    kind: v.string(),
    error_message: v.optional(v.string()),
    latency_ms: v.optional(v.number()),
    user_id: v.optional(v.id("users")),
    conversation_id: v.optional(v.id("ai_conversations")),
    metadata: v.optional(v.any()),
  },
  returns: v.id("reliability_events"),
  handler: async (ctx, args) => {
    // Truncate error_message at 200 chars to keep rows compact. Empty-after-
    // truncation stays as empty string (caller may have passed ""); only
    // strip the field entirely when the caller didn't pass it at all.
    const truncatedMessage =
      typeof args.error_message === "string"
        ? args.error_message.slice(0, ERROR_MESSAGE_MAX_CHARS)
        : undefined;

    return await ctx.db.insert("reliability_events", {
      surface: args.surface,
      kind: args.kind,
      ...(truncatedMessage !== undefined
        ? { error_message: truncatedMessage }
        : {}),
      ...(args.latency_ms !== undefined ? { latency_ms: args.latency_ms } : {}),
      ...(args.user_id !== undefined ? { user_id: args.user_id } : {}),
      ...(args.conversation_id !== undefined
        ? { conversation_id: args.conversation_id }
        : {}),
      ...(args.metadata !== undefined ? { metadata: args.metadata } : {}),
    });
  },
});

// ---------------------------------------------------------------------------
// getRecentEventsBySurface — Wave 7.2 ladder-state-decision read helper.
//
// Indexed trailing-window scan: "give me all events of (surface, kind) at or
// after timestamp T." The state-decision logic (Day 10+) calls this once
// per ladder-state check (~once per turn) for each surface/kind combo it
// cares about. With < 100 rows per 5-minute window in normal load, the
// scan is cheap.
//
// Bounded read: defensively cap at 200 results. The state machine reads
// COUNTS not contents; if the window has > 200 events of one (surface, kind)
// we're already in heavy-degradation territory and the count alone tells us.
// ---------------------------------------------------------------------------

const RECENT_EVENTS_MAX_RESULTS = 200;

export const getRecentEventsBySurface = internalQuery({
  args: {
    surface: v.string(),
    kind: v.string(),
    // Trailing-window floor (timestamp in ms). Caller computes
    // `Date.now() - windowMs`.
    since_ms: v.number(),
  },
  returns: v.array(
    v.object({
      _id: v.id("reliability_events"),
      _creationTime: v.number(),
      surface: v.string(),
      kind: v.string(),
      error_message: v.optional(v.string()),
      latency_ms: v.optional(v.number()),
      user_id: v.optional(v.id("users")),
      conversation_id: v.optional(v.id("ai_conversations")),
      metadata: v.optional(v.any()),
    }),
  ),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("reliability_events")
      .withIndex("by_surface_kind_time", (q) =>
        q
          .eq("surface", args.surface)
          .eq("kind", args.kind)
          .gte("_creationTime", args.since_ms),
      )
      .order("desc")
      .take(RECENT_EVENTS_MAX_RESULTS);
    return rows;
  },
});
