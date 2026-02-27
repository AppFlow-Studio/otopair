# Vehicle Pipeline Improvements — Session Summary

**Purpose:** Documents the improvements made to the vehicle enrichment pipeline (AI specs, validation, gap fill, service applicability).

**Related:** [ADD_VEHICLE_PIPELINE.md](./ADD_VEHICLE_PIPELINE.md), [DATA_MODEL_VEHICLE_SPECS.md](./DATA_MODEL_VEHICLE_SPECS.md).

---

## What Was Done

### 1. Year-Specific Fitment & Part Validation

The AI prompts now enforce **year-specific fitment** for OEM parts. Parts must be verified for the exact model year; if the AI cannot confirm year-specific fitment, it sets `confidence_score` to 0.5 or below and notes that fitment is unverified. The prompts also require citing sources and including OEM supersession numbers when parts have been updated.

A **part number validation** step runs before saving any OEM part. It checks: (1) whether the part is already mapped to a different model year for the same model (flags as suspicious), and (2) whether the part number format matches the make (e.g., Honda `XX-XXXXXXX`, Toyota `#####-#####`). Failed parts are stored as `"N/A"` and logged for review.

### 2. Split Call 1 into Call 1A + Call 1B

The original single base-specs call was split into two focused calls:

- **Call 1A** — Fluids, maintenance intervals, and vehicle attributes. Uses 8 web searches and focuses on owner’s manual–style data.
- **Call 1B** — OEM part numbers and trim specs. Uses 10 web searches and focuses on parts catalogs. Skips power steering parts when the vehicle has electric PS, and skips timing belt when it has a timing chain.

### 3. Structured Intervals & Vehicle Attributes

**`engine_specs`** now stores structured interval fields in addition to display strings:

- For each maintenance item: `_miles`, `_months`, `_status` (e.g. `scheduled`, `lifetime`, `inspect_only`, `conditional_severe`)
- Transmission severe-use fields: `transmission_fluid_severe_interval_miles`, `transmission_fluid_severe_note`

**Vehicle attributes** (on `engine_specs`): `power_steering_type`, `timing_system`, `has_turbocharger`, `fuel_injection_type`, `transmission_type`, `drivetrain_type`. These drive which services apply and which parts are relevant.

### 4. Gap Fill (Cross-Reference + Targeted Retry)

After Call 1B, any null or low-confidence fields are filled in two steps:

1. **Sibling cross-reference** — Engines with the same `engine_code` are queried. Part numbers for engine-level parts (oil filter, spark plug, serpentine belt, etc.) are copied from sibling engines when available.
2. **Targeted AI retry** — For remaining fields (up to 8), a focused AI call runs to fill only those gaps. This avoids a full re-run for a small number of misses.

### 5. Service Applicability (N/A Services)

Using vehicle attributes, services that do not apply to a vehicle can be marked **not applicable**:

- Power steering flush → electric power steering
- Differential service → FWD
- Timing belt replacement → timing chain

The `service_vehicle_specs` table now has an optional `is_applicable` field. For N/A services, `labor_hours` and `parts_cost` are 0, and `tech_notes` includes the reason (e.g. `"NOT APPLICABLE: electric power steering"`).

### 6. Pricing Prompt Enhancements

The pricing call (Call 2) now receives:

- **Vehicle attributes** — Used to mark N/A services
- **Known OEM part numbers** from Call 1B — So the AI can look up actual MSRP/dealer retail instead of generic estimates

### 7. New Mutations & Queries

| Name                  | Purpose                                                |
| --------------------- | ------------------------------------------------------ |
| `getEnginesByCode`    | Find engines by engine code (for sibling cross-ref)    |
| `getEnginesByTrim`    | Find engines for a trim (for single-option inference)   |
| `updateEngineAttributes` | Update vehicle attributes on `engine_specs`         |
| `updateVehicleSpecs`  | Partial update of `vehicle_specs` (for gap fill)        |
| `getEngineWithTrimModel` | Engine + trim + model (for validation)              |
| `getOtherEnginesWithPartNumber` | Engines using a part (for year-mismatch check) |
| `getVehicleSpecs`     | OEM part numbers for pricing prompt                    |

### 8. Engine Code Resolution

If NHTSA does not provide an engine code, it is resolved in order:

1. Check engines for the same trim; if only one option, use that engine’s code.
2. Infer via AI from make, model, trim, year, displacement, and cylinders.

---

## Flow Summary

```
enrichVehicleSpecs
├── Resolve engine code (trim single-option or AI infer)
├── Call 1A: Fluids, intervals, vehicle attributes → engine_specs, updateEngineAttributes
├── Call 1B: OEM parts, trim specs → vehicle_specs, trim_specs (with validation)
├── Gap fill: Cross-reference siblings → updateVehicleSpecs
├── Gap fill: Targeted AI retry for remaining nulls → updateVehicleSpecs
└── Call 2: Service pricing (with attributes + known parts, is_applicable) → service_vehicle_specs
```

---

**Last updated:** February 2026.
