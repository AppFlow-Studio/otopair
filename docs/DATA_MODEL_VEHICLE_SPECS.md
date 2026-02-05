# Vehicle Specs – Data Model Direction

**Purpose:** Documents the `vehicle_specs` and related schema changes to support MVP services, verified pricing, and Vehicle Health—aligned with Otopair's product vision. Defines what is in scope now vs. deferred.

**See also:** [BOOKING_INTEGRATION.md](./BOOKING_INTEGRATION.md), [REFERENCE.md](./REFERENCE.md), [convex/schema.ts](../convex/schema.ts).

---

## 1. Current Goals (In Scope)

- **Verified pricing** – Vehicle-specific OEM part numbers for job actuals and suggested parts
- **MVP service coverage** – Support all 23 MVP services from a parts-pricing perspective
- **Vehicle Health foundation** – Fluids, intervals, tire pressure for “due in X” predictions
- **Trust software** – Correct specs (brake fluid, coolant, lug torque) for safe service

## 2. Deferred (Not Aligned With Current Goals)

- **Engine specs structure changes** – No schema changes to `engine_specs` table structure
- **Transmission specs structure changes** – No schema changes to `transmission_specs` or `transmissions` tables
- **Transmission fluid / capacity / type** – Future work; not added to `vehicle_specs` or elsewhere for now

---

## 3. Schema Changes Implemented

### 3.1 `vehicle_specs` (engine-level OEM parts)

**Added fields** (all optional):

| Field                       | Description                                      | Service                     |
| --------------------------- | ------------------------------------------------ | --------------------------- |
| `oil_drain_plug_gasket_oem` | Replaced at every oil change                     | Oil Change                  |
| `front_brake_rotor_oem`     | Front brake rotor part number                    | Brake Rotor Replacement     |
| `rear_brake_rotor_oem`      | Rear brake rotor part number                     | Brake Rotor Replacement     |
| `engine_air_filter_oem`     | Engine air filter part number                    | Engine Air Filter           |
| `cabin_air_filter_oem`      | Cabin air filter part number                     | Cabin Air Filter            |
| `spark_plug_oem`            | Spark plug part number                           | Spark Plug Replacement      |
| `spark_plug_quantity`       | Number of plugs (may differ from cylinder count) | Spark Plug Replacement      |
| `spark_plug_gap_mm`         | Spark plug gap in mm                             | Spark Plug Replacement      |
| `serpentine_belt_oem`       | Serpentine belt part number                      | Serpentine Belt Replacement |

**Existing fields** (unchanged): `oil_viscocity`, `oil_capacity_qts`, `oil_filter_oem`, `front_brake_pad_oem`, `rear_brake_pad_oem`, `parking_brake_type`, `battery_group`, `battery_cca`.

### 3.2 `trim_specs` (trim-level specs)

**Added fields** (all optional):

| Field                           | Description                             | Service                 |
| ------------------------------- | --------------------------------------- | ----------------------- |
| `wiper_blade_driver_size_in`    | Driver-side wiper size in inches        | Wiper Blade Replacement |
| `wiper_blade_passenger_size_in` | Passenger-side wiper size in inches     | Wiper Blade Replacement |
| `wiper_blade_rear_size_in`      | Rear wiper size (null if no rear wiper) | Wiper Blade Replacement |

**Existing fields** (unchanged): `tire_size_front`, `tire_size_rear`, `recommended_tire_pressure_front_psi`, `recommended_tire_pressure_rear_psi`, `lug_nut_torque_ft_lbs`, `parking_brake_type`.

---

## 4. Where Other Specs Live

| Spec                                 | Table                           | Notes                                               |
| ------------------------------------ | ------------------------------- | --------------------------------------------------- |
| Oil viscosity, capacity              | `vehicle_specs`, `engine_specs` | Both tables; engine_specs has normalized types      |
| Brake fluid type                     | `engine_specs`                  | DOT 3, DOT 4, DOT 5.1                               |
| Coolant type, capacity               | `engine_specs`                  | IAT, OAT, HOAT, OEM-specific                        |
| Maintenance intervals                | `engine_specs`                  | Oil, cabin filter, engine filter, spark plugs, etc. |
| Tire size, lug torque, tire pressure | `trim_specs`                    | Tire Replacement, Tire Installation                 |
| Drivetrain type                      | `chassis_variants`              | FWD, RWD, AWD, 4WD (for Oto AI, alignment)          |
| Transmission fluid, capacity         | `transmission_specs`            | **Deferred** – structure unchanged                  |

---

## 5. job_actuals Suggested Parts

`job_actuals.getPrefillData` now supports suggested parts for:

- `oil-change` – Oil filter, synthetic oil, drain plug gasket
- `brake-pads` – Front/rear brake pads
- `engine-air-filter` – Engine air filter
- `cabin-air-filter` – Cabin air filter
- `spark-plugs` – Spark plugs (×quantity)
- `serpentine-belt` – Serpentine belt
- `brake-rotors` – Front/rear brake rotors

When these services are added to the `services` table, mechanics will get pre-filled OEM part suggestions.

---

## 6. Service Pricing (Car-Specific)

For the booking flow, service price is computed as `(shop.labor_rate × labor_hours) + parts` per service.

- **Car-specific (engine-specific):** `service_vehicle_specs` provides `labor_hours`, `parts_cost_low`, `parts_cost_high` per (engine_id, service_id). Used when the selected vehicle has `engine_id` (from Convex `vehicles`).
- **Fallback:** `services.default_labor_hours` and `service_options` (first option) parts average when no engine-specific spec exists.
- **Shop rate:** `shops.labor_rate` for per-shop pricing on the Choose Mechanic screen and footer.

**Display format:** `Oil change + x more... $80` (service names first, total price last).

---

## 7. Fitments Architecture (Parallel Path)

The schema also has a richer fitments architecture:

- `oem_parts` – Master part catalog
- `engine_part_fitments` – Maps parts to engines by role (oil_filter, engine_air_filter, etc.)
- `trim_part_fitments` – Maps parts to trims (battery, wiper_blade_driver, brake_rotor)
- `transmission_part_fitments` – Maps parts to transmissions (deferred)

`specs.getFullVehicleSpecPack` uses fitments + specs for a consolidated vehicle intelligence pack. `vehicle_specs` remains the primary source for `job_actuals` suggested parts to keep that flow simple.

---

## 8. Next Steps (When Goals Shift)

1. **AI enrichment prompt** – Update to request all new `vehicle_specs` and `trim_specs` fields
2. **Transmission fluid specs** – Add to `transmission_specs` when transmission work is in scope
3. **Interval fields** – Consider separate `_miles` and `_months` for decision-tree logic (Vehicle Health)
4. **Fitments for job_actuals** – Long-term: optionally migrate job_actuals to use fitments for suggested parts

---

**Last updated:** February 2026.
