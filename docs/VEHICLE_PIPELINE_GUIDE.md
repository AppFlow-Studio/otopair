# Vehicle Pipeline — Complete Guide

**One-stop reference** for adding vehicles, NHTSA decode, AI enrichment, schema, and all pipeline improvements.

**Key files:** `convex/vehicle_pipeline.ts`, `convex/vehicle_mutations.ts`, `convex/schema.ts`

---

## 1. Overview

| Path                 | Entry                                       | Stage 1                   | Stage 2      | Stage 3       |
| -------------------- | ------------------------------------------- | ------------------------- | ------------ | ------------- |
| **Manual VIN**       | `add-vehicle.tsx`                           | User enters 17-char VIN   | NHTSA decode | AI enrichment |
| **Smartcar Connect** | `add-vehicle-review.tsx` → "Connect My Car" | OAuth → VIN from Smartcar | NHTSA decode | AI enrichment |

---

## 2. Entry Points & Stage 1

### Path A — Manual VIN

1. User enters or scans VIN on `app/add-vehicle.tsx`.
2. **decodeVin** → `vehicle_pipeline.processVin` (NHTSA).
3. User goes to `add-vehicle-review.tsx` with decoded data.
4. User taps **"ADD VEHICLE"** → **confirmVehicleForUser** (creates records, schedules AI enrichment).

### Path B — Smartcar Connect

1. User taps **"CONNECT MY CAR"** on `add-vehicle-review.tsx`.
2. OAuth via `lib/smartcar.ts` → `exchangeCodeAndConnect` in `convex/smartcar.ts`.
3. Fetches vehicles from Smartcar → runs `processVin` for each → creates `vehicle_owner` + `vehicle` → schedules `enrichVehicleSpecs`.

---

## 3. Stage 2: NHTSA VIN Decode

**Function:** `processVin` in `vehicle_pipeline.ts`

- **API:** `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvaluesextended/{VIN}?format=json` (no key)
- **Extracts:** make, model, year, trim, engine code, cylinders, displacement, fuel type, body style, transmission.
- **Upserts:** `makes` → `models` → `trims` → `engines`
- Optional AI normalization corrects model/trim/drivetrain when NHTSA is wrong.

---

## 4. Stage 3: AI Enrichment (Full Flow)

**Function:** `enrichVehicleSpecs` — triggered after vehicle add via `scheduler.runAfter(0, ...)`.

### Step 0: Engine Code Resolution

If NHTSA didn't provide engine code:

1. **Trim single-option** — If trim has only one engine, use its `engine_code`.
2. **AI inference** — Infer from make, model, trim, year, displacement, cylinders, fuel type.

### Call 1A — Fluids, Intervals & Vehicle Attributes

- **Model:** Claude Sonnet 4.5, 8 web searches.
- **Writes to:** `engine_specs`, `updateEngineAttributes`.
- **Output:** Oil viscosity/capacity, coolant, brake fluid, maintenance intervals (with structured `_miles`, `_months`, `_status`), vehicle attributes (power steering type, timing system, drivetrain, turbo, fuel injection, transmission).

### Call 1B — OEM Part Numbers & Trim Specs

- **Model:** Claude Sonnet 4.5, 10 web searches.
- **Writes to:** `vehicle_specs`, `trim_specs`.
- **Output:** OEM part numbers with per-field confidence; tire sizes/pressures, lug torque, wiper sizes.
- **Skips:** Power steering parts if electric PS; timing belt if timing chain.
- **Validation:** Before save, each part is validated:
  - Year-mismatch check — part already mapped to different model year for same model → reject (store as N/A).
  - Format check — part number must match make pattern (Honda `XX-XXXXXXX`, Toyota `#####-#####`, etc.).
- **Year-pinning:** Prompts require parts verified for exact model year; if unverified, confidence ≤ 0.5.

### Gap Fill — Cross-Reference + Targeted Retry

After Call 1B, null or low-confidence (< 0.70) fields:

1. **Sibling cross-reference** — Find engines with same `engine_code`. Copy part numbers for: `oil_filter_oem`, `oil_drain_plug_gasket_oem`, `engine_air_filter_oem`, `spark_plug_oem`, `spark_plug_quantity`, `spark_plug_gap_mm`, `serpentine_belt_oem`.
2. **Targeted AI retry** — For remaining fields (≤ 8), one focused AI call.

### Call 2 — Service Pricing

- **Model:** Claude Sonnet 4.5, 5 web searches.
- **Writes to:** `service_vehicle_specs`.
- **Receives:** Vehicle attributes (for N/A logic), known OEM part numbers (for MSRP lookups).
- **Output:** `labor_hours`, `parts_cost_low`, `parts_cost_high`, `tech_notes`, `is_applicable`.
- **N/A services:** Power steering flush (electric PS), differential (FWD), timing belt (timing chain) → `is_applicable: false`, labor/parts = 0.
- **Re-enrichment guard:** Skips if `service_vehicle_specs` already exist for this engine.

---

## 5. Data Flow Diagram

```
Manual VIN (add-vehicle) ──┐
                           ├──► processVin (NHTSA) ──► makes, models, trims, engines
Smartcar OAuth ── exchangeCodeAndConnect ─────────────┘
         │
         └──► vehicle_owner + vehicle (+ smartcar_connections, vehicle_health_snapshots)
         └──► scheduler.runAfter(0, enrichVehicleSpecs)
                           │
                           ▼
                  enrichVehicleSpecs
                    ├── Resolve engine code (trim or AI)
                    ├── Call 1A: engine_specs (fluids, intervals), vehicle attributes
                    ├── Call 1B: vehicle_specs, trim_specs (+ validation)
                    ├── Gap fill: siblings → targeted AI
                    └── Call 2: service_vehicle_specs (pricing, is_applicable)
```

---

## 6. Tables Populated

| Stage                | Tables                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| **NHTSA**            | `makes`, `models`, `trims`, `engines`                                  |
| **Vehicle linking**  | `vehicles`, `vehicle_owners`                                          |
| **AI enrichment**    | `engine_specs`, `vehicle_specs`, `trim_specs`, `service_vehicle_specs` |
| **Audit**            | `ai_enrichment_logs`                                                   |
| **Smartcar only**    | `smartcar_connections`, `vehicle_health_snapshots`                    |

---

## 7. Schema Reference

### engine_specs

**Fluids/intervals:** `oil_viscosity`, `oil_capacity_qts`, `oil_change_interval`, `coolant_type`, `coolant_capacity_qts`, `brake_fluid_type`, `tire_rotation_interval`, `spark_plug_interval`, `serpentine_belt_interval`, `transmission_fluid_interval`, `engine_air_filter_interval`, `cabin_air_filter_interval`, `brake_fluid_interval`, `coolant_interval`.

**Structured intervals** (per item): `_miles`, `_months`, `_status` (e.g. `scheduled`, `lifetime`, `inspect_only`, `conditional_severe`). Plus `transmission_fluid_severe_interval_miles`, `transmission_fluid_severe_note`.

**Vehicle attributes:** `power_steering_type`, `timing_system`, `has_turbocharger`, `fuel_injection_type`, `transmission_type`, `drivetrain_type`.

### vehicle_specs (engine-level OEM parts)

`oil_filter_oem`, `oil_drain_plug_gasket_oem`, `engine_air_filter_oem`, `cabin_air_filter_oem`, `front_brake_pad_oem`, `rear_brake_pad_oem`, `front_brake_rotor_oem`, `rear_brake_rotor_oem`, `spark_plug_oem`, `spark_plug_quantity`, `spark_plug_gap_mm`, `serpentine_belt_oem`, `battery_group`, `battery_cca`, `parking_brake_type`, `oil_viscocity`, `oil_capacity_qts`.

### trim_specs

`tire_size_front`, `tire_size_rear`, `recommended_tire_pressure_front_psi`, `recommended_tire_pressure_rear_psi`, `lug_nut_torque_ft_lbs`, `wiper_blade_driver_size_in`, `wiper_blade_passenger_size_in`, `wiper_blade_rear_size_in`, `parking_brake_type`.

### service_vehicle_specs

`labor_hours`, `parts_cost_low`, `parts_cost_high`, `confidence_score`, `tech_notes`, `is_applicable` (optional, false = N/A for this vehicle).

---

## 8. Mutations & Queries (vehicle_mutations)

| Name                         | Purpose                                                    |
| ---------------------------- | ---------------------------------------------------------- |
| `getEngineSpecs`             | Engine specs for re-enrichment guard                       |
| `getEngine`                  | Engine by ID                                               |
| `getEngineWithTrimModel`     | Engine + trim + model (validation)                         |
| `getOtherEnginesWithPartNumber` | Engines using a part (year-mismatch check)              |
| `getVehicleSpecs`            | OEM part numbers for pricing prompt                        |
| `getEnginesByCode`           | Engines by engine code (sibling cross-ref)                 |
| `getEnginesByTrim`           | Engines for a trim (single-option inference)               |
| `updateEngineCode`           | Set engine_code after inference                             |
| `updateEngineAttributes`     | Patch vehicle attributes on engine_specs                   |
| `updateVehicleSpecs`         | Partial update of vehicle_specs (gap fill)                  |
| `storeEngineSpecs`          | Insert engine_specs                                        |
| `storeVehicleSpecs`         | Insert vehicle_specs                                       |
| `storeTrimSpecs`            | Insert trim_specs                                          |
| `upsertServiceVehicleSpec`   | Upsert service_vehicle_specs (with optional `is_applicable`) |
| `listAllServices`           | All services for pricing prompt                            |
| `getServiceVehicleSpecsCount`| Count for re-enrichment guard                              |

---

## 9. Key Files

| File                         | Role                                                                 |
| ---------------------------- | -------------------------------------------------------------------- |
| `convex/vehicle_pipeline.ts` | `decodeVin`, `processVin`, `confirmVehicleForUser`, `enrichVehicleSpecs` |
| `convex/vehicle_mutations.ts`| Internal upserts, specs storage, all mutations/queries above         |
| `app/add-vehicle.tsx`       | VIN entry UI                                                         |
| `app/add-vehicle-review.tsx` | Review screen, confirmVehicleForUser, Smartcar connect              |
| `convex/smartcar.ts`        | `exchangeCodeAndConnect`                                             |

---

## 10. Environment Variables

| Variable                         | Purpose                  |
| -------------------------------- | ------------------------ |
| `ANTHROPIC_API_KEY`              | Claude API (Convex env)  |
| `SMARTCAR_CLIENT_ID`             | Smartcar OAuth           |
| `SMARTCAR_CLIENT_SECRET`         | Smartcar OAuth           |
| `EXPO_PUBLIC_SMARTCAR_CLIENT_ID` | Smartcar redirect (app)  |

---

## 11. Service Pricing & job_actuals

- **Price formula:** `(shop.labor_rate × labor_hours) + parts` per service.
- **Car-specific:** `service_vehicle_specs` per (engine_id, service_id).
- **Fallback:** `services.default_labor_hours` and `service_options` when no engine-specific spec.
- **job_actuals** uses `vehicle_specs` for suggested parts (oil filter, brake pads, spark plugs, etc.).

---

**Last updated:** February 2026.
