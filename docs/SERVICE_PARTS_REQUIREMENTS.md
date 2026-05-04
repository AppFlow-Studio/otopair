# Otopair — Service Parts Requirements

**Source:** Waleed deployment `services` table + `convex/vehicleEnrichment/v3pipeline.ts` (`PART_FIELD_MAP`, `INTERVAL_TO_SERVICE`)
**Total services:** 23 across 7 categories

---

## DIAGNOSTICS

### 1. Diagnostic Scan — `diagnostic_scan`
- **Labor:** 0.5 hr
- **Parts:** None — OBD-II code read, pure labor

### 2. Pre-Purchase Inspection — `pre_purchase_inspection`
- **Labor:** 1.75 hr
- **Parts:** None — mechanic walkaround inspection, pure labor

### 3. Check Engine Light Diagnosis — `check_engine_light`
- **Labor:** 1.0 hr
- **Parts:** None — diagnostic only, pure labor

---

## INSPECTIONS

### 4. State Inspection — `state_inspection`
- **Labor:** 0.5 hr
- **Parts:** None — paperwork + visual inspection

### 5. Emissions Test — `emissions_test`
- **Labor:** 0.3 hr
- **Parts:** None — emissions analyzer test, pure labor

---

## MAINTENANCE

### 6. Oil Change — `oil_change`
- **Labor:** 0.4 hr
- **Parts (OEM):**
  - **Oil filter** (`oil_filter`)
  - **Oil drain plug gasket / crush washer** (`drain_plug_gasket`)
- **Fluid:** Engine oil (OEM-spec viscosity, capacity from engine specs)
- **Interval source:** `oil_change_miles` / `oil_change_months`

### 7. Filter Replacement — `filter_replacement`
- **Labor:** 0.35 hr
- **Parts (OEM):**
  - **Engine air filter** (`air_filter`)
  - **Cabin air filter** (`cabin_filter`)
- **Interval source:** `air_filter_miles/months` and `cabin_filter_miles/months` (separate intervals)

### 8. Spark Plugs — `spark_plugs`
- **Labor:** 1.5 hr
- **Parts (OEM):**
  - **Spark plug** (`spark_plug`) × cylinder count
- **Interval source:** `spark_plug_miles` / `spark_plug_months`

### 9. Timing Belt — `timing_belt`
- **Labor:** 5.0 hr
- **Parts (OEM):**
  - **Timing belt** (`timing_belt`)
  - Tensioner pulley (typically bundled in timing belt kit)
  - Idler pulley(s) (typically bundled)
  - Water pump (typically replaced at the same interval)
- **Fluid:** Coolant (refill after water pump R&R)
- **Interval source:** `timing_service_miles` / `timing_service_months`
- **Applicability:** Only for engines with `timing_system = "belt"`. Chain-driven engines: status `not_applicable`.

### 10. Coolant Flush — `coolant_flush`
- **Labor:** 1.25 hr
- **Parts (OEM):**
  - **OEM coolant** (`coolant`) — manufacturer-spec antifreeze (e.g. BMW HT-12, VW G013A8J1G)
- **Interval source:** `coolant_flush_miles` / `coolant_flush_months`

### 11. Transmission Service — `transmission_service`
- **Labor:** 1.5 hr
- **Parts:**
  - Transmission filter (only on vehicles with serviceable in-pan filter)
  - Pan gasket (only on vehicles with drop-pan service)
- **Fluid:** OEM transmission fluid (vehicle-specific, e.g. ZF Lifeguard 8, Dexron VI)
- **Interval source:** `transmission_service_miles` / `transmission_service_months`
- **Applicability:** Skip for "lifetime" fluid platforms (some ZF 8HP applications) — status `not_applicable`.

---

## TIRES

### 12. Tire Rotation — `tire_rotation`
- **Labor:** 0.4 hr
- **Parts:** None — tires repositioned across the four corners

### 13. Tire Balance — `tire_balance`
- **Labor:** 0.75 hr
- **Parts:** None — adhesive wheel weights are bulk consumable, not stocked as OEM SKUs

### 14. Wheel Alignment — `wheel_alignment`
- **Labor:** 1.0 hr
- **Parts:** None — adjustment of camber/caster/toe to OEM specs

### 15. Tire Replacement — `tire_replacement`
- **Labor:** 1.25 hr
- **Parts:**
  - **Tires** × requested quantity (typically 4)
- **Source:** `tire_models` table (not `oem_parts`) — tier-driven (Elite / Select / Standard) per V2 NYC launch list
- **Tire size source:** `trim_specs.tire_options` (OEM fitment options from wheel-size API)

---

## BRAKES

### 16. Brake Pad Replacement — `brake_pad_replacement`
- **Labor:** 1.5 hr
- **Parts (OEM):**
  - **Front brake pad set** (`front_brake_pad`, position: `front`) — sold as axle set
  - **Rear brake pad set** (`rear_brake_pad`, position: `rear`) — sold as axle set
- **Quantity:** 1 axle set per axle being serviced

### 17. Rotor Replacement — `rotor_replacement`
- **Labor:** 3.0 hr
- **Parts (OEM):**
  - **Front rotors** (`front_rotor`, position: `front`) × 2 (one per side)
  - **Rear rotors** (`rear_rotor`, position: `rear`) × 2 (one per side)
- **Bundled:** Brake pads are typically replaced when rotors are replaced (see `brake_pad_replacement`)

### 18. Brake Fluid Flush — `brake_fluid_flush`
- **Labor:** 0.85 hr
- **Parts:** None
- **Fluid:** DOT-spec brake fluid (DOT 3 / DOT 4 / DOT 5.1 — vehicle-specific, from `vehicle_configs.brake_fluid_type`)
- **Interval source:** `brake_fluid_flush_miles` / `brake_fluid_flush_months`

---

## BATTERY

### 19. Battery Test — `battery_test`
- **Labor:** 0.2 hr
- **Parts:** None — load test + charging system health check, pure diagnostic

### 20. Battery Replacement — `battery_replacement`
- **Labor:** 0.5 hr
- **Parts (OEM):**
  - **Battery** (`battery`) — group size + CCA + chemistry (AGM / EFB / flooded / lithium-ion) per `trim_specs.battery_*`

---

## FLUIDS

### 21. Power Steering Flush — `power_steering_flush`
- **Labor:** 0.75 hr
- **Parts:** None
- **Fluid:** OEM-spec power steering fluid (vehicle-specific, from `vehicle_configs.ps_fluid_type`)
- **Applicability:** Only for vehicles with hydraulic PS. Electric PS: status `not_applicable`.

### 22. Differential Service — `differential_service`
- **Labor:** 1.0 hr
- **Parts:**
  - LSD friction modifier additive (only on limited-slip diffs)
- **Fluid:** OEM diff fluid (front and/or rear, from `drivetrain_configs.diff_fluid_type`) + transfer case fluid for AWD/4WD (`drivetrain_configs.tc_fluid_type`)
- **Interval source:** `diff_fluid_miles/months`, `transfer_case_fluid_miles/months`
- **Applicability:** Skip for FWD vehicles (no rear differential, no transfer case) — status `not_applicable`.

### 23. Fuel System Cleaning — `fuel_system_cleaning`
- **Labor:** 1.0 hr
- **Parts:** None as OEM SKUs — uses chemical consumables (e.g. BG 44K, Chevron Techron) plus optional intake-valve walnut blast on direct-injection engines

---

## Summary table

| # | Service | Slug | Parts category (oem_parts.subcategory) |
|---|---|---|---|
| 1 | Diagnostic Scan | `diagnostic_scan` | — |
| 2 | Pre-Purchase Inspection | `pre_purchase_inspection` | — |
| 3 | Check Engine Light | `check_engine_light` | — |
| 4 | State Inspection | `state_inspection` | — |
| 5 | Emissions Test | `emissions_test` | — |
| 6 | Oil Change | `oil_change` | `oil_filter`, `drain_plug_gasket` + engine oil |
| 7 | Filter Replacement | `filter_replacement` | `air_filter`, `cabin_filter` |
| 8 | Spark Plugs | `spark_plugs` | `spark_plug` × N |
| 9 | Timing Belt | `timing_belt` | `timing_belt` (kit) + coolant |
| 10 | Coolant Flush | `coolant_flush` | `coolant` (OEM-spec antifreeze) |
| 11 | Transmission Service | `transmission_service` | trans fluid (+ filter/gasket if serviceable) |
| 12 | Tire Rotation | `tire_rotation` | — |
| 13 | Tire Balance | `tire_balance` | — |
| 14 | Wheel Alignment | `wheel_alignment` | — |
| 15 | Tire Replacement | `tire_replacement` | tires × N (from `tire_models`) |
| 16 | Brake Pad Replacement | `brake_pad_replacement` | `front_brake_pad`, `rear_brake_pad` |
| 17 | Rotor Replacement | `rotor_replacement` | `front_rotor` × 2, `rear_rotor` × 2 |
| 18 | Brake Fluid Flush | `brake_fluid_flush` | DOT-spec brake fluid |
| 19 | Battery Test | `battery_test` | — |
| 20 | Battery Replacement | `battery_replacement` | `battery` |
| 21 | Power Steering Flush | `power_steering_flush` | OEM PS fluid |
| 22 | Differential Service | `differential_service` | diff + transfer-case fluid |
| 23 | Fuel System Cleaning | `fuel_system_cleaning` | chemical consumables (no OEM SKU) |
