# Mechanic hand-off: Maintenance pipeline + Health score

**Audience:** engineer wiring the shop / web side so mechanic verdicts (per-item status, "healthy" confirmations, suggestions) flow into the app.
**Author:** Ahmad
**Written:** 2026-07-11

---

## TL;DR

- Everything the user sees on the Cars tab — the health ring at the top, the "NOW / SOON / ON THE HORIZON / HEALTHY" tracker underneath, and the Home-tab "NOW" callout — is derived from **one Convex table**: `maintenance_records`.
- Per-vehicle rows in that table are run through **three deterministic pipelines** (status → urgency → health score). Every consumer reads the same rows, so a single mechanic write flips both the tracker and the ring in the same query cycle. No dual-write needed.
- Mechanics can already push **job recommendations** (`job_recommendations` table) and those already dock the health score via `health_score_rec_penalty`. That path is live.
- What's **not** live yet: mechanics writing / verifying **maintenance records** directly — that's the void this hand-off asks you to fill.

---

## 1 — Data model (the one table you need to know)

### `maintenance_records`  ← the trunk

`convex/schema.ts`

```ts
{
  vehicleOwnerId: Id<"vehicle_owners">,   // per-vehicle
  type: "oil" | "brakes" | "tires" | "battery" | "inspection",
  lastServiceDate?: number,               // unix ms
  lastServiceMileage?: number,
  customInputs?: {                        // per-type payload
    // tires:  { tirePressure: {fl, fr, rl, rr}, patched?: boolean, age_years? }
    // brakes: { brakeFeel: "normal"|"soft_slow"|..., squeaking?: boolean }
    // oil:    (mostly interval-only)
    // battery:(mostly age-only)
    // inspection: { expiration_date }
  },
  confirmedHealthyAt?: number,            // "user (or mechanic) confirmed OK at t"
  serviceSource?: string,                 // "user" | "booking" | "mechanic" | "shop_import"
  confidence?: "verified" | "unverified" | "self_reported",
  createdAt, updatedAt,
}
```

**Cardinality:** one row per `(vehicleOwnerId, type)`. Enforced by the `by_vehicle_and_type` index; upserts are atomic.

**Who writes today:**
- User: quarterly check-ins, `car-pre-onboarding` stepper, Q4b confirm-healthy flow.
- App: `convex/bookings.ts` upserts on booking completion (uses booking date + arrived-at odometer).
- Enrichment pipeline: writes to *sibling* tables (`service_intervals`, `vehicle_owners.knownIssues`) — never `maintenance_records` directly.

**Who needs to write from your side:** the mechanic. See §7.

### Supporting tables that shape behavior

| Table | What it holds | How the pipelines use it |
|---|---|---|
| `vehicle_owners` | Per-vehicle facts: `knownIssues` (active warning-light IDs), `health_score`, `health_score_rec_penalty`, driving conditions, `avgMonthlyDriving`, `hpBuffer` | Warning lights escalate maintenance status (§2). Rec penalty is subtracted directly from health score (§3). |
| `service_intervals` | Enrichment-populated OEM intervals per (year+make+model+trim+engineCode) × service | Feeds `getInterval` inside status compute so oil / brake / tire cadences match the manufacturer's spec. |
| `job_recommendations` | Mechanic-authored recs (urgency + reason + target_mileage + visible_to_driver flag) | Ramp-up penalty into `health_score_rec_penalty` over 30 days. Wired end-to-end. |
| `follow_ups` | Reminders spawned by recs / expiring inspections | Not part of pipeline — just for notifications. |

---

## 2 — Maintenance pipeline (per-item status)

**Entry point:** `computeMaintenanceStatus(record, odometer, make, now, drivingConditions, avgMonthlyDriving, knownIssues, vehicleYear, oemIntervals)` in `utils/maintenanceStatus.ts`.

**Returns `StatusResult`:**
```ts
{
  status: "on_time" | "due_soon" | "needs_attention" | "overdue" | "unknown",
  percentUsed: 0..100,
  description: string,     // "Oil pressure warning light active — service urgently needed"
  detail: string,          // "About 400 mi to go"
  estimatedDueDate?: Date,
  milesRemaining?: number,
  monthsRemaining?: number,
}
```

**Dispatch by type** (all in `utils/maintenanceStatus.ts`):
| Type | Function | Signals | Warning-light escalation |
|---|---|---|---|
| Oil | `computeOilStatus` | Hybrid mileage-OR-time, whichever hits first. Driving-condition multipliers (city 0.80×, highway 1.0×). `confirmedHealthyAt` beats interval. | `oil_pressure` → `overdue`, `percentUsed = 100`, standard escalate copy prepended. |
| Brakes | `computeBrakeStatus` | Interval + symptoms (`brakeFeel: soft_slow`, `squeaking`). Symptoms bump status independently of interval. | `abs` → `overdue`. |
| Tires | `computeTireStatus` | Pressure per-corner thresholds (danger < 25 or > 44 PSI → overdue immediately), age (flag 4 yr, overdue 6 yr), patched/plugged escalation. | `tpms` → `overdue`. |
| Battery | `computeBatteryStatus` | Pure age (flag 36 mo, urgent 54 mo, max 60 mo). | `battery_charging` → `overdue`. |
| Inspection | `computeInspectionStatus` | Expiration date from `customInputs.expiration_date`. Flags 2 months before expiry. | n/a |

**Interval resolution order** (inside `getInterval`):
1. `oemIntervals` (from `service_intervals` table, if `mechanic_verified` or high-confidence)
2. `MAKE_OVERRIDES` map (VW / BMW / Mercedes / etc. use longer oil intervals)
3. `DEFAULT_INTERVALS` (oil 5k mi / 6 mo, brakes 40k / 48, tires 50k / 60, battery ∞ / 60)

**Warning-light escalation** — `escalateForWarningLight(result, description)`. Any active light in `knownIssues` forces `status = "overdue"`, `percentUsed = 100`, prepends its copy to the description. This is what makes a car with just a TPMS light show up on Home's NOW card even if the interval isn't due.

**Confirmed-healthy override:** if `record.confirmedHealthyAt` is set within the last check-in window, the item stays `on_time` regardless of interval. This is the hook you want to use for a mechanic's "verified healthy at last service" verdict — see §7.

---

## 3 — Health score (0–100, the ring at the top of the Cars tab)

**Entry point:** `computeVehicleHealthScore(input)` in `utils/healthScore.ts`.

**Formula** (spec §2.6):
```
score = maintenance × 0.65
      + usage       × 0.20
      + safetyReserve × 0.15
      − openIssuePenalty
      + hpBufferBonus   (capped +3)
```

Clamped to `[0, 100]` at the end.

### Maintenance component (65%)

Weighted average across the five items using `CATEGORY_WEIGHTS`:
```
brakes: 25, warning: 25, tires: 20, oil: 20, battery: 13, inspection: 12, other: 10
```

Each item contributes its `STATUS_SCORE`:
```
on_time: 1.00, due_soon: 0.70, needs_attention: 0.35, overdue: 0.10
unknown: sentinel — replaced with `unknownScoreForMileage(mi)`
        (≤15k → 0.95, ≤30k → 0.85, ≤60k → 0.55, ≤100k → 0.35, >100k → 0.20)
```

The unknown-mileage curve is why a well-maintained new car with no history still scores high, and why an old car with unknowns gets docked more.

### Usage component (20%)

Pure mileage curve — no per-item state:
```
≤30k: 100
30k–60k: 100 → 90
60k–100k: 90 → 75
100k–150k: 75 → 55
>150k: floor 30
```

### Safety reserve (15%)

`max(0, 15 − lightPenalty)` where `lightPenalty` sums `LIGHT_PENALTY[light]` for every entry in `knownIssues`:
```
oil_pressure: 15, temperature: 15, check_engine: 12,
battery_charging: 10, transmission: 10, abs: 8, airbag_srs: 7,
tpms: 5, not_sure_which: 6
```

Cap 25. So one serious light zeroes the safety-reserve component; multiple lights start eating into the maintenance component via the escalation path.

### Open-issue penalty (`OPEN_ISSUE_PENALTY_MAX = 15`)

Comes from `vehicle_owners.health_score_rec_penalty`, which is maintained by `recomputeRecPenaltyForVehicle` in `convex/jobRecommendations.ts`. Formula (per rec, urgency-weighted):
```
next_visit: 5   within_3_months: 2   soon: 1
```
Ramped over 30 days after the rec is created, summed, capped at 15. When a rec goes `acknowledged` / `completed` / `dismissed`, its contribution drops off.

### HP buffer bonus

+1 point per 15 HP saved in `vehicle_owners.hpBuffer`, capped +3. Applied post-clamp so the score can be nudged above what pure maintenance would give (rewards active care).

---

## 4 — Urgency tiers (NOW / SOON / ON THE HORIZON / HEALTHY)

**Entry point:** `computeUrgency({ id, status, percentUsed })` in `utils/urgency.ts`.

```
severity  = STATUS_SEVERITY[status] × (CATEGORY_WEIGHT / brakes_weight)
proximity = clamp(percentUsed, 0, 100)
score     = severity × 0.50 + proximity × 0.35
```

Where:
```
STATUS_SEVERITY = { on_time: 0, unknown: 20, due_soon: 50,
                    needs_attention: 75, overdue: 100 }
```

Tier cutoffs (`URGENCY_TIER_CUTOFFS` in `healthScore.ts`):
```
now:     score ≥ 75
soon:    55 ≤ score < 75
soonish: 25 ≤ score < 55
resting: score < 25
```

**Practical consequence:** Only categories with weight ≥ 20 (brakes, warning, tires, oil) can hit "now" via `overdue + 100% used`. Battery (weight 13) tops out at "soon" no matter what — that's a known ceiling, don't chase it.

`urgency_tier_events` telemetry — `hooks/useUrgencyRankedItems.ts` fires a Convex mutation whenever an item's tier changes for a VIN. Used to calibrate cutoffs post-launch.

---

## 5 — How this renders on the client

The whole chain runs entirely on the client from the same `maintenance_records` read.

**Cars tab (`app/(main-tabs)/cars/index.tsx`):**
1. `useMergedMaintenance(activeOwnershipId)` → returns `MaintenanceItem[]` (records + computed status + copy).
2. `useOemServiceIntervals(configId)` → feeds OEM intervals into (1).
3. Build `healthScoreInput` → `computeVehicleHealthScore` → `computedHealthScore`. Passed to `<CarCarousel healthScore=… />` → `<ActivityRings percentage=… />`.
4. Same items go to `<MaintenanceTracker tieredItems={useUrgencyRankedItems(items).byTier} />`.

**Home tab (`app/(main-tabs)/home/index.tsx`):**
- Same `useMergedMaintenance` + `computeUrgency`. Items with `tier === "now"` are grouped by vehicle and fed to `<NowTierCallout />`.

**Both surfaces read the same records** → **one mechanic write → both refresh in the same Convex query cycle.** This is the load-bearing property to preserve.

---

## 6 — What's already wired for mechanics

### `job_recommendations` (post-service suggestions)

Table shape (`convex/schema.ts`):
```ts
{
  booking_id, job_actual_id, shop_id, mechanic_id, vehicle_vin,
  recommended_service_id, freeform_text,
  urgency: "next_visit" | "within_3_months" | "soon",
  reason, visible_to_driver: boolean,
  target_mileage?: number,
  status: "open" | "acknowledged" | "completed" | "dismissed" | "expired",
}
```

Frontend read: `convex/jobRecommendations.getDriverVisibleRecsForVehicle` returns `visible_to_driver = true`, `status = "open"`. Consumed in the Cars tab's `UpcomingFollowUpsCard` and the health-score `recPenalty` recompute.

**If your web side is only pushing "suggestions,"** this is the table. It's already live end-to-end.

---

## 7 — The gap: mechanic-authored maintenance records

Bookings auto-upsert `maintenance_records` on completion, but that's a coarse "we did this at time T, mileage M" write. It doesn't capture the mechanic's independent per-item verdict — the "brakes look fine, no action needed" or "tires need a rotation in 2k miles" style feedback that should feed the pipeline directly.

To close the loop, expose these writes from the mechanic web side:

### Write 1 — verified per-item service

For each item the mechanic touched:
```
upsertRecord({
  vehicleOwnerId,
  type: "oil" | "brakes" | "tires" | "battery" | "inspection",
  lastServiceDate: <timestamp of the service>,
  lastServiceMileage: <odo at service>,
  customInputs: { ...per-type payload — see §1 shape },
  serviceSource: "mechanic",
  confidence: "verified",
})
```

Consequences:
- Status recomputes to `on_time` (interval reset).
- Urgency drops to `resting`.
- Health-score maintenance component picks up the improved status on next read.
- Any active warning light that was escalating this type is now the ONLY cause of urgency — if the mechanic also cleared it (see next), the item goes fully green.

### Write 2 — "verified healthy, no action" (didn't service, but confirmed OK)

Same upsert but omit `lastServiceDate` / `lastServiceMileage`, and set:
```
confirmedHealthyAt: <now>,
serviceSource: "mechanic",
confidence: "verified",
```

This is the hook already used by the app's Q4b flow. Setting it here means the item stays `on_time` regardless of interval until the next check-in window opens.

### Write 3 — clearing / setting warning lights

`vehicle_owners.knownIssues` is an array of light IDs. If the mechanic cleared a light:
```
patch(vehicleOwners, ownershipId, {
  knownIssues: knownIssues.filter(l => l !== "oil_pressure")
})
```
That's the ONLY thing that undoes the warning-light escalation from §2. Without it, the item keeps getting bumped to `overdue` every render even if the underlying interval is fresh.

### Write 4 — suggestions with target mileage

Use the existing `job_recommendations` create mutation. Set `target_mileage` for anything the driver should action at a specific odometer — that populates the health-score ramp AND shows up on the driver's "Upcoming Follow-Ups" card.

### Fields to preserve if you upsert existing records

- Don't clobber `customInputs` blindly — merge with the existing payload so user-entered tire pressures aren't wiped by a mechanic write that only touches brake feel.
- Set `updatedAt` on every write; leave `createdAt` alone.
- If you overwrite `lastServiceDate`, also overwrite `lastServiceMileage` (they're paired inside `computeHybridStatus`; a mismatched pair silently produces `unknown`).

---

## 8 — Load-bearing invariants (don't break these)

1. **One row per `(vehicleOwnerId, type)`.** Use the `by_vehicle_and_type` index for lookups; upsert, don't insert.
2. **`confirmedHealthyAt` is authoritative.** It bypasses interval math. Only set it when the mechanic has actually inspected the item.
3. **`serviceSource` and `confidence` are read by the enrichment / trust-scoring layer** to weight future decisions. Always populate them on your writes — `"mechanic"` and `"verified"` respectively.
4. **`knownIssues` is on `vehicle_owners`, not on `maintenance_records`.** Clearing a light happens at the vehicle level.
5. **Everything renders reactively.** Convex's built-in subscription means your write from the web side propagates to the driver's phone in ~200 ms. No need to poke a refresh endpoint.

---

## 9 — File index

| File | Role |
|---|---|
| `convex/schema.ts` | All table shapes |
| `convex/maintenance.ts` | `upsertRecord` mutation you'll wrap |
| `convex/jobRecommendations.ts` | Suggestion writes + rec-penalty recompute |
| `convex/bookings.ts` | Reference for the existing auto-write on completion |
| `utils/maintenanceStatus.ts` | Per-type status compute + escalation |
| `utils/urgency.ts` | Tier compute (score → NOW/SOON/…) |
| `utils/healthScore.ts` | Weights, cutoffs, `computeVehicleHealthScore` |
| `hooks/useMaintenanceData.ts` | Driver-side merged items |
| `hooks/useUrgencyRankedItems.ts` | Driver-side tier bucketing + telemetry |
| `hooks/useVehicleReadiness.ts` | Enrichment / package-question readiness |
| `components/cars/MaintenanceTracker.tsx` | Where the tier chips render |
| `components/cars/CarCarousel.tsx` → `ActivityRings` | Where the health ring renders |
| `components/home/NowTierCallout.tsx` | Where NOW items surface on Home |

Ping Ahmad if anything in this doc's wrong / stale — I keep it current.
