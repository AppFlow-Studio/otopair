# MEMORY_SCHEMA_V3_CONSOLIDATED

**Owner:** Memory Systems Engineer (adversarial review panel, Doc 3 §5)
**Status:** Locked. **Supersedes `docs/SPRINT_0/MEMORY_SCHEMA_V3.md`** in full.
**Companion:** D-3.2 (append-only invariant) — preserved for `conversation_facts` and `user_semantic_facts`; relocated for the audit trail; explicitly **not** transferred to the consolidated KB row.

---

## 0. Why this document exists (and why the prior one is dead)

The prior `MEMORY_SCHEMA_V3.md` and the corresponding `convex/schema.ts` addition (lines 1724–1942) introduced three new tables: `vehicle_searched_facts`, `vehicle_searched_facts_audit`, `fact_reports`. The first of those was a parallel of the existing `vehicle_facts` table — same `topic_axis`, same scoping ids (`vehicle_config_id`, `chassis_code`, `engine_code`, `make`, `model`, `trim_name`, `year_min`, `year_max`), same `fact_text` / `question_text` shape, same five `by_*` indexes. The split was justified on a "different trust class" argument that does not survive contact with the existing schema: `vehicle_facts.source` is already a union that explicitly includes `v.literal("web_search")` alongside `manufacturer | oto_inferred | user_confirmed | propagated`. The trust class **is the source field**. Forking the table forks the read path, the helpers, the indexes, and the migration story for no benefit.

Consolidation is the right move:

- One KB, one source-typed trust model. The agent reads one table; the disclaim tag is keyed on `(verification_status, source)`; the review queue is keyed on `verification_status` and `report_count`. Source-typed trust is what the union was already encoding.
- The five-tables-not-six hill (D-3.2 owner's spec) is preserved. Two new tables, not three: `vehicle_facts_audit` and `fact_reports`. Plus lifecycle fields on the existing `vehicle_facts`. Net schema delta is exactly what v3 always called for, and one fewer table than the prior pass landed.
- The embedding column and `vectorIndex` come **out**, not eventually, **now**. The whole point of D-3.12 is that the v3 KB is not behind an embedding model. Keeping the embedding column in the schema until "Wave 7" is keeping the architecture we said we were leaving.

This document is paste-ready: schema blocks, migration plan, mutation helper, CI rules, and rationale.

---

## 1. The consolidated `vehicle_facts` table

The post-v3 definition. Existing fields preserved; v3 lifecycle fields added; `embedding` and `.vectorIndex(...)` removed. Indexes added for the new lifecycle and cache-lookup access patterns. Drop-in replacement for `convex/schema.ts` lines 1667–1722.

```ts
// -------------------------------------------------------------------------
// vehicle_facts — Oto's KB, consolidated v3.
//
// Single KB table. Trust class is encoded in `source`:
//   manufacturer | oto_inferred | user_confirmed | propagated  → verified
//   web_search                                                  → unverified
// The agent serves all rows from here; the disclaim tag fires when
// (verification_status == "unverified") at render time.
//
// Lifecycle: unverified | verified | retracted. No auto-promotion.
// Human-only verification by Waleed or Temur via admin UI (D-3.13).
//
// Mutable in place. The append-only safety property (D-3.2) is preserved
// for conversation_facts and user_semantic_facts. The historical-
// reconstruction half of that property is provided here by the paired
// vehicle_facts_audit table (§2). Every edit to this row writes one
// audit row in the same Convex mutation — enforced by the editVehicleFact
// helper (§5) and the CI greps (§6).
//
// Read order on a reference ask:
//   Tier 1: enrichment-owned structured tables (vehicle_configs, engine_specs,
//           tire_specs, chassis_specs, …) — direct topic-routed lookup.
//   Tier 2: vehicle_facts.
//             a) by_canonical_question  (O(log n) point lookup on sha256)
//             b) by_vehicle_config / by_chassis / by_engine /
//                by_make_model_year / by_topic_axis  (structural)
//             c) by_text  (Convex searchIndex, BM25-like fuzzy fallback)
//   Tier 3: web_search → write back to vehicle_facts with
//             source: "web_search", verification_status: "unverified".
//
// No embedding column. No vectorIndex. (D-3.12.)
// -------------------------------------------------------------------------
vehicle_facts: defineTable({
  // ----- Topic + scoping (unchanged from pre-v3) -----
  topic: v.string(),
  topic_axis: v.union(
    v.literal("vehicle"),
    v.literal("trim"),
    v.literal("chassis"),
    v.literal("engine"),
    v.literal("model_year"),
  ),
  // Scoping ids — at least one is set, matching topic_axis.
  vehicle_config_id: v.optional(v.id("vehicle_configs")),
  chassis_code: v.optional(v.string()),
  engine_code: v.optional(v.string()),
  make: v.optional(v.string()),
  model: v.optional(v.string()),
  trim_name: v.optional(v.string()),
  year_min: v.optional(v.number()),
  year_max: v.optional(v.number()),

  // ----- The fact itself (unchanged) -----
  fact_text: v.string(),
  question_text: v.string(),
  answer_format: v.optional(v.string()),

  // ----- Provenance + trust (unchanged) -----
  source: v.union(
    v.literal("manufacturer"),
    v.literal("oto_inferred"),
    v.literal("web_search"),
    v.literal("user_confirmed"),
    v.literal("propagated"),
  ),
  cited_url: v.optional(v.string()),
  confidence: v.number(),
  propagated_from_id: v.optional(v.id("vehicle_facts")),

  // ----- v3 cache key -----
  // SHA-256 hex of the normalized question. O(1)-ish point lookup on repeat
  // asks across users. Computed by the agent at write time and on read for
  // cache probes. Normalization rules live in convex/oto/canonicalize.ts.
  canonical_question_key: v.string(),

  // ----- v3 lifecycle -----
  verification_status: v.union(
    v.literal("unverified"), // default for source == "web_search"
    v.literal("verified"),   // default for the other four source values; or
                             // human-promoted from unverified via admin UI
    v.literal("retracted"),  // soft-retract; not served to chat
  ),
  verified_at: v.optional(v.number()),
  retracted_at: v.optional(v.number()),

  // ----- v3 report telemetry (denormalized for review-queue ordering) -----
  // Source of truth is fact_reports; this pair is recomputed inside the
  // reportFact mutation (same transaction, atomic).
  report_count: v.number(),
  last_reported_at: v.optional(v.number()),

  // ----- v3 multi-agent writer attribution (D-3.6, extended by D-3.11) -----
  written_by: v.union(
    v.literal("chat_agent"),
    v.literal("health_monitor"),
    v.literal("admin_edit"),
    v.literal("system"),
  ),

  // ----- v3 asker attribution -----
  // Optional because health_monitor / system / admin_edit / propagated /
  // pre-v3 rows have no asking user.
  asked_by_user_id: v.optional(v.id("users")),
  asked_at: v.optional(v.number()),

  // ----- Timestamps (unchanged) -----
  created_at: v.number(),
  updated_at: v.optional(v.number()),
  last_verified_at: v.optional(v.number()),

  // NOTE: `embedding: v.optional(v.array(v.float64()))` is REMOVED.
  // The `.vectorIndex("by_embedding", ...)` block is REMOVED.
  // See §3 (embedding-removal migration) for the three-step deploy plan.
})
  // ---- Existing indexes (unchanged) ----
  .index("by_vehicle_config", ["vehicle_config_id", "topic"])
  .index("by_chassis", ["chassis_code", "topic"])
  .index("by_engine", ["engine_code", "topic"])
  .index("by_make_model_year", ["make", "model", "year_min"])
  .index("by_topic_axis", ["topic_axis", "topic"])

  // ---- v3 indexes ----
  // Hot read path: O(log n) point lookup on the canonical question hash.
  .index("by_canonical_question", ["canonical_question_key"])

  // Review queue: oldest-unverified-first; oldest-retracted-first for audit.
  .index("by_verification_status", ["verification_status", "created_at"])

  // Report-driven review queue: highest-reported first.
  .index("by_report_count", ["report_count"])

  // BM25-like fuzzy fallback. Replaces the deleted vectorIndex as the
  // last-resort match before falling through to web_search.
  .searchIndex("by_text", {
    searchField: "fact_text",
    filterFields: ["topic_axis", "topic"],
  }),
```

That is the complete table. Every existing field carries forward, every new field is integrated, and the embedding artifacts are gone. The schema diff against the current `convex/schema.ts` is:

- **Removed:** `embedding: v.optional(v.array(v.float64()))` and the `.vectorIndex("by_embedding", { … })` block.
- **Added:** `canonical_question_key`, `verification_status`, `verified_at`, `retracted_at`, `report_count`, `last_reported_at`, `written_by`, `asked_by_user_id`, `asked_at`.
- **Added indexes:** `by_canonical_question`, `by_verification_status`, `by_report_count`, `searchIndex by_text`.

The parallel `vehicle_searched_facts` table is **deleted from the schema** (see §3 / §4).

---

## 2. The new `vehicle_facts_audit` table

Append-only. The relocated D-3.2 safety property. Same shape as the prior `vehicle_searched_facts_audit`, but pointing at the consolidated `vehicle_facts` table.

```ts
// -------------------------------------------------------------------------
// vehicle_facts_audit — append-only edit history for vehicle_facts.
//
// Wave 3.1a addition. Authority: MEMORY_SCHEMA_V3_CONSOLIDATED §2.
//
// This table IS append-only. No ctx.db.patch, no ctx.db.replace ever.
// Every mutation to vehicle_facts inserts exactly one row here inside
// the same Convex mutation (atomic; Convex serializes).
//
// Creation of a vehicle_facts row is NOT audited — the creation row IS
// its own creation record. Audit captures CHANGES to existing rows.
// Size is O(edits), not O(facts).
// -------------------------------------------------------------------------
vehicle_facts_audit: defineTable({
  fact_id: v.id("vehicle_facts"),
  edited_by: v.id("users"),
  edited_at: v.number(),

  action: v.union(
    v.literal("verify"),     // unverified → verified
    v.literal("retract"),    // any → retracted
    v.literal("edit_text"),  // fact_text mutated
    v.literal("edit_meta"),  // confidence / topic / topic_axis / scoping /
                             // cited_url / source / answer_format
  ),

  // Snapshot of fields that changed, BEFORE the edit. Only fields actually
  // changing are present. Replay-equivalent: reverse-applying these in
  // chronological order reconstructs the row's full history. Shape matches
  // the set of fields editable on vehicle_facts (see editVehicleFact §5).
  previous_values: v.object({
    fact_text: v.optional(v.string()),
    verification_status: v.optional(v.string()),
    confidence: v.optional(v.number()),
    topic: v.optional(v.string()),
    topic_axis: v.optional(v.string()),
    cited_url: v.optional(v.string()),
    source: v.optional(v.string()),
    answer_format: v.optional(v.string()),
    // scoping fields — rare-but-possible to edit (e.g., refining scope)
    vehicle_config_id: v.optional(v.id("vehicle_configs")),
    chassis_code: v.optional(v.string()),
    engine_code: v.optional(v.string()),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    trim_name: v.optional(v.string()),
    year_min: v.optional(v.number()),
    year_max: v.optional(v.number()),
  }),

  reason: v.string(), // required; admin UI enforces non-empty
})
  // Full history of one fact in chronological order.
  .index("by_fact", ["fact_id", "edited_at"])
  // Per-editor audit — incident-response query if an account is suspected.
  .index("by_editor", ["edited_by", "edited_at"])
  // Time-range scan for the reconciliation cron.
  .index("by_time", ["edited_at"]),
```

---

## 3. The new `fact_reports` table

User-submitted reports against a `vehicle_facts` row. Identical shape to the prior version; `fact_id` is the only thing that changes (it now points at the consolidated table).

```ts
// -------------------------------------------------------------------------
// fact_reports — user-submitted "this answer looks wrong" reports.
//
// Wave 3.1a addition. Authority: PM Ruling v3 §3.1.
//
// One row per user tap on "Report Message/Conversation". Triggered only on
// messages rendered with the "Oto may be incorrect" disclaim tag (i.e.,
// backed by a vehicle_facts row whose verification_status is unverified,
// or a fresh-web_search answer). Visible to Waleed + Temur only via the
// admin review queue; disposition lifecycle ends in edited / retracted /
// answer_quality / no_action.
// -------------------------------------------------------------------------
fact_reports: defineTable({
  fact_id: v.id("vehicle_facts"),
  conversation_id: v.id("ai_conversations"),
  message_id: v.id("ai_messages"),

  reported_by: v.id("users"),
  reported_at: v.number(),
  user_note: v.optional(v.string()),

  disposition: v.union(
    v.literal("open"),           // default on insert; in review queue
    v.literal("edited"),         // resolved by editing the underlying fact
    v.literal("retracted"),      // resolved by retracting the underlying fact
    v.literal("answer_quality"), // not a factual problem; UX complaint
    v.literal("no_action"),      // reviewed, no change warranted
  ),

  resolved_by: v.optional(v.id("users")),
  resolved_at: v.optional(v.number()),
  resolution_note: v.optional(v.string()),
})
  // Review queue ordering: open first, oldest open first.
  .index("by_disposition", ["disposition", "reported_at"])
  // All reports against one fact — admin fact-detail view + parity check.
  .index("by_fact", ["fact_id", "reported_at"])
  // All reports filed by one user — abuse detection.
  .index("by_reporter", ["reported_by", "reported_at"]),
```

---

## 4. Backfill rules for the v3 fields on existing `vehicle_facts` rows

The consolidated `vehicle_facts` adds nine new fields. All but two are non-optional, so every existing row needs values stamped during the migration. The backfill mutation walks the table in batches of ~256 and sets the following per row:

| Field | Backfill rule |
|---|---|
| `verification_status` | If `source ∈ {manufacturer, oto_inferred, user_confirmed, propagated}` → `"verified"`. If `source == "web_search"` → `"unverified"`. |
| `verified_at` | If new status is `"verified"`, set to `last_verified_at ?? updated_at ?? created_at`. Otherwise leave undefined. |
| `retracted_at` | Always undefined on backfill (no row is retracted at migration time). |
| `report_count` | `0`. |
| `last_reported_at` | Undefined. |
| `written_by` | `"chat_agent"` (matches D-3.6 expansion — pre-v3 KB writes were all from the chat agent path). |
| `canonical_question_key` | sha256-hex of `normalize(question_text)` where `normalize` is the function in `convex/oto/canonicalize.ts` (lowercase, collapse whitespace, strip terminal punctuation, NFKC). Computed inline in the backfill batch. |
| `asked_by_user_id` | Undefined (pre-v3 rows have no asker linkage). |
| `asked_at` | `created_at` (the closest legitimate proxy when an asker timestamp is unknown). |

The backfill mutation is idempotent: it skips any row that already has `verification_status` set. Re-running after partial completion is safe. Progress is tracked in a single `_migrations` row keyed by migration name (`vehicle_facts_v3_lifecycle_backfill`), storing the last-seen `_creationTime` cursor.

Pseudocode:

```ts
export const backfillV3Lifecycle = internalMutation({
  args: { batchSize: v.number(), cursorMs: v.optional(v.number()) },
  handler: async (ctx, { batchSize, cursorMs }) => {
    const rows = await ctx.db
      .query("vehicle_facts")
      .withIndex("by_creation_time", (q) =>
        cursorMs !== undefined ? q.gt("_creationTime", cursorMs) : q,
      )
      .take(batchSize);

    for (const row of rows) {
      if (row.verification_status !== undefined) continue; // already done
      const verified =
        row.source === "manufacturer" ||
        row.source === "oto_inferred" ||
        row.source === "user_confirmed" ||
        row.source === "propagated";
      const verifiedAt = verified
        ? row.last_verified_at ?? row.updated_at ?? row.created_at
        : undefined;
      await ctx.db.patch(row._id, {
        verification_status: verified ? "verified" : "unverified",
        verified_at: verifiedAt,
        report_count: 0,
        written_by: "chat_agent",
        canonical_question_key: await sha256Hex(normalize(row.question_text)),
        asked_at: row.created_at,
      });
    }

    const nextCursor = rows.at(-1)?._creationTime;
    return { processed: rows.length, nextCursor };
  },
});
```

The driver is a small `internalAction` that loops until `processed === 0`.

---

## 5. Embedding-removal migration plan (three deploys, each reversible)

Convex's schema validation rejects extra fields by default. You cannot in a single deploy both stop accepting embedding writes AND drop the field, because rows still on disk would have a field the schema does not declare. The migration is three deploys, in order. Each is independently reversible until the next is shipped.

### Step 1 — Deploy A: stop new writes, keep the column.

In the same deploy:

1. Add the nine new v3 fields described in §1 to `vehicle_facts` (with appropriate defaults / optionality).
2. Add the new indexes (`by_canonical_question`, `by_verification_status`, `by_report_count`, `searchIndex by_text`).
3. **Keep** `embedding: v.optional(v.array(v.float64()))` exactly as it is.
4. **Remove** the `.vectorIndex("by_embedding", { … })` block.
5. Delete the parallel `vehicle_searched_facts` table from the schema (along with `vehicle_searched_facts_audit` if it landed — replaced by `vehicle_facts_audit`). If the parallel tables have non-trivial data, archive first (see §5.5 "Pre-flight: salvage from the parallel table" below).
6. Add the new `vehicle_facts_audit` and `fact_reports` tables from §2 and §3.
7. Code-level: rip out every `await ctx.db.patch(..., { embedding })`, every `await ctx.vectorSearch(...)` call, and every embedding-API action call from `convex/`. Grep for `embedding` and `vectorSearch` should return only schema-comment references after this step.

Effect:

- The vector index disappears; no read path tries to use it. Existing data in the `embedding` column is dormant.
- New rows do not write embeddings (no code path does). Existing rows still have their `embedding` value on disk.
- The new v3 read path (canonical_question_key → structural → searchIndex) is live.

Reversibility: re-add the `.vectorIndex` block and restore the embedding write calls. The column never went away.

### Step 2 — Deploy B-internal: backfill `embedding` to undefined.

This is **not** a schema change. It is an `internalMutation` that walks `vehicle_facts` in batches and patches each row with `{ embedding: undefined }`. Convex's `ctx.db.patch` with an explicit `undefined` value removes the field from the document.

Same checkpoint pattern as the v3 lifecycle backfill (§4) — a row in `_migrations` records the last `_creationTime` cursor. Run via an `internalAction` driver until the batch returns zero processed rows.

Pseudocode:

```ts
export const stripEmbeddings = internalMutation({
  args: { batchSize: v.number(), cursorMs: v.optional(v.number()) },
  handler: async (ctx, { batchSize, cursorMs }) => {
    const rows = await ctx.db
      .query("vehicle_facts")
      .withIndex("by_creation_time", (q) =>
        cursorMs !== undefined ? q.gt("_creationTime", cursorMs) : q,
      )
      .take(batchSize);

    let stripped = 0;
    for (const row of rows) {
      if (row.embedding === undefined) continue;
      await ctx.db.patch(row._id, { embedding: undefined });
      stripped += 1;
    }
    return { processed: rows.length, stripped, nextCursor: rows.at(-1)?._creationTime };
  },
});
```

The v3 lifecycle backfill (§4) and this embedding-strip backfill can be combined into one pass to halve the disk churn — fold the `{ embedding: undefined }` into the same `ctx.db.patch` call alongside the lifecycle defaults. Recommended.

Reversibility: still trivial. The schema still has `embedding: v.optional(...)`, so re-populating from a snapshot is supported.

### Step 3 — Deploy C: drop the column from the schema.

After the backfill driver reports zero remaining rows for several consecutive runs (and a verification query confirms `await ctx.db.query("vehicle_facts").filter(q => q.neq(q.field("embedding"), undefined)).first()` returns null):

1. Remove the `embedding: v.optional(v.array(v.float64()))` line from `vehicle_facts`.
2. Deploy. Convex schema validation now rejects any document with an `embedding` field — and there are none.

Reversibility: re-add the field as `v.optional(v.array(v.float64()))` and redeploy. There is no data to restore at this point.

### Step 4 — Wave 5.x.: drop the migration scaffolding.

After Deploy C ships and bakes for a release cycle, delete the two backfill mutations (`backfillV3Lifecycle`, `stripEmbeddings`) and their driver actions, and the `_migrations` rows they wrote. Not strictly necessary, but keeps `convex/` clean.

### 5.5 Pre-flight: salvage from the parallel table

If `vehicle_searched_facts` accumulated rows in the brief window it existed in the schema, those rows must be merged into `vehicle_facts` before the parallel table is dropped in Deploy A. The shape is compatible — every field on `vehicle_searched_facts` maps to a field on `vehicle_facts`:

| `vehicle_searched_facts` field | `vehicle_facts` target |
|---|---|
| `topic`, `topic_axis`, scoping ids | identical fields |
| `fact_text`, `question_text`, `answer_format` | identical fields |
| `canonical_question_key` | `canonical_question_key` |
| `source: "web_search"` | `source: "web_search"` |
| `cited_url` | `cited_url` |
| `confidence` | `confidence` |
| `verification_status`, `verified_at`, `retracted_at` | same |
| `report_count`, `last_reported_at` | same |
| `written_by` | same |
| `asked_by_user_id`, `asked_at` | same |
| `created_at`, `updated_at` | same |

Run as a one-shot `internalMutation`: read each parallel row, `ctx.db.insert("vehicle_facts", { … })` with the mapped fields, then drop the parallel table in Deploy A. `vehicle_searched_facts_audit` rows (if any) are dropped — no audits should have been written against rows that hadn't yet stabilized, and the launch state of `vehicle_facts_audit` is empty by definition.

---

## 6. The amended `editVehicleFact` mutation helper

Renamed from `editSearchedFact`. Points at `vehicle_facts` (consolidated). Atomic patch + audit-insert in one Convex mutation. All other invariants from `MEMORY_SCHEMA_V3` §3.1 carry over verbatim. File location: `convex/oto/vehicleFactsEditing.ts` (not `convex/oto/searchedFacts.ts` — name reflects the consolidated target).

```ts
// convex/oto/vehicleFactsEditing.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

type VehicleFactChanges = Partial<{
  fact_text: string;
  verification_status: "unverified" | "verified" | "retracted";
  confidence: number;
  topic: string;
  topic_axis: "vehicle" | "trim" | "chassis" | "engine" | "model_year";
  cited_url: string;
  source: "manufacturer" | "oto_inferred" | "web_search" | "user_confirmed" | "propagated";
  answer_format: string;
  vehicle_config_id: any; // Id<"vehicle_configs"> at the call site
  chassis_code: string;
  engine_code: string;
  make: string;
  model: string;
  trim_name: string;
  year_min: number;
  year_max: number;
}>;

type AuditAction = "verify" | "retract" | "edit_text" | "edit_meta";

// THE ONLY sanctioned path to mutate vehicle_facts (post-creation).
// Atomically:
//   1. Reads current row
//   2. Computes previous_values diff (only fields actually changing)
//   3. Patches the row + updated_at + status timestamps
//   4. Inserts the audit row
// All in a single Convex mutation -> single transaction -> atomic.
export const editVehicleFact = mutation({
  args: {
    factId: v.id("vehicle_facts"),
    changes: v.object({
      fact_text: v.optional(v.string()),
      verification_status: v.optional(v.string()),
      confidence: v.optional(v.number()),
      topic: v.optional(v.string()),
      topic_axis: v.optional(v.string()),
      cited_url: v.optional(v.string()),
      source: v.optional(v.string()),
      answer_format: v.optional(v.string()),
      vehicle_config_id: v.optional(v.id("vehicle_configs")),
      chassis_code: v.optional(v.string()),
      engine_code: v.optional(v.string()),
      make: v.optional(v.string()),
      model: v.optional(v.string()),
      trim_name: v.optional(v.string()),
      year_min: v.optional(v.number()),
      year_max: v.optional(v.number()),
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
      throw new Error("editVehicleFact: reason is required");
    }
    const current = await ctx.db.get(factId);
    if (!current) throw new Error("Fact not found");

    // Build previous_values snapshot of ONLY changing fields.
    const previous_values: Record<string, unknown> = {};
    for (const k of Object.keys(changes) as (keyof VehicleFactChanges)[]) {
      const next = (changes as Record<string, unknown>)[k];
      const prev = (current as Record<string, unknown>)[k];
      if (next !== undefined && next !== prev) {
        previous_values[k] = prev;
      }
    }

    // No-op guard: if nothing actually changed, do not write an audit row.
    if (Object.keys(previous_values).length === 0) return;

    const now = Date.now();
    const patch: Record<string, unknown> = { ...changes, updated_at: now };
    if (action === "verify") patch.verified_at = now;
    if (action === "retract") patch.retracted_at = now;

    await ctx.db.patch(factId, patch);
    await ctx.db.insert("vehicle_facts_audit", {
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

A separate `reportVehicleFact` helper inserts the `fact_reports` row and patches `vehicle_facts.report_count` + `last_reported_at` in the same mutation. It does **not** write an audit row — the `fact_reports` row is the audit trail for reports.

A separate `recordVehicleFact` (or `insertVehicleFact`) mutation handles creation. Creation does **not** write an audit row (per D-3.2 relocation: audit captures changes, not creations).

---

## 7. CI grep rule updates

Three rules. Same intent as before; updated to target `vehicle_facts` and `vehicle_facts_audit` instead of the parallel-table names. Path-anchored so the helper file is the single allowed exception.

```sh
# Direct patch against vehicle_facts — forbidden outside the helper.
rg -n "ctx\.db\.patch\([^,]+,\s*\{" convex/ \
  | rg "vehicle_facts\b" \
  | rg -v "convex/oto/vehicleFactsEditing\.ts" \
  | rg -v "convex/oto/vehicleFactsCreate\.ts"   # creation path; never audits

# Direct replace against vehicle_facts — forbidden outside the helper.
rg -n "ctx\.db\.replace\(" convex/ \
  | rg "vehicle_facts\b" \
  | rg -v "convex/oto/vehicleFactsEditing\.ts"

# Direct insert into the audit table — forbidden outside the helper.
# (Inserts into the audit table from anywhere else means someone is
# manufacturing audit rows without a paired patch — a forgery vector.)
rg -n "ctx\.db\.insert\(\"vehicle_facts_audit\"" convex/ \
  | rg -v "convex/oto/vehicleFactsEditing\.ts"
```

Add a fourth rule to keep the embedding artifacts out:

```sh
# No new embedding writes. After Deploy A this should match exactly zero.
rg -n "embedding\s*[:=]" convex/ \
  | rg -v "convex/_generated/" \
  | rg -v "convex/oto/migrations/stripEmbeddings\.ts"   # the strip mutation
```

A fifth rule pins the consolidation — the parallel-table names must never reappear:

```sh
# Parallel tables retired in v3 consolidation. Any reference is a regression.
rg -n "vehicle_searched_facts" convex/ app/ components/ hooks/ \
  | rg -v "MEMORY_SCHEMA_V3_CONSOLIDATED\.md"
```

These five rules together pin the v3 invariants at code-review time. Rules 1 and 2 prevent edits without audit. Rule 3 prevents audit fabrication without edits. Rule 4 prevents the embedding model from creeping back. Rule 5 prevents the parallel-table architecture from being re-introduced.

---

## 8. Audit-log reconciliation

Carries forward from `MEMORY_SCHEMA_V3` §4 unchanged in spirit. Targets are renamed to the consolidated tables. Summary:

- **Replay-equivalence.** Walk `vehicle_facts_audit` by `by_fact` index, reverse-apply each `previous_values` diff to reconstruct the row's prior state. Any impossible state (e.g., `verify` whose `previous_values.verification_status` is not `"unverified"`) pages immediately.
- **Report counter parity.** Aggregate `report_count` per `fact_id` from `fact_reports`; compare to denormalized `report_count` on `vehicle_facts`. Drift > 5 in 24h alerts.
- **Orphan audit rows.** Audit rows whose `fact_id` does not resolve in `vehicle_facts` — page immediately.
- **Telemetry parity.** `vehicle_facts.edits_committed` counter vs `vehicle_facts.audit_rows_written` counter — delta must be zero per interval.

Cadence: every 15 minutes for the cheap indexed scans, hourly for the aggregate, every 5 minutes for the in-memory counter check.

---

## 9. Rationale

*Memory Systems Engineer, on the record.*

### 9.1 Why consolidation is right

One KB, one source-typed trust model. Forking `vehicle_searched_facts` off from `vehicle_facts` was a separation that existed only at the table level — the underlying logical model was already unified by `vehicle_facts.source`, a union with five members including `web_search`. The trust class is the source; the verification lifecycle is the status; the disclaim tag is a render-time function of `(source, verification_status)`. There is no third axis that would justify two tables.

Practical consequences of consolidation:

1. **One read path.** The agent computes `canonical_question_key` and probes one table. Structural fallback, search-index fallback, and Tier-3 web_search persistence all land in the same row family. The retrieval eval (Wave 5.1) measures one tier, not two.
2. **One mutation helper.** `editVehicleFact` is the only sanctioned write path, regardless of whether the row originated from enrichment, manufacturer data, or web_search. The audit guarantee is uniform.
3. **One review queue.** Reviewers see all reportable facts (currently only `source == "web_search"` rows trip the disclaim, but the queue model accommodates future expansion without a schema change).
4. **Cross-source promotion is trivial.** If a `web_search` row gets reviewed and verified, the row stays in place with `verification_status: "verified"` and an audit entry. Under the parallel-table model, a verification action would have meant a row migration — schema-level work for what should be a single field flip.

The five-tables-not-six hill is preserved exactly: `conversation_facts`, `user_semantic_facts`, `vehicle_facts`, `vehicle_facts_audit`, `fact_reports`. The prior pass would have been six.

### 9.2 Why the embedding has to come out now, not in Wave 7

D-3.12 ruled: no embedding model in the v3 KB. The whole point of v3 — the cost reset, the latency reset, the operational simplification — depends on that ruling holding. Keeping `embedding: v.optional(v.array(v.float64()))` and the `.vectorIndex("by_embedding", ...)` block in the schema until "some future wave" is keeping the architecture v3 was meant to leave. Specifically:

- **The vector index is itself the cost.** Convex's vector indexes are non-trivial to maintain; every insert/update against the table has to update the index if the embedding field is present. Keeping the index live means continuing to pay the cost of the architecture we said we were retiring.
- **`v.optional` is not safety.** It says the field can be absent. It does not say new writes can't add it. As long as the schema declares the field, any code path can write it, and the next person to touch the file will assume the column is in active use. The schema is a contract; ambiguous contracts decay.
- **Three deploys, each reversible.** The migration plan in §5 makes removal cheap. Step 1 stops new writes; Step 2 strips existing data; Step 3 drops the column. Each step is independently revertible until the next ships. There is no engineering reason to defer.
- **The replacement is operational.** The canonical-hash + structural + searchIndex stack already does the job for v3's traffic shape. The labeled retrieval eval (Wave 5.1) measures it. R-8'-NEW (lexical precision drift) is the monitored failure mode; R-8 (vector-DB tripwire) is retired the moment the index goes.

The Wave 7 deferral was a hedge. v3 doesn't need a hedge here. The removal is a three-deploy script, not a research project.

### 9.3 Why my D-3.2 append-only hill is still preserved

D-3.2 defended two safety properties: historical reconstruction, and defense against compromised internal accounts. Both transfer cleanly to v3:

- **`conversation_facts` and `user_semantic_facts` remain append-only with soft-retract.** Unchanged. The threat model that justified the discipline (concurrent agent writers, no deliberate human review queue, retroactive history reconstruction for incident response) is identical post-v3.
- **`vehicle_facts_audit` IS append-only.** No mutation, no retraction, no replace. Every edit to a `vehicle_facts` row writes one audit row atomically. The historical reconstruction property is preserved by reverse-replay over the audit table (see §8). The compromised-account defense is preserved because an attacker who compromises an editor account can edit facts but cannot rewrite audit rows.
- **`vehicle_facts` itself is mutable in place.** This is the v3 concession (PM Ruling §3.1). The threat model is genuinely different: edits are deliberate human review by Waleed or Temur, serialized through the admin UI, not concurrent agent writes. The mutability concession is bounded by the four-layer defense from `MEMORY_SCHEMA_V3` §5 — helper-only pattern, CI grep, runtime telemetry, replay-equivalence cron. Each layer is independent.

Consolidating the KB into one table does not change any of this. It changes the table the audit table points at, and the grep target. The discipline survives unchanged.

### 9.4 What I want recorded for the next person to touch this

If a future engineer looks at a `vehicle_facts` row with `source == "web_search"` and thinks "this should be in its own table" — the answer is no, and the reason is `MEMORY_SCHEMA_V3_CONSOLIDATED §9.1`. The trust class is the source field. The lifecycle is the status field. The disclaim tag is a render-time function. Splitting the table fragments the read path, the helpers, and the audit story for no benefit.

If a future engineer looks at the absence of an embedding column and thinks "we should add vector search back" — the answer is conditional, and the conditions are `R-8'-NEW`. If the labeled retrieval eval (Wave 5.1) shows precision@3 sustained drop > 5% over 7 days, **then** the precision regression is the trigger to consider re-introducing vectors. Not before. And the re-introduction path is a separate document, not a schema edit.

If a future engineer looks at `vehicle_facts_audit` and thinks "we should clean up old audit rows" — the answer is no. The audit table is the load-bearing artifact for the D-3.2 safety property post-v3. Size is `O(edits)`, not `O(facts)`; growth is bounded. Cleanup is a forgery vector.

— Memory Systems Engineer, signing off the consolidated v3.

---

## Appendix A — File deliverables checklist

- [ ] `convex/schema.ts`: replace lines 1667–1722 with the consolidated `vehicle_facts` block from §1. Delete the parallel `vehicle_searched_facts` (currently lines 1724–1846), `vehicle_searched_facts_audit` (1848–1899), and the existing `fact_reports` (1901+) blocks. Re-add `vehicle_facts_audit` (§2) and `fact_reports` (§3) at the same location.
- [ ] `convex/oto/vehicleFactsEditing.ts`: new file containing `editVehicleFact` and `reportVehicleFact` (§6).
- [ ] `convex/oto/vehicleFactsCreate.ts`: new file containing `recordVehicleFact` (creation path; no audit row).
- [ ] `convex/oto/canonicalize.ts`: existing or new file with `normalize(question_text)` + `sha256Hex(...)`; used by both the agent write path and the backfill mutation.
- [ ] `convex/oto/migrations/backfillV3Lifecycle.ts`: the §4 backfill (idempotent, batched).
- [ ] `convex/oto/migrations/stripEmbeddings.ts`: the §5 Step 2 backfill (idempotent, batched). May be merged into the lifecycle backfill for one-pass disk efficiency.
- [ ] `.github/workflows/ci.yml` (or equivalent CI config): add the five grep rules from §7.
- [ ] `docs/SPRINT_0/MEMORY_SCHEMA_V3.md`: mark as superseded with a one-line pointer to this document. (Do not delete; preserving prior decisions.)

---

## Appendix B — Open question for Waleed

There is one ambiguity worth flagging: **what does `verification_status` default to on a brand-new write whose `source` is one of the four non-web_search values?** The backfill rule (§4) sets these to `"verified"` because they originated from manufacturer / OEM / propagated / user-confirmed sources, which are by design higher-trust than `web_search`. But on **forward** writes (a new manufacturer fact landing tomorrow), the question is whether we want a one-touch human verification step regardless of source, or whether the source itself is sufficient to mark the row `"verified"` automatically.

Two readings of D-3.13 ("no auto-promotion") are possible:

- **Narrow:** D-3.13 applies only to `unverified → verified` transitions. New writes with source ∈ {manufacturer, oto_inferred, user_confirmed, propagated} start as `"verified"` immediately, never having been `"unverified"`. Web_search rows alone start `"unverified"` and require human action to promote.
- **Broad:** D-3.13 applies to all rows. Every new write starts `"unverified"` and requires explicit human verification before the disclaim tag is dropped.

The narrow reading matches the backfill rule and is consistent with the cost calculus (you do not want Waleed manually verifying every enrichment row). The broad reading is more conservative and would prevent any single source path from being "trusted by default." I am proceeding with the narrow reading in the spec; flag if you want the broad reading and I will amend §1 (default `verification_status` becomes `"unverified"` unconditionally) and §4 (backfill rule collapses to a single value).

— End of MEMORY_SCHEMA_V3_CONSOLIDATED.
