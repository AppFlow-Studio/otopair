# Wave 7.2 — Degradation Ladder Design

**Status:** DESIGN ONLY (Day 9). Implementation deferred to Day 10+.
**Date:** 2026-05-17 (Sprint 2 Day 9)
**Owner:** LLM Reliability Engineer
**Authority:** Doc 3 §10 (Failure modes and graceful degradation); Day 6 cross-mandate consultation flags ("no degradation ladder defined" + "no latency budget on retries"); Day 8 EOD `ReturnsValidationError` post-mortem (the silent-swallow gap this doc closes structurally).

---

## 0. The contract this doc establishes

Production chat is a stack of co-dependent capabilities (Anthropic API, Convex memory wire-ins, web_search server-tool, Wave 3 helper writes, cascade retrieval). Each can fail independently. Today every failure is caught + swallowed + warned to stdout (~21 sites in `chat.ts`) and the chat turn continues degraded — but the system has **no notion of state**: there is no per-surface health metric, no canned-fallback messaging when a critical surface is unhealthy, and no auto-recovery probe.

This doc defines:
1. The four ladder states (FULL → DEGRADED → MINIMAL → DOWN) and what each delivers to the user.
2. The transition triggers between adjacent states (one promotion, one demotion path per neighbor pair).
3. The data source the state-decision logic reads (`reliability_events` table, populated by Day 9 observability dispatch).
4. The API contract for code paths that need to consult the current state (`getCurrentDegradationState` internalQuery).
5. The recovery probe (auto-promotion conditions).

This doc is **the contract for Day 10+ implementation**. The observability substrate it depends on lands today in `convex/oto/reliability.ts` (sibling deliverable B/C of this same dispatch).

---

## 1. The four ladder states

| State | Model | Data tools | State tools | Render tools | web_search | Memory wire-ins | User-facing posture |
|---|---|---|---|---|---|---|---|
| **FULL** | Haiku (default) + Sonnet cascade | All enabled | All enabled | All enabled | Enabled | All enabled (recordTurn, recordConversationFact, commitEpisodic, commitControl, recordSelectionFact, getCrossConversationMemory, record_semantic_fact, reinforce, retract pair) | Normal chat with full personalization, retrieval, web search |
| **DEGRADED** | Haiku + Sonnet cascade | All enabled | All enabled | All enabled | **DISABLED** | All enabled (memory wire-ins continue best-effort) | Normal chat minus web search; visible only on questions that would have triggered web_search (the model still answers from KB + envelope) |
| **MINIMAL** | Haiku only (no Sonnet handoff) | **DISABLED** (no `retrieve_vehicle_facts`, no `get_*` data lookups) | State tools only (`update_conversation_state`, `record_semantic_fact`) | **DISABLED** (no render of pickers, carousels, forms) | DISABLED | Memory writes continue if Convex is reachable; retrieval reads disabled | Canned summary from envelope only: "Here's what I have on file about your vehicle: …" + "Sorry, I'm having trouble accessing services right now; please try again in a moment." |
| **DOWN** | None (no Anthropic call attempted) | Disabled | Disabled | Disabled | Disabled | Disabled | Friendly retry only: "Sorry — Oto is having trouble right now. Please try again in a moment." with `error_kind: "outage"` field surfaced for harness/UI logging |

### 1.1 State semantics

**FULL** is the default and the only state in which the system delivers its full capability set. The other three are progressive amputations driven by observed failure patterns. The ladder is monotonic in capability (FULL > DEGRADED > MINIMAL > DOWN).

**DEGRADED** specifically targets the `web_search` server-managed tool. web_search has its own failure modes (rate limits, Anthropic-side quota, slow networks during a real-time crawl) that are independent of the main Anthropic API. When web_search fails repeatedly inside a turn or across recent turns, we strip it from the merged tool list on subsequent turns so Haiku stops trying. The model still has retrieval (`retrieve_vehicle_facts`), the envelope's `<recent_context>` + `<vehicle_facts>`, and conversation history — these cover most queries.

**MINIMAL** is the "Anthropic-is-flaky-but-Convex-is-OK" floor. When Anthropic API calls are exhausting their retry budget repeatedly (the `AnthropicTransientError` rate climbs), we stop attempting tool-use loops. Instead we surface envelope facts to the user as a canned summary. This is the same model `chat.ts` already returns via the friendly-fallback path (commit `54b169d`), but generalized: instead of waiting for one turn's retry to exhaust, we *pre-empt* by going straight to canned text on the first attempt.

**DOWN** is "Anthropic is fully unavailable." We don't even attempt the API call — we return the same friendly-retry copy as `MINIMAL` but flag `error_kind: "outage"` so the UI can render a banner.

### 1.2 Why these four states (not three, not five)

- 3 states (FULL / MINIMAL / DOWN) misses the web_search-only failure mode, which is the most common partial degradation we observed in production (web_search server-tool errors come up but the main API is fine — per the `[oto/chat] retrieve_vehicle_facts runFullCascade swallowed error:` signal Day 6 RAG consultation flagged).
- 5 states (adding a "DEGRADED-MEMORY" tier between FULL and DEGRADED-WEB-SEARCH) over-fits. Memory wire-ins failing doesn't change the user's experience materially — recordTurn failing means analytics gap, not user-facing failure. We deliberately keep memory wire-ins in MINIMAL because they're best-effort fire-and-forget anyway.

### 1.3 Compatibility with existing fallback in chat.ts

The current friendly-fallback at `sendMessageHandler` lines 348-372 (commit `54b169d`) is the **DOWN** state's user-facing copy in disguise. After Wave 7.2 implementation:
- It STAYS as the bottom-of-stack guard (defense-in-depth: even if the ladder logic mis-classifies state, retry-exhaust still produces a friendly response).
- The ladder PRE-EMPTS it for repeat failures: instead of one slow attempt per turn, we go straight to canned text after N consecutive exhausts.

---

## 2. Transition triggers

The ladder transitions on read-side decisions: every chat turn reads `getCurrentDegradationState` at turn start and applies that state's gates to its tool list, model selection, and response shaping. Writes happen via `recordReliabilityEvent` (Deliverable B) at every existing swallow site.

Transitions are computed in `getCurrentDegradationState` as a pure function of recent `reliability_events` rows. No persisted state — the table IS the state.

### 2.1 Demotion paths (FULL → DEGRADED → MINIMAL → DOWN)

| Path | Trigger (read from `reliability_events` table) |
|---|---|
| FULL → DEGRADED | ≥3 events with `surface="cascade_strangler_full_cascade"` AND `kind="swallowed"` in the trailing 5-minute window, OR ≥3 `surface="anthropic_call_main"` events with `error_message` matching `/web_search/i` in trailing 5 min. (The web_search server tool errors come back through the main Anthropic call path, not via a dedicated surface — we substring-detect.) |
| DEGRADED → MINIMAL | ≥3 events with `surface="anthropic_retry_exhausted"` AND `kind="transient_error"` in trailing 5 min. The retry wrapper has already done its job; chronic retry-exhaust signals upstream pain. |
| MINIMAL → DOWN | ≥5 consecutive `surface="anthropic_retry_exhausted"` events with no successful Anthropic call in between AND the most recent event is < 60 seconds old. This is "everything we tried failed and we're still failing." |

**Window choice rationale.** A 5-minute trailing window covers normal load-balancer hiccup waves without locking in degradation for >5 minutes of recovery time. Most Anthropic outages cluster < 5 min historically; 5 min is also long enough to filter out single-burst false positives from N=1 transient blips.

**Threshold choice rationale (3 / 3 / 5).** The numbers are deliberately conservative — easier to demote than to promote so we don't oscillate. The exact values are tunable post-deploy based on real observability data; v1 picks defensible defaults.

### 2.2 Promotion paths (auto-recovery; ladder climbs back)

The ladder MUST self-heal. Manual ops intervention is not in the v1 design.

| Path | Trigger |
|---|---|
| DOWN → MINIMAL | ≥1 `surface="anthropic_call_main"` event with `kind="success"` in the trailing 60 seconds. (Anthropic API reachable again.) |
| MINIMAL → DEGRADED | ≥3 consecutive `surface="anthropic_call_main"` events with `kind="success"` AND no `anthropic_retry_exhausted` events in trailing 5 min. (Anthropic is stable; promote one rung.) |
| DEGRADED → FULL | ≥3 consecutive `surface="cascade_strangler_full_cascade"` events with `kind="success"` AND no web_search-error events in trailing 5 min. (web_search is healthy.) |

**Why 3-in-a-row for promotion.** Symmetric to demotion thresholds; biased slightly conservative. A single success after a wave of failures may be a sampled-recovery (the next call fails again) — we want a small cooldown.

### 2.3 Anti-oscillation

The trailing-window approach naturally damps oscillation: a 5-min window means we don't toggle between states more than ~every 2-3 minutes in the worst case (the window has to clear of demotion events before promotion fires).

If oscillation is observed post-deploy, the next iteration adds a state-change cooldown timer (e.g., must hold a state for ≥90 seconds before transitioning again). For v1, we accept potential mild oscillation as the cost of fast recovery.

---

## 3. Data sources — `reliability_events` table

This doc references the table defined in Deliverable B of the same dispatch (`convex/schema.ts` addition + `convex/oto/reliability.ts` helper). The table is observability-only; it does not directly drive runtime behavior. The state-decision logic queries it.

### 3.1 Read pattern for `getCurrentDegradationState`

```ts
// Pseudocode for the Day 10+ implementation.
export const getCurrentDegradationState = internalQuery({
  args: {},
  returns: v.union(
    v.literal("FULL"),
    v.literal("DEGRADED"),
    v.literal("MINIMAL"),
    v.literal("DOWN"),
  ),
  handler: async (ctx) => {
    const now = Date.now();
    const FIVE_MIN_MS = 5 * 60 * 1000;
    const SIXTY_SEC_MS = 60 * 1000;
    const windowFloor = now - FIVE_MIN_MS;

    // Read all reliability_events in trailing 5 min via by_surface_kind_time
    // index. Bounded scan; user_id NOT in scope for ladder state (system-wide,
    // not per-user).
    const recent = await ctx.db
      .query("reliability_events")
      .withIndex("by_surface_kind_time", (q) =>
        q.gte("_creationTime", windowFloor),
      )
      .collect();

    // Count by surface+kind. Decide ladder state by the rules in §2.
    // Order matters: check from most-degraded to least-degraded.
    // ... DOWN check first (5 consecutive exhausts + most recent < 60s) ...
    // ... then MINIMAL check ...
    // ... then DEGRADED check ...
    // ... fall through to FULL ...
    return "FULL"; // default
  },
});
```

Read latency budget: ≤50ms for the indexed scan. The 5-minute window with realistic event volume (~tens to hundreds per minute at scale) keeps the scan bounded.

### 3.2 Write pattern (Deliverable B/C of this dispatch)

Every swallow site in `chat.ts` writes one `reliability_events` row per swallowed error via fire-and-forget `recordReliabilityEvent`. The table grows ~21 rows × turn rate × failure rate. At ~1% per-surface failure rate and 100 turns/min, that's ~21 rows per minute total. Storage cost negligible (each row < 1KB).

A cron-driven GC for the table (delete rows > 7 days old) is out of scope for Day 9; flagged as a Day 11+ candidate alongside the cross-conv eval fixture cleanup hook.

---

## 4. API contract — how callers consult the ladder

### 4.1 Read at turn start (`chat.ts:sendMessageHandler`)

```ts
const ladderState = await ctx.runQuery(
  internal.oto.reliability.getCurrentDegradationState,
);

if (ladderState === "DOWN") {
  return {
    text: "Sorry — Oto is having trouble right now. Please try again in a moment.",
    error_kind: "outage",
  };
}

if (ladderState === "MINIMAL") {
  // Build a canned summary from the envelope's vehicle_facts + recent_context
  // (already constructed by buildEnvelope). Skip the Anthropic call entirely.
  return buildCannedMinimalResponse(envelope);
}

// FULL or DEGRADED: proceed with chat.ts as today, but gate tool list:
const toolNames =
  ladderState === "DEGRADED"
    ? TOOL_NAMES_V1 // (already excludes web_search; web_search is server-managed)
    : TOOL_NAMES_V1;
// For DEGRADED, also strip web_search from SERVER_MANAGED_TOOLS in callAnthropic.
```

### 4.2 Per-turn gates

| State | What gates change in `chat.ts` |
|---|---|
| FULL | No changes (current behavior) |
| DEGRADED | `callAnthropic` strips `web_search` from `SERVER_MANAGED_TOOLS` for this turn |
| MINIMAL | Skip the entire tool-use loop; return canned summary from envelope |
| DOWN | Return friendly-retry copy immediately; do not call Anthropic |

### 4.3 Read latency budget on the ladder query

The state read MUST NOT add > 50ms to the chat turn at p99. If we observe higher latency, the implementation falls back to "assume FULL" — defense-in-depth: a slow observability layer must never break the chat path.

---

## 5. Implementation plan (Day 10+)

Not part of this dispatch. Documented here for the next implementor:

1. **Day 10:** Add `getCurrentDegradationState` internalQuery to `convex/oto/reliability.ts` per §3.1.
2. **Day 10:** Add `buildCannedMinimalResponse(envelope)` helper to `chat.ts` — formats envelope's vehicle_facts + recent_context into a polite "Here's what I have on file…" message.
3. **Day 10:** Wire `getCurrentDegradationState` read at `sendMessageHandler` line ~400 (right after auth, before envelope build).
4. **Day 11:** Add cron-driven GC on `reliability_events` (delete rows > 7 days old).
5. **Day 11:** Add eval cases under `tests/eval/cases/degradation/` exercising each transition trigger via pre-seeded `reliability_events` rows.

---

## 6. Cross-mandate consumers

This doc's state machine is read-only from the perspectives of:
- **Memory Engineer**: memory wire-ins continue best-effort in all states; the ladder does not directly gate them.
- **RAG Specialist**: `runFullCascade` swallowed errors feed the FULL→DEGRADED trigger (web_search-tagged failures); cascade walks continue in DEGRADED state.
- **Security Analyst**: Wave 7.3 read-rate-limit operates orthogonally; rate-limit hits feed `recordReliabilityEvent` (kind="rate_limited") but do NOT directly trigger ladder transitions in v1.
- **Prompt Engineer**: prompt versions are independent of ladder state; the same SYSTEM_PROMPT is used in FULL/DEGRADED. MINIMAL bypasses Anthropic entirely so the prompt is not loaded.
- **QA Lead**: eval-test the ladder via `pre_seed_mutations` primitive (already shipped Day 8) to insert synthetic `reliability_events` rows and assert correct state classification.

---

## 7. Wave 1.5 protocol implication

The ladder is **eval-testable** via the existing `REPEAT × CASE_FILTER` primitives. Day 10+ test cases can:
1. Seed `reliability_events` to force each state.
2. Run the same case under each state and assert tool-list / response shape.
3. Validate the auto-promotion timer after a 60-second wait.

This is the Wave 1.5 hook for the degradation ladder. Prompt Engineer's standing Wave 1.5 protocol flag (owed for v0.9 → v0.13 bumps) is unblocked by the same observability substrate this doc designs.

---

## 8. Out of scope (Day 9 design dispatch)

The following decisions are NOT made by this doc and are flagged for PM review:

1. **Per-user vs system-wide state.** v1 is system-wide (one ladder for all users). A per-user ladder would let one abusive user's quota exhaust drop them to MINIMAL without affecting others — but doubles the read complexity. Flagged for Day 11+ if Wave 7.3 read-rate-limit data shows per-user demand asymmetry.
2. **Manual ops override.** No admin-side "force MINIMAL" knob in v1. If we need this (e.g., during a planned Anthropic outage), the cleanest path is an `ai_runtime_flags` Convex table the ladder read checks first. Day 11+.
3. **Canned MINIMAL response copy.** §1's example wording ("Here's what I have on file…") is a placeholder. Final copy needs Prompt Engineer + UX input.
4. **Latency budget on retries.** Day 6 Reliability consultation flagged "no latency budget on retries." This doc addresses the OUTCOME (pre-empt slow retry waves via MINIMAL state) but not the per-retry latency cap. A per-retry deadline (e.g., "abort after 8s total wall-clock") is a complementary Day 11+ knob.

---

## 9. Decisions flagged for PM review

- [ ] Confirm the 4 states (vs 3 or 5).
- [ ] Confirm the 5-min trailing window (vs longer for stability or shorter for responsiveness).
- [ ] Confirm thresholds (3/3/5 demote, 1/3/3 promote).
- [ ] Confirm per-user vs system-wide (v1: system-wide).
- [ ] Confirm canned MINIMAL response copy (placeholder in §4.1).
- [ ] Confirm GC cadence on `reliability_events` (proposal: cron daily, delete > 7d old).
- [ ] Confirm latency budget (proposal: 50ms p99 on `getCurrentDegradationState`).

---

## 10. References

- `docs/SPRINT_2_DAY_6_LOG.md` §1.1 + §5 — cross-mandate consultation that surfaced the "no degradation ladder" gap.
- `docs/SPRINT_2_DAY_8_LOG.md` §2.4 + §8.3 — the `ReturnsValidationError` post-mortem that motivates observability over swallow.
- Commit `54b169d` — Anthropic retry+backoff foundation this doc extends.
- `convex/oto/chat.ts` lines 348-372 — existing friendly-fallback path (the DOWN state's user-facing copy in disguise).
- `convex/oto/reliability.ts` (NEW, this dispatch) — observability substrate; the read source for §3.1.
- Doc 3 §10 — failure modes mandate (Reliability Engineer role file `.claude/agents/llm-reliability-engineer.md`).

— End of Wave 7.2 design doc.
