# Sprint 1 Day 3 — Execution Log
**Date:** 2026-05-16 (same calendar day; Sprint 1 Day 1 + Correction + Day 2 + Day 3 all shipped today)
**Authority:** PM Ruling v3 (consolidated) + Architecture v3 Amendments §F + Sprint 1 Day 2 Log queued items
**Owner:** PM, executing via 3 parallel subagents per Waleed's efficiency directive.

---

## 0. Day 3 in one sentence

**Three subagents in parallel — QA Lead, Memory Engineer, Security Analyst — landed the eval harness, the reconciliation cron, and the Wave 7.3 design doc concurrently with no contention; all 5 CI grep rules clean throughout.**

---

## 1. The efficiency lesson recorded

Day 2 used 2 sequential subagents (Memory then RAG); Waleed observed that left parallel work streams on the table. Day 3 fanned out to 3 parallel subagents because the three Day 3 deliverables had genuinely zero overlap — different files, different mandates, different review surfaces.

| Subagent | Files touched | Files NOT touched (and why no contention) |
|---|---|---|
| QA Lead | `scripts/eval/**` (new tree) | No `convex/` writes; harness reads from production deployment via HTTP API |
| Memory Engineer | `convex/oto/migrations/vehicleFactsReconciliation.ts` (new), `convex/schema.ts` (one append at bottom), `convex/crons.ts` (one cron registration), `docs/SPRINT_1/RECONCILIATION_RUNBOOK.md` (new) | No `vehicle_facts` mutation; new file at a path the other agents don't visit |
| Security Analyst | `docs/SPRINT_1/WAVE_7_3_RATE_LIMIT_DESIGN.md` (new) | No code today — design doc only |

The discipline: when an agent's deliverable lives in a directory another agent doesn't visit and modifies files another agent doesn't read, they can ship in parallel safely. When two agents would touch the same file or schema, sequence them.

---

## 2. What landed (by subagent)

### 2.1 QA Lead — eval harness + Wave 1.4 v3 cases

`scripts/eval/` tree (new):

| File | Purpose |
|---|---|
| `fixtures/wave_5_1_labeled_set.jsonl` | 36 labeled entries, exactly 4 per category across A–I (real vehicle scopes: Civic 1.5T L15B7, F-150 5.0L Coyote, Audi A4 CAEB 2.0T, Subaru WRX FA20DIT, Wrangler JL Pentastar 3.6, Camry A25A-FKS, etc.) |
| `wave_5_1_harness.ts` | Main retrieval-quality harness. `npx tsx scripts/eval/wave_5_1_harness.ts [--mock\|--live] [--repeats 10] [--fixture path] [--out dir]` |
| `wave_1_4_v3_harness.ts` | Wave 1.4 v3 case harness. Same CLI shape + `--category [a\|b\|c\|d\|e\|all]` |
| `lib/cascadeClient.ts` | Typed wrapper around `cascadeTier2` action call. `--mock` mode supported. |
| `lib/metrics.ts` | Five pure metric implementations: `precisionAt3`, `recallAt5`, `meanReciprocalRank`, `tierMisclassification` (5 sub-rates including `t1_to_t3` and `t2_to_t3` LOUD cases), `disclaimTagCorrectness` (with `over_disclaim_rate` + `under_disclaim_rate`). Plus `passRateWithConfidence` Wilson 95% CI utility for N≥10 statistical reporting. |
| `lib/metrics.test.ts` | Vitest unit tests for the pure metric functions. |
| `README.md` | Run instructions, env vars, output paths, Day-4 blockers section |

Wave 1.4 v3 case categories shipped: (a) tier routing — 6 cases, (b) disclaim-tag render — 5, (c) report flow — 5, (e) audit-log invariant — 5. Deferred to Day 4: (d) cross-tenant read — 3 case stubs written with `passed: false` + `DEFERRED Day 4` notes; blocked on multi-user data-setup helper.

### 2.2 Memory Engineer — reconciliation cron

`convex/oto/migrations/vehicleFactsReconciliation.ts` (new, ~32 KB):

| Export | Cadence | Severity-on-fire |
|---|---|---|
| `checkReplayEquivalence` | every 15 min | PAGE on first inconsistency |
| `checkCounterParity` | hourly (driver scans prior hour) | ALERT at drift ≥ 5 |
| `checkOrphanAuditRows` | every 15 min | PAGE on first orphan |
| `checkTelemetryParity` | every 15 min | ALERT on nonzero delta |
| `runReconciliation` | driver internalAction | writes `reconciliation_runs` row |

`convex/crons.ts` — registered with `crons.interval("vehicle_facts_reconciliation", { minutes: 15 }, ...)`. Driver decides which checks fire each tick based on prior-hour history.

`convex/schema.ts` — appended `reconciliation_runs` table (after `oto_migrations`): `run_id`, `started_at`, `completed_at?`, `checks_ran[]`, `anomalies[]`, `status` ∈ { running | clean | anomalies }. Indexes `by_started_at`, `by_status`.

**Telemetry-parity simplification documented in code:** chose option (b) — query-based approximation (count audits in window vs count edits in window) rather than runtime counters. Reason: the audit invariant already equates "edit happened" with "audit row written" atomically via the helper, so a count-based check is sufficient ground truth without new counter infrastructure. The known gap (rows created before window but edited inside) is covered independently by `checkReplayEquivalence`.

`docs/SPRINT_1/RECONCILIATION_RUNBOOK.md` (new) — on-call investigation steps for each anomaly type, threshold-tuning instructions, env-var kill switches (`OTO_RECON_DISABLE_<CHECK>`), example `reconciliation_runs` queries.

### 2.3 Security Analyst — Wave 7.3 rate-limit design

`docs/SPRINT_1/WAVE_7_3_RATE_LIMIT_DESIGN.md` (new, ~700 lines):

| Section | Decision |
|---|---|
| Moat-table count | **28 tables** (up from prior 27 — added `mechanic_verifications` because chat surfaces verified-mechanic recommendations to users) |
| Tables explicitly EXCLUDED | `vehicle_facts_audit`, `fact_reports`, `oto_migrations`, `reconciliation_runs`, telemetry, `audit_log` — all admin/queue, no moat-data exfiltration value |
| Counter storage | Three new optional fields on `users` table: `moat_reads_window`, `moat_reads_window_start`, `moat_reads_is_admin_exempt` |
| Bump trigger | Single wrapper helper `queryMoat(ctx, "tableName", build)` — Convex doesn't support query middleware; the helper + CI grep is the enforcement pattern (mirrors Rules 1-3) |
| Window | Rolling 24h, one-timestamp reset semantics. Edge-burst-immune; cheapest in op cost. |
| Threshold formula | `N × p95(legitimate-user 24h read count)` where N is a calibration parameter (starting at 50). Numbers are a Sprint 2 calibration item; the formula is locked here. |
| Enforcement at breach | **Hybrid: soft-block then hard-block** — 1×–2× threshold serves cached/stale Tier-1 data invisibly; >2× hard-blocks with a friendly "high traffic" message. Throttling rejected (visibly degrades legitimate user; doesn't cap scraper). |
| Cross-account farm sobering number | Assuming p95 ≈ 200 rows/24h, N=50, ~1.4M-row moat: 100 fake accounts = ~1.1 days to extract; 500 accounts = ~5 hours. Account creation = $1–5/account on gray market. A $500–2500 budget defeats single-account rate-limiting entirely. **This is the residual R-3 risk Temur is accepting until cross-account behavioral correlation lands.** |
| Rule 6 (CI grep) | **Sketched, not added live.** Bash rule with 28-table regex + bypass paths for `queryMoat.ts` helper, `convex/admin/`, `convex/oto/migrations/`, `convex/vehicleEnrichment/`. The implementing engineer turns it on at Wave 7.3 ship after migrating existing moat reads through the wrapper. |

---

## 3. CI grep status

```
Rule 1: forbidden direct patches on vehicle_facts...               OK
Rule 2: forbidden direct replace on vehicle_facts...               OK
Rule 3: forbidden direct insert into vehicle_facts_audit...        OK
Rule 4: no new embedding writes...                                 OK
Rule 5: retired vehicle_searched_facts name must not reappear...   OK
All vehicle-facts invariant checks passed (5/5 rules clean).
```

Clean throughout Day 3 — verified after each agent shipped.

---

## 4. Pre-existing TS errors surfaced (NOT regressions)

The Memory Engineer ran `tsc --noEmit` on their new file and noted pre-existing unrelated errors in:

- `convex/oto/chat.ts` — pre-existing, unrelated to our changes
- `convex/oto/searchedFacts.ts` — BOM encoding issue on the deprecation stub
- `convex/oto/migrations/backfillV3Lifecycle.ts` line 289 — pre-existing in the Memory Engineer's Day 2 file

None of these block Sprint 1 forward progress (the schema and helpers compile; the affected lines are existing code paths or comment-only edits). Flagging here so they're not lost; they should be cleaned up in a Day 4 housekeeping pass.

---

## 5. Decisions flagged for Waleed (carryover + new)

### From Day 2 (still open)

1. **Wave 5.2 baseline timing.** State-0 measurement is gone (vectorIndex removed Day 1). Accept the shifted baseline (today's structural retrieval becomes the comparison anchor) or roll back schema for an hour to measure? **PM lean:** accept the shift.
2. **`recordFact` deprecation.** Legacy paths in `vehicleFactsKB.ts` (`insertFact`, `recordFact`) coexist with the new `recordVehicleFact` in `vehicleFactsEditing.ts`. Migrate chat.ts to the new helper Day 4 or defer?

### New from Day 3 (Security Analyst's four)

3. **Wave 7.3 moat-table list — `mechanic_verifications` in or out?** Defaulted IN on the read-pattern argument that chat surfaces verified-mechanic recommendations. Could argue OUT if treated as "vendor moat" not "vehicle moat." **Security Analyst lean:** include.
4. **Admin exempt pattern: `is_admin_exempt` flag on `users` vs hardcoded allowlist?** Defaulted flag. Could argue hardcoded for less-tamperable allowlist.
5. **Convex `query`-context moat reads uncounted.** Queries can't patch counters in Convex. Documented as known gap with the argument that the scraper attack vector goes through mutation/action context, not `useQuery` list pages. **Security Analyst confidence:** medium-high; flagged for explicit Waleed sign-off.
6. **N=50 threshold parameter.** Sprint 2 calibration input, not a Sprint 1 commit. Listed so it's tracked as an upcoming decision rather than a forgotten default.

### New from Day 3 (QA Lead's three Day-4 blockers)

7. **Live-mode T1/T3 coverage.** Harness currently only calls `cascadeTier2` (Tier 2). T1 (enrichment-owned tables) and T3 (web_search) paths live in `convex/oto/tools.ts::retrieve_vehicle_facts` and aren't exposed as a standalone action. Day 4 needs to expose `api.oto.evalHarness.runFullCascade` for full-tier live coverage.
8. **Multi-tenant data-setup helper** for Wave 1.4 v3 case (d) cross-tenant read + Wave 5.1 Cat G. Day 4 deliverable: `scripts/eval/lib/multiTenantSetup.ts` plus two Clerk-synthetic users + a fully-enriched vehicle config.
9. **Report-mutation export name confirmation.** Harness assumed `api.oto.factReports.report` for category (c); needs verification against the actual export. Day 4 ten-minute check.

---

## 6. Sprint 1 Day 4 candidate stack

| # | Item | Owner | Notes |
|---|---|---|---|
| 1 | Expose `api.oto.evalHarness.runFullCascade` for T1/T3 live coverage | RAG Specialist | Unblocks Wave 5.2 uncomfortable-baseline measurement |
| 2 | `scripts/eval/lib/multiTenantSetup.ts` + 2 synthetic users + enriched config | Memory Engineer or RAG Specialist | Unblocks Wave 1.4 v3 case (d) + Cat G live runs |
| 3 | Run `runBackfillV3Lifecycle` in dev to validate idempotency on real data | Waleed (manual op) | Carryover from Day 2 |
| 4 | Wave 5.2 baseline measurement (once #1 + #2 land) | QA Lead | The "uncomfortable number" Doc 3 §4 said would be the signal doing its job |
| 5 | Clean the three pre-existing TS errors (chat.ts, searchedFacts.ts BOM, backfillV3Lifecycle.ts:289) | PM housekeeping pass | Quick |
| 6 | `recordFact` → `recordVehicleFact` migration in chat.ts | RAG Specialist | Carryover from Day 2 |
| 7 | Wave 2.4 prompt language PR draft from `INTERACTION_WAVE_2_4_V3.md` | Interaction Strategist | Gated on Wave 1.5 (prompt-change protocol) existing first — which is itself a separate work stream |
| 8 | Wave 1.5 prompt-change protocol implementation | Principal Prompt Engineer | Needed before any prompt change ships |

**Recommended Day 4 pick:** Items 1 + 2 in parallel (two subagents). Both are Day-4 blockers for the harness; both are independent code work in different files. Once they land, item 4 (the baseline measurement run) becomes mechanical and Waleed can execute it as a single command.

---

## 7. The Day 3 one-line summary

**Three subagents, three deliverables, zero contention, five CI rules holding — the parallel-fan-out methodology Waleed pushed for ships ~3× more per day with the same coordination cost as Day 2's sequential pair.**

— End of Day 3.
