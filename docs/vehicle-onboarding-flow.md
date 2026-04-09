# Vehicle Onboarding Flow

## Overview

Users add vehicles through one of two main paths:

1. **VIN-based** - Scan or type a 17-character VIN → NHTSA decode → AI normalization → review → optional Smartcar connect
2. **Manual entry** - Select brand, model, year, color, body style, trim, drivetrain, mileage → pseudo-VIN generated

Both paths converge at the review screen, then proceed to a success screen and optional "Tell Us About" questionnaire.

---

## Data Flow Diagram

```
                        ┌─────────────────────┐
                        │   Add Vehicle Screen │
                        │  (app/add-vehicle.tsx)│
                        └─────────┬───────────┘
                                  │
                 ┌────────────────┼────────────────┐
                 │                │                 │
           ┌─────▼─────┐   ┌─────▼──────┐   ┌─────▼──────┐
           │  Scan VIN  │   │  Type VIN  │   │   Manual   │
           │(vin-scanner)│   │ (17 chars) │   │   Entry    │
           └─────┬──────┘   └─────┬──────┘   │(add-car-   │
                 │                │           │  info.tsx)  │
                 └───────┬────────┘           └─────┬──────┘
                         │                          │
                    ┌────▼────┐               ┌─────▼──────┐
                    │  NHTSA  │               │  User picks │
                    │ Decode  │               │  7 fields   │
                    │  + AI   │               │  + mileage  │
                    │normalize│               └─────┬──────┘
                    └────┬────┘                     │
                         │                          │
                    ┌────▼──────────────────────────▼────┐
                    │        Review Screen               │
                    │    (add-vehicle-review.tsx)         │
                    │                                    │
                    │  ┌──────────────┐ ┌──────────────┐│
                    │  │ CONNECT MY   │ │ ADD VEHICLE   ││
                    │  │ CAR (Smartcar)│ │ (direct add) ││
                    │  └──────┬───────┘ └──────┬───────┘│
                    └─────────┼────────────────┼────────┘
                              │                │
                    ┌─────────▼────────┐       │
                    │ Smartcar OAuth    │       │
                    │ Token exchange    │       │
                    │ VIN matching      │       │
                    │ Health snapshots  │       │
                    └─────────┬────────┘       │
                              │                │
                         ┌────▼────────────────▼────┐
                         │    Vehicle Added Screen   │
                         │    (vehicle-added.tsx)     │
                         │    Animated checkmark      │
                         └────────────┬─────────────┘
                                      │
                              ┌───────▼────────┐
                              │  Cars Tab       │
                              │  (main-tabs)    │
                              └───────┬────────┘
                                      │
                              ┌───────▼────────┐
                              │ Tell Us About   │
                              │ Flow (adaptive  │
                              │ questionnaire)  │
                              └────────────────┘

        Background (async after vehicle creation):
        ┌──────────────────────────────────────────┐
        │  AI Enrichment Pipeline                   │
        │  Claude researches OEM parts, intervals,  │
        │  specs, and service pricing               │
        └──────────────────────────────────────────┘
```

---

## Path 1: VIN-Based Entry

### Add Vehicle Screen (`app/add-vehicle.tsx`)

The entry screen shows a car illustration with dots pointing to typical VIN locations. Users can:
- **Type a VIN** in the text input (auto-capitalized, validated to 17 characters)
- **Scan a VIN** via the camera button → routes to `/vin-scanner`

When a valid VIN is entered and "DECODE VIN" is tapped, the `decodeVin` Convex action is called. Results are passed to the review screen.

### VIN Scanner (`app/vin-scanner.tsx`)

- Uses `expo-camera` CameraView with barcode scanning
- Accepts barcode types: `code128`, `code39`, `code93`, `datamatrix`, `qr`
- Only accepts 17-character codes as valid VINs
- Includes flashlight toggle
- On successful scan: calls `decodeVin`, then routes to `/add-vehicle-review` with decoded data

### VIN Decode Pipeline (`convex/vehicle_pipeline.ts`)

**Stage 1: NHTSA API Decode**

```
VIN → NHTSA API → Raw Fields → Optional Claude Normalization → DB Upserts
```

- **Endpoint:** `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvaluesextended/{vin}?format=json`
- **Extracted fields:** Make, Model, ModelYear, Trim, EngineModel, EngineCylinders, DisplacementL, FuelTypePrimary, Turbo, BodyClass, TransmissionStyle, DriveType, Series

**Stage 2: AI Normalization (Optional)**

Claude (`claude-sonnet-4-5-20250929`, temperature: 0.1) corrects NHTSA mislabeling:
- Example: BMW M550i xDrive — NHTSA returns model "M550i", Claude normalizes to "5 Series" with trim "M550i xDrive"
- Extracts canonical drivetrain (awd, rwd, fwd, 4wd)
- Infers engine code when NHTSA leaves it blank

**Stage 3: Database Upserts**

```
makeId   = upsertMake({ name })
modelId  = upsertModel({ makeId, name })
trimId   = upsertTrim({ modelId, name, year })
engineId = upsertEngine({ trimId, engineCode, cylinders, displacement, fuelType })
```

All upserts are idempotent — repeated calls with the same data update rather than duplicate.

---

## Path 2: Manual Entry

### Add Car Info Screen (`app/add-car-info.tsx`)

Users fill out vehicle details through bottom sheet pickers:

| Field | Input Type | Options |
|-------|-----------|---------|
| Brand | Bottom sheet picker | 40+ manufacturers |
| Model | Bottom sheet picker | Dynamic list based on selected brand |
| Year | Bottom sheet picker | Last 30 years |
| Color | Bottom sheet picker | 10 preset colors with swatches |
| Body Style | Bottom sheet picker | Sedan, SUV, Coupe, Truck, Hatchback, Van, Wagon, Convertible |
| Trim | Bottom sheet picker | Common trims across brands |
| Drivetrain | Bottom sheet picker | FWD, RWD, AWD, 4WD |
| Mileage | Text input | Optional, numeric |

**UI layout:** 2x2 grid for primary fields, additional rows below. When all 7 required fields are filled, a 5-second loading animation plays before navigating to the review screen.

**Pseudo-VIN generation:**
```javascript
vin = `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
```

**Submission:**
```javascript
upsertVehicle({
  vin: pseudoVin,
  year: parseFloat(year),
  metadata: { make: brand, model, body_style: bodyStyle, color }
})

addOwner({
  vin: pseudoVin,
  userId,
  is_primary: true,
  nickname: `${year} ${brand} ${model}`,
  mileage: mileage ? Number(mileage) : undefined
})
```

---

## Review Screen (`app/add-vehicle-review.tsx`)

Operates in two modes:

### VIN Mode
- Displays decoded data (read-only): Year, Make, Model, Trim, Engine displacement, Fuel type, VIN
- Header: "VEHICLE DETECTED"
- Two action buttons:
  - **"CONNECT MY CAR"** → Opens Smartcar OAuth flow
  - **"ADD VEHICLE"** → Creates vehicle directly (skips Smartcar)

### Manual Mode
- All fields editable via bottom sheet pickers
- "Edit Information" button toggles between view and edit modes
- Mileage input with keyboard accessory (iOS)
- Vehicle image generated from make/model/year

Both modes pass `trimId` and `engineId` from the decode pipeline to link against the catalog.

---

## Smartcar Integration

### OAuth Flow

**Client-side** (`lib/smartcar.ts`):

```
Scopes requested:
  read_vehicle_info    read_vin           read_odometer
  read_location        read_tires         read_engine_oil
  read_fuel            read_battery       read_security
  read_service_history
```

1. App calls `openSmartcarConnect()` which builds an OAuth URL
2. Opens `https://connect.smartcar.com/oauth/authorize` in an in-app browser
3. User authorizes with their vehicle manufacturer account
4. Redirect to `otopair://smartcar/callback?code=...&state=...`
5. Authorization code returned to the app

### Backend Token Exchange (`convex/smartcar.ts`)

The `exchangeCodeAndConnect` action handles the full integration:

1. **Token exchange:** POST to `https://auth.smartcar.com/oauth/token` → access_token, refresh_token
2. **Fetch vehicle list:** GET `/vehicles` → array of Smartcar vehicle IDs
3. **For each vehicle:**
   - Fetch VIN, vehicle info, odometer, tire pressure, oil life, fuel, location, lock status, service history
   - **VIN matching:** If user provided a VIN (from the add vehicle flow), only link the Smartcar vehicle whose VIN matches — prevents linking the wrong car
   - Run VIN through NHTSA pipeline (Stage 2)
   - Create/update vehicle + vehicle_owner records (idempotent)
   - Store Smartcar connection with tokens
   - Subscribe to webhook for ongoing updates
   - Store initial health snapshots

### Data Fetched from Smartcar

| Snapshot Type | Data |
|--------------|------|
| `odometer` | distance + unit |
| `tire_pressure` | Pressure by wheel position |
| `oil_life` | Percentage remaining |
| `fuel` | Current level |
| `location` | Latitude/longitude |
| `lock_status` | isLocked boolean |
| `service_history` | Service records array |
| `online_status` | Vehicle connectivity |

### Hook: `useSmartcar` (`hooks/useSmartCar.ts`)

```typescript
const { connect, isConnecting, error } = useSmartcar()
// Usage:
const result = await connect(userId, vin)  // vin optional, for deterministic matching
```

---

## Success Screen (`app/vehicle-added.tsx`)

Animated celebration sequence:

1. Checkmark circle bounces in (spring animation)
2. Checkmark path draws (400ms timing)
3. Text fades in with upward slide (staggered 300ms)
4. Buttons slide up (staggered 500ms)
5. Subtle car image zoom (3000ms)
6. Haptic feedback on mount

**Actions:**
- "VIEW MY VEHICLE" → Navigates to `/(main-tabs)/cars`
- Back button → Navigate back

---

## Background AI Enrichment (`convex/vehicle_pipeline.ts`)

After vehicle creation, an async pipeline enriches the vehicle record with OEM data. This runs in the background via `ctx.scheduler.runAfter(0, ...)`.

### Call 1: Base Specs Extraction

Claude (`claude-sonnet-4-5-20250929`) uses the `web_search` tool to research OEM specifications:

**Engine specs stored:**
- Oil viscosity, oil capacity (qts), oil change interval
- Coolant type, coolant capacity (qts)
- Brake fluid type
- Tire rotation interval, spark plug interval
- Serpentine belt interval, transmission fluid interval
- Engine air filter interval, cabin air filter interval

**Vehicle specs stored (OEM part numbers):**
- Oil filter, oil drain plug gasket
- Engine air filter, cabin air filter
- Front/rear brake pads, front/rear brake rotors
- Spark plugs (part number, quantity, gap in mm)
- Serpentine belt
- Battery (group size, CCA)
- Parking brake type

**Trim specs stored:**
- Tire sizes (front/rear), recommended pressure (front/rear PSI)
- Lug nut torque (ft-lbs)
- Wiper blade sizes (driver/passenger)

**Confidence scoring:**
- 0.90+ → Verified exact match
- 0.70-0.89 → Strong match (same generation/platform)
- 0.50-0.69 → Partial match
- <0.50 → Mostly unknown, generic fallback

**Fallback ladder:** Exact vehicle → same engine code → same model/generation → generic vehicle class

### Call 2: Service Pricing

- Fetches all platform services
- Calculates `labor_hours` and `parts_cost_low`/`parts_cost_high` for each service + engine combo
- Generates `service_vehicle_specs` records with confidence scores

### Rate Limiting

- 15-second delay between base specs and pricing calls
- Retry on HTTP 429 with 60-second wait (max 2 retries)
- Aligned with 30k input tokens/minute org rate limit

---

## Tell Us About Flow

**Entry:** After adding a vehicle, users are prompted with an adaptive questionnaire.
**Files:** `components/tell-us-about/TellUsAboutFlow.tsx`, `app/(tell-us-about)/_layout.tsx`

### Three Adaptive Paths Based on Knowledge Level

The first step (`ExperienceStep`) determines the user's car knowledge level (1, 2, or 3), which controls which subsequent steps they see:

**Level 1 — Novice (6 steps):**
```
experience → carUsage → shopType → maintenanceFrustration → maintenanceApproachLevel1 → servicePriorities
```

**Level 2 — Intermediate (5 steps):**
```
experience → maintenanceTracking → shopType → repairQuoteNeeds → servicePriorities
```

**Level 3 — Advanced (8 steps):**
```
experience → serviceHistory → partsPhilosophy → maintenanceApproachLevel3 → shopPriorities → householdRole → decisionStyle → servicePriorities
```

### Step Components

| Step | Levels | Purpose |
|------|--------|---------|
| ExperienceStep | All | Determines knowledge level (1, 2, or 3) |
| CarUsageStep | 1 | Driving frequency and purpose |
| MaintenanceFrustrationStep | 1 | Pain points with car maintenance |
| MaintenanceApproachStepLevel1 | 1 | Basic maintenance strategy |
| MaintenanceTrackingStep | 2 | How they currently track maintenance |
| RepairQuoteNeedsStep | 2 | What they need from repair quotes |
| ServiceHistoryStep | 3 | Current maintenance record keeping |
| PartsPhilosophyStep | 3 | OEM vs aftermarket preference |
| MaintenanceApproachStepLevel3 | 3 | Advanced maintenance strategy |
| ShopPrioritiesStep | 3 | What matters when choosing a shop |
| HouseholdRoleStep | 3 | Decision maker role in household |
| DecisionStyleStep | 3 | How they make repair decisions |
| ShopTypeStep | 1, 2 | Dealer vs independent preference |
| ServicePrioritiesStep | All | What matters most in car service |

### Vehicle-Specific Data Collection

The flow also collects vehicle-specific data via `saveOnboardingField`:

| Field | Storage |
|-------|---------|
| `mileage` | `vehicle_owners.mileage` |
| `avgMonthlyDriving` | `vehicle_owners.avgMonthlyDriving` |
| `drivingConditions` | `vehicle_owners.drivingConditions` |
| `oil`, `tires`, `brakes`, `battery`, `inspection` | `maintenance_records` (upsert by type) |

**Auto-completion check:**
```
isComplete = hasMileage && hasUsage && hasAllRecords
// Where: mileage > 0, avgMonthlyDriving defined,
//        all of [oil, tires, brakes, battery] have maintenance_records
```

When complete, sets `vehicle_owners.onboardingComplete = true`.

### UI

- Animated gradient background with 16 color configs
- 1200ms Bezier easing transitions between steps
- Progress indicator showing current/total for the selected path
- Stack navigation with slide-from-right animation

---

## Database Schema

### `vehicles` — Vehicle Catalog (one per unique VIN)

```typescript
{
  vin: string                          // Indexed, unique per vehicle
  trim_id?: Id<"trims">
  engine_id?: Id<"engines">
  transmission_id?: Id<"transmissions">
  chassis_id?: Id<"chassis_variants">
  year?: number
  metadata?: {                         // Flexible object
    make: string
    model: string
    body_style?: string
    color?: string
  }
  created_at: number
  updated_at: number
}
```

### `vehicle_owners` — Ownership Relationships

```typescript
{
  vin: string                          // Indexed
  user_id: Id<"users">
  status: "active" | "removed"         // Soft delete
  nickname: string                     // e.g., "2021 BMW 5 Series"
  is_primary: boolean                  // One primary per user
  mileage?: number
  connectionStatus: "unconnected" | "connected" | "error"
  smartcarVehicleId?: string
  onboardingComplete?: boolean         // Tell Us About completed
  avgMonthlyDriving?: string
  drivingConditions?: string
  added_at: number
  removed_at?: number
}
// Indexes: by_vin, by_user_status, by_vehicle_owner
```

### `makes` — Vehicle Manufacturers

```typescript
{
  name: string                         // Indexed (e.g., "BMW", "Toyota")
  logo_url?: string
}
```

### `models` — Vehicle Model Lines

```typescript
{
  make_id: Id<"makes">
  name: string                         // e.g., "5 Series", "Camry"
}
// Indexes: by_make_id
```

### `trims` — Vehicle Trim Levels

```typescript
{
  model_id: Id<"models">
  name: string                         // e.g., "M550i xDrive"
  year: number
}
// Indexes: by_model_id, by_model_and_year
```

### `engines` — Engine Specifications

```typescript
{
  trim_id: Id<"trims">
  engine_code: string                  // e.g., "N63B44T3"
  cylinders: number
  displacement_liters: string          // e.g., "4.4"
  fuel_type: string                    // e.g., "Gasoline"
}
// Indexes: by_trim_id
```

### `vehicle_specs` — OEM Parts Reference

```typescript
{
  engine_id: Id<"engines">
  oil_viscosity?: string
  oil_capacity_qts?: number
  oil_filter_oem?: string
  oil_drain_plug_gasket_oem?: string
  engine_air_filter_oem?: string
  cabin_air_filter_oem?: string
  front_brake_pad_oem?: string
  rear_brake_pad_oem?: string
  front_brake_rotor_oem?: string
  rear_brake_rotor_oem?: string
  spark_plug_oem?: string
  spark_plug_quantity?: number
  spark_plug_gap_mm?: number
  serpentine_belt_oem?: string
  battery_group?: string
  battery_cca?: number
  parking_brake_type?: string
}
// Indexes: by_engine_id
```

### `service_vehicle_specs` — Service Pricing by Engine

```typescript
{
  engine_id: Id<"engines">
  service_id: Id<"services">
  labor_hours: number
  parts_cost_low: number
  parts_cost_high: number
  confidence_score: number
  tech_notes?: string
}
// Indexes: by_engine_id, by_service_id, by_engine_and_service
```

### `maintenance_records` — User Vehicle Maintenance History

```typescript
{
  vehicleOwnerId: Id<"vehicle_owners">
  type: "oil" | "tires" | "brakes" | "battery" | "inspection"
  lastServiceDate?: number
  lastServiceMileage?: number
  customInputs?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}
// Indexes: by_vehicle_owner, by_vehicle_and_type
```

### `smartcar_connections` — Smartcar OAuth Tokens

```typescript
{
  vehicleOwnerId: Id<"vehicle_owners">
  smartcarVehicleId: string
  accessToken: string
  refreshToken: string
  expiresIn: number
  status: "active" | "expired" | "revoked"
  connectedAt: number
  lastSyncedAt: number
}
// Indexes: by_vehicle_owner, by_smartcar_id
```

### `vehicle_health_snapshots` — Real-time Vehicle Data

```typescript
{
  vehicleOwnerId: Id<"vehicle_owners">
  snapshotType: "odometer" | "tire_pressure" | "oil_life" | "fuel" |
                "location" | "lock_status" | "service_history" | "online_status"
  data: any                            // Shape varies by type
  source: "smartcar" | "user_input"
  recordedAt: number
}
// Indexes: by_vehicle_and_type (sorted by timestamp)
```

---

## Key Design Patterns

**Idempotency:** Vehicle creation by VIN is idempotent (`upsertVehicle`). Repeated calls update rather than duplicate. Ownership relationships follow the same pattern.

**Soft Deletes:** `vehicle_owners.status = "removed"` (never hard-deleted). Can be reactivated by calling `addOwner` again.

**Gradual Enrichment:** Vehicle data builds up over time — manual entry or NHTSA decode first, then async AI enrichment adds OEM specs and pricing in the background.

**Deterministic VIN Matching:** When connecting via Smartcar, only the vehicle whose VIN matches the user's provided VIN gets linked. This prevents accidentally associating the wrong vehicle.

---

## Key Source Files

| File | Purpose |
|------|---------|
| `app/add-vehicle.tsx` | Entry screen — VIN input or scan |
| `app/vin-scanner.tsx` | Camera-based VIN barcode scanning |
| `app/add-car-info.tsx` | Manual vehicle entry form |
| `app/add-vehicle-review.tsx` | Review decoded/entered data before adding |
| `app/vehicle-added.tsx` | Success screen with animated checkmark |
| `convex/vehicles.ts` | Vehicle and ownership mutations |
| `convex/vehicle_pipeline.ts` | NHTSA decode + AI normalization + enrichment |
| `convex/smartcar.ts` | Smartcar OAuth, token exchange, data fetching |
| `convex/schema.ts` | All table definitions |
| `lib/smartcar.ts` | Smartcar OAuth URL builder, scopes, redirect URI |
| `hooks/useSmartCar.ts` | React hook wrapping Smartcar connect flow |
| `components/tell-us-about/TellUsAboutFlow.tsx` | Adaptive vehicle questionnaire |
| `app/(tell-us-about)/_layout.tsx` | Tell Us About stack navigator |
