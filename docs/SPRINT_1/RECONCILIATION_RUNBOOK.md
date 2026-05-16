# RECONCILIATION_RUNBOOK

**Owner:** Memory Systems Engineer (Doc 3 §5)
**Sprint:** Sprint 1 Day 3 (2026-05-16)
**Authority:** MEMORY_SCHEMA_V3_CONSOLIDATED §8.
**Companion code:** `convex/oto/migrations/vehicleFactsReconciliation.ts`, `convex/crons.ts`, `convex/schema.ts` (`reconciliation_runs` table).

---

## 0. Purpose

This is the on-call runbook for the `vehicle_facts_reconciliation` cron — the fourth layer of the four-layer defense on the `vehicle_facts` mutability concession (PM Ruling v3 §3.1). Layers 1–3 already exist:

1. Helper-only pattern (`convex/oto/vehicleFactsEditing.ts` is the single write path).
2. CI grep (`scripts/ci/vehicle-facts-grep.sh` blocks PRs that bypass the helper).
3. Runtime telemetry (`oto_telemetry` counters; in v1 the telemetry parity check is query-based — see §3).

Layer 4 (this runbook) is the durable, out-of-process parity check against the append-only `vehicle_facts_audit` table. The cron runs every 15 minutes and writes one row to `reconciliation_runs` per invocation.

---

## 1. What each check fires on

| Check | Cadence | Severity | Fires when |
|---|---|---|---|
| **replay** | every 15 min | **page** | An audit row is inconsistent with the helper's pre-conditions (e.g. `action="verify"` whose `previous_values.verification_status` is not `"unverified"`, or a `vehicle_facts` row whose `updated_at != created_at` has zero audit rows). |
| **orphan** | every 15 min | **page** | An audit row's `fact_id` does not resolve in `vehicle_facts`. Impossible by design (we never hard-delete vehicle_facts and the helper enforces atomic insert). |
| **telemetry** | every 15 min | **page** (drift > 5) / **alert** (any drift) | `count(audits in window) != count(edits in window)`. Indicates helper bypass or audit forgery. |
| **counter** | every ~hour (every 4th driver run) | **alert** (drift ≥ 5) / **info** (drift > 0) | Denormalized `vehicle_facts.report_count` disagrees with `count(fact_reports by fact_id)`. Small drift is transient mid-mutation racing; large drift indicates a counter-bump miss in `reportVehicleFact`. |

**Severity meanings:**

- **page** — wake on-call. Either tampering, helper bypass, or a real bug in the helper. Investigate within the hour.
- **alert** — Slack/email notification. Investigate within the business day. Often catches drift that will self-heal on the next run.
- **info** — recorded only. No action required unless a pattern emerges across runs.

---

## 2. How to investigate

### 2.1 A replay-equivalence anomaly (page)

The anomaly's `details` string identifies the offending audit row by `_id` and the offending fact by `fact_id`. To reconstruct manually:

```ts
// In Convex dashboard or via npx convex run:
const audit = await ctx.db.get(<audit_id from details>);
const fact  = await ctx.db.get(<fact_id from details>);
const history = await ctx.db.query("vehicle_facts_audit")
  .withIndex("by_fact", q => q.eq("fact_id", <fact_id>))
  .collect();
```

Walk `history` in chronological order. Reverse-replay each `previous_values` diff onto the current `fact` to reconstruct prior states. Two failure modes:

1. **Helper-bypass signal** — fact's `updated_at != created_at` but `history.length === 0`. Someone patched the row outside `editVehicleFact`. Grep `convex/` for any `ctx.db.patch` or `ctx.db.replace` against `vehicle_facts`; cross-check with the most recent merged PRs. The CI grep should have caught this at PR time — if it did not, the CI grep rules are themselves a regression.
2. **Audit-forgery signal** — `action` and `previous_values` are internally inconsistent (e.g. `action="verify"` whose `previous_values.verification_status` is anything other than `"unverified"`). Treat as a compromised editor account or a code-bug in `editVehicleFact`. Inspect the editor's recent activity:

```ts
const editorActivity = await ctx.db.query("vehicle_facts_audit")
  .withIndex("by_editor", q => q.eq("edited_by", <editor_id>))
  .collect();
```

Lock the editor account in Clerk while investigating. Do NOT clean up the offending audit row — `vehicle_facts_audit` is append-only by invariant.

### 2.2 An orphan audit row (page)

An orphan should be IMPOSSIBLE — we never hard-delete `vehicle_facts`, retract is a soft-delete via `verification_status="retracted"`. If one appears:

1. **Treat as a code bug, not data corruption.** Something inserted an audit row with a `fact_id` that either (a) was never a real id, or (b) is a real id whose `vehicle_facts` row was deleted.
2. Grep `convex/` for `ctx.db.delete("vehicle_facts"` — should return zero matches. If it returns anything, someone added a hard-delete path; revert that PR.
3. Grep `convex/` for `ctx.db.insert("vehicle_facts_audit"` — should return matches only inside `convex/oto/vehicleFactsEditing.ts`. If anywhere else, someone bypassed the helper for audit inserts; revert that PR.
4. Do NOT mutate the orphan audit row. It is evidence. Open a Sev-1 ticket with the run_id from `reconciliation_runs`.

### 2.3 A telemetry parity anomaly (page or alert)

```
edits_in_window = N, audits_in_window = M, drift = N - M
```

- **`N > M` (edits exceed audits)** → helper was bypassed. Some code path patched `vehicle_facts` without writing an audit row. Investigate the same way as a replay-equivalence helper-bypass (§2.1.1). The CI grep should have caught this; if not, the CI grep rules are a regression.
- **`M > N` (audits exceed edits)** → audit forgery, OR an audit row was written for a row whose `updated_at` did not actually move (a no-op edit that wrote an audit — `editVehicleFact` has a `hasRealChange` guard against this, so its failure means the guard is wrong). Investigate `editVehicleFact`'s `hasRealChange` logic; check recent PRs to that file.

The query-based approximation (option (b) in the file header) has a known v1 gap: a row whose `_creationTime` is older than the window start but whose `updated_at` falls inside the window WILL be missed by the `editsInWindow` count. The replay-equivalence check (Check 1) catches the same condition independently when it walks the row and sees zero audit rows. The two checks together cover the gap.

### 2.4 A counter parity drift (alert)

```
denormalized = vehicle_facts.report_count
actual       = count(fact_reports where fact_id = ...)
drift        = abs(denormalized - actual)
```

If `drift == 1` and the run is within a few seconds of a `reportVehicleFact` call against the same fact: ignore. Convex serializes per-document but cross-document reads can catch a partial state across the patch + insert.

If `drift >= 5` or drift persists across multiple runs: investigate `reportVehicleFact` (`convex/oto/vehicleFactsEditing.ts`). The mutation patches `report_count` and inserts `fact_reports` in the same Convex transaction; either step failing should fail both. Real persistent drift suggests the `report_count` field has been mutated elsewhere (CI grep Rule 1 should have caught this — if not, again, CI regression).

Self-heal: editing the underlying fact via `editVehicleFact` does NOT touch `report_count` (the helper preserves it). If you need to manually re-sync, the only sanctioned path is a one-shot internal mutation that re-counts `fact_reports` and patches `report_count` — file it as an entry in `oto_migrations` so the action is auditable.

---

## 3. The telemetry-parity simplification (v1)

The spec (MEMORY_SCHEMA_V3_CONSOLIDATED §3.3) calls for two runtime counters that don't actually exist yet. The v1 implementation uses a query-based approximation (option (b) in the file header):

```
edits_in_window   = vehicle_facts where updated_at in (windowStart, now]
                                  AND updated_at != created_at
audits_in_window  = vehicle_facts_audit where edited_at in (windowStart, now]
```

This is honest about its limitation: a row with `_creationTime < windowStart` but `updated_at in window` is missed by the `editsInWindow` count, because the v1 implementation walks `vehicle_facts.by_creation_time` from `windowStart`. The replay check covers the residual.

**Future work:** add real counters wired into `editVehicleFact` (a small `oto_counters` table, or fields on `oto_migrations`). When that lands, Check 4 becomes a single-row read instead of a window scan, and the residual gap goes away. Track as a Sprint 2 backlog item.

---

## 4. Bumping alert thresholds

The two tunables that can become noise sources:

- **`COUNTER_PARITY_DRIFT_ALERT_THRESHOLD`** (default `5`). Raise to `10` or `20` if normal traffic produces drift between report-bump and the next reconciliation run. Edit `convex/oto/migrations/vehicleFactsReconciliation.ts`. Document the bump in `SPRINT_1_DAY_3_LOG.md` (or its successor).
- **`TELEMETRY_PARITY_WINDOW_MS`** (default `15 * 60 * 1000`). Shrinking the window makes the check more sensitive; widening it tolerates more racy edits. Leave at 15 minutes (matches cron cadence) unless cron cadence changes.

The page-level drift threshold for telemetry parity (`Math.abs(drift) > 5`) is hard-coded in `checkTelemetryParity`. Bump it together with `COUNTER_PARITY_DRIFT_ALERT_THRESHOLD` if you change one — they're tuned to the same expected traffic shape.

---

## 5. Disabling a check temporarily

Each of the four checks honors a kill-switch env var. Setting these in the Convex dashboard (Settings → Environment Variables) takes effect on next deploy and on next cron invocation without redeploying code:

```
OTO_RECON_DISABLE_REPLAY      = "true"   # skip replay-equivalence
OTO_RECON_DISABLE_COUNTER     = "true"   # skip counter parity
OTO_RECON_DISABLE_ORPHAN      = "true"   # skip orphan-audit-row
OTO_RECON_DISABLE_TELEMETRY   = "true"   # skip telemetry parity
```

A skipped check still appears in `reconciliation_runs.checks_ran`, but contributes zero anomalies and returns `skipped: true`. The driver itself never short-circuits — even with all four disabled, a `reconciliation_runs` row is still written, marked `clean`, recording an empty check list of skipped checks. This is the audit trail for the disable.

**Discipline:** disabling a page-severity check (replay or orphan) is a Sev-2 action that requires sign-off from Waleed or Temur. Document the reason and the planned re-enable date in `SPRINT_1_DAY_3_LOG.md`. The CI grep rules are NOT a substitute for the runtime check — they catch new commits, not data already on disk.

---

## 6. Reading `reconciliation_runs`

```ts
// Latest 10 runs:
await ctx.db.query("reconciliation_runs")
  .withIndex("by_started_at")
  .order("desc")
  .take(10);

// All runs with anomalies in the last 24h:
const since = Date.now() - 24 * 60 * 60 * 1000;
await ctx.db.query("reconciliation_runs")
  .withIndex("by_status", q => q.eq("status", "anomalies").gt("started_at", since))
  .collect();
```

The two indexes (`by_started_at`, `by_status`) support both an "is the cron running?" check and a "what failed today?" query.

A run row is mutated exactly once in its lifecycle: inserted as `status: "running"` by `_insertRunRow`, patched once by `_finalizeRunRow` to `status: "clean"` or `"anomalies"`. A row stuck at `status: "running"` for more than ~5 minutes indicates the driver action errored partway through; check Convex logs for the matching `run_id`.

---

## 7. Hard constraints (do not violate)

- `vehicle_facts_audit` is append-only. The reconciliation cron READS it but MUST NOT write to it. CI grep Rule 3 enforces this at PR time. If you find yourself writing to the audit table from the cron, you are wrong.
- `vehicle_facts` is mutated only through `editVehicleFact` / `recordVehicleFact` / `reportVehicleFact`. The cron MUST NOT patch `vehicle_facts`. CI grep Rule 1 enforces this. The cron's job is to OBSERVE, not to repair.
- `reconciliation_runs` is the cron's own output log. It is the ONLY table the cron writes to. The cron patches a row at most once (from `running` to `clean`/`anomalies`); no row in `reconciliation_runs` is ever patched more than once.

---

## 8. Owner

— Memory Systems Engineer. Page me (via the standard on-call channel) for any anomaly the runbook does not cover.

End of RECONCILIATION_RUNBOOK.
