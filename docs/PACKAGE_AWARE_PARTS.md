# Package-Aware Parts & Owner-Specific Vehicle Specs

**Status:** Design — pre-implementation
**Author:** Waleed
**Date:** 2026-04-25
**Scope:** v3 enrichment pipeline + booking-time parts resolution
**Replaces:** Previous "many vehicle_configs per real-world vehicle" approach

---

## Problem statement

Three issues with how the v3 enrichment pipeline currently handles parts.

**Issue 1 — Some services need more than one part number per vehicle.**
The clearest example is brake pads: a single brake-pad-replacement job needs *two* OEM part numbers, one for the front axle and one for the rear. Today the pipeline does cover this for brake pads and rotors (separate `front_brake_pad_oem` / `rear_brake_pad_oem` fields, written to `part_fitments` with `position: "front" | "rear"`), but the same pattern isn't applied consistently. Wiper blades, in particular, are stored as a single `wiper_blade_set_oem` field with no front/rear split, even though front and rear wipers are different parts.

**Issue 2 — Some parts depend on packages, not just trim.**
The same trim of the same model can ship with very different parts depending on optional packages. A 2024 BMW M340i without M Performance brakes uses a different rotor and pad than the same M340i with the M Performance Brake Package. Today the pipeline produces one set of part numbers per vehicle config and has no concept of packages at all — so for any vehicle with package-dependent parts, we're either guessing or wrong.

**Issue 3 — We've been creating too many vehicle_configs.**
The original approach was to fork the dictionary every time real-world vehicles diverged in their installed parts. That doesn't scale and isn't how the data naturally lives. The dictionary should describe *what's possible* for a given year/make/model/trim/engine; the per-car reality should live separately, attached to the owner record.

---

## Current state (with line references)

### Schema (`convex/schema.ts`)
- **`vehicle_configs`** (line 186) — the dictionary keyed by `config_key = {year}_{make}_{model}_{trim}_{engineCode}`. No `packages` field.
- **`part_fitments`** (line 323) — already has a `position: v.optional(v.string())` field. One service can have multiple fitment rows per `vehicle_config_id`. Does *not* have a package_code field.
- **`oem_parts`** (line 300) — one row per part number.
- **`vehicle_owners`** (line 642) — 47 fields, all lifecycle data (ownership history, mileage, smartcar, segments, modes). No hardware-spec fields.
- **`vehicle_driving_profiles`** (line 800) — onboarding-derived driving habits. Not hardware.
- **`vehicle_service_states`** (line 820) — per-service urgency state. Not hardware.

### v3 pipeline (`convex/vehicleEnrichment/v3pipeline.ts`)
- **VDB decode** at line 982: `await advancedVinDecode(vehicleDoc.vin)` returns the full VDB payload.
- **Field extraction** at line 983: `extractVDBFields(vdbRaw)` reads engine, tires, brakes, electrical — but only `data.standard_options` is touched (line 288 of `lib/vehicleDatabases.ts`), and only for the engine description string. `optional_options`, `installed_equipment`, and `trim_packages` fields are ignored.
- **Part field map** at lines 433–455 (`PART_FIELD_MAP`): defines how each Claude-extracted part field maps to (name, category, subcategory, serviceSlug, position). Brake pads and rotors are split front/rear. Wipers are not.
- **Part write** at line 714: `upsertPartAndFitment` writes to `oem_parts` + `part_fitments` with `position` set from the map.

### What's actually working today
- ✅ Multiple part numbers per service for brake pads and rotors (front + rear via `position`).
- ✅ Front/rear tire sizes (via `trim_specs.tire_options[]`).
- ❌ Front/rear wipers (single `wiper_blade_set_oem` field, no split).
- ❌ Any awareness of packages at any layer.
- ❌ Any place to record "this specific car has the M Performance Brake Package."

---

## The three-table model

We need three changes, all additive — no destructive migrations.

### 1. Extend `vehicle_configs` with `packages_available`

The dictionary entry stores the list of packages that *exist for this trim* and that *would affect at least one of the 23 services* if the vehicle had them. This is detection, not confirmation. We don't try to figure out whether *this specific VIN* has the package; we record that the question exists.

```ts
// schema.ts — add to vehicle_configs
packages_available: v.optional(
  v.array(
    v.object({
      code: v.string(),                       // "m_performance"
      label: v.string(),                      // "M Performance Brake Package"
      services_affected: v.array(v.string()), // ["brake_pad_replacement", "brake_rotor_replacement"]
      detected_from: v.string(),              // "vdb_optional_options" | "claude_inference" | "rules_table"
      confidence: v.optional(v.number()),
    })
  )
),
```

If a 2024 M340i ships with three theoretically-orderable packages that touch the 23 services (M Performance Brakes, Track Handling, Cold Weather), all three end up in `packages_available`. The dictionary doesn't know whether *this car* has them — only that we'll need to ask.

### 2. Extend `part_fitments` with `package_code`

Every package variant of a part gets its own fitment row. `package_code: null` (or absent) means "this is the default/base part — applies when no package overrides it."

```ts
// schema.ts — add to part_fitments
package_code: v.optional(v.string()),  // null/undefined = base/default fitment
```

Concrete example for brake_pad_replacement on a 2024 M340i with M Performance Brakes available:

```
{ vehicle_config: M340i_2024, service: brake_pad_replacement, position: front, package: null,            part: BMW_BASE_FRONT_PAD }
{ vehicle_config: M340i_2024, service: brake_pad_replacement, position: rear,  package: null,            part: BMW_BASE_REAR_PAD  }
{ vehicle_config: M340i_2024, service: brake_pad_replacement, position: front, package: "m_performance", part: BMW_MP_FRONT_PAD   }
{ vehicle_config: M340i_2024, service: brake_pad_replacement, position: rear,  package: "m_performance", part: BMW_MP_REAR_PAD    }
```

Index update: extend `by_config_service` to include `package_code` for fast lookup.

### 3. New table `vehicle_owner_specs`

One row per `vehicle_owner_id`. Stores concrete *facts about this car* — once we ask the user, we store the answer and never ask again.

```ts
// schema.ts — new table
vehicle_owner_specs: defineTable({
  vehicle_owner_id: v.id("vehicle_owners"),

  // Package answers — accumulated over time as user requests services
  confirmed_packages: v.optional(v.array(v.string())),  // ["m_performance"]
  denied_packages: v.optional(v.array(v.string())),     // ["track_handling"]
  // pending = packages_available − confirmed − denied (computed, not stored)

  // Tire setup — what's actually on the car right now
  tire_setup: v.optional(
    v.object({
      front: v.optional(v.object({
        brand: v.optional(v.string()),
        model: v.optional(v.string()),
        size: v.optional(v.string()),
        confirmed_at: v.optional(v.number()),
        source: v.optional(v.string()),  // "user" | "scan" | "inferred_from_oem"
      })),
      rear: v.optional(v.object({
        brand: v.optional(v.string()),
        model: v.optional(v.string()),
        size: v.optional(v.string()),
        confirmed_at: v.optional(v.number()),
        source: v.optional(v.string()),
      })),
    })
  ),

  // Aftermarket / non-package modifications
  modifications: v.optional(
    v.array(
      v.object({
        type: v.string(),           // "exhaust" | "intake" | "suspension" | etc.
        brand: v.optional(v.string()),
        note: v.optional(v.string()),
        added_at: v.optional(v.number()),
      })
    )
  ),

  last_updated_at: v.optional(v.number()),
  created_at: v.optional(v.number()),
})
  .index("by_vehicle_owner", ["vehicle_owner_id"]),
```

**Semantics — the user's clarification, captured.** This is *not* a per-user "override" of dictionary defaults. It's where we record the actual hardware on this car. Once the user says "yes, I have M Performance brakes" or "no, I don't," that fact lives forever (denied = permanent — see decisions below). Asking again is a UX failure.

---

## Booking-time lookup

The whole point of the design: when a user requests a service, we resolve which exact part numbers apply to *their* car.

```ts
async function getPartsForService(serviceSlug: string, vehicleOwnerId: Id<"vehicle_owners">) {
  const owner       = await get(vehicleOwnerId);
  const ownerSpecs  = await getOwnerSpecs(vehicleOwnerId);  // may not exist yet
  const config      = await getVehicleConfig(owner.vehicle_config_id);

  const confirmed = ownerSpecs?.confirmed_packages ?? [];
  const denied    = ownerSpecs?.denied_packages ?? [];

  // 1. What unanswered package questions block pricing this service?
  const blockingQuestions = (config.packages_available ?? [])
    .filter(p => p.services_affected.includes(serviceSlug))
    .filter(p => !confirmed.includes(p.code))
    .filter(p => !denied.includes(p.code));

  if (blockingQuestions.length > 0) {
    return { needsUserInput: blockingQuestions };
    // UI renders the questions; answers update vehicle_owner_specs;
    // booking flow resumes.
  }

  // 2. All package questions for this service are resolved. Pull fitments.
  const fitments = await getFitmentsByConfigAndService(config._id, serviceSlug);

  return fitments.filter(f =>
    f.package_code == null || confirmed.includes(f.package_code)
  );
}
```

**Key behavior:** the database alone tells the booking flow when the user needs to be asked. There's no out-of-band "have we onboarded this user for packages yet?" check — `packages_available − confirmed − denied = pending`, computed on the fly per service.

---

## Pipeline changes

### `convex/lib/vehicleDatabases.ts` — new helper

Add a new exported function:

```ts
export interface DetectedPackage {
  code: string;
  label: string;
  services_affected: string[];
  detected_from: "vdb_optional_options" | "vdb_standard_options" | "claude_inference" | "rules_table";
  confidence: number;
}

export function assessAvailablePackages(args: {
  vdbRaw: any;
  make: string;
  model: string;
  trim: string;
  year: number;
}): DetectedPackage[];
```

Implementation:
1. Pull `vdbRaw.optional_options`, `vdbRaw.standard_options`, `vdbRaw.installed_equipment`, `vdbRaw.trim_packages` (whichever fields the real API returns — confirm against a live sample before shipping).
2. Pattern-match against a per-make rules table (curated, lives in the same file or a sibling `lib/packageRules.ts`). Initial coverage:
   - **BMW**: M Sport, M Performance, M Performance Brakes, Track Handling
   - **Mercedes**: AMG Line, AMG Performance, AMG Track Pace
   - **Audi**: S line, RS, Performance, Black Optic
   - **Porsche**: PCCB, Sport Chrono, Sport Exhaust
   - **Generic / cross-make**: Tow Package, Cold Weather Package, HD Battery, Sport Tuned Suspension, Off-Road Package
3. Each rule declares `services_affected`. **Filter out any rule whose `services_affected` doesn't intersect the 23 services.** If a package has no impact on what we sell, we don't store it.
4. Return the filtered list with confidence scores. VDB explicit hits = 0.95; Claude inference (e.g., trim name "M340i" implies M Sport) = 0.7; rules-only inference = 0.6.

### `convex/vehicleEnrichment/v3pipeline.ts` — wire into v3

Insert at line 984, immediately after `extractVDBFields`:

```ts
const detectedPackages = vdbRaw 
  ? assessAvailablePackages({
      vdbRaw,
      make: args.make,
      model: args.model,
      trim: args.trim,
      year: args.year,
    })
  : [];
```

Pass `detectedPackages` through to:
1. **`upsertVehicleConfig`** — write `packages_available` field on the dictionary entry.
2. **Batch 1 prompt** — append a section: *"This vehicle's trim supports the following optional packages that affect the parts catalog. For each one, return the package-specific OEM part numbers if they differ from the base trim. Use null where the package uses the same parts as the base trim."* Then list each package with its `services_affected`.
3. **Batch 1 response parser** — accept package-specific part numbers under `packages.[code].oem_parts`. Each package-specific part flows through the same `upsertPartAndFitment` path with `package_code` set.

The `PART_FIELD_MAP` doesn't need to change for packages — package-specific entries just stamp `package_code` on the fitment row, using the same `position`/`subcategory`/`serviceSlug` semantics.

---

## Wiper blade fix (Issue 1 leftover gap)

Per Waleed's clarification: front wipers ship as a set (driver + passenger as one part), rear is its own part. So we go from one wiper field to two, not three.

**`PART_FIELD_MAP` change in `v3pipeline.ts:452`:**

```ts
// Before:
wiper_blade_set_oem: { name: "Wiper Blade Set", category: "wiper", subcategory: "wiper_blade_set", serviceSlug: null },

// After:
wiper_blade_set_oem: {
  name: "Wiper Blade Set (Front)",
  category: "wiper",
  subcategory: "wiper_blade_front_set",
  serviceSlug: "wiper_blade_replacement",
  position: "front",
},
wiper_blade_rear_oem: {
  name: "Wiper Blade (Rear)",
  category: "wiper",
  subcategory: "wiper_blade_rear",
  serviceSlug: "wiper_blade_replacement",
  position: "rear",
},
```

**Prompt change** (`convex/vehicleEnrichment/prompts/batch1Prompt.ts`): replace the single `wiper_blade_set_oem` request with two — `wiper_blade_set_oem` (front pair) and `wiper_blade_rear_oem`. If the vehicle has no rear wiper (chassis_specs.has_rear_wiper === false), Claude returns null for the rear field and we don't write a fitment.

**Field key list** (`v3pipeline.ts:122`): add `wiper_blade_rear_oem` to the array.

No schema migration needed — `part_fitments.position` already supports the front/rear distinction.

---

## Concrete walkthrough — 2024 BMW M340i

**Step 1 — VIN decode.** v3 pipeline calls `advancedVinDecode(VIN)` → returns VDB payload. New step calls `assessAvailablePackages(payload, ...)` and matches:
- `optional_options` includes "M Performance Brake Package" → rule matches → `code: "m_performance"`, `services_affected: ["brake_pad_replacement", "brake_rotor_replacement"]`, `detected_from: "vdb_optional_options"`, `confidence: 0.95`.
- `optional_options` includes "Track Handling Package" → rule matches → `code: "track_handling"`, `services_affected: ["brake_pad_replacement", "brake_rotor_replacement", "tire_replacement"]`, confidence 0.95.

**Step 2 — Dictionary write.** `vehicle_configs` row for `2024_bmw_m340i_3.0_b58` gets `packages_available: [{code: "m_performance", ...}, {code: "track_handling", ...}]`.

**Step 3 — Batch 1 prompt.** Claude is asked for base parts AND, for each package, the package-specific parts. Returns:
```json
{
  "oem_parts": { "front_brake_pad_oem": "34_BASE_FRONT_PAD", "rear_brake_pad_oem": "34_BASE_REAR_PAD", ... },
  "packages": {
    "m_performance": {
      "oem_parts": { "front_brake_pad_oem": "34_MP_FRONT_PAD", "rear_brake_pad_oem": "34_MP_REAR_PAD" }
    },
    "track_handling": {
      "oem_parts": { "front_brake_pad_oem": null }  // shares M Performance pad
    }
  }
}
```

**Step 4 — Fitment write.** Six rows in `part_fitments` for brake_pad_replacement on this config (2 base + 2 m_performance + null entries skipped).

**Step 5 — User adds the car.** A `vehicle_owners` row is created. No `vehicle_owner_specs` row yet — that's lazy. `confirmed_packages = []`, `denied_packages = []` by default.

**Step 6 — User requests Brake Pad Replacement.** `getPartsForService("brake_pad_replacement", ownerId)` runs. Computes `pending = ["m_performance", "track_handling"]`. Returns `{ needsUserInput: [...] }`.

**Step 7 — UI asks.** "Does your M340i have the M Performance Brake Package?" User says yes. "Does it have the Track Handling Package?" User says no. Both answers persist on `vehicle_owner_specs`: `confirmed_packages: ["m_performance"]`, `denied_packages: ["track_handling"]`.

**Step 8 — Resolution.** Booking flow re-runs the lookup. `pending = []`. Pulls fitments, filters: keep `package_code == null` (none here, since M Performance overrides) OR `package_code in ["m_performance"]`. Returns the M Performance front + rear pad part numbers. Booking is priced correctly.

**Step 9 — Future requests.** Same user requests Brake Rotor Replacement six months later. `getPartsForService("brake_rotor_replacement", ownerId)` runs. Both relevant packages are already in `confirmed_packages` / `denied_packages`. Zero questions. Returns the right rotor part numbers immediately.

---

## Decisions made

These are the choices we landed on during the design conversation. Capturing them so future-us doesn't re-litigate.

- **Detection threshold.** We don't try to confirm whether a specific VIN has a package. We flag any package available to this trim that affects 1+ of the 23 services, and ask the user when relevant.
- **Denied packages are permanent.** If the user says no, the package code goes in `denied_packages` forever. No re-asking on ownership change, after major service, or otherwise.
- **Mutual exclusivity is not modeled.** If two packages can't co-exist (e.g., M Sport vs. M Performance), we still ask each as an independent yes/no. Simpler now; we can introduce `code_group` mutual-exclusion logic if real usage shows confusion.
- **No backfill.** Existing `vehicle_configs` rows that were enriched before this change keep `packages_available: undefined`. Only newly-enriched configs go through `assessAvailablePackages`. We can add a one-shot backfill later if needed.
- **Same Claude batches handle package parts.** No separate batch run, no FireCrawl Tier-2 detour. We add a new section to Batch 1's prompt and a new branch in the response parser.
- **Owner specs are facts, not overrides.** `vehicle_owner_specs` records what the car actually has. It doesn't override defaults — it resolves which package-tagged fitments apply.
- **Wiper split is two fields, not three.** Front pair as one part (sold as a set), rear as a second part.

---

## What this design doesn't solve

Calling these out so we don't pretend they're addressed.

- **Cross-shop part inventory.** We resolve which OEM part *should* go on the car. We don't yet model whether a particular shop stocks it, or what aftermarket equivalents they carry.
- **Mid-life modifications without an owner answer.** If the car has aftermarket Borla exhaust the user never told us about, we'll book the OEM exhaust part. The `modifications` field exists to fix this once the user volunteers the info, but there's no auto-detection.
- **Multi-VIN packages within one user.** If a user owns two cars with M Performance Brakes, they'll be asked once per car. That's correct — they could legitimately have it on one and not the other — but worth noting.
- **Package detection failure mode.** If `assessAvailablePackages` misses a real package (rules table incomplete), we'll quietly book the base parts. Mechanic verification (Tier 3) is the eventual catch — it'll surface variance and we can update the rules table.

---

## Implementation order (when we move to code)

1. **Schema diff** — add `packages_available` to `vehicle_configs`, `package_code` to `part_fitments`, create `vehicle_owner_specs`. Run `npx convex dev` to validate.
2. **`assessAvailablePackages` helper** — write the function and a small initial rules table (BMW + Mercedes only) in `lib/vehicleDatabases.ts`.
3. **Pipeline wiring** — call it after `extractVDBFields` in `v3pipeline.ts`, write to `packages_available`.
4. **Batch 1 prompt + parser** — extend the prompt to ask for package-specific parts, extend the parser to write `package_code` on fitments.
5. **Wiper field split** — add `wiper_blade_rear_oem`, update `PART_FIELD_MAP`, update the prompt.
6. **Booking-time resolver** — implement `getPartsForService` in a new `convex/lib/serviceParts.ts` (or extend `bookings.ts`), wire into the booking flow's pricing step.
7. **Tests** — at minimum, `scripts/test-pipeline` should cover one BMW with M Performance and one Honda Civic with no relevant packages.
8. **Expand rules table** — add Audi, Porsche, generic packages.
