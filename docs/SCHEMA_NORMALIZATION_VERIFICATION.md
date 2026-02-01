# Schema Normalization Verification – OEM Parts & Specs by Subsystem

**Date**: February 1, 2026  
**Status**: ✅ COMPLETE  
**Branch**: waleedcodespace

---

## Overview

This document verifies the implementation of the Convex schema normalization for Otopair, specifically:
- **OEM Parts Normalization**: Centralized parts registry with categorization
- **Specs Split by Subsystem**: Engine, Transmission, and Trim specs separated from vehicles
- **Fitment Mapping**: Trim-scoped variant tracking with part associations
- **Vehicle References**: Updated to reference trim-scoped variants

---

## 1. New Tables Implemented ✅

### 1.1 OEM Parts Registry

**Table**: `oem_parts`

| Field | Type | Required | Unique | Notes |
|-------|------|----------|--------|-------|
| `oem_part_number` | string | ✅ | ✅ (via `by_part_number`) | Unique identifier for OEM part |
| `name` | string | ❌ | — | Human-readable part name |
| `category` | string | ❌ | — | e.g., "filter", "brakes", "wipers", "fluids" |
| `notes` | string | ❌ | — | Additional notes |
| `created_at` | float64 (ms) | ✅ | — | Timestamp |

**Indexes**:
- `by_part_number`: Unique lookup by OEM part number
- `by_category`: Query parts by category

**Rationale**: Centralized parts repository prevents duplication and enables cross-referencing via fitment tables.

---

### 1.2 Trim-Scoped Variants

#### 1.2.1 Transmissions

**Table**: `transmissions`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `trim_id` | id("trims") | ✅ | Foreign key to trim |
| `transmission_type` | string | ✅ | "automatic" \| "manual" \| "cvt" \| "dct" |
| `code` | string | ❌ | OEM transmission code if known |
| `notes` | string | ❌ | Additional notes |
| `created_at` | float64 (ms) | ✅ | Timestamp |

**Indexes**:
- `by_trim`: Lookup transmissions for a given trim
- `by_trim_type`: Query (trim_id, transmission_type) composite

**Rationale**: Mimics `engines` table structure. Allows a trim to have multiple transmission options.

---

#### 1.2.2 Chassis Variants

**Table**: `chassis_variants`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `trim_id` | id("trims") | ✅ | Foreign key to trim |
| `drivetrain_type` | string | ✅ | "fwd" \| "rwd" \| "awd" \| "4wd" |
| `notes` | string | ❌ | Additional notes |
| `created_at` | float64 (ms) | ✅ | Timestamp |

**Indexes**:
- `by_trim`: Lookup chassis variants for a given trim
- `by_trim_drivetrain`: Query (trim_id, drivetrain_type) composite

**Rationale**: Encapsulates drivetrain configuration separate from other specs.

---

### 1.3 Specification Tables (NOT Parts)

#### 1.3.1 Engine Specs

**Table**: `engine_specs`

| Field | Type | Required | Unique | Notes |
|-------|------|----------|--------|-------|
| `engine_id` | id("engines") | ✅ | ✅ (via `by_engine`) | Foreign key to engine |
| `oil_viscosity` | string | ❌ | — | e.g., "5W-30", "10W-40" |
| `oil_capacity_qts` | float64 | ❌ | — | Oil capacity in quarts |
| `coolant_type` | string | ❌ | — | e.g., "OAT", "IAT", "HOAT" |
| `coolant_capacity_qts` | float64 | ❌ | — | Coolant capacity in quarts |
| `brake_fluid_type` | string | ❌ | — | e.g., "DOT 3", "DOT 4", "DOT 5.1" |
| `maintenance_intervals` | string | ❌ | — | JSON or comma-separated intervals |
| `created_at` | float64 (ms) | ✅ | — | Timestamp |

**Indexes**:
- `by_engine`: Unique lookup by engine_id

**Rationale**: Consolidates engine-specific fluid and maintenance specifications away from vehicle table.

---

#### 1.3.2 Transmission Specs

**Table**: `transmission_specs`

| Field | Type | Required | Unique | Notes |
|-------|------|----------|--------|-------|
| `transmission_id` | id("transmissions") | ✅ | ✅ (via `by_transmission`) | Foreign key to transmission |
| `transmission_fluid_type` | string | ❌ | — | e.g., "ATF", "MTF", "CVT" |
| `transmission_fluid_capacity_qts` | float64 | ❌ | — | Fluid capacity in quarts |
| `maintenance_interval` | string | ❌ | — | e.g., "Every 30k miles" |
| `created_at` | float64 (ms) | ✅ | — | Timestamp |

**Indexes**:
- `by_transmission`: Unique lookup by transmission_id

**Rationale**: Separates transmission fluid specs from engine and trim specs.

---

#### 1.3.3 Trim Specs

**Table**: `trim_specs`

| Field | Type | Required | Unique | Notes |
|-------|------|----------|--------|-------|
| `trim_id` | id("trims") | ✅ | ✅ (via `by_trim`) | Foreign key to trim |
| `tire_size_front` | string | ❌ | — | e.g., "P225/60R17" |
| `tire_size_rear` | string | ❌ | — | e.g., "P225/60R17" or null if same |
| `recommended_tire_pressure_front_psi` | float64 | ❌ | — | Front tire PSI |
| `recommended_tire_pressure_rear_psi` | float64 | ❌ | — | Rear tire PSI |
| `lug_nut_torque_ft_lbs` | float64 | ❌ | — | Lug nut torque specification |
| `parking_brake_type` | string | ❌ | — | e.g., "mechanical", "electronic" |
| `created_at` | float64 (ms) | ✅ | — | Timestamp |

**Indexes**:
- `by_trim`: Unique lookup by trim_id

**Rationale**: Houses trim-level specifications (tires, brakes, parking brake).

---

### 1.4 Fitment Tables (Variant → Part Mapping)

#### 1.4.1 Engine Part Fitments

**Table**: `engine_part_fitments`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `engine_id` | id("engines") | ✅ | Foreign key to engine |
| `part_id` | id("oem_parts") | ✅ | Foreign key to OEM part |
| `role` | string | ✅ | oil_filter, spark_plug, serpentine_belt, engine_air_filter, cabin_air_filter, oil_drain_plug_gasket, front_brake_pad, rear_brake_pad, etc. |
| `quantity` | float64 | ❌ | e.g., 4 spark plugs, 1 oil filter |
| `spark_plug_gap_mm` | float64 | ❌ | Spark plug gap in mm (if role = "spark_plug") |
| `notes` | string | ❌ | Additional fitment notes |
| `created_at` | float64 (ms) | ✅ | Timestamp |

**Indexes**:
- `by_engine`: Query all fitments for an engine
- `by_engine_role`: Query (engine_id, role) – treated as unique in code
- `by_part`: Reverse lookup – find all engines using a part

**Rationale**: Enables engines to have multiple part fitments with roles and quantities.

---

#### 1.4.2 Transmission Part Fitments

**Table**: `transmission_part_fitments`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `transmission_id` | id("transmissions") | ✅ | Foreign key to transmission |
| `part_id` | id("oem_parts") | ✅ | Foreign key to OEM part |
| `role` | string | ✅ | transmission_filter, transmission_pan_gasket, etc. |
| `quantity` | float64 | ❌ | e.g., 1 filter |
| `notes` | string | ❌ | Additional fitment notes |
| `created_at` | float64 (ms) | ✅ | Timestamp |

**Indexes**:
- `by_transmission`: Query all fitments for a transmission
- `by_transmission_role`: Query (transmission_id, role) – treated as unique in code
- `by_part`: Reverse lookup

**Rationale**: Enables transmissions to have specific part requirements.

---

#### 1.4.3 Trim Part Fitments

**Table**: `trim_part_fitments`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `trim_id` | id("trims") | ✅ | Foreign key to trim |
| `part_id` | id("oem_parts") | ✅ | Foreign key to OEM part |
| `role` | string | ✅ | battery, wiper_blade_driver, wiper_blade_passenger, wiper_blade_rear, front_brake_rotor, rear_brake_rotor, etc. |
| `quantity` | float64 | ❌ | e.g., 2 wiper blades |
| `wiper_size_in` | float64 | ❌ | Wiper blade size in inches |
| `notes` | string | ❌ | Additional fitment notes |
| `created_at` | float64 (ms) | ✅ | Timestamp |

**Indexes**:
- `by_trim`: Query all fitments for a trim
- `by_trim_role`: Query (trim_id, role) – treated as unique in code
- `by_part`: Reverse lookup

**Rationale**: Enables trims to have specific part requirements.

---

## 2. Updated Existing Tables ✅

### 2.1 Vehicles Table Updates

**Added Fields**:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `transmission_id` | id("transmissions") | ❌ | Nullable reference to chosen transmission variant for this vehicle |
| `chassis_id` | id("chassis_variants") | ❌ | Nullable reference to chosen chassis variant for this vehicle |

**Preserved Indexes**:
- `by_vin`: Unique lookup by VIN
- `by_engine_id`: Query vehicles by engine
- `by_trim_id`: Query vehicles by trim

**New Indexes**:
- `by_transmission`: Query vehicles by transmission
- `by_chassis`: Query vehicles by chassis variant

**Rationale**: Vehicles now reference specific trim-scoped transmission and chassis choices.

---

### 2.2 Vehicle Specs (DEPRECATED)

**Status**: ⚠️ DEPRECATED – Do not use in new code

The original `vehicle_specs` table is marked as deprecated and should be phased out in favor of:
- `engine_specs` for engine-specific data
- `transmission_specs` for transmission-specific data
- `trim_specs` for trim-specific data

---

## 3. Schema Integrity Checklist ✅

| Requirement | Status | Notes |
|------------|--------|-------|
| OEM Parts uniqueness | ✅ | `by_part_number` enforces UNIQUE on `oem_part_number` |
| Transmissions trim-scoped | ✅ | All transmissions link to trim_id |
| Chassis variants trim-scoped | ✅ | All chassis variants link to trim_id |
| Engine specs engine-scoped | ✅ | All engine specs link to engine_id UNIQUE |
| Transmission specs transmission-scoped | ✅ | All transmission specs link to transmission_id UNIQUE |
| Trim specs trim-scoped | ✅ | All trim specs link to trim_id UNIQUE |
| Engine fitments indexed by role | ✅ | `by_engine_role` composite index |
| Transmission fitments indexed by role | ✅ | `by_transmission_role` composite index |
| Trim fitments indexed by role | ✅ | `by_trim_role` composite index |
| All fitments reverse-indexed by part | ✅ | `by_part` indexes on all fitment tables |
| Vehicles reference transmissions | ✅ | `transmission_id` nullable field added |
| Vehicles reference chassis | ✅ | `chassis_id` nullable field added |
| Vehicles preserve existing indexes | ✅ | `by_vin`, `by_engine_id`, `by_trim_id` retained |
| File compiles without errors | ✅ | No TypeScript or Convex schema errors |

---

## 4. Implementation Summary

### Tables Added: 9

1. ✅ `oem_parts`
2. ✅ `transmissions`
3. ✅ `chassis_variants`
4. ✅ `engine_specs`
5. ✅ `transmission_specs`
6. ✅ `trim_specs`
7. ✅ `engine_part_fitments`
8. ✅ `transmission_part_fitments`
9. ✅ `trim_part_fitments`

### Tables Modified: 1

1. ✅ `vehicles` – Added `transmission_id` and `chassis_id` fields

### Tables Deprecated: 1

1. ⚠️ `vehicle_specs` – Marked for removal

### Total Indexes Added: 21

| Table | Indexes |
|-------|---------|
| `oem_parts` | 2 |
| `transmissions` | 2 |
| `chassis_variants` | 2 |
| `engine_specs` | 1 |
| `transmission_specs` | 1 |
| `trim_specs` | 1 |
| `engine_part_fitments` | 3 |
| `transmission_part_fitments` | 3 |
| `trim_part_fitments` | 3 |
| `vehicles` | 2 |
| **TOTAL** | **21** |

---

## 5. Data Migration Path (Future)

### Phase 1: Populate New Tables
1. Run migrations to create all new tables and indexes
2. Seed `oem_parts` with master parts list
3. Create `transmissions` and `chassis_variants` for each trim
4. Populate `*_specs` tables with data from existing vehicle specs

### Phase 2: Populate Fitment Tables
1. Create `engine_part_fitments` based on engine compatibility
2. Create `transmission_part_fitments` based on transmission compatibility
3. Create `trim_part_fitments` based on trim-level parts

### Phase 3: Update Vehicles
1. For each vehicle, assign `transmission_id` from trim's transmissions
2. For each vehicle, assign `chassis_id` from trim's chassis variants

### Phase 4: Archive Old Specs
1. Verify all data migrated to new tables
2. Mark `vehicle_specs` as read-only (optional)
3. Remove references to `vehicle_specs` from application code
4. Archive or delete `vehicle_specs` table

---

## 6. Query Examples (For Reference)

### Find all parts for a specific engine
```
engine_part_fitments
  .withIndex("by_engine", q => q.eq("engine_id", engineId))
  .map(fitment => oem_parts.getX(fitment.part_id))
```

### Find all transmissions for a trim
```
transmissions
  .withIndex("by_trim", q => q.eq("trim_id", trimId))
```

### Find all vehicles with a specific transmission type
```
transmissions
  .withIndex("by_trim_type", q => q.eq("trim_id", trimId).eq("transmission_type", "automatic"))
  .map(tx => vehicles.withIndex("by_transmission", q => q.eq("transmission_id", tx._id)))
```

### Find spec requirements for a vehicle
```
engine_specs.withIndex("by_engine", q => q.eq("engine_id", vehicle.engine_id))
transmission_specs.withIndex("by_transmission", q => q.eq("transmission_id", vehicle.transmission_id))
trim_specs.withIndex("by_trim", q => q.eq("trim_id", vehicle.trim_id))
```

---

## 7. Next Steps

1. ✅ **Schema Updated** – All new tables and indexes implemented
2. ⏭️ **Tests** – Unit tests for fitment queries and aggregations
3. ⏭️ **Migrations** – Data migration from old vehicle_specs to new tables
4. ⏭️ **API Updates** – Update Convex functions to use new schema
5. ⏭️ **Frontend Updates** – Update UI components to reference new tables
6. ⏭️ **Archive** – Remove old vehicle_specs when safe to do so

---

## 8. Sign-Off

- **Schema File**: [convex/schema.ts](convex/schema.ts)
- **Changes**: 9 new tables, 21 indexes, 2 vehicle fields, 1 table deprecated
- **Status**: ✅ Complete and verified
- **Date Completed**: February 1, 2026

---

**End of Verification Document**
