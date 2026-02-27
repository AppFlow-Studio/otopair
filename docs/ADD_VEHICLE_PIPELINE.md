# Add Vehicle Pipeline — NHTSA, Smartcar & Anthropic AI

**Purpose:** Documents how adding a car populates the vehicle catalog and intelligence tables using NHTSA VIN decode, Smartcar OAuth (optional), and Anthropic Claude AI for spec research.

**See also:** [REFERENCE.md](./REFERENCE.md) (schema), [DATA_MODEL_VEHICLE_SPECS.md](./DATA_MODEL_VEHICLE_SPECS.md) (spec fields), [VEHICLE_PIPELINE_IMPROVEMENTS.md](./VEHICLE_PIPELINE_IMPROVEMENTS.md) (recent enhancements), [convex/vehicle_pipeline.ts](../convex/vehicle_pipeline.ts), [convex/smartcar.ts](../convex/smartcar.ts).

---

## 1. Overview

There are two entry points for adding a vehicle; both feed into the same pipeline:

| Path                 | Entry                                       | Stage 1                   | Stage 2      | Stage 3       |
| -------------------- | ------------------------------------------- | ------------------------- | ------------ | ------------- |
| **Manual VIN**       | `add-vehicle.tsx`                           | User enters 17-char VIN   | NHTSA decode | AI enrichment |
| **Smartcar Connect** | `add-vehicle-review.tsx` → "Connect My Car" | OAuth → VIN from Smartcar | NHTSA decode | AI enrichment |

---

## 2. Stage 1: Input

### Path A — Manual VIN

1. User enters or scans VIN on [`app/add-vehicle.tsx`](../app/add-vehicle.tsx).
2. **decodeVin** action calls `vehicle_pipeline.processVin` (NHTSA).
3. User is navigated to `add-vehicle-review.tsx` with decoded data.
4. User taps **"ADD VEHICLE"** → **confirmVehicleForUser** (creates records, schedules AI enrichment).

### Path B — Smartcar Connect

1. User taps **"CONNECT MY CAR"** on `add-vehicle-review.tsx`.
2. **useSmartcar.connect** opens Smartcar OAuth via [`lib/smartcar.ts`](../lib/smartcar.ts) (`openSmartcarConnect`).
3. **exchangeCodeAndConnect** (`convex/smartcar.ts`):
   - Exchanges OAuth code for tokens.
   - Fetches vehicle IDs from Smartcar API.
   - For each vehicle: fetches info, VIN, odometer.
   - Runs `processVin` (NHTSA) with the VIN.
   - Creates `vehicle_owner` + `vehicle` records.
   - Stores Smartcar connection (tokens) and odometer snapshot.
   - Schedules `enrichVehicleSpecs` if `engine_id` exists.

---

## 3. Stage 2: NHTSA VIN Decode

**File:** [`convex/vehicle_pipeline.ts`](../convex/vehicle_pipeline.ts) — `processVin`

- **API:** `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvaluesextended/{VIN}?format=json`
- **No API key** — public NHTSA endpoint.
- **Extracts:** make, model, year, trim, engine code, cylinders, displacement, fuel type, body style, transmission.
- **Upserts catalog tables** (via `vehicle_mutations`):
  - **makes** → **models** → **trims** → **engines**
- Returns IDs and fields for Stage 3 and UI.

---

## 4. Stage 3: AI Enrichment (Claude)

**File:** [`convex/vehicle_pipeline.ts`](../convex/vehicle_pipeline.ts) — `enrichVehicleSpecs`

Triggered after a vehicle is added (via `confirmVehicleForUser` or `exchangeCodeAndConnect`). Scheduled in background with `scheduler.runAfter(0, ...)`.

### Call 1A — Fluids, intervals & vehicle attributes

- **Model:** Claude Sonnet 4.5 with `web_search_20250305` (8 web searches).
- **Writes to:** `engine_specs` (including structured intervals), `engine_specs` via `updateEngineAttributes` (vehicle attributes).
- **Fields:** oil viscosity/capacity, coolant, brake fluid, maintenance intervals with `_miles` / `_months` / `_status`, vehicle attributes (power steering type, timing system, drivetrain, turbo, etc.).

### Call 1B — OEM part numbers & trim specs

- **Model:** Claude Sonnet 4.5 with `web_search_20250305` (10 web searches).
- **Writes to:** `vehicle_specs`, `trim_specs`.
- **Fields:** OEM part numbers (per-field confidence), tire sizes/pressures, lug torque, wiper sizes. Skips power steering / timing belt parts when attributes indicate they don't apply. Part numbers are validated before save (year-mismatch, format checks).

### Gap fill — Cross-reference & targeted retry

- Sibling engines (same `engine_code`) are cross-referenced for missing parts; then a targeted AI call fills remaining nulls (≤8 fields).

### Call 2 — Service pricing

- **Model:** Claude Sonnet 4.5 with web search.
- **Writes to:** `service_vehicle_specs`.
- **Fields:** labor hours, parts_cost_low, parts_cost_high, tech_notes, `is_applicable` (for N/A services). Receives vehicle attributes and known OEM part numbers for more accurate pricing.
- **Re-enrichment guard:** Skips if service_vehicle_specs already exist for this engine.

Both calls log to **ai_enrichment_logs** for audit.

---

## 5. Tables Populated

| Stage                  | Tables                                                                 |
| ---------------------- | ---------------------------------------------------------------------- |
| **NHTSA (Stage 2)**    | `makes`, `models`, `trims`, `engines`                                  |
| **Vehicle linking**    | `vehicles`, `vehicle_owners`                                           |
| **Claude (Stage 3)**   | `engine_specs`, `vehicle_specs`, `trim_specs`, `service_vehicle_specs` |
| **Audit**              | `ai_enrichment_logs`                                                   |
| **Smartcar path only** | `smartcar_connections`, `vehicle_health_snapshots`                     |

---

## 6. Data Flow

```
Manual VIN (add-vehicle) ──┐
                           ├──► processVin (NHTSA) ──► Upsert makes/models/trims/engines
Smartcar OAuth ── exchangeCodeAndConnect ─────────────┘
         │
         └──► Create vehicle_owner + vehicle
         └──► Store smartcar_connections, vehicle_health_snapshots
         └──► scheduler.runAfter(0, enrichVehicleSpecs)
                           │
                           ▼
                  enrichVehicleSpecs (Claude)
                    ├── Call 1A: engine_specs (fluids/intervals), vehicle attributes
                    ├── Call 1B: vehicle_specs, trim_specs (+ validation)
                    ├── Gap fill: cross-reference siblings, targeted AI retry
                    └── Call 2: service_vehicle_specs (pricing, is_applicable)
```

---

## 7. Environment Variables

| Variable                         | Required for  | Purpose                  |
| -------------------------------- | ------------- | ------------------------ |
| —                                | NHTSA         | No key; public API       |
| `ANTHROPIC_API_KEY`              | AI enrichment | Claude API (Convex env)  |
| `SMARTCAR_CLIENT_ID`             | Smartcar      | OAuth (Convex env)       |
| `SMARTCAR_CLIENT_SECRET`         | Smartcar      | OAuth (Convex env)       |
| `EXPO_PUBLIC_SMARTCAR_CLIENT_ID` | Smartcar      | OAuth redirect (app env) |

---

## 8. Key Files

| File                          | Role                                                                              |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `convex/vehicle_pipeline.ts`  | `decodeVin`, `processVin`, `confirmVehicleForUser`, `enrichVehicleSpecs`          |
| `convex/smartcar.ts`          | `exchangeCodeAndConnect`, `createVehicleOwnerFromSmartcar`, Smartcar HTTP helpers |
| `convex/vehicle_mutations.ts` | Internal upserts (makes, models, trims, engines), specs storage                   |
| `app/add-vehicle.tsx`         | VIN entry UI; calls `decodeVin`                                                   |
| `app/add-vehicle-review.tsx`  | Review screen; calls `confirmVehicleForUser` or `useSmartcar.connect`             |
| `hooks/useSmartCar.ts`        | `connect()`, `fetchVehicleData`, `disconnectVehicle`, `checkCompatibility`        |
| `lib/smartcar.ts`             | `openSmartcarConnect` — OAuth redirect flow                                       |

---

**Last updated:** February 2026.
