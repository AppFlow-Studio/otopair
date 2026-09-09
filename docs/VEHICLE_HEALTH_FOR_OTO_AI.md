# Vehicle Health & Service-Due — Handoff for Oto AI

**Audience:** Waleed, integrating vehicle-health + maintenance signals into the Oto AI feature.
**Owner of underlying logic:** Ahmad Hamoudeh.
**Last updated:** 2026-05-13.

This doc explains how OtoPair computes a vehicle's health score and decides
when each maintenance service is due, so Oto can answer questions like
*"How is my car doing?"* / *"When do I need an oil change?"* / *"What
service should I book next?"* without recomputing anything itself.

---

## TL;DR — the mental model

```
        ┌──────────────────────────────────────────────┐
        │  Per-item maintenance status (5 types)        │  utils/maintenanceStatus.ts
        │  oil | brakes | tires | inspection | battery  │  → on_time / due_soon /
        │  Based on intervals + odometer + months       │     needs_attention / overdue / unknown
        └──────────────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────────────┐
        │   Composite 0-100 Vehicle Health Score        │  utils/healthScore.ts
        │   = maintenance (60%)                         │
        │   + usage/mileage curve (25%)                 │
        │   + warning-light reserve (up to 15%)         │
        └──────────────────────────────────────────────┘
                            │
                            ▼
        ┌──────────────────────────────────────────────┐
        │  Renders the health ring + Vehicle Health     │  app/(main-tabs)/cars/index.tsx
        │  sheet + MaintenanceTracker rows on Cars tab. │  components/cars/CarCarousel.tsx
        └──────────────────────────────────────────────┘
```

The two `utils/` files are deterministic and pure — no side effects, no
network. Oto can call the same exported functions. Convex stores raw
`maintenance_records` (e.g. "oil changed at 35,000 mi on Aug 2025"), and
the prediction engine derives status at read time from those + the
vehicle's current odometer / driving level.

---

## Data shapes Oto will see

### `MaintenanceItem` — the unit Oto should reason over

Defined in `components/cars/MaintenanceTracker.tsx:75-86`.

```ts
type MaintenanceStatus =
  | 'on_time'         // serviced recently, well within interval
  | 'due_soon'        // within ~10% of next interval
  | 'needs_attention' // soft warning (e.g. squeaking brakes, low tire psi)
  | 'overdue'         // past the interval
  | 'unknown';        // no record on file

interface MaintenanceItem {
  id: string;             // "oil" | "brakes" | ... | "user-{recordId}"
  serviceName: string;    // "Oil Change", "Brakes", ...
  description: string;    // Human sentence: "Due in ~800 mi based on your driving"
  detail: string;         // Short label: "Mar 2025", "Aug 2025", "Unknown"
  status: MaintenanceStatus;
  lastService?: string;   // "Last service: 8,200 mi ago"
  urgency?: string;
  impacts?: Array<{ label: string; severity: 'high' | 'medium' | 'low' }>;
  recommendation?: string;
}
```

### `MaintenanceType`

`utils/maintenanceStatus.ts:28-33` — five canonical types Oto can ask about:

```ts
type MaintenanceType = 'oil' | 'brakes' | 'tires' | 'inspection' | 'battery';
```

Labels (`MAINTENANCE_LABELS`) and the display order (`ALL_MAINTENANCE_TYPES`,
which excludes `inspection` until a record exists) are exported from the
same file.

### `HealthScoreInput` — feeds the health calculator

`utils/healthScore.ts:151-160`:

```ts
interface HealthScoreInput {
  maintenanceItems: MaintenanceItem[];
  odometerMiles: number;
  knownIssues?: string[];                  // user-reported warning lights
  pipelineHealthScore?: number | null;     // server-side cached (vehicle_owners.health_score)
  pipelineIsEstimated?: boolean;
}
```

---

## Health Score formula — `computeVehicleHealthScore(input)`

`utils/healthScore.ts:171-218`. Returns `0–100`, rounded, clamped.

```
score = maintenance(60%) + mileage(25%) + warningLightReserve(15% - penalty)
```

### Component breakdown

**Maintenance component** (`STATUS_SCORE`, line 23):

| status            | weight |
|-------------------|--------|
| `on_time`         | 1.00   |
| `due_soon`        | 0.70   |
| `needs_attention` | 0.35   |
| `overdue`         | 0.10   |
| `unknown`         | inferred from mileage (see below) |

`unknown` items aren't dropped — they get a score that decays with
mileage (`unknownScoreForMileage`, line 58):

| odometer       | score |
|----------------|-------|
| ≤15k mi        | 0.95  |
| ≤30k mi        | 0.95 → 0.85 linear |
| ≤60k mi        | 0.85 → 0.55 linear |
| ≤100k mi       | 0.55 → 0.35 linear |
| >100k mi       | 0.35 → 0.20, floor 0.15 |

**Mileage component** (`mileageScore`, line 35) — piecewise linear:

| mileage | score |
|---------|-------|
| 0-30k   | 100   |
| 30k-60k | 100 → 90 |
| 60k-100k | 90 → 75 |
| 100k-150k | 75 → 55 |
| 150k+ | 55 → 40, floor 30 |

**Warning lights** (`LIGHT_PENALTY`, line 70) — `knownIssues` is an array
where index 0 is the top answer (`no_all_clear`, `check_engine`,
`different_light`, `not_sure`) and indices 1..n are specific light ids:

| light            | penalty |
|------------------|---------|
| oil_pressure     | 15      |
| temperature      | 15      |
| check_engine     | 12      |
| battery_charging | 10      |
| transmission     | 10      |
| abs              | 8       |
| airbag_srs       | 7       |
| tpms             | 5       |
| not_sure_which   | 6       |

Total penalty is capped at 25 pts and subtracted from a 15-pt reserve;
overflow does *not* affect the rest of the score.

### Projected score (what-if)

`computeProjectedHealthScore(input, fixedItemId)` (line 224) returns
what the score *would be* if a specific item were resolved to
`on_time`. Useful for Oto messages like *"Booking an oil change would
take you from 78 to 85."*

---

## Service-due prediction engine — `utils/maintenanceStatus.ts`

1,005 lines, but the public surface Oto needs is small. The header
comment (lines 1-20) is the canonical spec; this section condenses it.

### Hybrid mileage + time

For each maintenance type the engine checks two signals in parallel:

- **Mileage:** `(interval − miles since last service) ÷ monthly miles → ETA in months`.
- **Time:** `interval months − months since last service`.

Whichever predicts the earlier "due" date wins.

### Service intervals (with per-make overrides)

Defaults (`DEFAULT_INTERVALS`, line 107):

| type        | miles  | months |
|-------------|--------|--------|
| oil         | 5,000  | 6      |
| brakes      | 40,000 | 48     |
| tires       | 50,000 | 60     |
| inspection  | —      | 12     |
| battery     | —      | 60     |

Per-make overrides (`MAKE_OVERRIDES`, line 120) cover European makes
(longer synthetic-oil intervals, ~10k mi), Japanese (Toyota/Subaru/Nissan
shorter at 5–7.5k, Honda/Lexus 7.5–10k), American (typically 7.5k),
Tesla (no oil, longer brakes), and Korean makes (~7.5k). Always look up
by `make.toLowerCase()`.

### Monthly miles

User picks a driving level during onboarding (`AVG_MONTHLY_DRIVING_MAP`, line 83):

| level   | mi/month | mi/year |
|---------|----------|---------|
| light   | 500      | ~6,000  |
| average | 1,000    | ~12,000 |
| heavy   | 1,500    | ~18,000 |

Defaults to 1,000 if the user didn't answer.

### Driving conditions modifier

City driving shortens oil + brake intervals by 20%. Highway driving
shortens tire interval by 15%. Highway has no effect on oil (synthetic
is fine at speed); city has no effect on tires.

### Time-only items (battery, inspection)

- **Inspection:** soft `due_soon` flag at month 10, `overdue` after month 12.
- **Battery:** `due_soon` at year 4, `overdue` at year 5+. Floors regardless of mileage.
- **Tire age:** independent of mileage — `due_soon` at age 4 yr, `overdue` at 5–6 yr.

### "Confirmed healthy" override

If the user answered Q4b of the quarterly check-in saying a service is
fine (`record.confirmedHealthyAt`), the engine forces `on_time` for 90
days regardless of other signals. Constant: `CONFIRMED_HEALTHY_TTL_MS`
(line 67).

---

## Convex tables involved

All tables live in `convex/schema.ts`. Mobile repo is canonical for the
schema (per the team convention).

| Table | Purpose | Key fields Oto would care about |
|---|---|---|
| `vehicle_owners` (line 681) | One row per (user, vehicle). The hub of per-car state. | `vin`, `user_id`, `mileage`, `health_score`, `health_score_is_estimated`, `avgMonthlyDriving`, `drivingConditions`, `knownIssues`, `preOnboardingComplete`, `onboardingComplete`. |
| `maintenance_records` (line 961) | User-provided service history. One row per service (e.g. "oil at 35,000 mi on Aug 2025"). The prediction engine derives every status from these. | `vehicleOwnerId`, `type` ("oil" / "brakes" / ...), `lastServiceDate`, `lastServiceMileage`, `customInputs`, `confirmedHealthyAt`, `serviceSource`. |
| `vehicle_classifications` (line 884) | Pipeline-computed modifiers per vehicle (vehicle age tier, mileage tier, usage segment, driving condition modifier, etc.). | `vehicle_owner_id`, `vehicle_mode`, `owner_segment`, `driving_condition_modifier`, `vehicle_age_modifier`, `mileage_tier_modifier`, `composite_routine`, `composite_tires`. |
| `vehicle_service_states` (line 932) | Per-service due dates/mileages produced by the backend pipeline (`maintenance_pipeline.ts`). When you want the *server's* projection of when a service is due rather than recomputing, read here. | `vehicle_owner_id`, `service_id`, `is_applicable`, `adjusted_interval_miles`, `adjusted_interval_months`, `due_at_mileage`, `due_at_date`, `trigger_type`. |
| `composite_modifier_weights` (line 846) | Global tunables that weight DCM/VAM/MTM/PUM/HCM components inside the pipeline. Read-only for Oto — don't touch unless coordinating with Ahmad. | `category_name`, `dcm_weight`, `vam_weight`, `mtm_weight`, `pum_weight`, `hcm_weight`. |
| `services` | Service catalog (Oil Change, Brake Service, etc.). `vehicle_service_states` joins by `service_id`. | `_id`, `slug`, `name`. |

### Convex functions Oto can call

`convex/maintenance.ts`:

| Function | Type | Returns |
|---|---|---|
| `getRecordsByVehicle({ vehicleOwnerId })` | query | All `maintenance_records` for one vehicle. |
| `getRecordsByMultipleVehicles({ vehicleOwnerIds })` | query | Same, batched. |
| `upsertRecord({...})` | mutation | Insert/update a record (oil at 35k on Aug 2025, etc.). |
| `deleteRecord({ recordId })` | mutation | Remove a record. |

`convex/maintenance_pipeline.ts` (835 LOC) holds the backend pipeline.
It writes to `vehicle_classifications`, `vehicle_service_states`, and
patches `vehicle_owners.health_score`/`health_score_is_estimated`. If
Oto wants the *cached* score without recomputing client-side, read
`vehicle_owners.health_score` directly via `useQuery(api.vehicles.getOwnership, ...)` (or whatever query you wire up on the Oto side).

> The pipeline is the source of truth for *server-derived* projections.
> The client-side `computeVehicleHealthScore` exists so the health ring
> reacts immediately to stepper answers without waiting for the async
> pipeline. Both should converge; if they disagree by more than ~5 pts,
> something stale is involved — flag it to Ahmad.

---

## How to read the data — Oto's entry points

### Mobile / RN side — already wired

```ts
import { useMaintenanceRecords } from "@/hooks/useMaintenanceData";

const { items } = useMaintenanceRecords(
  vehicleOwnerId,
  currentOdometer,
  vehicle.make,
  drivingConditions,
  avgMonthlyDriving,
  knownIssues,
);
// items: MaintenanceItem[]  — feed straight into Oto's prompt.
```

For the health score:

```ts
import { computeVehicleHealthScore } from "@/utils/healthScore";

const score = computeVehicleHealthScore({
  maintenanceItems,
  odometerMiles,
  knownIssues,
});
```

`hooks/useMaintenanceData.ts:55-407` is the existing consumer — model
Oto's hook after it.

### Server-driven Oto answers

If Oto runs server-side (Convex action / chat backend), prefer the cached
values:

1. Read `vehicle_owners` for the active vehicle → grab `health_score`,
   `health_score_is_estimated`, `mileage`, `avgMonthlyDriving`,
   `drivingConditions`, `knownIssues`.
2. Read `vehicle_service_states` for the vehicle → that's already the
   "what's due when" projection (`due_at_mileage`, `due_at_date`,
   `trigger_type`, `adjusted_interval_miles/months`).
3. Read `maintenance_records` for the raw history if Oto needs to cite
   specifics ("you last did oil at 32k on Aug 2025").

---

## Suggested Oto integration patterns

### Pattern 1 — "How is my car doing?"

```
1. Resolve the active vehicle (useVehicleStore.selectedVehicle, or
   query vehicle_owners by user_id + is_primary on the server).
2. Pull MaintenanceItem[] via useMaintenanceRecords (client) OR
   compose them from vehicle_service_states (server).
3. Compute / read the score:
   - Client: computeVehicleHealthScore(input).
   - Server: vehicle_owners.health_score (note health_score_is_estimated).
4. Build an Oto sentence:
   - score >= 85 → "Your car's in great shape — N% health."
   - 60-84 → mention any due_soon items.
   - <60 → lead with the overdue / needs_attention items, sorted by
     STATUS_PRIORITY in MaintenanceTracker.tsx:105 (overdue=0,
     due_soon=1, needs_attention=2, on_time=3, unknown=4).
```

### Pattern 2 — "When do I need an oil change?"

```
1. Find the item where id === "oil" (client) OR the
   vehicle_service_states row for the Oil Change service (server).
2. Read description / due_at_mileage + due_at_date. Both sides give
   the same info — server is authoritative when present.
3. If status === 'unknown' (no record), tell the user we need a record
   and offer the Add Info entry point.
```

### Pattern 3 — "What should I book next?"

```
1. Filter items where status in {'overdue', 'due_soon', 'needs_attention'}.
2. Sort by STATUS_PRIORITY.
3. For the top item, optionally call computeProjectedHealthScore(input,
   item.id) to show "fixing this would lift your score from X to Y".
4. Hand off into the booking flow with the item's service name
   (mirrors how MaintenanceTracker's "Book Now" routes to /home/map).
```

---

## File map (quick reference)

| File | Lines | Role |
|---|---|---|
| `utils/healthScore.ts` | 232 | Composite 0-100 health score. Pure function. |
| `utils/maintenanceStatus.ts` | 1005 | Per-item due-date / status engine. Pure. |
| `hooks/useMaintenanceData.ts` | 407 | Hook composing the `MaintenanceItem[]` from user records. |
| `convex/maintenance.ts` | 128 | CRUD over `maintenance_records`. |
| `convex/maintenance_pipeline.ts` | 835 | Pipeline that derives + caches `vehicle_owners.health_score` and writes `vehicle_service_states` / `vehicle_classifications`. |
| `convex/schema.ts` | — | Source of truth for table shapes. |
| `components/cars/MaintenanceTracker.tsx` | — | UI consumer; defines `MaintenanceItem` type. |
| `components/cars/CarCarousel.tsx` | — | Hosts the Vehicle Health bottom sheet w/ formula breakdown. |
| `app/(main-tabs)/cars/index.tsx` | — | Top-level wiring (passes data into ring + tracker). |

---

## Edge cases worth knowing

- **Brand-new car (≤1,000 mi):** the Cars page auto-completes onboarding
  (`cars/index.tsx:743-747`) — no maintenance items expected.
- **Pre-onboarding vehicle:** uses estimated health score from
  `vehicle_owners.health_score` (`pipelineHealthScore`) until the user
  finishes the quick-read flow. `health_score_is_estimated === true` is
  the flag.
- **All `unknown` items + low mileage:** score sits near 90 because the
  unknown fallback assumes "too early for service" until 30k mi.
- **Quarterly check-in stale:** `pipelineIsEstimated === true` means the
  server's score is older than the check-in interval; clients still
  recompute fresh, so trust the client value for "right now" answers.
- **No records, mid-mileage:** the score gradient (unknown → 0.55 at
  60k) is intentional — don't surprise the user by claiming the car is
  fine if we have zero data on a 75k-mile car.

---

## Questions Ahmad can answer

- How the quarterly check-in interacts with `confirmedHealthyAt`.
- How `vehicle_classifications` modifiers blend into the pipeline score.
- Tuning weights / thresholds if Oto needs to soften or harden a verdict.
- Adding new maintenance types beyond the five listed here.
