# Services-Slug Drift — Remediation Plan

> **Status:** Surfaced 2026-05-11 during Oto AI tool-layer reconciliation. **Still parked as of v0.9 (2026-05-14).** The Oto AI work through v0.9 has not touched any of the listed drift sites — those failures still latent in `convex/bookings.ts`, `maintenance_pipeline.ts`, `job_actuals.ts`, `packageRules.ts`, and the stale seed files. Picked up at a dedicated cleanup pass.
> **Owner-decision needed before any of this is done** — the fixes have cross-feature blast radius and at least one of them (`seed.ts`) is potentially destructive.

---

## TL;DR

Production Convex has 23 services with **snake_case** slugs (`oil_change`, `brake_pad_replacement`, `filter_replacement`, etc.) seeded by `convex/seeds/seedServices.ts`. Several runtime files reference an old **kebab-case** taxonomy (`oil-change`, `brake-pad-replacement`, `wiper-blade-replacement`, etc.) that doesn't exist in production. Those lookups currently fail silently.

Surface area:

| File | Type | Severity | Failure mode |
|---|---|---|---|
| `convex/bookings.ts` | Live runtime | **High** | Pre-onboarding maintenance-record creation is a no-op |
| `convex/maintenance_pipeline.ts` | Live runtime | **High** | Anchor-date interval calculation misses every modern slug |
| `convex/job_actuals.ts` | Live runtime | **Medium** | Oil-Filter parts suggestion never fires for completed oil changes |
| `convex/lib/packageRules.ts` | Live runtime | **High** | All 23 package-detection rules reference non-existent slugs |
| `convex/seed.ts` | Dev/demo seed | **Critical if run** | Would insert parallel kebab-case services, corrupting production catalog |
| `convex/seed_services.ts` | Stale seed (root) | Latent | Same blast radius as `seed.ts` if ever invoked |
| `convex/seed_services_catalog.ts` | Stale seed (root) | Latent | Same blast radius |
| `components/home/MoreServicesSection.tsx` | UI labels only | **Low** | Cosmetic — IDs aren't used for DB lookup |

**The root cause is the same in every case:** at some point the canonical slug format flipped from kebab to snake, the live seed (`convex/seeds/seedServices.ts`) was updated, but the call sites and adjacent seeds weren't. The new `services` table was repopulated; the old code kept comparing against ghost slugs.

---

## Production source of truth

- **23 services**, snake_case, kept in the Convex `services` table.
- **7 categories**: `Diagnostics`, `Compliance`, `Routine Maintenance`, `Tires`, `Brakes`, `Battery`, `Fluids`.
- **Live seed:** `convex/seeds/seedServices.ts` (`internalMutation seedServices`). Matches the production CSV byte-for-byte on the 23 slugs.
- **No `is_active` flag.** All 23 are assumed live.

Canonical slug list:

```
diagnostic_scan, pre_purchase_inspection, check_engine_light,
state_inspection, emissions_test,
oil_change, filter_replacement, spark_plugs, timing_belt,
coolant_flush, transmission_service,
tire_rotation, tire_balance, wheel_alignment, tire_replacement,
brake_pad_replacement, rotor_replacement, brake_fluid_flush,
battery_test, battery_replacement,
power_steering_flush, differential_service, fuel_system_cleaning
```

---

## File 1: `convex/bookings.ts:2108-2145` — Pre-onboarding maintenance hookup

### What's broken

`SLUG_TO_TYPE` at line 2109 maps kebab-case slugs to `maintenance_records` row types (`oil`, `brakes`, `tires`, …). Used at line 2140 to translate a booking's services into anchor-date entries in `maintenance_records` when the user completes pre-onboarding via a booking.

```ts
// CURRENT (broken — none of these slugs exist in production)
const SLUG_TO_TYPE: Record<string, string> = {
  "oil-change": "oil",
  "brake-pads": "brakes",
  "brake-rotors": "brakes",
  "tire-replacement": "tires",
  "tire-rotation": "tires",
  "tire-balance": "tires",
  "wheel-alignment": "tires",
  // ... (kebab continues)
};
```

### Blast radius

Failure is **silent**. The `SLUG_TO_TYPE[(service as any).slug]` lookup returns `undefined`; `continue` skips the row. New users who book during pre-onboarding never have anchor dates seeded into `maintenance_records`, which means the **maintenance pipeline gets no inputs**, which means `get_due_services` (when wired) returns nothing for these users.

### Fix recipe

Rename every key to production snake_case:

```ts
const SLUG_TO_TYPE: Record<string, string> = {
  oil_change: "oil",
  brake_pad_replacement: "brakes",
  rotor_replacement: "brakes",
  tire_replacement: "tires",
  tire_rotation: "tires",
  tire_balance: "tires",
  wheel_alignment: "tires",
  battery_replacement: "battery",
  battery_test: "battery",
  brake_fluid_flush: "fluids",
  coolant_flush: "fluids",
  transmission_service: "fluids",
  power_steering_flush: "fluids",
  state_inspection: "inspection",
  emissions_test: "inspection",
};
```

Also decide whether `filter_replacement`, `spark_plugs`, `timing_belt`, `differential_service`, and `fuel_system_cleaning` need a `maintenance_records` anchor type — they may not have one today, which is a separate (probably valid) decision.

### Test plan

1. Run a fresh pre-onboarding flow end-to-end as a new user with a booking that includes `oil_change`.
2. Verify a `maintenance_records` row with `type: "oil"` is created.
3. Repeat for each anchor type (`brakes`, `tires`, `battery`, `fluids`).

### Estimated effort

15 minutes for the rename, 30 minutes for the test cycle. Low risk if the test plan passes — it's a one-direction map.

---

## File 2: `convex/maintenance_pipeline.ts:518-547` — Anchor date interval calculation

### What's broken

Inverse of File 1. `TYPE_TO_SLUGS` at line 519 maps maintenance-record types back to lists of service slugs; line 533 inverts to `SLUG_TO_TYPE`; line 545 reads `SLUG_TO_TYPE[service.slug]` against the live `services.slug` column. Same kebab-vs-snake mismatch.

```ts
// CURRENT (broken)
const TYPE_TO_SLUGS: Record<string, string[]> = {
  oil: ["oil-change"],
  brakes: ["brake-pads", "brake-rotors"],
  tires: ["tire-replacement", "tire-rotation", "tire-balance", "wheel-alignment"],
  battery: ["battery-replacement", "battery-test"],
  fluids: ["brake-fluid-flush", "coolant-flush", "transmission-fluid", "power-steering-flush"],
};
```

### Blast radius

The maintenance pipeline uses this to find the most recent anchor date for each service when computing `vehicle_service_states.due_at_mileage` / `due_at_date`. Because the map produces no hits against snake_case slugs, **every service in production currently falls back to OEM-default intervals** (or "no anchor known"), regardless of whether the user has actually had the service done. This is the bigger of the two — File 1 prevents anchors from being created, File 2 prevents anchors from being read.

Also references **`transmission-fluid`** and **`power-steering-flush`**, but production calls them `transmission_service` and `power_steering_flush`. Naming drift, not just format.

### Fix recipe

```ts
const TYPE_TO_SLUGS: Record<string, string[]> = {
  oil: ["oil_change"],
  brakes: ["brake_pad_replacement", "rotor_replacement"],
  tires: ["tire_replacement", "tire_rotation", "tire_balance", "wheel_alignment"],
  battery: ["battery_replacement", "battery_test"],
  fluids: ["brake_fluid_flush", "coolant_flush", "transmission_service", "power_steering_flush"],
  // Consider adding: inspection, filter, spark, timing, differential, fuel
};
```

### Test plan

1. Pick a real user with anchor dates in `maintenance_records`.
2. Run the maintenance pipeline manually for that user's vehicle.
3. Verify `vehicle_service_states.due_at_mileage` / `due_at_date` populates from anchors, not OEM defaults.
4. Cross-check before-and-after `urgency` values — `due_soon` / `overdue` should appear where currently everything reads `ok` (the silent-fail outcome).

### Estimated effort

20 minutes for the rename. Test plan is the gnarly part — needs a real user with anchors.

---

## File 3: `convex/job_actuals.ts:132-145` — Oil-Filter parts suggestion

### What's broken

```ts
const slug = service.slug;
if (slug === "oil-change") {
  suggestedParts.push({ part_name: "Oil Filter", ... });
}
```

Branch never fires; production slug is `oil_change`.

### Blast radius

Mechanic-side feature: when a job is marked complete, the system suggests parts that were probably used. The Oil Filter suggestion never appears for oil-change jobs. Lower user impact (mechanic can still add parts manually), but the feature is dead.

### Fix recipe

```ts
if (slug === "oil_change") {
```

Check the rest of the file for other kebab branches while you're in there.

### Test plan

Complete an oil-change booking; verify Oil Filter appears in suggested parts on the job_actuals screen.

### Estimated effort

5 minutes.

---

## File 4: `convex/lib/packageRules.ts` — Package-detection rules

### What's broken

`KNOWN_SERVICE_SLUGS` at line 35 lists 23 kebab-case slugs, none of which exist in production. Every `PACKAGE_RULES` entry's `services_affected` array references kebab-case (`"brake-pad-replacement"`, `"brake-rotor-replacement"`, `"tire-replacement"`, …).

### Blast radius

`assessAvailablePackages` filters package rules by whether they affect at least one of the 23 services. Today the filter sees zero overlap with production slugs, so **every package rule is filtered out**. The package-aware-parts feature (see `docs/PACKAGE_AWARE_PARTS.md`) is currently a no-op — `vehicle_configs.packages_available` likely contains nothing from rule-driven detection, only from VDB explicit hits.

Also note: `packageRules.ts` references slugs like `"brake-rotors"` and `"transmission-fluid-service"` which don't exist in EITHER the live seed or the stale seeds — meaning even after a kebab→snake rename, several rules will point at slugs that don't exist. Needs a careful per-rule audit.

### Fix recipe

1. Update `KNOWN_SERVICE_SLUGS` to the 23 production snake_case slugs (delete the comment "from seed_services_catalog.ts" — wrong source of truth).
2. Walk each PACKAGE_RULES entry; replace slug references one-for-one:
   - `brake-pad-replacement` → `brake_pad_replacement`
   - `brake-rotor-replacement` → `rotor_replacement` (different name, not just format)
   - `tire-replacement` → `tire_replacement`
   - `tire-rotation` → `tire_rotation`
   - `tire-installation` → no production slug — drop from rules
   - `battery-replacement` → `battery_replacement`
   - `battery-test` → `battery_test`
   - `transmission-fluid-service` → `transmission_service`
   - `coolant-flush` → `coolant_flush`
3. For any slug that doesn't map (e.g. `"tire-installation"`), decide whether to drop the rule or whether the production catalog is missing a service.

### Test plan

1. Run `assessAvailablePackages` against a vehicle with a known package trim (e.g. BMW M Performance).
2. Verify `vehicle_configs.packages_available` populates with the expected rule-derived package code.
3. Cross-check before-and-after — today should be empty for rule-only detection.

### Estimated effort

1-2 hours including the per-rule audit. Highest blast radius of the four runtime files; touches the enrichment pipeline outputs.

---

## File 5: `convex/seed.ts` — General dev/demo seed

### What's broken

The `seed.ts` `seed` mutation inserts services with kebab-case slugs (`"oil-change"`, `"tire-rotation"`, `"brake-pad-replacement"`, …) at multiple call sites, then performs `services.find((s) => s.slug === "oil-change")` lookups to wire demo bookings, demo mechanics, and rewards demo data. 18 kebab-case slug references total.

### Blast radius

**Critical if run against production.** Either:
- The seed's `services` insert succeeds and a parallel set of 18 kebab-case services appears in production (corrupting `shop_services`, breaking booking foreign keys, and overlapping with the canonical 23).
- The `services.find` lookups return `undefined` and the seed throws (`"Oil Change service not found. Run seed first."`), bricking the demo seed without explanation.

Locally (fresh dev deployment) the failure is the same.

### Fix recipe

Either:

**(a) Delete `seed.ts` entirely.** Canonical seeds live in `convex/seeds/*` (`seedServices.ts`, `seedMakes.ts`, etc.). `seed.ts` predates that split and duplicates work. Recommend.

**(b) Refactor `seed.ts` to call the canonical seeds.** Replace inline service inserts with `await ctx.runMutation(internal.seeds.seedServices.seedServices, {})`. Replace each `services.find((s) => s.slug === "oil-change")` with `services.find((s) => s.slug === "oil_change")`. Then verify the demo flow still works end-to-end.

**(c) Just rename the 18 slugs to snake_case.** Lowest-effort but leaves the duplication problem (two files that both seed services) for the next pass.

### Test plan

1. Stand up a fresh dev deployment.
2. Run the chosen seed command.
3. Verify 23 services exist, all snake_case.
4. Verify demo bookings, mechanics, and rewards data populate correctly.

### Estimated effort

(a) 10 minutes (delete + adjust any references). (b) 2-3 hours. (c) 30 minutes plus risk of perpetuating the dual-seed problem.

---

## File 6 & 7: `convex/seed_services.ts` and `convex/seed_services_catalog.ts` — Stale seed roots

### What's broken

Two more seed files at the convex root, each declaring a different stale taxonomy. `seed_services.ts`: 22 services, kebab-case, 7 categories with names like `"battery"`, `"fluids"` (slugs as category names — wrong). `seed_services_catalog.ts`: 23 services, kebab-case, 5 categories (`"Routine Maintenance"`, `"Tires & Wheels"`, …).

Neither matches production.

### Blast radius

Latent. Neither is referenced by any runtime code path I could find — they're only invoked manually via `npx convex run seed_services:seedServices` or `npx convex run seed_services_catalog:seedServicesCatalog`. **If run against production, either would clobber the live `services` table and break every booking and shop_services FK.**

### Fix recipe

Delete both files. The canonical seed is `convex/seeds/seedServices.ts`. The earlier attempt to mark these `@deprecated` in a header comment was rejected — preserved here as historical reference. If the user wants to keep them around, gate them behind an explicit `if (process.env.ALLOW_LEGACY_SEED !== "true") throw new Error(...)` at the top of each mutation handler so they cannot run by accident.

### Test plan

After deletion: `grep -r "seed_services_catalog\|seedServicesCatalog\|seed_services\b" .` should return zero matches outside the `oto-ai/` docs.

### Estimated effort

10 minutes including the grep sweep.

---

## File 8: `components/home/MoreServicesSection.tsx` — UI labels

### What's broken

```tsx
{
  id: 'oil-change',
  label: 'Oil Change',
  ...
}
```

23 entries with kebab-case `id` fields, used purely as React keys / UI identifiers. The `id` isn't used for any Convex query — verified by absence of `services.find` or `service.id` references in the component.

### Blast radius

**Cosmetic only.** No DB impact. But the IDs are still wrong against production, and someone may eventually wire them to a service lookup expecting them to match `services.slug` — at which point this becomes a real bug. Worth fixing while we're here.

### Fix recipe

Rename each `id` to its production snake_case equivalent. Same as the canonical list at the top of this doc.

### Test plan

Click each "More Services" tile in the app; verify the navigation/onPress handler still works (it doesn't read `id` as a slug today, so this is paranoia).

### Estimated effort

10 minutes.

---

## Recommended order of operations

When the cleanup pass actually happens, do it in this order — each step de-risks the next.

1. **Audit `packageRules.ts`** to enumerate which kebab slugs map to which production slugs, and which are simply gone (`tire-installation`, `wiper-blade-replacement`, `tpms-sensor-calibration`, `general-diagnostic`, `brake-system-inspection`, `ny-state-inspection`). This audit is shared input for File 1, File 2, and File 4 fixes.
2. **Fix Files 1-3** (runtime maps in `bookings.ts`, `maintenance_pipeline.ts`, `job_actuals.ts`). These are the silently-failing features. Lowest blast radius.
3. **Fix File 4** (`packageRules.ts`). Bigger blast radius, depends on the audit in step 1.
4. **Delete File 6 & 7** (stale root seeds). Trivial, but do it BEFORE touching `seed.ts` so the cleanup isn't tempted to consolidate into one of the dead files.
5. **Refactor or delete File 5** (`seed.ts`). Most invasive; do last when the canonical state is solid.
6. **Rename File 8** (UI labels). Cosmetic — slot it in whenever convenient.

After the cleanup: add a CI grep check that fails any commit introducing kebab-case slugs (`/"[a-z]+(-[a-z]+)+"/` in a `slug:` or `slug ===` context against a known kebab-blacklist). Prevents recurrence.

---

## Cross-references

- `convex/seeds/seedServices.ts` — the canonical seed (do not touch)
- `convex/schema.ts:551-573` — the `services` table definition
- `docs/oto-ai/tool-inventory.md` §5 — schema gaps that touch the same slugs
- `docs/PACKAGE_AWARE_PARTS.md` — describes the feature `packageRules.ts` is supposed to power

---

*End of remediation plan. Resume Oto AI work in `docs/oto-ai/tool-inventory.md`.*
