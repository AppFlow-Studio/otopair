# Convex Backend Changes — Ahmad-dev Branch

> Summary of all backend (Convex) schema, function, and library changes introduced in this branch.
> For use during merge review by the backend team.

---

## Overview

| Category | Count |
|----------|-------|
| New tables | 6 |
| Modified tables | 4 |
| New function files | 11 |
| Modified function files | 6 |
| Deleted files | 1 |
| Total lines changed | ~3,550 added / ~366 removed |

---

## 1. New Tables

### `composite_modifier_weights`
Weight profiles per service category. Weights must sum to 1.00 for non-compliance rows. Changing weights never requires a code deploy.

| Field | Type | Description |
|-------|------|-------------|
| `category_name` | `string` | `"routine"` · `"tires"` · `"brakes"` · `"battery"` · `"fluids"` · `"diagnostics"` · `"compliance"` |
| `dcm_weight` | `float64` | Driving Condition weight |
| `vam_weight` | `float64` | Vehicle Age weight |
| `mtm_weight` | `float64` | Mileage Tier weight |
| `pum_weight` | `float64` | Previous Usage weight |
| `hcm_weight` | `float64` | History Confidence weight |
| `is_fixed` | `boolean` | `true` = Compliance category, skip modifier entirely |

**Indexes:** `by_category`

---

### `vehicle_driving_profiles`
Raw onboarding answers. One row per vehicle-owner pair, upserted on completion.

| Field | Type | Description |
|-------|------|-------------|
| `vehicle_owner_id` | `id("vehicle_owners")` | FK to vehicle_owners |
| `onboarding_path` | `string` | `"leased"` · `"owned_new"` · `"owned_used"` |
| `onboarding_completed_at` | `float64` | Timestamp |
| `mileage_at_purchase` | `float64?` | Path 3 only |
| `ownership_duration` | `string?` | `"<1yr"` · `"1-2"` · `"2-4"` · `"4+"` |
| `current_mileage` | `float64` | Current odometer |
| `annual_mileage_band` | `string` | `"light"` · `"average"` · `"heavy"` · `"very_heavy"` |
| `usage_pattern` | `string` | `"city"` · `"highway"` · `"mixed"` |
| `last_service_when` | `string?` | Recency of last service |
| `last_service_what` | `string[]?` | Service types performed |
| `where_serviced` | `string?` | `"dealer"` · `"independent"` · `"chain"` · `"self"` · `"not_sure"` |
| `current_concerns` | `string?` | Free-text concerns |
| `garage_role` | `string?` | `"primary"` · `"secondary"` · `"weekend"` · `"stored"` |
| `source` | `string` | `"onboarding"` · `"settings_edit"` · `"checkin_reclassify"` |
| `created_at` / `updated_at` | `float64` | Timestamps |

**Indexes:** `by_vehicle_owner`

---

### `vehicle_classifications`
Computed mode + 5 dimension scores + 6 pre-computed composite modifiers. Append-only with `active`/`superseded` status for full audit trail.

| Field | Type | Description |
|-------|------|-------------|
| `vehicle_owner_id` | `id("vehicle_owners")` | FK |
| `vehicle_mode` | `string` | `"lease"` · `"owned_new"` · `"owned_active"` · `"owned_endurance"` · `"owned_weekend"` |
| `owner_segment` | `string` | `"A"` · `"B"` · `"C"` · `"D"` |
| `driving_condition_modifier` | `float64` | Dimension score |
| `vehicle_age_modifier` | `float64` | Dimension score |
| `mileage_tier_modifier` | `float64` | Dimension score |
| `previous_usage_modifier` | `float64` | Dimension score |
| `history_confidence_modifier` | `float64` | Dimension score |
| `composite_routine` | `float64` | Pre-computed composite |
| `composite_tires` | `float64` | Pre-computed composite |
| `composite_brakes` | `float64` | Pre-computed composite |
| `composite_battery` | `float64` | Pre-computed composite |
| `composite_fluids` | `float64` | Pre-computed composite |
| `composite_diagnostics` | `float64` | Pre-computed composite |
| `annual_mileage_estimated` | `float64` | Velocity data |
| `velocity_confidence` | `string` | `"high"` · `"moderate"` · `"low"` |
| `status` | `string` | `"active"` · `"superseded"` |
| `computed_at` | `float64` | Timestamp |
| `triggered_by` | `string` | `"onboarding"` · `"checkin"` · `"booking"` · `"manual"` |
| `superseded_at` | `float64?` | Timestamp |
| `superseded_by` | `id("vehicle_classifications")?` | Self-referencing FK |

**Indexes:** `by_vehicle_owner` · `by_vehicle_owner_active` · `by_computed_at`

---

### `vehicle_service_states`
Central output of the intelligence engine. One row per vehicle per service. Updated on new data (mileage update, Quick Read, booking, check-in).

| Field | Type | Description |
|-------|------|-------------|
| `vehicle_owner_id` | `id("vehicle_owners")` | FK |
| `service_id` | `id("services")` | FK |
| `is_applicable` | `boolean` | Gate result |
| `exclusion_reason` | `string?` | Why service is excluded |
| `adjusted_interval_miles` | `float64?` | Modified OEM interval |
| `adjusted_interval_months` | `float64?` | Modified OEM interval |
| `composite_modifier` | `float64?` | Applied modifier value |
| `due_at_mileage` | `float64?` | Next due mileage |
| `due_at_date` | `float64?` | Next due date |
| `trigger_type` | `string?` | `"mileage"` · `"time"` · `"both"` |
| `last_service_mileage` | `float64?` | Anchor |
| `last_service_date` | `float64?` | Anchor |
| `last_service_booking_id` | `id("bookings")?` | Anchor booking ref |
| `last_service_source` | `string?` | `"user_reported"` · `"booking"` · `"smartcar"` |
| `urgency` | `string` | `"none"` · `"low"` · `"moderate"` · `"high"` · `"critical"` |
| `urgency_score` | `float64?` | Numeric urgency |
| `quick_read_flag` | `string?` | Quick Read override |
| `quick_read_urgency` | `string?` | Quick Read override |
| `phase_visit` | `float64?` | 1 · 2 · 3 (Segment C phasing) |
| `is_surfaced` | `boolean` | Whether shown to user |
| `calculated_at` | `float64` | Timestamp |

**Indexes:** `by_vehicle_owner` · `by_vehicle_service` · `by_urgency` · `by_surfaced`

---

### `vehicle_checkins`
Quarterly check-in responses. Append-only — every check-in is a new row.

| Field | Type | Description |
|-------|------|-------------|
| `vehicle_owner_id` | `id("vehicle_owners")` | FK |
| `mode_at_checkin` | `string` | Vehicle mode at time of check-in |
| `questions_shown` | `string[]` | Question IDs presented |
| `answers` | `any` | Raw answers object |
| `mileage_reported` | `float64` | User-reported mileage |
| `mileage_projected` | `float64` | System-projected mileage |
| `velocity_delta` | `float64` | Difference between reported and projected |
| `services_reported` | `string[]?` | Services done since last check-in |
| `services_through_otopair` | `string?` | `"yes"` · `"no"` · `"partial"` |
| `warning_lights` | `boolean` | Any active warning lights |
| `symptoms_text` | `string?` | Free-text symptoms |
| `mode_transition_triggered` | `boolean` | Whether mode changed |
| `new_mode` | `string?` | Mode after transition |
| `new_classification_id` | `id("vehicle_classifications")?` | New classification ref |
| `engine_recalc_completed_at` | `float64?` | When recalc finished |
| `started_at` | `float64` | Timestamp |
| `completed_at` | `float64?` | Timestamp |
| `status` | `string` | `"completed"` · `"abandoned"` · `"in_progress"` |
| `next_checkin_due` | `float64?` | Next quarterly due date |

**Indexes:** `by_vehicle_owner` · `by_status` · `by_next_due` · `by_vehicle_owner_completed`

---

### `maintenance_records`
User-provided maintenance data for items Smartcar doesn't cover. One record per vehicle + type. Upserted on user submission.

| Field | Type | Description |
|-------|------|-------------|
| `vehicleOwnerId` | `id("vehicle_owners")` | FK |
| `type` | `string` | `"oil"` · `"brakes"` · `"tires"` · `"inspection"` · `"battery"` etc. |
| `lastServiceDate` | `float64?` | Timestamp of last service |
| `lastServiceMileage` | `float64?` | Mileage at last service |
| `customInputs` | `any?` | Type-specific data |
| `confirmedHealthyAt` | `float64?` | Q4b check-in: user confirmed "all good" |
| `serviceSource` | `string?` | `"otopair"` · `"external"` · `"unknown"` |
| `confidence` | `string?` | `"verified"` · `"unverified"` |
| `createdAt` / `updatedAt` | `float64` | Timestamps |

**Indexes:** `by_vehicle_owner` · `by_vehicle_and_type`

---

## 2. Modified Tables

### `engines`
| Added Field | Type | Description |
|-------------|------|-------------|
| `timing_type` | `string?` | `"belt"` · `"chain"` · `"gear"` |

### `trims`
| Added Field | Type | Description |
|-------------|------|-------------|
| `steering_type` | `string?` | `"hydraulic"` · `"electric"` |

### `service_vehicle_specs`
| Added Field | Type | Description |
|-------------|------|-------------|
| `oem_interval_miles` | `float64?` | OEM baseline mileage interval |
| `oem_interval_months` | `float64?` | OEM baseline time interval |
| `oem_interval_note` | `string?` | Notes on interval |
| `parts_required` | `string?` | JSON array `[{name, oem_part_num, cost_estimate}]` |
| `estimated_labor_hours` | `float64?` | Estimated labor |
| `labor_notes` | `string?` | Labor notes |
| `is_applicable` | `boolean` | Applicability gate |
| `exclusion_reason` | `string?` | Why not applicable |
| `data_source` | `string?` | `"ai_enrichment"` · `"manual"` · `"actuals"` |
| `last_enriched_at` | `float64?` | Provenance timestamp |

### `vehicle_owners`
| Added Field | Type | Description |
|-------------|------|-------------|
| `usage_pattern` | `string?` | `"city"` · `"highway"` · `"mixed"` |
| `vehicle_age_years` | `float64?` | Computed vehicle age |
| `mileage_tier` | `string?` | `"low"` · `"moderate"` · `"high"` · `"ultra"` |
| `prev_usage_intensity` | `string?` | `"light"` · `"average"` · `"heavy"` · `"ultra_heavy"` |
| `history_confidence` | `string?` | `"full"` · `"partial"` · `"none"` |
| `owner_segment` | `string?` | `"A"` · `"B"` · `"C"` · `"D"` |
| `segment_classified_at` | `float64?` | Timestamp |
| `annual_mileage_rate` | `float64?` | Estimated rate |
| `prev_owner_annual_rate` | `float64?` | For used vehicles |
| `active_classification_id` | `id("vehicle_classifications")?` | Denormalized FK |
| `vehicle_mode` | `string?` | Current mode |
| `last_checkin_at` | `float64?` | Last check-in timestamp |
| `next_checkin_due` | `float64?` | Next check-in timestamp |
| `health_score` | `float64?` | Current health score |
| `health_score_is_estimated` | `boolean?` | Whether score is estimated |
| `ownership_plan` | `string?` | `"keeping"` · `"might_sell"` · `"not_sure"` |
| `lease_ending_soon` | `boolean?` | Lease status |
| `lease_mileage_pace` | `string?` | `"on_track"` · `"running_ahead"` · `"well_under"` |
| `setupCardDismissed` | `boolean?` | UI state: user pressed "Done" |

---

## 3. New Convex Function Files

| File | Description |
|------|-------------|
| `convex/checkin.ts` | Quarterly check-in flow — start, submit answers, complete, fetch latest check-in |
| `convex/crons.ts` | Scheduled cron jobs (check-in reminders) |
| `convex/maintenance_pipeline.ts` | **Core intelligence engine** — computes adjusted intervals, urgency scores, and due dates for all applicable services per vehicle |
| `convex/retrigger_enrichment.ts` | Re-triggers AI enrichment for `service_vehicle_specs` rows |
| `convex/seed_modifier_weights.ts` | Seeds `composite_modifier_weights` table with default weight profiles |
| `convex/seed_services.ts` | Seeds `services` table with all maintenance service definitions |
| `convex/vehicle_mutations.ts` | Vehicle-specific write operations (health score, classification, etc.) |
| `convex/lib/checkin_questions.ts` | Question definitions for quarterly check-in, selected per vehicle mode |
| `convex/lib/classifier.ts` | Computes vehicle mode + owner segment from driving profile answers |
| `convex/lib/intervals.ts` | OEM interval lookups + composite modifier adjustments for each service |
| `convex/lib/modifiers.ts` | Computes the 5 dimension modifiers (DCM, VAM, MTM, PUM, HCM) |

## 4. Modified Convex Function Files

| File | What Changed |
|------|--------------|
| `convex/bookings.ts` | On booking completion (`status → "completed"`): auto-creates `maintenance_records` from booked services and triggers the pipeline to recalculate intervals/urgency with new anchors |
| `convex/maintenance.ts` | Schema supports new fields (`confirmedHealthyAt`, `serviceSource`, `confidence`); enriched field writes happen in `bookings.ts` on booking completion |
| `convex/smartcar.ts` | Added pipeline trigger after Smartcar data sync so intervals update with fresh telemetry |
| `convex/vehicle_pipeline.ts` | Extended with NHTSA VIN decoding stages; classification + maintenance pipeline triggers are wired through `vehicles.ts` |
| `convex/vehicles.ts` | Added mutations for health score updates, check-in pointer management, auto-complete for new vehicles, and pre-onboarding profile saves |
| `convex/vehicle_owners.ts` | Added mutations: `dismissSetupCard` (persists "Done" press on Finish Car Setup card) and `markOnboardingComplete` (force-sets `onboardingComplete` when user presses "Finish for now" in CarInfoStepper) |

## 5. Deleted Files

| File | Reason |
|------|--------|
| `convex/imagin.ts` (306 lines) | Removed IMAGIN.studio vehicle image integration — image pipeline moved to client-side utilities |

---

## Architecture Diagram

```
Onboarding Answers
        │
        ▼
┌─────────────────────┐
│  vehicle_driving_    │
│  profiles            │  Raw answers stored
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐    ┌──────────────────────────┐
│  lib/classifier.ts  │───▶│  vehicle_classifications  │
│  lib/modifiers.ts   │    │  (mode, segment, 5 dims,  │
└────────┬────────────┘    │   6 composite modifiers)  │
         │                 └──────────────────────────┘
         ▼
┌─────────────────────┐    ┌──────────────────────────┐
│  maintenance_        │───▶│  vehicle_service_states   │
│  pipeline.ts        │    │  (intervals, urgency,     │
│  lib/intervals.ts   │    │   due dates per service)  │
└─────────────────────┘    └──────────────────────────┘
         ▲                           ▲
         │                           │
    ┌────┴────┐                 ┌────┴────┐
    │ Booking │                 │ Smartcar│
    │ Complete│                 │  Sync   │
    └─────────┘                 └─────────┘

Quarterly:
┌─────────────────────┐
│  checkin.ts          │──▶ Re-classifies + re-runs pipeline
│  lib/checkin_        │
│  questions.ts        │
└─────────────────────┘
```

---

*Generated for merge review — Ahmad-dev branch*
