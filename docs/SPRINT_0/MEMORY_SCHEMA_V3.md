> **⚠ SUPERSEDED 2026-05-16 by `MEMORY_SCHEMA_V3_CONSOLIDATED.md`.**
>
> This document specified a parallel `vehicle_searched_facts` table. Waleed ruled the parallel table was wrong — it was the same thing as the existing `vehicle_facts` (whose `source` enum already includes `web_search`). Consolidation v3 collapsed them into the single `vehicle_facts` table with v3 lifecycle fields added in place, the embedding column + vectorIndex removed entirely, and two NEW tables only (`vehicle_facts_audit` + `fact_reports`). See `MEMORY_SCHEMA_V3_CONSOLIDATED.md` for the authoritative spec and `SPRINT_1_DAY_1_CORRECTION_LOG.md` for the rollback record.
>
> The content below is preserved as the historical record of the prior pass.

---

# MEMORY_SCHEMA_V3

**Owner:** Memory Systems Engineer (adversarial review panel, Doc 3 §5)
**Status:** Locked for Wave 5 shadow rollout
**Supersedes:** Memory Schema V2 draft (six-table proposal)
**Companion:** D-3.2 (append-only invariant), relocated per v3 update

---

## 0. Scope and Posture

This document specifies three new Convex tables that complete the Oto memory layer:

1. `vehicle_searched_facts` — mutable in place. Holds web_search-sourced answers persisted on a miss against enrichment-owned structured tables.
2. `vehicle_searched_facts_audit` — append-only. Captures previous values on every edit, retract, or verify event against `vehicle_searched_facts`.
3. `fact_reports` — user-submitted reports about messages that referenced a searched fact, with disposition lifecycle.

The append-only invariant **D-3.2 remains unchanged** for `conversation_facts` and `user_semantic_facts` (out of scope for this doc; those tables exist as specified in Memory Schema V2 §3-4). The safety property D-3.2 was protecting — historical reconstruction and defense against compromised internal accounts — relocates here to `vehicle_searched_facts_audit`.

Lifecycle for `vehicle_searched_facts`: `unverified | verified | retracted`. No auto-promotion. Human-only verification by Waleed or Temur via admin UI.

---

## 1. Schema Definitions

The following blocks are paste-ready for `convex/schema.ts`. They assume the file already imports `defineSchema`, `defineTable`, and `v` from `convex/server` and `convex/values` respectively, and that the existing schema export pattern is in place.

### 1.1 `vehicle_searched_facts`

```ts
// Mutable in place. Threat model differs from D-3.2 tables:
//   - No concurrent writers (admin UI serializes edits behind a single reviewer at a time).
//   - Edits are deliberate human review actions, not background agents.
//   - Historical reconstruction lives in the paired audit table, not here.
vehicle_searched_facts: defineTable({
  // ----- Identity / scoping -----
  scope: v.union(
    v.literal("global"),         // applies to all vehicles (e.g., "what is OBD-II")
    v.literal("make"),           // make-level (e.g., Toyota recall pattern)
    v.literal("make_model"),     // make+model
    v.literal("make_model_year"),// make+model+year
    v.literal("vin"),            // VIN-specific
  ),
  scope_key: v.string(), // composite key matching scope shape, normalized lower-case

  topic: v.string(), // coarse category — "maintenance" | "specs" | "recalls" | "diagnostic" | "general"

  // SHA-256 hex of the canonicalized user question. Used to dedupe identical
  // questions across users and bypass web_search on cache hit.
  canonical_question_key: v.string(),

  // ----- Content -----
  fact_text: v.string(), // the answer body, agent-rendered, persisted verbatim

  // ----- Provenance -----
  source: v.literal("web_search"), // locked literal; this table is web_search-sourced only
  source_url: v.optional(v.string()),

  // Who wrote this row. Union, not free-string, so CI can enumerate writers.
  written_by: v.union(
    v.literal("chat_agent"),     // normal path: agent persists after web_search
    v.literal("health_monitor"), // background reconciliation worker
    v.literal("admin_edit"),     // human edit through admin UI
    v.literal("system"),         // migrations, backfills
  ),

  // Who asked the question that caused the row to be created. Optional because
  // health_monitor/system rows may have no asker.
  asked_by_user_id: v.optional(v.id("users")),
  asked_at: v.number(), // ms epoch

  // ----- Quality / lifecycle -----
  confidence: v.number(), // 0..1; web_search-sourced facts must be <= 0.7 at insert time

  verification_status: v.union(
    v.literal("unverified"), // default on insert
    v.literal("verified"),   // human review by Waleed or Temur
    v.literal("retracted"),  // soft-retracted; not served to chat
  ),
  verified_at: v.optional(v.number()),
  retracted_at: v.optional(v.number()),

  // ----- Report telemetry (denormalized for review-queue ordering) -----
  // Kept on the row itself so the review queue can order by report_count
  // without a join. Source of truth is still the fact_reports table; this
  // pair is recomputed on every fact_reports insert inside the same mutation.
  report_count: v.number(),
  last_reported_at: v.optional(v.number()),

  // ----- Timestamps -----
  created_at: v.number(),
  updated_at: v.number(),
})
  // Cache lookup: agent computes canonical_question_key, queries this index
  // first. O(log n) point lookup, hottest read path in the system.
  .index("by_canonical_question", ["canonical_question_key"])

  // Scope-narrowed browse for admin UI and for agent fallbacks that want
  // "everything I know about this VIN". Compound key keeps the index dense.
  .index("by_scope", ["scope", "scope_key"])

  // Review queue: "show me everything unverified, oldest first" is the most
  // common admin workflow. Sorting by created_at inside a status partition.
  .index("by_verification_status", ["verification_status", "created_at"])

  // Reported-content review queue: highest-report-count first. Cheap because
  // report_count is denormalized onto the row.
  .index("by_report_count", ["report_count"])

  // Full-text search over fact_text, scoped by (scope, scope_key). Lets the
  // agent do a fuzzy fallback if the canonical_question_key is a miss but
  // semantically similar content exists. Filter fields keep recall bounded.
  .searchIndex("by_text", {
    searchField: "fact_text",
    filterFields: ["scope", "scope_key"],
  }),
```

### 1.2 `vehicle_searched_facts_audit`

```ts
// Append-only. This is where D-3.2's safety property lives now.
// Every edit to vehicle_searched_facts MUST write one row here in the same
// Convex mutation. See §3 (Mutation-layer enforcement).
vehicle_searched_facts_audit: defineTable({
  fact_id: v.id("vehicle_searched_facts"),
  edited_by: v.id("users"), // must be Waleed or Temur for human edits; system user id for cron edits
  edited_at: v.number(),

  action: v.union(
    v.literal("verify"),    // unverified -> verified
    v.literal("retract"),   // any -> retracted
    v.literal("edit_text"), // fact_text changed
    v.literal("edit_meta"), // scope, scope_key, topic, confidence, source_url changed
  ),

  // Snapshot of the row fields that changed, BEFORE the edit. Free-form
  // object because the shape varies by action. We do not snapshot the whole
  // row to keep storage bounded; downstream reconciliation reconstructs
  // current state by replaying actions in order.
  previous_values: v.object({
    fact_text: v.optional(v.string()),
    verification_status: v.optional(v.string()),
    confidence: v.optional(v.number()),
    scope: v.optional(v.string()),
    scope_key: v.optional(v.string()),
    topic: v.optional(v.string()),
    source_url: v.optional(v.string()),
  }),

  reason: v.string(), // required free-text; admin UI enforces non-empty
})
  // Per-fact history view: "show me the full edit chain for this fact in
  // chronological order". Compound on edited_at gives sorted scans for free.
  .index("by_fact", ["fact_id", "edited_at"])

  // Per-editor audit: "what has Temur changed this week". Needed for the
  // compromised-account threat model — if an editor account is suspected
  // compromised, we need to enumerate everything it touched.
  .index("by_editor", ["edited_by", "edited_at"])

  // Time-range scan for reconciliation cron (§4).
  .index("by_time", ["edited_at"]),
```

### 1.3 `fact_reports`

```ts
fact_reports: defineTable({
  // What's being reported. fact_id is the canonical link; conversation_id
  // and message_id give the agent context for why the user reported it.
  fact_id: v.id("vehicle_searched_facts"),
  conversation_id: v.id("conversations"),
  message_id: v.id("messages"),

  reported_by: v.id("users"),
  reported_at: v.number(),
  user_note: v.optional(v.string()),

  disposition: v.union(
    v.literal("open"),           // default on insert; in review queue
    v.literal("edited"),         // resolved by editing the underlying fact
    v.literal("retracted"),      // resolved by retracting the underlying fact
    v.literal("answer_quality"), // not a factual problem; user UX complaint
    v.literal("no_action"),      // reviewed, no change warranted
  ),

  resolved_by: v.optional(v.id("users")),
  resolved_at: v.optional(v.number()),
  resolution_note: v.optional(v.string()),
})
  // Review queue ordering: open first, oldest open first. Disposition is
  // low-cardinality so this index stays compact.
  .index("by_disposition", ["disposition", "reported_at"])

  // "All reports against this fact" — used by admin UI fact-detail view
  // and by the report_count reconciliation check (§4).
  .index("by_fact", ["fact_id", "reported_at"])

  // "All reports filed by this user" — abuse detection (one user reporting
  // everything) and per-user history.
  .index("by_reporter", ["reported_by", "reported_at"]),
```

---

## 2. Migration Outline

**Goal:** add three tables, change nothing existing, run dual-read during Wave 5 shadow phase, no destructive ops.

**Preconditions:**
- The existing `vehicle_facts` table (current AI-written KB, pre-v3) **stays in place**. It is read-only during Wave 5. We do not migrate its rows into `vehicle_searched_facts`; the two have different provenance and confidence floors.
- Enrichment-owned tables (`vehicle_config`, `engine_specs`, `tire_specs`, `chassis_specs`, etc.) are untouched.
- The `users`, `conversations`, and `messages` tables exist (referenced by `v.id(...)` in the schemas above). Verify before applying.

**Step 1 — Schema apply (idempotent):**
- Add the three table definitions from §1 to `convex/schema.ts`.
- Run `npx convex dev`. Convex `defineTable` adds are non-destructive; existing data is untouched. Re-running the migration is a no-op.

**Step 2 — Seed system user (idempotent):**
- Insert (or upsert by stable email key) a `users` row representing the `system` editor. This id is referenced by `vehicle_searched_facts_audit.edited_by` for cron-driven edits. Idempotent: lookup by email before insert.

**Step 3 — Wire writers:**
- `chat_agent` writer: agent path persists web_search results to `vehicle_searched_facts` with `written_by: "chat_agent"`, `verification_status: "unverified"`, `confidence <= 0.7`, `report_count: 0`. No audit row required on **insert** (audit captures **edits**, not creation).
- `admin_edit` writer: admin UI calls the `editSearchedFact` helper (§3.1).
- `health_monitor` writer: background job that re-validates rows; uses `editSearchedFact` for any change.

**Step 4 — Dual-read shadow phase (Wave 5):**
- Agent read path: enrichment tables -> `vehicle_searched_facts` -> `web_search`. The legacy `vehicle_facts` table is **not** in the new read path.
- Shadow log: for each query that hits `vehicle_searched_facts`, also lookup `vehicle_facts` and emit a telemetry event with both results. Do not serve from `vehicle_facts`. This generates the corpus we'll use to decide the eventual fate of `vehicle_facts` (post-Wave 5).
- No data is moved during shadow. The old table is a passive comparison source.

**Step 5 — Post-shadow decision (out of scope for this doc):**
- After two weeks of shadow telemetry, Waleed decides: keep `vehicle_facts` as historical archive, migrate selectively into `vehicle_searched_facts` as `written_by: "system"` rows, or deprecate. None of these paths are destructive.

**Rollback:** drop the three new tables (Convex supports drop via schema removal + manual cleanup). `vehicle_facts` is untouched throughout, so rollback is symmetric.

---

## 3. Mutation-Layer Enforcement

The invariant: **every edit to `vehicle_searched_facts` writes a corresponding row to `vehicle_searched_facts_audit` in the same Convex mutation.** This is what preserves the relocated D-3.2 safety property. Enforcement is layered: helper pattern at the code level, grep rule at CI, telemetry invariant at runtime.

### 3.1 Helper function pattern

All edits go through a single helper. Direct `ctx.db.patch` against `vehicle_searched_facts` is **forbidden** outside this helper (enforced by §3.2 grep rule).

```ts
// convex/searchedFacts.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";

type SearchedFactChanges = Partial<{
  fact_text: string;
  verification_status: "unverified" | "verified" | "retracted";
  confidence: number;
  scope: "global" | "make" | "make_model" | "make_model_year" | "vin";
  scope_key: string;
  topic: string;
  source_url: string;
}>;

type AuditAction = "verify" | "retract" | "edit_text" | "edit_meta";

// THE ONLY sanctioned path to mutate vehicle_searched_facts.
// Atomically:
//   1. Reads current row
//   2. Computes previous_values diff (only fields actually changing)
//   3. Patches the row + updated_at + status timestamps
//   4. Inserts the audit row
// All in a single Convex mutation -> single transaction -> atomic.
export const editSearchedFact = mutation({
  args: {
    factId: v.id("vehicle_searched_facts"),
    changes: v.object({
      fact_text: v.optional(v.string()),
      verification_status: v.optional(v.string()),
      confidence: v.optional(v.number()),
      scope: v.optional(v.string()),
      scope_key: v.optional(v.string()),
      topic: v.optional(v.string()),
      source_url: v.optional(v.string()),
    }),
    editorId: v.id("users"),
    reason: v.string(),
    action: v.union(
      v.literal("verify"),
      v.literal("retract"),
      v.literal("edit_text"),
      v.literal("edit_meta"),
    ),
  },
  handler: async (ctx, { factId, changes, editorId, reason, action }) => {
    if (!reason.trim()) {
      throw new Error("editSearchedFact: reason is required");
    }
    const current = await ctx.db.get(factId);
    if (!current) throw new Error("Fact not found");

    // Build previous_values snapshot of ONLY changing fields.
    const previous_values: Record<string, unknown> = {};
    for (const k of Object.keys(changes) as (keyof SearchedFactChanges)[]) {
      if (changes[k] !== undefined && changes[k] !== (current as never)[k]) {
        previous_values[k] = (current as never)[k];
      }
    }

    // No-op guard: if nothing actually changed, do not write an audit row.
    if (Object.keys(previous_values).length === 0) return;

    const now = Date.now();
    const patch: Record<string, unknown> = { ...changes, updated_at: now };
    if (action === "verify") patch.verified_at = now;
    if (action === "retract") patch.retracted_at = now;

    await ctx.db.patch(factId, patch);
    await ctx.db.insert("vehicle_searched_facts_audit", {
      fact_id: factId,
      edited_by: editorId,
      edited_at: now,
      action,
      previous_values,
      reason,
    });
  },
});
```

Reporting (which increments `report_count`) goes through a separate `reportFact` helper that:
- inserts the `fact_reports` row;
- patches `vehicle_searched_facts.report_count` and `last_reported_at` in the same mutation;
- does **not** write an audit row (the `fact_reports` row itself is the audit trail for reports; the audit table is reserved for editor actions on the fact's content/status).

### 3.2 CI grep rules

Add to the lint/CI step. Fail the build on any match outside `convex/searchedFacts.ts`:

```
# Direct patch against the mutable table — forbidden outside the helper.
rg -n "ctx\.db\.patch\([^,]+,\s*\{" convex/ \
  | rg "vehicle_searched_facts" \
  | rg -v "convex/searchedFacts\.ts"

# Direct replace against the mutable table — forbidden outside the helper.
rg -n "ctx\.db\.replace\(" convex/ \
  | rg "vehicle_searched_facts" \
  | rg -v "convex/searchedFacts\.ts"

# Direct insert into the audit table — forbidden outside the helper.
# (Inserts into the audit table from anywhere else means someone is
# manufacturing audit rows without a paired patch — a forgery vector.)
rg -n "ctx\.db\.insert\(\"vehicle_searched_facts_audit\"" convex/ \
  | rg -v "convex/searchedFacts\.ts"
```

These three rules together pin the invariant at code-review time. The first two prevent edits without audit; the third prevents audit fabrication without edits.

### 3.3 Runtime invariant telemetry

Emit two counters per mutation transaction:

- `searched_facts.edits_committed` — incremented once per successful `editSearchedFact` call.
- `searched_facts.audit_rows_written` — incremented once per audit insert inside `editSearchedFact`.

A periodic check (every 5 minutes, in the reconciliation cron — see §4) computes the delta of these two counters over the last interval. **Invariant: delta must be zero.** Any nonzero delta pages on-call immediately — it means the helper has been bypassed or the transaction guarantee has been violated. This is the runtime backstop for the CI grep.

---

## 4. Audit-Log Reconciliation

A periodic cron (sketched, not implemented in this doc) verifies that the live state of `vehicle_searched_facts` is reachable by replaying `vehicle_searched_facts_audit` rows in chronological order.

**Checks:**
1. **Replay-equivalence.** For each fact row, walk its audit history ordered by `edited_at` ascending (via `by_fact` index). Apply each `previous_values` diff in reverse from the current row state. The resulting "creation-time" state should match an `insert` event (no audit row, but a row exists with `written_by` and `created_at`). Any fact where reverse-replay produces an impossible state (e.g., a `verify` action whose `previous_values.verification_status` is not `"unverified"`) is flagged.
2. **Counter parity.** Aggregate `report_count` per `fact_id` from the `fact_reports` table (filter `disposition != "no_action"` is **not** applied — `report_count` is a raw counter). Compare to the denormalized `report_count` on `vehicle_searched_facts`. Mismatches are flagged.
3. **Orphan audit rows.** Audit rows whose `fact_id` does not resolve in `vehicle_searched_facts` (should be impossible since we never hard-delete). Flagged immediately.
4. **Telemetry parity.** `searched_facts.edits_committed` vs `searched_facts.audit_rows_written` delta over the interval (§3.3). Must be zero.

**Alert thresholds:**
- Replay-equivalence failures: **page on the first occurrence.** This signals tampering or a helper bypass — there is no acceptable rate.
- Counter parity drift: alert if more than 5 facts drift in a 24-hour window. Below 5 is likely transient mid-mutation racing and self-heals.
- Orphan audit rows: **page on the first occurrence.**
- Telemetry parity nonzero: **page immediately** (this is the runtime invariant from §3.3).

**Cadence:** every 15 minutes for checks 1 and 3 (cheap, indexed scans), every hour for check 2 (full table aggregate), every 5 minutes for check 4 (in-memory counter read).

---

## 5. Rationale — Why the Audit Table Preserves D-3.2

*Memory Systems Engineer, on the record.*

D-3.2 made `conversation_facts` and `user_semantic_facts` append-only with soft-retract. The property I was defending with that constraint was not "immutability for its own sake." It was two specific safety guarantees:

1. **Historical reconstruction.** At any time T-past, we must be able to answer: "what did Oto believe when it generated message M?" If the fact rows backing M have been silently rewritten, we cannot do post-hoc incident analysis and we cannot defend the system in a dispute. Append-only with soft-retract gave us this for free — the row at T-past is still the same row, the retraction is a forward-dated decoration.

2. **Defense against compromised internal accounts.** If an editor account is compromised, an attacker with mutate rights can rewrite history to cover their tracks. Append-only denied them that capability. The worst they could do was add new rows or retract old ones; the prior state was still recoverable.

Waleed's v3 ruling — that `vehicle_searched_facts` is mutable in place — does not violate either property, **because the threat model is genuinely different and because the audit table catches what the mutability gives up:**

- The mutability concession is justified by single-writer admin UI access. Concurrent-write races, which were a real threat against agent-written `conversation_facts`, do not apply here. Edits are deliberate human review, serialized through a queue.
- The historical reconstruction guarantee transfers to `vehicle_searched_facts_audit`. Because every edit writes a `previous_values` diff atomically with the patch (§3.1), we can reconstruct any prior state by reverse-replaying audit rows. The reconstruction is now a function of two tables instead of one, but it is still exact and still verifiable (§4 check 1).
- The compromised-account defense transfers, and arguably strengthens, in two ways. First, the audit table is **itself append-only** — an attacker who compromises an editor account can edit facts but cannot delete or rewrite audit rows. Second, the `by_editor` index on the audit table makes incident response materially better than what we had under D-3.2: we can enumerate everything the suspect account touched in a single query.

The remaining attack vector is an attacker who can both edit facts **and** suppress audit-row insertion within the same mutation. The four-layer defense in §3 closes this:

1. Helper-only mutation pattern — no other code path can patch the table.
2. CI grep — catches a developer trying to introduce a bypass at review time.
3. Runtime counter parity — catches a bypass that somehow lands in production.
4. Replay-equivalence cron — catches a bypass that the runtime counter missed (e.g., a forged audit row paired with a real edit).

Each layer is independent. To defeat all four simultaneously, an attacker would need code-commit access, CI-bypass access, telemetry-suppression access, and reconciliation-cron-suppression access. At that point they have already won at a level no schema discipline addresses.

I am signing off on the v3 ruling. The append-only discipline is preserved where it counts, the mutability is bounded where it is safe, and the audit table is doing the load-bearing work that `conversation_facts` and `user_semantic_facts` continue to do for their respective domains.

— Memory Systems Engineer
