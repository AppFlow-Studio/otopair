# Convex Schema Normalization: OEM Parts & Subsystem Specs

**Date Completed:** February 1, 2026  
**Status:** ✅ Complete and Implemented

## Overview

This document details the comprehensive schema normalization update that introduces:
- Normalized OEM parts catalog (`oem_parts`)
- Trim-scoped transmission variants (`transmissions`)
- Trim-scoped chassis variants (`chassis_variants`)
- Subsystem-level specs tables (NOT parts, but specification data)
- Fitment mapping tables to connect variants to parts

## NEW TABLES ADDED

### 1. OEM Parts Normalization

#### `oem_parts` Table
**Purpose:** Master catalog of OEM parts for normalization across fitments.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `oem_part_number` | string | UNIQUE (via index) | Primary identifier for part |
| `name` | string | Optional | E.g., "Oil Filter", "Brake Pad" |
| `category` | string | Optional | E.g., "filter", "brakes", "wipers", "fluids" |
| `notes` | string | Optional | Additional notes |
| `created_at` | float64 | Required | Unix ms timestamp |

**Indexes:**
- `by_part_number` on `oem_part_number` (unique constraint in code)
- `by_category` on `category`

**Relationships:**
- Has-many → `engine_part_fitments` (via `part_id`)
- Has-many → `transmission_part_fitments` (via `part_id`)
- Has-many → `trim_part_fitments` (via `part_id`)

---

### 2. Transmission Variants (Trim-Scoped)

#### `transmissions` Table
**Purpose:** Trim-scoped transmission variants, mirroring `engines` structure.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `trim_id` | id("trims") | Required | FK to trim |
| `transmission_type` | string | Required | "automatic" \| "manual" \| "cvt" \| "dct" |
| `code` | string | Optional | OEM transmission code |
| `notes` | string | Optional | Additional notes |
| `created_at` | float64 | Required | Unix ms timestamp |

**Indexes:**
- `by_trim` on `trim_id`
- `by_trim_type` on `(trim_id, transmission_type)` composite

**Relationships:**
- FK → `trims(trim_id)`
- Has-many → `transmission_specs` (via `transmission_id`)
- Has-many → `transmission_part_fitments` (via `transmission_id`)
- Referenced by → `vehicles(transmission_id)` optional

---

#### `chassis_variants` Table
**Purpose:** Trim-scoped drivetrain/chassis variants.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `trim_id` | id("trims") | Required | FK to trim |
| `drivetrain_type` | string | Required | "fwd" \| "rwd" \| "awd" \| "4wd" |
| `notes` | string | Optional | Additional notes |
| `created_at` | float64 | Required | Unix ms timestamp |

**Indexes:**
- `by_trim` on `trim_id`
- `by_trim_drivetrain` on `(trim_id, drivetrain_type)` composite

**Relationships:**
- FK → `trims(trim_id)`
- Referenced by → `vehicles(chassis_id)` optional

---

### 3. Subsystem-Level Specs (NOT Parts - Specification Data)

**Concept:** These tables store SPECIFICATION DATA (oil type, fluid capacity, tire size, etc.), NOT parts themselves. Each has a UNIQUE index ensuring one spec record per variant.

#### `engine_specs` Table
**Purpose:** Engine subsystem specifications (oil, coolant, brake fluid).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `engine_id` | id("engines") | UNIQUE (via index) | FK to engine |
| `oil_viscosity` | string | Optional | E.g., "5W-30" |
| `oil_capacity_qts` | float64 | Optional | Quarts |
| `coolant_type` | string | Optional | Coolant specification |
| `coolant_capacity_qts` | float64 | Optional | Quarts |
| `brake_fluid_type` | string | Optional | Brake fluid specification |
| `maintenance_intervals` | string | Optional | Maintenance schedule |
| `created_at` | float64 | Required | Unix ms timestamp |

**Indexes:**
- `by_engine` on `engine_id` (unique constraint via index)

**Relationships:**
- FK → `engines(engine_id)`

---

#### `transmission_specs` Table
**Purpose:** Transmission subsystem specifications (fluid type, capacity).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `transmission_id` | id("transmissions") | UNIQUE (via index) | FK to transmission |
| `transmission_fluid_type` | string | Optional | Fluid specification |
| `transmission_fluid_capacity_qts` | float64 | Optional | Quarts |
| `maintenance_interval` | string | Optional | Maintenance schedule |
| `created_at` | float64 | Required | Unix ms timestamp |

**Indexes:**
- `by_transmission` on `transmission_id` (unique constraint via index)

**Relationships:**
- FK → `transmissions(transmission_id)`

---

#### `trim_specs` Table
**Purpose:** Trim-level specifications (tires, lug nuts, parking brake).

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `trim_id` | id("trims") | UNIQUE (via index) | FK to trim |
| `tire_size_front` | string | Optional | E.g., "205/55R16" |
| `tire_size_rear` | string | Optional, nullable | Rear tire size |
| `recommended_tire_pressure_front_psi` | float64 | Optional | PSI |
| `recommended_tire_pressure_rear_psi` | float64 | Optional | PSI |
| `lug_nut_torque_ft_lbs` | float64 | Optional | Torque spec |
| `parking_brake_type` | string | Optional | "drum" \| "disc" |
| `created_at` | float64 | Required | Unix ms timestamp |

**Indexes:**
- `by_trim` on `trim_id` (unique constraint via index)

**Relationships:**
- FK → `trims(trim_id)`

---

### 4. Fitment Mapping Tables (Variant → Part)

**Concept:** These tables normalize the relationship between vehicle variants (engines, transmissions, trims) and OEM parts. Each record specifies:
- Which part (via `part_id` → `oem_parts`)
- What role it plays (validated in code)
- What variant it fits (engine_id, transmission_id, or trim_id)

#### `engine_part_fitments` Table
**Purpose:** Maps OEM parts to specific engines with role/quantity context.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `engine_id` | id("engines") | Required | FK to engine |
| `part_id` | id("oem_parts") | Required | FK to OEM part |
| `role` | string | Required | Validated in code; e.g., "oil_filter", "spark_plug", "serpentine_belt" |
| `quantity` | float64 | Optional | How many units needed |
| `spark_plug_gap_mm` | float64 | Optional | Spark plug gap if applicable |
| `notes` | string | Optional | Additional fitment notes |
| `created_at` | float64 | Required | Unix ms timestamp |

**Indexes:**
- `by_engine` on `engine_id`
- `by_engine_role` on `(engine_id, role)` – treated as unique in code
- `by_part` on `part_id`

**Relationships:**
- FK → `engines(engine_id)`
- FK → `oem_parts(part_id)`

**Valid Roles (examples, validated in application code):**
- `oil_filter`
- `spark_plug`
- `serpentine_belt`
- `engine_air_filter`
- `cabin_air_filter`
- `oil_drain_plug_gasket`
- `front_brake_pad`
- `rear_brake_pad`

---

#### `transmission_part_fitments` Table
**Purpose:** Maps OEM parts to specific transmissions with role/quantity context.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `transmission_id` | id("transmissions") | Required | FK to transmission |
| `part_id` | id("oem_parts") | Required | FK to OEM part |
| `role` | string | Required | Validated in code; e.g., "transmission_filter", "pan_gasket" |
| `quantity` | float64 | Optional | How many units needed |
| `notes` | string | Optional | Additional fitment notes |
| `created_at` | float64 | Required | Unix ms timestamp |

**Indexes:**
- `by_transmission` on `transmission_id`
- `by_transmission_role` on `(transmission_id, role)` – treated as unique in code
- `by_part` on `part_id`

**Relationships:**
- FK → `transmissions(transmission_id)`
- FK → `oem_parts(part_id)`

**Valid Roles (examples):**
- `transmission_filter`
- `transmission_pan_gasket`
- `transmission_dipstick`

---

#### `trim_part_fitments` Table
**Purpose:** Maps OEM parts to specific trims with role/quantity context.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `trim_id` | id("trims") | Required | FK to trim |
| `part_id` | id("oem_parts") | Required | FK to OEM part |
| `role` | string | Required | Validated in code; e.g., "battery", "wiper_blade_driver" |
| `quantity` | float64 | Optional | How many units needed |
| `wiper_size_in` | float64 | Optional | Wiper blade size in inches |
| `notes` | string | Optional | Additional fitment notes |
| `created_at` | float64 | Required | Unix ms timestamp |

**Indexes:**
- `by_trim` on `trim_id`
- `by_trim_role` on `(trim_id, role)` – treated as unique in code
- `by_part` on `part_id`

**Relationships:**
- FK → `trims(trim_id)`
- FK → `oem_parts(part_id)`

**Valid Roles (examples):**
- `battery`
- `wiper_blade_driver`
- `wiper_blade_passenger`
- `wiper_blade_rear`
- `front_brake_rotor`
- `rear_brake_rotor`
- `front_brake_pad`
- `rear_brake_pad`

---

## UPDATED TABLES

### `vehicles` Table
**Changes:** Added two new optional foreign key fields.

| Field | Type | Change | Notes |
|-------|------|--------|-------|
| `vin` | string | Unchanged | Canonical unique identifier |
| `trim_id` | id("trims") | Unchanged | Optional trim reference |
| `engine_id` | id("engines") | Unchanged | Optional engine reference |
| **`transmission_id`** | id("transmissions") | **NEW** | Optional chosen transmission variant |
| **`chassis_id`** | id("chassis_variants") | **NEW** | Optional chosen chassis variant |
| `year` | float64 | Unchanged | Optional model year |
| `metadata` | object | Unchanged | Flexible additional data |
| `created_at` | float64 | Unchanged | Unix ms timestamp |
| `updated_at` | float64 | Unchanged | Unix ms timestamp |

**New Indexes:**
- `by_transmission` on `transmission_id`
- `by_chassis` on `chassis_id`

**Existing Indexes (unchanged):**
- `by_vin` on `vin`
- `by_engine_id` on `engine_id`
- `by_trim_id` on `trim_id`

---

## DEPRECATED TABLES

### `vehicle_specs` Table
**Status:** ⚠️ DEPRECATED

This table remains in the schema for **backward compatibility only**. New code should NOT use this table.

**Reason for deprecation:** Specs have been split into subsystem-specific tables:
- Engine specs → `engine_specs`
- Transmission specs → `transmission_specs`
- Trim specs → `trim_specs`

And parts have been normalized into:
- `oem_parts` (master catalog)
- Fitment tables (`engine_part_fitments`, `transmission_part_fitments`, `trim_part_fitments`)

**Migration Path:**
1. Extract engine oil/coolant specs → `engine_specs`
2. Extract brake fluid spec → `engine_specs` or create in fitment if part-based
3. Extract parking brake type → `trim_specs`
4. Extract tire data → `trim_specs`
5. Extract part numbers → `oem_parts` + fitment tables

---

## QUERY PATTERNS & USAGE

### Finding Parts for a Vehicle

**Scenario:** User wants to know what parts fit their vehicle for an oil change.

```
1. Get vehicles record by VIN
2. Extract engine_id, trim_id, transmission_id, chassis_id
3. Query engine_part_fitments by (engine_id, "oil_filter")
4. Get the part_id
5. Look up part details in oem_parts
```

### Finding Specs for a Vehicle Subsystem

**Scenario:** User wants to know the oil capacity for their engine.

```
1. Get vehicles record by VIN
2. Extract engine_id
3. Query engine_specs by engine_id (UNIQUE index)
4. Return oil_capacity_qts
```

### Finding All Transmissions for a Trim

**Scenario:** A trim year might have automatic AND manual options.

```
1. Get trim_id
2. Query transmissions by trim_id
3. Get array of transmission_id options
4. For each transmission, optionally get transmission_specs
```

### Finding Which Trims Use a Specific Part

**Scenario:** "Which trim years use this battery?"

```
1. Query trim_part_fitments by part_id
2. Get array of trim_id values
3. Join with trims table for details
```

---

## INDEX STRATEGY

### Why Composite Indexes?

**Fitment Table Composite Indexes** (e.g., `by_engine_role` on `(engine_id, role)`):
- Allows efficient lookup of a specific fitment for a vehicle + role combo
- Enforced uniqueness via application code (Convex doesn't support unique composite indexes)
- Efficient range queries like "all fitments for engine_id"

### Uniqueness Enforcement

Since Convex doesn't support composite unique constraints, enforce via:
1. **Application code:** When creating fitments, check `(engine_id, role)` uniqueness before insert
2. **Queries:** Use `by_engine_role` index for fast lookups before upserts

---

## Data Integrity Notes

1. **No Cascading Deletes:** Convex doesn't support cascade deletes. Handle manually:
   - Deleting an `oem_parts` record should trigger cleanup of fitment records
   - Deleting a `transmission` should trigger cleanup of transmission specs and fitments

2. **Optional References:** All new references in `vehicles` are optional to support:
   - Legacy vehicles without transmission/chassis specified
   - Gradual migration from old specs to new architecture

3. **Spec Record Uniqueness:** Use application code to enforce:
   - One `engine_specs` per engine
   - One `transmission_specs` per transmission
   - One `trim_specs` per trim

---

## Migration Considerations

### For Existing Data

1. **Vehicles without transmission/chassis:**
   - Set `transmission_id` and `chassis_id` to null initially
   - Populate via migration script or manual review queue

2. **Existing vehicle_specs data:**
   - Create `engine_specs` records from oil/coolant data
   - Create `trim_specs` records from tire/brake data
   - Create `oem_parts` records from extracted part numbers
   - Create fitment records linking parts to variants

3. **Part Numbers:**
   - Normalize duplicates in new `oem_parts` table
   - Deduplicate before creating fitments

---

## TypeScript Type Hints

When writing queries, reference these tables:

```typescript
// OEM parts
id("oem_parts")

// Variants
id("transmissions")
id("chassis_variants")

// Specs
id("engine_specs")
id("transmission_specs")
id("trim_specs")

// Fitments
id("engine_part_fitments")
id("transmission_part_fitments")
id("trim_part_fitments")
```

---

## Summary Table: New Table Count

| Category | Tables | Total |
|----------|--------|-------|
| OEM Parts | `oem_parts` | 1 |
| Variants | `transmissions`, `chassis_variants` | 2 |
| Specs | `engine_specs`, `transmission_specs`, `trim_specs` | 3 |
| Fitments | `engine_part_fitments`, `transmission_part_fitments`, `trim_part_fitments` | 3 |
| **Total New** | | **9** |
| Updated | `vehicles` (2 new fields) | 1 |
| Deprecated | `vehicle_specs` (marked, not deleted) | 1 |

---

## Files Modified

- [convex/schema.ts](convex/schema.ts) – Schema definition with all new tables and updated `vehicles` table

**Status:** ✅ Schema validation passed. No TypeScript errors.
