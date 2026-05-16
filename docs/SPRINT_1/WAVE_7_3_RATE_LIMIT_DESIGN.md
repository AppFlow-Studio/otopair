# Wave 7.3 — KB Exfiltration Rate-Limit (Code-Ready Design)

**Date:** 2026-05-16
**Author:** AI Security Analyst
**Hill:** KB exfiltration rate-limit covering all moat tables (Wave 7.3) — owner: Security Analyst.
**Authority:** PM Ruling v3 §6.7, Architecture v3 Amendments §C.4, `docs/SPRINT_0/SECURITY_CONSOLIDATED_V3.md` §3-4.
**Scope:** This document specifies the Wave 7.3 single-account rate-limit at design granularity. It is **not** an implementation — there is no executable code here. It is the design the implementing engineer (Wave 7.3 sprint owner) reads to write the implementation without needing to make further load-bearing decisions.

---

## 0. What this document is, in one paragraph

A single per-user counter — one denormalized integer field per user — sums the number of **row-reads against the moat tables** the user incurs over a rolling window. When the counter exceeds a calibrated threshold, fresh moat reads are denied for the remainder of the window; reads that are already in-flight or cached on the message itself continue to be served. The counter is bumped through a single helper that every moat-table read **must** route through, enforced at code-review time by a new CI grep rule (Rule 6). Admin investigation and reset paths are provided. The cross-account scraper-farm case is **out of scope**; the sobering-number estimate below documents the residual exposure.

---

## 1. The moat-table enumeration (verified against current schema)

### 1.1 Method

I re-listed every `defineTable(` in `convex/schema.ts` and classified each table as **moat** (reading reveals knowledge worth extracting, the data is not the asking user's own, and chat or any user-facing endpoint can reach it) or **not-moat** (audit-only / admin-only / asker-owned / pipeline-internal / telemetry).

The prior 27-table list in `SECURITY_CONSOLIDATED_V3.md` §3.3 was verified table-by-table. Three new tables exist in the current schema that did not in the prior list: `vehicle_facts_audit`, `fact_reports`, `oto_migrations`. A fourth (`reconciliation_runs`) lands Day 3 (Memory Engineer's deliverable). All four are **not moat**; rationale per table is in §1.3.

### 1.2 Moat tables (counter scope) — 27 total

The per-user counter sums reads from each of these. The grouping is **organizational only**; the counter does not maintain per-group sub-counters on the hot path (per-table breakdowns are an aggregation-cron concern; see §2.4).

#### A. Vehicle structural moat (10 tables)

| # | Table | Why it counts |
|---|---|---|
| 1 | `makes` | The makes catalog — enrichment-curated; exfiltration reveals our coverage map. |
| 2 | `models` | Models per make; same exfiltration concern as makes. |
| 3 | `generations` | Generation breakdowns per model; enrichment-derived; retained on the list because reads are still occurring against it pending deprecation. |
| 4 | `trims` | Trim hierarchy per generation; high-cardinality, high-value. |
| 5 | `engines` | Engine catalog with displacement, fuel type, layout — pure enrichment moat. |
| 6 | `transmissions` | Transmission catalog (gear counts, types) — pure enrichment moat. |
| 7 | `chassis_variants` | Chassis variant typology — direct enrichment product. |
| 8 | `chassis_specs` | Per-chassis dimensions, weights, structural details — the heart of the structural moat. |
| 9 | `vehicle_configs` | The canonical YMMT-chassis-engine-trans-trim binding; the join table the whole moat hinges on. |
| 10 | `drivetrain_configs` | Drivetrain-typology bindings; same exfiltration concern. |

#### B. Trim/spec moat (1 table)

| # | Table | Why it counts |
|---|---|---|
| 11 | `trim_specs` | Per-trim feature/spec rows; high-value, high-volume, the canonical "what does this trim have" data. |

#### C. Parts moat (3 tables)

| # | Table | Why it counts |
|---|---|---|
| 12 | `oem_parts` | OEM part catalog with part numbers — direct enrichment moat; competitive bullseye. |
| 13 | `part_fitments` | Part-to-vehicle fitments — the join from `oem_parts` to `vehicle_configs`. Exfiltration of this is exfiltration of the parts-catalog logic. |
| 14 | `part_prices` | Per-part price observations — high-value commercial data; expensive to recompute. |

#### D. Service definitions moat (7 tables)

| # | Table | Why it counts |
|---|---|---|
| 15 | `services` | Service definitions (oil change, brake job, etc.) — enrichment-curated taxonomy. |
| 16 | `service_categories` | Service category typology — small but moat. |
| 17 | `service_options` | Per-service option matrix — moat. |
| 18 | `service_vehicle_specs` | Per-vehicle-config service-spec overlays — high-value joined-table data. |
| 19 | `service_intervals` | Manufacturer-recommended intervals per service per vehicle — direct exfil target. |
| 20 | `labor_times` | Per-vehicle-config labor-time book — pure commercial enrichment moat. |
| 21 | `mechanic_verifications` | Mechanic-license/verification records; not the moat in the "vehicle knowledge" sense, but reads expose vendor-vetting data we curate. **Borderline**; including it on the list because chat exposing mechanic credibility signal would let competitors reproduce our vetting. (See §1.4 for the call.) |

#### E. Tire moat (4 tables)

| # | Table | Why it counts |
|---|---|---|
| 22 | `tire_brands` | Tire brands taxonomy — small but moat. |
| 23 | `tire_size_cache` | Per-vehicle tire size lookups — enrichment-derived. |
| 24 | `tire_models` | Tire model catalog — moat. |
| 25 | `tire_pricing` | Tire price observations — moat (same logic as `part_prices`). |

#### F. Vehicle-derivative caches (2 tables)

| # | Table | Why it counts |
|---|---|---|
| 26 | `model_year_cache` | The years-per-model enrichment cache. Surfaced via chat ("does this model exist for year X?"). Counts. |
| 27 | `trim_year_cache` | Same as above for trim availability per year. Counts. |

#### G. Consolidated KB (1 table)

| # | Table | Why it counts |
|---|---|---|
| 28 | `vehicle_facts` | The consolidated KB (absorbs the prior `vehicle_searched_facts`). **The single highest-value table on the list** — it is the moat in concentrated form. Reads here count double in spirit, though the counter sums by row-count, not weighted. (Weighted counting is a Sprint 2 calibration option; flagged in §2.5.) |

**Count change vs. prior list: 27 → 28.** The prior list undercounted by one — `mechanic_verifications` was not on the §3.3 list but on read-pattern grounds is reachable from the chat-agent's mechanic-recommendation answer path and exposes curated vetting data. I'm adding it. See §1.4 for the explicit rationale.

If `mechanic_verifications` is contested at Sprint 2 calibration time (i.e., "this isn't really vehicle-moat data"), it drops out cleanly — the counter sums-set is a list, not a structural invariant. Total is 27 or 28 depending on the call; this doc commits to 28.

### 1.3 Explicitly NOT on the list (with one-sentence defense each)

#### Audit / append-only tables

- **`vehicle_facts_audit`** — append-only edit history; admin-read only (admin queue UI). User-facing chat never reads it. Even an admin compromise here exfiltrates only edits-to-the-moat, not the moat itself; the moat is one query away on `vehicle_facts` directly.
- **`reconciliation_runs`** (Day 3 add) — Memory Engineer's reconciliation cron output. Admin-read only; rows describe parity-check anomalies, not vehicle data. Zero exfiltration value.
- **`audit_log`** — generic audit table; admin-only; no vehicle data.
- **`spec_confirmations`** / **`spec_variances`** — user-confirmation telemetry on enrichment data, written by the asking user from their own vehicle; not exposed across users via chat. Asker-owned.

#### Pipeline internals (never reachable from chat-agent)

- **`enrichment_evidence`** — evidence URLs + confidence scores for enrichment runs. Pipeline-internal; chat doesn't render evidence URLs directly (it renders facts derived from evidence). Excluded.
- **`enrichment_runs`** — enrichment job records. Pipeline-internal. Excluded.
- **`source_registry`** — domain-trust registry. Pipeline-internal. Excluded.
- **`blocked_domains`** — domain blocklist. Pipeline-internal. Excluded.
- **`scrape_cache`** — raw FireCrawl markdown payloads. Pipeline-internal; the chat-agent never reads raw markdown — only the enrichment pipeline does. If this exclusion later proves wrong (i.e., we wire a chat path that reads `scrape_cache` directly), add it to the counter list at that wave; the design accommodates additions.
- **`scrape_jobs`** — job-state for scrape runs. Pipeline-internal. Excluded.
- **`vin_queue`** — VIN decode queue. Pipeline-internal. Excluded.

#### Asker-owned / transactional (not the moat)

- **`vehicles`** — owned by the asking user; reading your own vehicle is not exfiltration.
- **`vehicle_owners`**, **`vehicle_owner_specs`**, **`vehicle_passports`**, **`odometer_history`**, **`smartcar_connections`** — same: owned by the asking user.
- **`vehicle_tiers`** — tier-weighting parameters; tiny static table; not the moat (3-5 rows of weights).
- **`composite_modifier_weights`** — same: weights table, not data.
- **`vehicle_checkins`**, **`vehicle_classifications`**, **`vehicle_driving_profiles`**, **`vehicle_service_states`** — per-user vehicle state.
- **`maintenance_records`**, **`vehicle_health_snapshots`** — per-user vehicle state.
- **`users`**, **`user_settings_preferences`**, **`user_mechanic_preferences`**, **`user_contribution_claims`**, **`user_reward_wallets`**, **`onboarding_questions_answers`** — per-user records.
- **`shops`**, **`shops_hours`**, **`shop_services`**, **`shop_portfolio`**, **`shop_users`**, **`shop_invitations`** — vendor records, not the vehicle-knowledge moat; commercial-directory exfiltration is a separate risk class (R-?, not R-3).
- **`block_time_types`**, **`mechanics`**, **`time_slots`** — booking-infrastructure; not vehicle moat. Note `mechanics` here is the per-shop mechanic record, distinct from `mechanic_verifications` above.
- **`bookings`**, **`tire_quote_responses`**, **`booking_status_history`**, **`payments`**, **`payment_status_history`**, **`stripe_webhook_events`**, **`transactions`**, **`ownership_credit_transactions`**, **`reward_deals`**, **`reviews`** — transactional/commerce; not the moat.
- **`follow_ups`**, **`job_actuals`** — booking-derived state; not the moat.
- **`ai_conversations`**, **`ai_messages`** — chat history; per-user, asker-owned. Note: `ai_messages` rendered to the asking user can quote moat data, but that quote was already counted at the moat-read time. We don't double-count by counting the message render.
- **`bugs`**, **`app_feedback`** — user feedback, asker-owned.
- **`director_notes`**, **`director_users`**, **`director_sessions`** — admin-tool internals.
- **`late_start_monitors`**, **`late_start_reviews`**, **`customer_late_alerts`**, **`customer_late_monitors`**, **`job_overrun_checkins`**, **`overrun_checkins`** — booking-monitoring telemetry.
- **`notification_outbox`** — push/email queue; not moat.

#### Reports / queues

- **`fact_reports`** — user-inserts of their own reports (one report per chat tap); admin-read for the review queue. The asking user can only see their own inserts. Reading rows here doesn't reveal moat data — only that some other user reported some fact. Negligible exfiltration value.

#### Telemetry / migrations

- **`oto_telemetry`** — per-turn metrics; admin-read only.
- **`analytics_events`**, **`conversion_funnels`**, **`client_logs`** — analytics; admin-read only.
- **`cdn_assets`** — asset URLs; not the moat.
- **`oto_migrations`** (Day 1 add) — migration-progress cursor table; admin-internal. Zero moat value.

### 1.4 The `mechanic_verifications` call

The prior list excluded `mechanic_verifications` by inertia — the original Doc 3 framing put it under "vendor records." But the read pattern matters: when a chat answer recommends a mechanic and surfaces credibility ("verified by Oto for BMW work"), the chat-agent has read `mechanic_verifications`. A scraper enumerating mechanics across regions would exfiltrate our vendor-vetting curation — which is real moat work, even if it's "vendor moat" rather than "vehicle moat." R-3 in Doc 3 §9 phrases the moat broadly as "the KB" without distinguishing vehicle-vs-vendor.

**Decision:** include `mechanic_verifications` on the counter list. If Waleed/Temur disagree at Sprint 2 calibration, remove it. The cost of including a low-volume table on the counter is negligible; the cost of excluding a moat-worthy table and only catching it post-incident is high.

**Flag for Waleed:** §10.2 lists this as the one judgment call where reasonable engineers could disagree.

### 1.5 What happens when new tables are added

The counter list is **maintained alongside `convex/schema.ts`**. Every new table added must answer the question "does this table count against the rate limit?" with a one-line answer in its schema comment. The CI grep rule (§6) enforces that every new table either:

(a) is wrapped by `queryMoat` (counts), or
(b) has a `// NOT-MOAT: <one-sentence reason>` comment above its `defineTable`, or
(c) appears on the explicit exclusion list in the helper.

Maintenance discipline is part of the design, not an afterthought.

---

## 2. Counter mechanics

### 2.1 Storage — extend `users` (not a new table)

**Decision:** denormalize three fields onto `users`. Do NOT create a `user_moat_read_counters` table.

#### Schema fragment

```typescript
// In convex/schema.ts, inside users: defineTable({ ... existing fields ... }):

  // Wave 7.3 — single per-user moat-read counter.
  // See docs/SPRINT_1/WAVE_7_3_RATE_LIMIT_DESIGN.md §2.
  // All three fields are optional during the backfill window and on
  // first-bump-for-this-user; defaulted by the bump helper.
  moat_reads_window:        v.optional(v.number()),   // count of rows read this window
  moat_reads_window_start:  v.optional(v.number()),   // epoch ms of window open
  moat_reads_is_admin_exempt: v.optional(v.boolean()),// see §5.3 — Waleed/Temur opt-out
```

No new indexes — the lookup is by `_id` (the user-id), which is the implicit primary key.

#### Why extend `users`, not a new table

**Argument for a new `user_moat_read_counters` table:**

- Clean separation of concerns: rate-limit state is not user identity.
- The counter row is high-write (every moat read patches it), and isolating it lets us reason about hot-write contention without touching the broader `users` row.
- If we ever need additional rate-limit dimensions (per-table sub-counters, multiple windows, leaky-bucket state), they grow naturally on the new table.
- Convex documents are mutated atomically; an isolated counter document avoids any chance of an unrelated `users` field being read/written in the same mutation.

**Argument for extending `users`:**

- One row, one mutation, no foreign-key dance. Bumping the counter is `ctx.db.patch(userId, { moat_reads_window: ... })`. A separate table would require `ctx.db.query("user_moat_read_counters").withIndex("by_user", q => q.eq("user_id", userId)).unique()` then patch.
- The per-action op budget cost matters. Per the Architecture Amendments §C.4 R-3 annotation, the counter must fit inside Convex's per-action op budget. A separate-table design adds 1 query + 1 patch per moat read = 2 ops; the inline design adds 0 query + 1 patch = 1 op (the user document is already in scope from auth). **Half the op-cost.**
- The counter is a single number. Three fields max. The "growth" argument doesn't apply because the counter is intentionally one-dimensional — per-table breakdowns are an aggregation-cron concern (§2.4), not a hot-path concern.
- Convex's mutation atomicity holds per-document. `users` patches don't lock the whole row against concurrent reads in any meaningful way — Convex serializes mutations per-document at the optimistic-transaction level. The "isolation" benefit is theoretical here.
- Hot-write contention on `users`: every moat read patches one user's row. Different users' rows don't contend. The same user issuing concurrent moat reads serializes through Convex's mutation pipeline, which we want anyway (the counter must not lose increments).

**Decision:** extend `users`. The op-cost halving is the load-bearing argument; the simplicity is the secondary one. Revisit if (a) we want per-table sub-counters on the hot path (we won't — see §2.4) or (b) the `users` row hits Convex document-size limits (each field is a number/boolean; we're three orders of magnitude under any limit).

### 2.2 Bump trigger — wrapper helper `queryMoat`

**Decision:** every moat-table read goes through a single helper function. The helper bumps the counter inside the same Convex query/mutation.

#### The three options considered

**(a) Wrapper helper `queryMoat(ctx, "tableName", indexFn)` enforced by CI grep.** Every moat read must look like:

```typescript
const rows = await queryMoat(ctx, "vehicle_facts",
  (q) => q.withIndex("by_canonical_question",
    (q) => q.eq("canonical_question_key", key)));
```

The helper internally calls `ctx.db.query("vehicle_facts").withIndex(...)`, awaits the result, then patches the calling user's counter by the row-count returned. CI grep enforces "no direct `ctx.db.query("vehicle_facts")` (or any of the 28 tables) outside the helper." This is the same pattern as Rule 1 in `vehicle-facts-grep.sh` (which forbids direct `ctx.db.patch` on `vehicle_facts` outside `convex/oto/vehicleFactsEditing.ts`).

**(b) Convex query-middleware.** Does Convex support a middleware that intercepts `ctx.db.query` calls and bumps a side-effect? **No.** Convex's `ctx.db` is a direct database handle, not a middleware-able surface. There is no `ctx.use(middleware)` API. We'd have to monkey-patch `ctx.db`, which (i) Convex docs warn against, (ii) is invisible to TypeScript so it breaks our strict-types discipline, and (iii) would silently break if Convex internally restructures the ctx object. **Rejected.**

**(c) Periodic aggregation from access logs.** Convex does not expose query-level access logs to user code. (There are server-side logs Convex Cloud retains for ops, but they're not queryable from the deployment.) Even if they were, aggregation-after-the-fact violates the real-time-block requirement — by the time the aggregation runs, the attacker has already exfiltrated. **Rejected.**

**Decision: option (a).** Wrapper helper + CI grep enforcement. This mirrors the discipline we already use for `vehicle_facts` mutations (helper-only path, CI grep) and the implementing engineer has a working pattern to copy.

#### The helper API (pseudocode)

```typescript
// convex/oto/queryMoat.ts (new file)
//
// THE ONLY LEGAL READ PATH for any of the 28 moat tables.
// Direct ctx.db.query("vehicle_facts") and equivalents are
// forbidden by CI grep (Rule 6). See WAVE_7_3_RATE_LIMIT_DESIGN.md.

import { MoatTableName, MOAT_TABLES } from "./moatTables";

export async function queryMoat<T extends MoatTableName>(
  ctx: QueryCtx | MutationCtx,
  tableName: T,
  build: (q: QueryBuilder<DataModel, T>) => OrderedQuery<...>,
): Promise<DocFromTableName<T>[]> {
  // 1. Resolve the calling user. If unauthenticated (or a system call
  //    from a cron/action), skip counter mutation but still execute
  //    the read. System reads are not subject to the user counter.
  const userId = await getCallingUserIdOrNull(ctx);

  // 2. Build the underlying Convex query and execute.
  const rows = await build(ctx.db.query(tableName)).collect();

  // 3. If a user is on the call AND not admin-exempt, bump the counter.
  if (userId !== null && ctx.db) {
    await bumpUserCounter(ctx, userId, rows.length);
    // bumpUserCounter:
    //   reads users[userId], checks moat_reads_is_admin_exempt,
    //   re-windows if (now - window_start) > WINDOW_MS,
    //   patches moat_reads_window += rows.length.
    // If threshold breached, throws RateLimitedError (see §3).
  }
  return rows;
}
```

**Counting unit:** rows returned, not queries issued. A query that returns 1 row counts as 1; a query that returns 200 rows counts as 200. This is the right unit — exfiltration value is proportional to rows extracted, not queries issued. (A 200-row query is what a scraper does; a 1-row point-lookup is what a legitimate user's chat does.)

**Edge case — paginated reads.** If a query uses `.paginate()`, the helper counts the rows in the current page. Same rule: the cost is proportional to rows delivered to the caller. The implementing engineer must add a `queryMoatPaginated` variant; same shape.

**Edge case — `.first()` / `.unique()`.** Both return ≤ 1 row; count as 1 if present, 0 if absent.

**Edge case — count-only queries.** Convex doesn't have a native count query; if it ever lands, count as 1 (the count operation reveals 1 number, not data — but reveals enumeration capability, so we don't count it as 0).

#### Mutation-context bump

`bumpUserCounter` is a database `patch`. In a Convex **query**, you cannot patch. So the helper has two shapes:

- **Read-side `queryMoat` (in Convex `query` context):** cannot bump; it must defer the increment.
- **Read-side `queryMoat` (in Convex `mutation` or `action` context):** bumps immediately.

This is a hard constraint of Convex's query/mutation separation. The implementing engineer must structure moat reads to occur from within mutations (which is already the case for the chat-agent's `sendMessage` action and for the helper-mediated KB reads). For the rare case of a Convex `query` function that reads moat data (e.g., a `useQuery`-bound list view of vehicle configs), the design **defers the counter bump to the next mutation** by writing a "pending bump" intent to a small auxiliary record that the next mutation drains. **OR** — simpler — we accept that `useQuery`-driven moat reads (which are typically client-rendered list pages and don't fan out arbitrarily) bypass the counter on the read-side and rely on the mutation-side reads (chat-agent, admin operations) for the bulk of counted reads. The scraper-attack vector goes through chat (which is a mutation), not through `useQuery` list pages (which are paginated, capped, and don't surface KB data).

**Decision:** mutation-context counter only. Convex `query`-context reads of moat tables are uncounted. This is documented as a known gap; the chat-agent (the actual attack vector) is in `action` context which runs a mutation for telemetry anyway. The implementing engineer must verify with `grep -rn 'ctx.db.query("vehicle_facts"' convex/` that no production `query` function reads moat data; any that do are migrated to mutation-context wrappers or explicitly exempted.

**Flag for Waleed:** §10.3 — this is the one design corner where I'm making a "lossy but accepts the loss" call.

### 2.3 Window — calendar-day OR rolling-24h? Recommend rolling.

#### Options

- **Rolling 24h window:** `now - window_start > 24h` → reset. Most accurate; the attacker can't "wait until midnight" to drain the counter. Implementation: one timestamp comparison per bump.
- **Calendar-day window (e.g., reset at 00:00 UTC):** the user's intuition matches — "I get N reads per day." But a scraper can sync against the reset boundary and double their per-second throughput at the reset moment.
- **Token bucket (capacity B, refill rate R rows/sec):** smoothest; no edge-burst exploit. Slightly more state (`last_refill_at` + `tokens_remaining`).

#### Recommendation: rolling 24h window.

- It matches the user's mental model ("I can ask a lot of questions; if I'm hammering it for a day I'm probably scraping") while being immune to the calendar-edge-burst exploit.
- One-timestamp implementation is the cheapest of the three. Token bucket would need refill-on-read math; not worth the extra ops in Convex's op-budget-sensitive environment.
- The "rolling 24h is hard because you have to track every read with its timestamp" critique does NOT apply here: we are not doing a precise rolling sum. We are doing a **window that resets when the first read of a new window arrives more than 24h after the window_start**. That's one timestamp, one comparison, one patch.

```
bumpUserCounter pseudocode:
  user = ctx.db.get(userId)
  now  = Date.now()
  if user.moat_reads_window_start === undefined ||
     (now - user.moat_reads_window_start) > 24 * 60 * 60 * 1000:
    # new window
    ctx.db.patch(userId, {
      moat_reads_window: rowsDelta,
      moat_reads_window_start: now,
    })
  else:
    newCount = (user.moat_reads_window ?? 0) + rowsDelta
    if newCount > threshold(user):
      throw RateLimitedError(user_id, newCount, threshold)
    ctx.db.patch(userId, { moat_reads_window: newCount })
```

### 2.4 No per-table sub-counters on the hot path

The counter is **one number per user.** Per-table breakdowns ("this user read 800 rows from `vehicle_facts` and 200 from `oem_parts`") are computed by an **aggregation cron** that scans `oto_telemetry` (which logs per-turn metrics including which moat tables the turn touched) post-hoc. The hot path stays one-op.

When an admin investigates a breached user (§5.1), they run the aggregation cron on demand against that user_id over the breached window. The breakdown is the diagnostic tool, not the rate-limit input.

This is the single most important micro-decision in the design: it keeps the per-read op cost at 1 patch. Anything per-table would multiply ops by 28.

### 2.5 Threshold — formula, not a number

The threshold is **a formula calibrated post-launch from production telemetry, not a hardcoded number committed in code today.**

```
threshold(user) =
  N × p95(legitimate_user_24h_moat_reads)

where:
  N = a multiplier (Sprint 2 calibration item; conservative starting
      point: 50; range 30-200 depending on observed legitimate-user
      tail).
  p95(...) = the 95th-percentile 24-hour moat-read count across
      legitimate users over the calibration window (first 2 weeks
      of production telemetry post-Wave-5.6).
```

#### Why a formula, not a number

Numbers chosen at design time are wrong. We don't know what legitimate-user read volumes look like under v3 (the consolidated KB changes the read pattern from the pre-v3 split design we measured against). Locking a number now means we either over-block (legitimate power users get falsely throttled and lose trust) or under-block (the threshold is too generous and a scraper extracts at will). Locking the **formula** means the calibration is a deterministic post-launch step, not a guess.

#### Why p95 specifically

p99 includes outliers we can't distinguish from scraping behavior at the tail. p50 cuts power users off too aggressively. p95 leaves ~5% of legitimate users at or near threshold — those users almost certainly include Waleed/Temur in admin-review mode, which is why §5.3 introduces the `is_admin_exempt` flag.

#### Why `N=50` as the starting point

If p95 of legitimate users is X reads/24h, allowing 50X means "a single account would have to read 50 days' worth of legitimate use in 24 hours to trip the limit." A legitimate user spike (long road trip, multi-vehicle research session) is unlikely to exceed 5-10X p95; a scraper trivially does. 50× balances "no false positives for power users" with "any real scraper trips fast."

The number is a **Sprint 2 calibration item.** Locking the formula here means the implementing engineer doesn't need to make this call; the calibration engineer does, with real data.

#### Per-user thresholds vs. global threshold

The formula is **global** — one threshold applies to all users (with the admin-exempt opt-out). Per-user thresholds (e.g., "this user has done 10 bookings; bump their threshold 2×") are explicitly out of scope. They add policy complexity that won't pay back until we have an abuse pattern that the global threshold can't catch.

### 2.6 Op-budget sizing

Per Convex's per-action operation budget (~1000 ops/action as of current platform limits):

- A legitimate chat turn fans out to: 1 read of `users` (auth), 1 read of the user's `vehicle`, 1-3 reads of the KB cascade (Tier 1 canonical-hash + Tier 2 structural + Tier 3 searchIndex), 1 mutation to `ai_messages`, 1 mutation to `oto_telemetry`. **Order 5-10 ops.**
- The Wave 7.3 counter adds: **1 read of `users` (already-in-scope) + 1 patch to `users` = 1 net new op per moat read**, since the `users` document is already fetched for auth.
- A worst-case chat turn doing 5 moat reads pays 5 extra patches = 5 net new ops. Even at 50 moat reads per turn (which would itself be anomalous), we're at 50 net new ops, well inside the budget.

No op-budget concern.

---

## 3. Enforcement at threshold breach

### 3.1 Three options

| Mode | Behavior on breach | UX | Trust-protocol implication |
|---|---|---|---|
| **Soft block** | Serve cached/stale data only; no fresh moat reads; no visible error | User sees slightly stale info | Power user never knows they were limited; trust intact |
| **Hard block** | Throw error; chat surfaces "high traffic detected; try again in X hours" | User sees an error | Trust hit if false positive; clarity if true scraper |
| **Throttle** | Insert delay (e.g., 1-5s per moat read after threshold); no block | User experiences slow chat | Subtle; degrades scraper economics without an explicit denial |

### 3.2 Recommendation: hybrid — soft block first, hard block on egregious breach

#### Phase 1 (1× → 2× threshold): soft block

- Tier 1 (canonical-hash exact match on `vehicle_facts`) still serves — it's already cache-shaped, the row is in memory of the chat-agent's recent context, and we want the legitimate-user-near-threshold experience to feel **identical** to normal.
- Tier 2/3 (structural index reads, BM25 fallback, fresh enrichment-table reads) return **the most recent cached result** (if any) with a "you're seeing recent data; refresh shortly" disclaimer suppressed at the UI layer (no visible disclaimer — the disclaimer would itself be a side-channel; "I just saw this disclaimer = I'm being rate-limited" = scraper signal).
- web_search-derived fresh queries — i.e., the chat-agent deciding to invoke web_search and persist a new `vehicle_facts` row — are **suppressed** during soft block. The chat returns a "I don't have specific data on that right now; try a more general question" answer, identical in tone to a legitimate-miss answer.
- No error is thrown to the client. No telemetry surface to the user.

#### Phase 2 (> 2× threshold): hard block

- Beyond 2× threshold in the same window, the user is now demonstrably extracting at scale. Hard block: subsequent moat queries throw `RateLimitedError`, the chat surfaces a friendly "we're seeing unusual traffic on your account; please try again later" message, and an admin telemetry event fires for review (§5.1).
- A legitimate power user does not hit 2× threshold within a 24h window in any realistic scenario — by definition, the threshold is N×p95 already, and 2N×p95 = 100×p95 at the recommended N=50.

#### Why hybrid

- **Trust:** a legitimate power user near the limit should not know they're near the limit. Soft block preserves trust.
- **Cost asymmetry:** a scraper deriving zero new data per turn (soft-blocked) is paying API costs to OpenAI for nothing. The economics break for them long before we have to surface an error.
- **Hard cap:** a determined scraper might still extract slowly during soft block (replaying cached data). The hard cap at 2× threshold puts the ceiling on per-account exfiltration.

#### Why not pure throttle

Throttling (insert 1-5s delays) is a legitimate option, and is **lighter-weight to implement** than the soft/hard hybrid. The argument against: it degrades the legitimate near-threshold user's experience visibly ("the chat is slow today") which is the same trust hit as a soft error. And it doesn't cap the scraper — they just wait the throttle out. The hybrid is strictly better than pure throttle.

### 3.3 The trust-protocol contract

This design treats threshold breach as **a quality-of-service degradation, not an account flag.** No "blocked" state, no admin review queue entry on first breach, no email "you've been limited." Just degraded service, then a soft "try again later" if it persists, then a hard block if it really persists.

A user who scraped accidentally (curious power user clicking through every spec on their dream car) experiences mild stale-data and recovers naturally as the window rolls. A user who is actively scraping (bot driver, automated test, real scraper) is incrementally degraded and eventually denied. No false-positive support ticket needed for the former; the latter is by definition no longer trusted.

---

## 4. The cross-account scraper-farm honest gap

Restating Doc 3 §9 / R-3 / Architecture Amendments §C.4:

> The cross-account scraper-farm case (which I flagged in Doc 3 §9 as honestly unsolved) remains honestly unsolved in v3 — it is not made worse by the v3 architecture, but it is not fixed either. This stays a known open problem on the Risk Register until cross-account behavioral correlation is built.

### 4.1 The unsolved problem in concrete terms

An adversary registers N fake accounts (cheap: email + Clerk verification + a created vehicle for query scope). Each account is permitted up to threshold T row-reads per 24h window before being soft-blocked. The adversary's effective extraction rate is **N × T rows / 24h**.

The Wave 7.3 single-account counter does nothing against this. It cannot — the counter is keyed on `user_id`, and N user_ids are N independent counters.

### 4.2 What it would take to solve

A cross-account solution requires three building blocks none of which exist today:

1. **Account-cluster fingerprinting.** Group accounts by likelihood-of-shared-origin. Signal sources: IP (rotates cheaply on residential proxy networks), device fingerprint (rotates with each fresh browser profile), Clerk OAuth provider identity (a determined adversary uses throwaway Gmail), behavior pattern (query rhythm, vehicle-selection pattern, question style). Each signal is individually weak; the cluster is built by ML over multi-signal correlation. **None of this exists in our codebase. Building it is a multi-quarter security-engineering project.**
2. **Cross-account aggregate counter.** For each cluster, sum the moat reads across its accounts. Apply a cluster-level threshold (T_cluster ≥ T per-account, calibrated separately). When a cluster crosses, all accounts in the cluster degrade together.
3. **False-positive appeals path.** Clusters will catch legitimate co-located users (family sharing IP, office network, etc.). An appeals UI + human-review process is required to avoid trapping innocents.

### 4.3 The sobering number

Working numbers assume the Sprint 2 calibration lands at p95(legitimate_user_24h_moat_reads) ≈ **200 rows** and N=50, so per-account threshold T = **10,000 rows / 24h**.

Moat size assumed (order-of-magnitude):

- 28 moat tables, average ~50K rows each. (Conservative; some tables are 10K-50K range like `chassis_specs` and `vehicle_configs`; some are 100K+ like `part_fitments`.) Total moat ≈ **1.4M rows.**
- A determined adversary wants to extract, say, 80% of the moat — call it **1.1M rows.**

**Extraction time at T per account, with N accounts in the farm:**

| Accounts (N) | Per-day extraction (N × T) | Days to extract 1.1M rows |
|---|---|---|
| 1 | 10,000 | **110 days** (~3.5 months) |
| 5 | 50,000 | **22 days** |
| 10 | 100,000 | **11 days** |
| 50 | 500,000 | **2.2 days** |
| 100 | 1,000,000 | **1.1 days** |
| 500 | 5,000,000 | **5.3 hours** |

The single-account rate-limit pushes a lone attacker from "extract in a weekend" to "extract in ~3.5 months of continuous scraping" — a meaningful cost. **A real scraper farm with 100 fake accounts** can extract the entire moat in **just over one day.** A 500-account farm (cheap: $1-5 per Gmail-verified Clerk account on the gray market = $500-2500 total cost) extracts in **5 hours.**

**This is the strategic risk Temur is taking.** The Wave 7.3 control raises the bar for casual scraping but does not stop a financed competitor with $1-2K to spend on accounts. The honest assessment is that the moat-as-a-defensive-asset assumes either (a) we are below adversary attention for the first 12-18 months, (b) the moat is renewing faster than it's exfiltrated (enrichment pipeline outputs new data faster than scrapers can read old data — measurable; we should track this metric), or (c) we ship cross-account correlation before any adversary at this scale notices us.

### 4.4 What's NOT in this wave

Explicitly out of scope for Wave 7.3:

- IP-based throttling at the Convex layer (Convex doesn't expose IP to user code without a custom action; could be added later via a Clerk pre-auth hook).
- Device-graph correlation across accounts.
- Query-pattern similarity clustering across users.
- Account-age-gated query budgets (new accounts get a lower T for their first N days).
- CAPTCHA on chat after threshold proximity.

Any of these is a candidate for a future "Wave 7.4 / Wave 7.5 cross-account abuse control" item on the Risk Register.

### 4.5 The R-3 entry update

R-3 in `RISK_REGISTER.md` (and Architecture Amendments §C.4) should be amended at Wave 7.3 ship to read:

> **R-3 — KB moat exfiltration. Severity: Irreversible.**
>
> **Single-account exposure (Wave 7.3):** mitigated. Per-user rate-limit caps a lone adversary at ~10K rows/24h, raising solo extraction time of the full moat to ~3.5 months.
>
> **Cross-account exposure:** unmitigated. A scraper farm with 100 fake accounts extracts the full moat in ~1 day; 500 accounts in ~5 hours. Cost to adversary: $500-2500 in account creation. Mitigation deferred to a future cross-account behavioral-correlation wave (not scheduled).
>
> **Strategic premise:** the moat is defensible under R-3 only if adversary attention lags behind our defensive maturation. We track moat-growth-rate vs. theoretical-extraction-rate as a quarterly metric. If a real exfiltration event is detected, cross-account correlation gets promoted from "future wave" to "P0."

---

## 5. Operational concerns

### 5.1 Admin investigation of a tripped user

When the counter breaches, two things happen:

1. The user enters soft-block (and at 2× hard-block) per §3.
2. An admin-visible telemetry event fires (insertion into `oto_telemetry` with `event_type: "moat_rate_limit_breach"` and the user_id + counter value + window_start).

The admin investigation UI (admin-only screen, Waleed + Temur access) shows for each breach:

- **The counter value at breach** and the threshold it crossed.
- **The per-table breakdown** (computed on-demand by the aggregation cron against `oto_telemetry` for the breached window).
- **The user's most recent N chat conversations** in the breached window, with the moat-reads-per-turn highlighted.
- **A "scraper or power user?" judgment prompt:** if the per-table distribution is uniform-across-many-tables (= scraping pattern), flag as likely scraper. If concentrated on a single vehicle's data (= legitimate research), flag as likely power user.

The admin then has three actions: **Reset counter** (false positive), **Confirm scraper** (lock account, escalate), or **Leave as-is** (let the natural window-roll handle it).

### 5.2 Counter reset for false positives

A new admin mutation lands in `convex/admin/` — specifically, `convex/admin/rateLimitOps.ts`:

```typescript
// Pseudocode — implementing engineer writes the actual function.
export const resetMoatCounter = mutation({
  args: { user_id: v.id("users"), reason: v.string() },
  handler: async (ctx, { user_id, reason }) => {
    await assertAdmin(ctx);  // throws if caller not Waleed/Temur
    await ctx.db.patch(user_id, {
      moat_reads_window: 0,
      moat_reads_window_start: Date.now(),
    });
    await ctx.db.insert("audit_log", {
      action: "rate_limit_reset",
      target_user_id: user_id,
      acting_user_id: await getCallingUserId(ctx),
      reason,
      ts: Date.now(),
    });
  },
});
```

Gating: `assertAdmin` checks the caller's clerk-user-id against a hardcoded allowlist of Waleed and Temur, identical to the gating already used in `convex/admin/` for the fact-review queue (per `SECURITY_CONSOLIDATED_V3.md` §6.2 item 4).

The audit-log row is non-optional — every reset is recorded. If a compromised admin account starts resetting counters in bulk, the `audit_log` table reveals it on review.

### 5.3 Admin-exempt flag

Waleed and Temur both run high-volume read patterns during admin review (browsing the fact-review queue clicks `vehicle_facts` rows; navigating the admin UI fans out to many moat tables). They will trip the limit.

**Solution:** a boolean flag on `users` — `moat_reads_is_admin_exempt: v.optional(v.boolean())` — that, when true, causes `bumpUserCounter` to skip the increment and the threshold check entirely. The flag is set by a one-time mutation (gated to Waleed-and-Temur, same allowlist) and persists.

The flag's TRUE state is itself audited: a row in `audit_log` records who set it, when, and why. The flag's value is exposed in the admin UI (a small "admin exempt" badge on the user row) so that no one forgets which accounts are skipping the counter.

**Why not just hardcode the allowlist in the helper?** Because then changing the allowlist is a code deploy. A flag on `users` lets the admin UI flip the bit in seconds.

**Why not exempt all admin-role users?** Because the `role` field on `users` is `v.optional(v.string())` and not closely audited. The two named accounts are the smallest blast radius.

---

## 6. CI grep update (Rule 6 — sketch only, not in the live script today)

Per the §2.2 decision (option (a), wrapper helper), a new CI grep rule must enforce that no direct `ctx.db.query("<moat-table>")` happens outside the helper.

### 6.1 Rule 6 sketch

To be added to `scripts/ci/vehicle-facts-grep.sh` (or a sibling file, implementer's choice):

```bash
# Rule 6 — direct ctx.db.query on a moat table outside queryMoat helper
echo "Rule 6: forbidden direct ctx.db.query on moat tables..."

MOAT_TABLES_REGEX='"(makes|models|generations|trims|engines|transmissions|chassis_variants|chassis_specs|vehicle_configs|drivetrain_configs|trim_specs|oem_parts|part_fitments|part_prices|services|service_categories|service_options|service_vehicle_specs|service_intervals|labor_times|mechanic_verifications|tire_brands|tire_size_cache|tire_models|tire_pricing|model_year_cache|trim_year_cache|vehicle_facts)"'

QUERY_MOAT_HELPER="convex/oto/queryMoat.ts"

RULE_6_HITS=$(
  rg -n "ctx\.db\.query\(${MOAT_TABLES_REGEX}\)" convex/ \
    --type ts \
  | rg -v "^$QUERY_MOAT_HELPER" \
  | rg -v "^convex/_generated/" \
  | rg -v "^convex/admin/" \
  # admin/ tools intentionally exempt — see §5
  | rg -v "^convex/oto/migrations/" \
  # migrations intentionally exempt — see below
  || true
)
if [ -n "$RULE_6_HITS" ]; then
  red "  FAIL — direct ctx.db.query on moat table outside $QUERY_MOAT_HELPER:"
  echo "$RULE_6_HITS"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  green "  OK"
fi
echo ""
```

### 6.2 Bypassed paths

- **`convex/oto/queryMoat.ts`** — the helper itself, the one legal site of the underlying query.
- **`convex/admin/`** — admin tooling reads bulk moat data to populate the review queue; admin queries are not subject to user rate limits.
- **`convex/oto/migrations/`** — migrations read the moat to backfill / reconcile; they run from cron context with no user, so the counter is irrelevant anyway. (The runtime helper already returns early if `userId === null`, but explicit exemption keeps the CI rule cleanly scoped.)
- **`convex/vehicleEnrichment/`** — possibly: the enrichment pipeline's structured-table writes/reads run from action context, not user context. These are not user-rate-limit-subject. The implementing engineer reviews `convex/vehicleEnrichment/` and decides per-file; the safe default is to exempt the whole subtree on the grounds that this is the pipeline that **writes** the moat, not user code that reads it.

### 6.3 Not in the live script today

This is **a sketch only.** The Wave 7.3 implementing engineer writes the live script when the helper ships. Adding Rule 6 to the live script before the helper exists would cause an unrunnable CI (every existing moat read fails the rule). The order is: ship helper → migrate existing moat reads through helper → add Rule 6 to script → enforce.

The schedule:

1. Wave 7.3 sprint: ship the helper (`convex/oto/queryMoat.ts`), migrate all existing moat reads onto it.
2. Wave 7.3 + 1 day: turn on Rule 6 in CI.

---

## 7. Rationale — the security analyst's voice

### 7.1 Why a single-account counter, knowing the farm case is open

The single-account counter is **the cheapest meaningful protection that materially raises the cost of casual scraping.** It catches:

- Curiosity scraping (a developer plays with the API and hits it 50K times).
- Single-developer competitor recon (one person spins up an account, scrapes during their lunch break).
- Automated test infrastructure pointed at our production by mistake (we've seen this; everyone has).
- The first day of a real scraper farm (which often starts as one account before scaling).

It does NOT catch a financed competitor with $1-2K to spend on account creation. **That competitor is not the cheapest-to-defeat adversary.** The cross-account behavioral correlation that catches them requires ML infrastructure we do not have and cannot ship inside the 12-week initial program. Building it before we even know if we have such an adversary is over-engineering against a phantom.

The right sequencing is: (i) ship the cheap protection (Wave 7.3) that handles 80% of attackers at 5% of the engineering cost; (ii) instrument moat-growth-rate so we can detect when a real exfiltration event is happening; (iii) when (and only when) a real event lands, promote cross-account correlation from "future wave" to "P0" with the budget and engineering attention it requires.

### 7.2 Why a wrapper helper, not query-middleware

Convex doesn't support middleware. Building our own would either monkey-patch ctx (fragile across Convex platform upgrades) or use a class wrapper around ctx (verbose at every call site). The helper pattern is the path Convex's design steers us toward — see how mutations already use helper functions for cross-cutting concerns (auth, telemetry, the v3 `vehicleFactsEditing.ts` itself). One more helper is one more file; the discipline is **proven by Rules 1-3 of the existing CI grep.**

### 7.3 Why extend `users`, not a new table

Op cost. Every halved op buys us headroom on the per-action budget that we can spend on more important things (more KB reads per turn, more enrichment touches). Architectural purity ("rate-limit state is conceptually separate from user identity") is a real concern but a smaller one than 1 vs 2 ops per moat read times the millions-of-reads-per-day moat traffic we expect.

### 7.4 Why a formula, not a number, for the threshold

The single biggest failure mode of a rate limit is **wrong number.** Too low: legitimate power users get blocked, lose trust, churn. Too high: scraper extracts at will, R-3 fires, irreversible. The right number is the post-calibration number. Committing to a formula now and the number later means we don't make this mistake at design time. The implementing engineer doesn't need to make this call; the calibration engineer does, with two weeks of real telemetry in hand.

### 7.5 Why soft-block-then-hard-block, not throttle

Throttle degrades the legitimate near-threshold user visibly (slow chat). Soft block degrades them invisibly (slightly stale data, served from cache). The trust calculus: a legitimate user who experiences slow chat reports a bug ("your app is slow today") and we have a support ticket. A legitimate user who experiences slightly-stale-but-still-correct data experiences nothing reportable. Soft block is the trust-preserving choice. Hard block at 2× ensures we still have a ceiling on egregious abuse.

### 7.6 Why this design holds even when wrong

Every piece of the design has a fail-soft mode if calibration is off:

- If the threshold is too low and legitimate users trip: soft block degrades them invisibly; admin investigation (§5.1) catches the false positives within 24-48h of telemetry; admin resets counters (§5.2); we tune N down. Recoverable.
- If the threshold is too high and scrapers slip: we still have moat-growth-rate instrumentation (§7.1); we catch the exfiltration via the macro signal; we tune N up and add cross-account work to the queue. Recoverable.
- If the wrapper helper is bypassed by a developer (CI grep failure): Rule 6 is the trip-wire; PR is blocked; no production exposure.
- If the counter is wrong (state corruption, e.g., Convex doc-size limit): the worst case is the counter undercounts (user reads more than they should) — not an availability failure, just a degraded protection. We catch this in periodic counter-sanity-checks (compare to `oto_telemetry` aggregation).

No single failure of this design takes down chat or blocks legitimate users without recourse.

---

## 8. Decision summary

| Decision | Choice | Rationale (1 line) |
|---|---|---|
| Storage | Extend `users` (3 fields) | Halves per-read op cost vs. separate table |
| Bump trigger | Wrapper helper `queryMoat` | Convex has no middleware; helper + CI grep is the proven pattern |
| Window | Rolling 24h | Edge-burst-immune; one-timestamp implementation |
| Threshold | `N × p95(legitimate_user_24h_reads)`; N defaults to 50 | Formula locked; number is Sprint 2 calibration |
| Counting unit | Rows returned, not queries issued | Exfiltration value is per-row |
| Per-table sub-counters on hot path | NO — aggregation cron only | Keeps per-read op cost at 1 |
| Enforcement at breach | Soft block 1×→2×; hard block > 2× | Trust-preserving for legitimate; ceiling for abuse |
| Admin investigation UI | Required | Per-table breakdown computed on demand |
| Admin counter reset | Required, gated to Waleed + Temur, audit_log row | Standard admin operation; auditable |
| Admin-exempt flag | `users.moat_reads_is_admin_exempt` boolean | Waleed + Temur use the admin UI without tripping |
| CI Rule 6 (forbid direct moat-table query) | Sketched here; live script update at Wave 7.3 ship | Same pattern as Rules 1-3 in `vehicle-facts-grep.sh` |
| Cross-account farm protection | OUT OF SCOPE; documented as R-3 residual | Multi-quarter ML work; not in 12-week program |

---

## 9. Implementer's checklist (Wave 7.3 sprint)

When the Wave 7.3 sprint runs, the implementing engineer's deliverables are:

- [ ] Add three fields to `users` in `convex/schema.ts`: `moat_reads_window`, `moat_reads_window_start`, `moat_reads_is_admin_exempt`. All optional.
- [ ] Create `convex/oto/moatTables.ts` exporting the 28-name `MoatTableName` union and `MOAT_TABLES` constant array.
- [ ] Create `convex/oto/queryMoat.ts` with the `queryMoat` helper (signatures + bump logic per §2.2). Sister function `queryMoatPaginated`.
- [ ] Migrate every existing moat-table read in `convex/` to go through `queryMoat`. List of files to touch: any file matching `rg -l 'ctx\.db\.query\("(<28 names>)"\)' convex/`. Expected non-trivial fan-out in `convex/oto/`, `convex/vehicleEnrichment/` (except: that subtree is exempt; see §6.2).
- [ ] Create `convex/admin/rateLimitOps.ts` with `resetMoatCounter` and `setAdminExemptFlag` mutations, both gated to Waleed + Temur, both inserting `audit_log` rows.
- [ ] Add Rule 6 (per §6.1) to `scripts/ci/vehicle-facts-grep.sh` (or create `scripts/ci/moat-read-grep.sh` — implementer's call). Run after migration is complete.
- [ ] Add `event_type: "moat_rate_limit_breach"` to the `oto_telemetry` event-type union and emit on hard-block.
- [ ] Wire the soft-block / hard-block branches into the chat-agent's moat-read paths (§3.2).
- [ ] Sprint 2 follow-up (separate ticket): calibrate `N` and `p95` from 2 weeks of production telemetry.
- [ ] Update R-3 entry in `RISK_REGISTER.md` per §4.5.

---

## 10. Flags for Waleed (the design-time decisions I'd want sanity-checked)

### 10.1 The 28-vs-27 count — `mechanic_verifications` inclusion

I'm adding `mechanic_verifications` to the moat list (prior list had 27; this list has 28). If you ("the moat is vehicle-knowledge, not vendor-credibility") disagree, drop it cleanly. **Default in the design: include.**

### 10.2 The `is_admin_exempt` flag

I'm proposing a boolean flag on `users` for Waleed-and-Temur to bypass the counter during admin work. The alternative — exempt admins by allowlist at the helper layer — is less flexible but more secure (the flag's storage is itself a target). Lean: flag, because the admin UI use-case is daily and the flag's lifecycle has its own audit row. **Confirm or call.**

### 10.3 Convex `query` context moat reads are uncounted

The helper bumps the counter only in mutation context (Convex limitation: queries can't patch). Moat reads from Convex `query` functions (e.g., a `useQuery` on a list page) bypass the counter. This is a known gap. The chat-agent attack vector is in action/mutation context so the gap doesn't compromise R-3 mitigation against the bot scraper. **Acceptable trade-off; flag for visibility.**

### 10.4 The N=50 starting point

This is the Sprint 2 calibration input, not a Sprint 1 commit. But the conservative range is 30-200 and I'm anchoring at 50 for the doc. If you have a strong prior on the right N before we have data, override here. **Otherwise: leave as the formula-locked default until telemetry lands.**

---

## 11. Cross-references

| Concept | This doc | Prior doc |
|---|---|---|
| The 28 moat tables enumerated | §1.2 | `SECURITY_CONSOLIDATED_V3.md` §3.3 (was 27) |
| Counter mechanics (storage + bump) | §2 | `SECURITY_CONSOLIDATED_V3.md` §3.4 |
| Threshold formula | §2.5 | `SECURITY_CONSOLIDATED_V3.md` §3.5 |
| Enforcement at breach | §3 | (new in this doc) |
| Cross-account residual | §4 | `SECURITY_CONSOLIDATED_V3.md` §4, Architecture Amendments §C.4 |
| Admin investigation / reset | §5 | (new in this doc) |
| CI Rule 6 sketch | §6 | (extends `scripts/ci/vehicle-facts-grep.sh` Rules 1-5) |

— AI Security Analyst, Sprint 1 Day 3 deliverable.

---

## 12. Implementation Status (Sprint 1 Day 7 ship)

This section is appended as the design transitions from spec to shipped code. Updated 2026-05-16 by the AI Security Analyst at Option B implementation time.

### 12.1 What is live

- **Schema fields on `users` (§2.1)** — three optional fields appended to `convex/schema.ts`:
  - `moat_reads_window: v.optional(v.number())`
  - `moat_reads_window_start: v.optional(v.number())`
  - `moat_reads_is_admin_exempt: v.optional(v.boolean())`
- **Wrapper helper `convex/oto/queryMoat.ts` (§2.2)** — exports `queryMoat<T>(ctx, tableName, build)`, the `MoatTable` union of the 28 names, `MOAT_TABLES` constant array, and `MoatRateLimitedError`. Threshold defaults to `N × MOAT_P95_DEFAULT` where `N=50` (env-overridable via `OTO_MOAT_THRESHOLD_N`) and `MOAT_P95_DEFAULT=200` is a placeholder.
- **CI Rule 7 in `scripts/ci/vehicle-facts-grep.sh` (§6)** — direct `ctx.db.query("<moat_table>")` inside `convex/oto/` is forbidden outside the bypass paths (`queryMoat.ts`, `migrations/`, `evalHarness.ts`, `evalTestFilter.ts`) or sites annotated with a per-call `EXEMPT:` comment within 2 lines above the read. Mirrors Rule 6's structure.
- **Grandfather posture** — existing pre-migration moat reads carry an `EXEMPT:` annotation pointing here. Only `lookupVehicleSpec.ts`'s `makes` read currently needs this. The four-table services-moat hole (D-Q1 accepted, services/service_categories/service_options/service_vehicle_specs) is reachable via mobile `useQuery` only — no convex/oto/ reads against those tables exist today. CI Rule 7 grandfathers the migration-time annotation pattern.

### 12.2 What is deferred

- **Real p95 calibration of the threshold (§2.5).** `MOAT_P95_DEFAULT = 200` is a placeholder; `N = 50` is the design default. Both wait on two weeks of production telemetry post-Wave-5.6 to anchor the formula. Sprint 2 calibration item.
- **Migration of existing moat reads through `queryMoat()`.** This pass ships only the helper + schema + CI rule. The grandfather list and `EXEMPT:` annotations cover existing reads; a follow-up wave migrates each site through the helper and removes its annotation.
- **Mobile `useQuery` four-table exfiltration (Adv-1 hole).** The four services-moat tables (`services`, `service_categories`, `service_options`, `service_vehicle_specs`) remain exfiltrable at full speed by a legitimate account via direct `useQuery`. Per D-Q1 acceptance and `WAVE_7_3_QUERY_CONTEXT_DECISION.md` §6.1, this is the explicitly-accepted residual. Tripwire: 10× p95 sustained 24h on per-function call counts (D-Q2 accepted) promotes Option C re-routing to P1.
- **Cross-account behavioral correlation (§4).** Scraper-farm protection remains out of scope. R-3 residual per Architecture Amendments §C.4.1.
- **Admin investigation UI + counter reset mutation (§5).** Not in this pass. `moat_reads_is_admin_exempt` field exists on schema but no admin-only setter mutation ships yet; will land with the migration wave.
- **Telemetry event `moat_rate_limit_breach` (§5.1).** Not emitted. The helper currently `console.warn`s on soft-block and throws `MoatRateLimitedError` on hard-block.

### 12.3 Verification

- Schema brace-balance preserved: open=128, close=128, delta=0.
- CI rule status: 7/7 rules clean.
- TypeScript strict compile: clean against `convex/` (no `any` in `queryMoat.ts`; one pre-existing `.expo`-generated template-literal warning unrelated to this change).

— AI Security Analyst, Sprint 1 Day 7 — Option B implementation.
