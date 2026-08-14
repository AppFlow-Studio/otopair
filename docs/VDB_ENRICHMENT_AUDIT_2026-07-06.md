# Vehicle Databases (VDB) — Full Enrichment-Pipeline Audit

**Date:** 2026-07-06
**Scope:** Every place OtoPair touches the Vehicle Databases API (`api.vehicledatabases.com`) — the paid VIN-decode/spec provider referred to internally as "VDB". Positioned against the other vehicle-data sources (NHTSA, FireCrawl, Claude, RepairPal, tire scrapers).
**Method:** 7-slice parallel forensic read of the codebase, cross-checked against first-hand reads of `vehicle_pipeline.ts`, `v3pipeline.ts`, `vdbCache.ts`. Accuracy target: 99%. Every claim is anchored to `file:line`.

---

## 0. What "vehicle database" means here

"Vehicle database" = the **Vehicle Databases API** (`api.vehicledatabases.com`), a **paid, structured VIN-decode + spec provider**. It is OtoPair's *primary* decode source; **NHTSA vPIC is the free fallback** in the same domain. Client at [`convex/lib/vehicleDatabases.ts`](../convex/lib/vehicleDatabases.ts). Module doc pins its confidence at **0.90** (`vehicleDatabases.ts:8`).

VDB gives us the structured specs NHTSA doesn't: engine code, tire sizes + pressures, battery CCA, brake rotor diameters + brake tier, steering type, transmission detail, packages, maintenance schedule + labor hours, and vehicle images/paint colors.

---

## 1. Endpoints (the whole surface)

| # | Endpoint | Method | Auth (header `x-AuthKey`) | Called from | What we get |
|---|----------|--------|---------------------------|-------------|-------------|
| 1 | `/advanced-vin-decode/v2/{vin}` | GET | `VEHICLE_DATABASES_API_KEY` (server) | `vehicleDatabases.ts:38` | Full structured spec blob (`json.data`) — engine/tires/braking/electrical/steering/fuel/mpg/transmission/dimensions/options |
| 2 | `/repair-estimates/{vin}` | GET | `VEHICLE_DATABASES_API_KEY` (server) | `vehicleDatabases.ts:151` & `:297` | Maintenance schedule blocks: per-mileage service actions + labor hours. **Parts costs deliberately NOT read** (v9.7) |
| 3 | `/vehicle-images/{vin}` **and** `/vehicle-images/{year}/{make}/{model}/{trim}` | GET | **Client:** `EXPO_PUBLIC_VEHICLE_DB_API_KEY`; **Server:** `VEHICLE_DATABASES_API_KEY` | Client `utils/vehicleImage.ts:642`; Server `convex/lib/vehicle_image.ts:156` | `data.images.exterior[]` + `data.images.colors[]` (EVOX renders; colors[] filenames = paint names) |
| 4 | `/ymm-specs/options/v3/trim/{year}/{make}/{model}` | GET | `EXPO_PUBLIC_VEHICLE_DB_API_KEY` (**client only**) | `utils/vehicleImage.ts:315` | Canonical verbose trim strings (`string[]`) that the images endpoint accepts. Drives the trim picker |
| 5 | `/ymm-specs/options/v3/model/{year}/{make}` | GET | `EXPO_PUBLIC_VEHICLE_DB_API_KEY` (**client only**) | `utils/vehicleImage.ts:162` | Canonical catalog model names (`string[]`). Family-split backstop (e.g. Mercedes GLE 350/450/580) |
| 6 | `/ymm-specs/v3/{year}/{make}/{model}/{trim}` | GET | `VEHICLE_DATABASES_API_KEY` (`x-authkey` lowercase here) | **Dev-only** `convex/devOnly/vdbProbe.ts:27` | Nothing persisted — feasibility probe only |

**Endpoints 1–5 are production. Endpoint 6 is a throwaway dev probe.**

### Two API keys, one account
- **`VEHICLE_DATABASES_API_KEY`** — Convex server env. Used by decode, repair-estimates, server images.
- **`EXPO_PUBLIC_VEHICLE_DB_API_KEY`** — **inlined into the RN app bundle** (`utils/vehicleImage.ts:29`). Used for client-direct image/trim/color calls. **This is a live paid credential shipped in the app binary** (see Findings §7, F-1).
- Header casing `x-AuthKey` is **load-bearing** — the gateway has been observed to 403 on lowercased `x-authkey` (`utils/vehicleImage.ts:639-642`). The dev probe ironically uses lowercase.

---

## 2. Play-by-play by usage area

### AREA A — VIN decode & identity merge — [`convex/vehicle_pipeline.ts`](../convex/vehicle_pipeline.ts) `processVin`
This is the **first** VDB consumer, invoked when a user adds a car by VIN (the `decodeVin` action, called by `add-vehicle.tsx` and `vin-scanner.tsx`).

1. **`vehicle_pipeline.ts:102-103`** — `advancedVinDecode(vin)` → `extractVDBFields(vdbRaw)` = **SOURCE 1 (paid, primary)**.
2. **`:118-152`** — NHTSA vPIC `decodevinvaluesextended` = **SOURCE 2 (free, fallback)**.
3. **`:161-175`** — Builds the **NHTSA-only dedup key** (`nhtsa_vin_key`) *before* any VDB merge, so dedup works even when VDB is down (403).
4. **`:177-212`** — **YMMT trust gate**: VDB occasionally returns the wrong vehicle for a VIN. `trustVdbYmmt` = fuzzy make/model match + year agreement. On mismatch → **prefer NHTSA identity, keep VDB deep specs**, log a warning.
5. **`:217-278`** — The merge (see table below).
6. **`:285-318`** — Engine-code resolution ladder: **VDB code** (filtered against placeholders `STDEN/STD/BASE/…`) → NHTSA code (filtered against marketing terms `tsi/tfsi/vtec/…`) → Claude norm → web-search+Haiku → synthetic.
7. **`:358-364`** — Halo promotion (`findHaloVariant`): VDB "3 Series"/"M3 Competition" → model "M3".

**Merge authority — who wins per field** (`vehicle_pipeline.ts:217-278`):

| Field | Winner | Note |
|-------|--------|------|
| make / model / year / trim | **VDB if `trustVdbYmmt`**, else NHTSA | Identity gate |
| bodyClass | NHTSA, then VDB `body_type` | |
| doors | **VDB**, then NHTSA | |
| **cylinders** | **NHTSA (authoritative)** | VDB fills gap only; VDB historically read `engine_size` (displacement) as cylinders — documented bug. Disagreement logged (`:246-250`) |
| displacement | **VDB** | |
| fuelType | **VDB** | |
| engineConfiguration | VDB `block_type`, then NHTSA | |
| valveTrain | VDB `cam_type`, then NHTSA | |
| engineHP | **NHTSA** (`EngineHP`) | VDB hp is extracted but not used at merge |
| transStyle / transSpeeds / transDescription | **VDB** | |
| driveType | **VDB** | |
| frontTireSize / rearTireSize | **VDB only among decode sources — but NOT source of record** | Shown on the review screen at decode time, then **superseded by wheel-size.com** (`WHEEL_SIZE_API_KEY`) which writes `trim_specs.tire_options`. Never persisted from VDB |
| front/rearTirePressure | **VDB only among decode sources — but NOT source of record** | Stored pressures come from wheel-size.com + Claude batch, not VDB |
| wheelTorque | **VDB only** | |
| cca (battery) | **VDB only** | |
| steeringType | **VDB only** | |

If make/model/year end up empty → decode returns `null` (`:280-283`).

---

### AREA B — Enrichment pipeline — [`convex/vehicleEnrichment/v3pipeline.ts`](../convex/vehicleEnrichment/v3pipeline.ts)
VDB is hit **twice** per enrichment run (both VIN-keyed, decode is `VDB_CACHE`-short-circuited):

**Decode path** (`v3pipeline.ts:1304-1319`):
- `advancedVinDecode` → `extractVDBFields` → **only 3 of ~30 fields are consumed here**:
  - `brakeSystemType` → `vehicle_configs.brake_system_type` (`:1467-1471`) → **Shop Rotors booking radio pre-select**.
  - `steeringType` → `chassis_specs.steering_type` (`:1537-1543`) — **only if a chassis code resolved**, else silently dropped.
  - `cca` → `trim_specs.battery_cca` (`:1610-1622`).
  - The other ~27 fields (hp, cylinders, displacement, tires, rotor dias, mpg, transmission, engineCode, fuelType, wheelTorque…) are extracted and **thrown away in this file** — they serve other consumers. **VDB decode does NOT seed the `engines` table here.**
- `assessAvailablePackages(vdbRaw,…)` (`:1311-1319`) → `vehicle_configs.packages_available` (`:1457-1462`) **and** injected into the Batch 1A Claude prompt (`batch1Prompt.ts:92-117`) so Claude returns package-specific OEM part numbers → `part_fitments`/`oem_parts`.

**Repair path** (`v3pipeline.ts:1501-1953`):
- `fetchVDBRepairRaw(vin)` (`:1506`) → `{blocks, actions}` (raw mileage/labor blocks + unique VDB action strings).
- Action strings become a **Batch 1C Haiku request** (`:1678-1691`, model Haiku, `maxSearchUses:0`) that maps VDB action strings → the 23 OtoPair service slugs.
- In `_pollBatch1V3` (`:1891-1953`): `parseVDBMappingResponse` → `applyVDBMappingResult(blocks, map)` → derives **intervals** (≥2 distinct mileage checkpoints, min gap ≥5000 mi) + **labor hours** (summed per slug).
  - **Intervals → `service_intervals` at confidence 0.9 / `data_quality: "vdb_schedule"` — AUTHORITATIVE** (comment: "Batch 2 fallback never overwrites").
  - **Labor → `labor_times`, source `vdb_repair_estimates`, weight 0.05, tier "catalog" — near-zero, treated as verified-bad**, a tiebreaker only.
- **If Batch 1C errors, the entire VDB interval+labor write is skipped** (`:1951-1953`) — no static-map fallback at the pipeline level.

**Key asymmetry:** the *same* repair endpoint is **trusted for intervals (0.9)** and **distrusted for labor (0.05)**.

> Note: `repairpalEndpointSibling.ts` has **no** VDB usage — it only references `vehicleDatabases.ts` in a docstring as a Haiku-pattern citation.

---

### AREA C — VDB client internals — [`convex/lib/vehicleDatabases.ts`](../convex/lib/vehicleDatabases.ts)

**`extractVDBFields(data)` (`:779-953`) — the full field inventory (what we get from a decode):**

| Group | Fields | From |
|-------|--------|------|
| Identity | year, make, model, trim, style, trim_and_style, body_type, doors | `data.*`, `data.vehicle.*` |
| Engine (specs) | engineCode, displacement (÷1000), camType, blockType, drivetrain, cylindersConfiguration | `specifications.engine.*` |
| Engine (dims) | horsepower (`unit=hp`), engineDisplacementLiters (`unit=l`) | `dimensions.engine[]` |
| Engine (derived) | engineDescription, cylinders (parsed from config string / description) | `standard_options[name=Engine]` |
| Fuel / MPG | fuelType, mpgCity, mpgHighway, mpgCombined | `specifications.fuel/mpg` |
| Transmission | transType, transSpeeds, transDescription | `data.transmission.*` |
| Tires | frontTireSize, rearTireSize, front/rearTirePressure | `specifications.tires.*` |
| Wheels | wheelTorque | `dimensions.wheels` |
| Battery | cca | `specifications.electrical.cold_cranking_capacity_amps` |
| Brakes | frontRotorDia, rearRotorDia, brakeType, brakeSystemType | `dimensions.braking`, `specifications.braking.type` → `normalizeBrakeSystemType` |
| Steering | steeringType | `specifications.steering.type` → `mapSteeringType` |

**Other exported functions:**
- `advancedVinDecode` (`:22-71`) — cache-first (VDB_CACHE) GET decode.
- `fetchVDBRepairRaw` (`:143-175`) / `fetchVDBRepairData` (`:283-409`, legacy inline-Haiku path, **not used by v3pipeline**) / `fetchVDBLaborHours` (`:412-418`, wraps legacy path).
- `applyVDBMappingResult` (`:182-240`) — blocks + action→slug map → `{intervals, labor}`. Interval rule ≥2 checkpoints / gap ≥5000mi; labor **summed** per slug.
- `buildVDBMappingPrompt` / `parseVDBMappingResponse` (`:247-281`) — Haiku prompt build + parse with static fallback fill.
- `mapVDBActionsToSlugsWithHaiku` (`:487-551`) — Haiku (`claude-haiku-4-5-20251001`, temp 0, max_tokens 4096) action→slug mapper.
- `VDB_TO_SERVICE_SLUG` (`:561-598`) — ~25-entry **exact-string** static fallback map.
- `mapVDBLaborToSlugs` (`:604-617`) — standalone helper, **first-match-wins (does NOT sum)** — divergent semantics from the in-file paths.
- `assessAvailablePackages` (`:708-777`) + `collectPackageStrings` (`:663-691`) — recursive whole-payload string walk + regex rules (`packageRules.ts`), halo-gated (`haloVariantRules.ts`).

---

### AREA D — Images / colors / trim discovery
**Client** — [`utils/vehicleImage.ts`](../utils/vehicleImage.ts) (feature-rich, `EXPO_PUBLIC` key):
- `fetchVehicleImageUrl` (`:601-723`) → hero image (Cars tab, Home, review, add-car-info). Color-match → EVOX-front → colors[0] → exterior[0] ladder.
- `resolveVdbVariantsForVehicle` (`:430-529`) → probes ymm-specs/trim + ymm-specs/model → trim picker (`useVdbVariants`).
- `fetchVdbColorsForVehicle` (`:1179-1387`) → paint swatches from `colors[]` filenames (`useVdbColorsForVin`). Handles decode-shaped vs catalog-shaped model/trim via `buildVdbYmmtCombos` (`:1136-1177`).
- Throttle: `VDB_MAX_CONCURRENT=3` + 10s per-endpoint 429 cooldown (module-global, `:39-89`). Caches are **session-only in-memory Maps** (`COLORS_CACHE`, `VDB_MODELS_CACHE`, `VDB_MODEL_DISCOVERY_CACHE`).

**Server** — [`convex/lib/vehicle_image.ts`](../convex/lib/vehicle_image.ts) (`VEHICLE_DATABASES_API_KEY`):
- `resolveVehicleImage` (`:32-150`) — dumber, cache-first (`vehicles.image_url` → `vehicle_configs.image_url`), VIN-first then YMMT, **no ymm-specs discovery, no color matching**. **Only consumer: `email_provider.ts`** (walk-in claim email hero image).

**`ColorSwatchSkeleton.tsx`** — pure loading UI, **zero VDB calls**.

> Client tries **YMMT-first** (trim-specific); server tries **VIN-first** (base trim) — same VIN can render different images on Cars page vs email.

---

### AREA E — Client entry points
| File | VDB path |
|------|----------|
| [`app/add-vehicle.tsx`](../app/add-vehicle.tsx) `:65-141` | VIN → Convex `decodeVin` (**server** VDB), pushes decoded params to review. No client key. |
| [`app/vin-scanner.tsx`](../app/vin-scanner.tsx) `:56-119` | Same as above, camera-scanned VIN. |
| [`app/add-vehicle-review.tsx`](../app/add-vehicle-review.tsx) `:168-256` | Specs card from decode params; **client-direct VDB** via `useVdbVariants`, `useVdbColorsForVin`, `fetchVehicleImageUrl`. |
| [`app/add-car-info.tsx`](../app/add-car-info.tsx) `:166-216` | Manual entry + review edit; **client-direct VDB** hooks (trim/color/image). Static `FALLBACK_COLOURS` when VDB empty. |
| [`convex/ymmtCatalog.ts`](../convex/ymmtCatalog.ts) + [`hooks/useYmmtCatalog.ts`](../hooks/useYmmtCatalog.ts) | **NOT VDB** — NHTSA-backed makes/models. Trims intentionally cached **empty** (`ymmtCatalog.ts:308-323`); real trims come from VDB `useVdbVariants`. |

---

### AREA F — Backfills, probe, cron, schema persistence
- [`convex/backfillVdbBrakes.ts`](../convex/backfillVdbBrakes.ts) — **manual one-shot**. Walks `vehicle_configs` (newest 2000), re-hits **live** `advancedVinDecode` per row, fills `brake_system_type` + `packages_available` via `patchVehicleConfig`. `writeBrake` only fires on truthy `brakeSystemType` (unknown brake vocab → **permanent no-op**).
- [`convex/vehicleEnrichment/backfillNhtsaKey.ts`](../convex/vehicleEnrichment/backfillNhtsaKey.ts) — **NOT VDB** (NHTSA vPIC). Fills `nhtsa_vin_key`. `dryRun` defaults **true**.
- [`convex/devOnly/vdbProbe.ts`](../convex/devOnly/vdbProbe.ts) — dev feasibility probe of ymm-specs/v3. Persists nothing.
- [`convex/crons.ts`](../convex/crons.ts) — **NO VDB / enrichment re-fetch cron of any kind.** VDB data never refreshes on a schedule. `refreshStalePrices` is FireCrawl-only and default-off.
- **Schema persistence:** `vehicle_configs.brake_system_type` and `nhtsa_vin_key` carry **no source/confidence/evidence column**. VDB-derived engine/tire/CCA/rotor/steering values land in `engines`/`trim_specs`/`chassis_specs` with generic `confidence_score`/`data_quality` but **nothing stamps them VDB-origin** — provenance is lost. Only `packages_available[]` carries per-item `confidence` + `detected_from` (and that confidence comes from the rules table, not VDB).

---

## 3. Where VDB sits vs the other data sources

| Source | Domain | Auth | What we get | Relationship to VDB |
|--------|--------|------|-------------|---------------------|
| **VDB** | VIN decode + specs + images + schedule | `x-AuthKey` (paid) | Engine/tires/brakes/battery/steering/packages, intervals, labor, images | **Anchor.** Primary paid decode |
| **NHTSA vPIC** | VIN decode / identity | none (free) | YMMT, cylinders (authoritative), HP, fuel, drivetrain, body | **Same domain — free fallback.** Real call at `vehicle_pipeline.ts:26` (NOT `nhtsa.ts`, which is a DB reader) |
| **FireCrawl** (`api.firecrawl.dev/v2`) | Web-scrape transport | `Bearer FIRECRAWL_API_KEY` | Parts pages, owner's manuals, tire retailers, wheel-size, open-web specs | **Fills what VDB lacks** (retail prices, manuals). Shared by nearly everything |
| **Anthropic Claude** | Extraction / gap-fill / mapping | `ANTHROPIC_API_KEY` | 3 modes: Batch Haiku (`claude-haiku-4-5-20251001`) extraction; real-time Sonnet (`claude-sonnet-4-5-20250929`) web-search gap-fill; inline Haiku (VDB action mapping, VIN extraction) | Reasons over VDB+scrape context; maps VDB actions → slugs |
| **RepairPal** (`repairpal.com/next-api`) | Labor + price bands | none (Cloudflare risk) | Labor minutes/hours, labor & parts price bands | **Different domain.** Highest labor weight (0.9) but **flag-gated default-off** |
| **OEM parts** (`*partsdeal.com` / `{brand}.oempartsonline.com`) | Parts pricing | via FireCrawl | OEM part #, discount price, MSRP, supersession | **Replaces VDB parts costs** (which we deliberately don't read) |
| **Tire scrapers** (SimpleTire JSON / Walmart / TireRack) | Tire catalog + price | mixed | Tire model, price, MSRP, load/speed | Independent domain; unrelated to VDB |

---

## 4. What we actually get from VDB (the payoff)

- **Decode (endpoint 1):** VDB returns a deep-spec set NHTSA lacks. **What we actually persist and use:** engine code + displacement (engine record), transmission type/speeds + drivetrain + fuel type (VDB-first at merge), **battery CCA** (`trim_specs`), **brake system tier** — standard/sport/carbon-ceramic (drives the rotor-booking pre-select), **steering type** (`chassis_specs`, only when a chassis code resolves), and **package/options detection**. **Extracted but NOT the source of record:** tire sizes + pressures and brake rotor *diameters* — VDB returns these and they're shown on the add-vehicle review screen at decode time, but the stored/authoritative tire spec comes from the **wheel-size.com API** (`WHEEL_SIZE_API_KEY`) + Claude batch, which supersede VDB; rotor *part numbers* come from the Claude batch. HP / MPG / cylinders are extracted but NHTSA wins them.

> **Correction (2026-07-07):** an earlier draft listed tire sizes/pressures and rotor sizing as VDB values we rely on. They are not — tire data's source of record is **wheel-size.com**, and VDB's tire/rotor-dimension fields are decode-time display only.
>
> **Verification round (2026-07-07) — additional corrections** (adversarial re-check of every brief claim):
> - **Drivetrain is NOT VDB-sourced.** The persisted drivetrain comes from Claude AI-normalization → mapped NHTSA `DriveType`, and is then overridden by Batch 1B enrichment (`vehicle_pipeline.ts:423-433`, `v3pipeline.ts:762-797,1406-1414`). VDB's `drivetype` is captured at merge but is neither first-priority at persistence nor the final value.
> - **Horsepower shown to the user is VDB-first**, NHTSA `EngineHP` only a fallback (`vehicle_pipeline.ts:498-500`); the NHTSA-only `merged.engineHP` is computed but discarded.
> - **MPG / EPA fuel economy is VDB-only** (`vehicle_pipeline.ts:504-506`, `specifications.mpg`). NHTSA vPIC returns no MPG — the earlier merge-table "engineHP | NHTSA" line refers to the dead `merged.engineHP`, not the displayed value.
> - **Fuel type** resolves VDB-first but NHTSA `FuelTypePrimary` supplies it free — not a VDB dependency.
> - **Steering type** is the weakest VDB field: written only when a chassis code resolves, and Batch 1B often overwrites it with a Claude-derived value.
> - **Package detection**: detection + Batch-1A prompt injection are live, but the booking-flow consumer is a **dead no-op** — `packages_available[].services_affected` is kebab-case while production `services.slug` is snake_case, so the gate never matches (`services.ts:449`, `serviceParts.ts:191-192`). VDB only supplies the raw option strings; the rules are OtoPair-curated (`packageRules.ts`).
> - **Maintenance intervals — overstated.** The repair-estimates path is live and does write real `service_intervals` rows (`vdb_schedule`, 0.9) — but the maintenance tracker ([utils/maintenanceStatus.ts:253](../utils/maintenanceStatus.ts)) is a hardcoded `DEFAULT_INTERVALS` + `MAKE_OVERRIDES` table, with OEM rows only an optional Tier-1 override for ~5 types. VDB's mapper vocabulary (`OTOPAIR_SERVICE_SLUGS`) cannot emit `tire_replacement`/`state_inspection` and writes **miles-only** (months always hardcoded), and brakes are usually emitted as inspections → mapped to null. Net: **oil-change mileage is the only tile VDB reliably powers**, and even there it competes with the AI-`enriched` writer (the read query [service_intervals_queries.ts:49](../convex/service_intervals_queries.ts) doesn't privilege VDB by `data_quality`; the source-count merge in `v3mutations.ts:800-841` can outvote a single VDB row). A 0.50 `default_fallback` row is written for every vehicle but filtered out by the 0.75 read floor. **VDB is not the authoritative source powering maintenance tracking.**
- **Repair-estimates (endpoint 2):** **service intervals** written at 0.9 (`vdb_schedule`) — but per the verification correction above, the maintenance tracker is default-table-driven and VDB realistically only supplies **oil-change mileage** on some vehicles, not "the authoritative interval source." **Labor hours** are ingested at near-zero weight (0.05). **No parts costs.** In practice OtoPair uses very little of the Repair Estimates product.
- **Images/colors/trim (endpoints 3–5):** hero renders, paint-swatch options, canonical trim + model strings for the picker.

---

## 5. Findings & risks (prioritized)

**F-1 — Paid API key shipped in the app bundle (security).** `EXPO_PUBLIC_VEHICLE_DB_API_KEY` (`utils/vehicleImage.ts:29`) is inlined into the RN binary and used for client-direct image/trim/color calls. Extractable from any install; it's the **same paid account** as the server key. Anyone can drain VDB credits with it.

**F-2 — `VDB_CACHE` is a 1-VIN static cache with zero writeback.** `vdbCache.ts` holds exactly one hardcoded VIN (`3VV5B7AX9RM230023`); the only reference is a *read* at `vehicleDatabases.ts:25`. The "repeats are free" comment (`backfillVdbBrakes.ts:16`) is misleading — a bulk backfill spends a **real credit per non-hardcoded VIN**.

**F-3 — VDB data never refreshes.** No cron re-fetches VDB (`crons.ts`). `brake_system_type`, `packages_available`, and all decode specs go stale silently; only corrected by re-running the manual backfill or a fresh per-VIN enrichment.

**F-4 — Provenance is not tracked on VDB fields.** `brake_system_type`/`nhtsa_vin_key` have no source/confidence column; engine/tire/CCA specs lose their VDB origin once written. Violates the "evidence-based enrichment" rule in CLAUDE.md for these fields.

**F-5 — Batch 1C failure loses ALL VDB repair data** (`v3pipeline.ts:1951-1953`), not just unmapped actions — despite `parseVDBMappingResponse` having a per-action static fallback.

**F-6 — Silent degradation everywhere.** Every VDB helper collapses missing key / 401 / 429 / 500 / malformed / genuine-empty into the same `null`/`[]`. ymm-specs endpoints may be **disabled on the account** (401 handled as "no data", `utils/vehicleImage.ts:164-172`) — the entire trim picker + color discovery can silently return empty with no user-visible error or telemetry.

**F-7 — Cold add-vehicle can fire 15+ paid VDB requests** (colors + multi-candidate trim probes + image with multi-URL fallback). Only guard is a per-device 3-concurrent cap + 10s cooldown; no cross-user coordination against the account-global rate limit.

**F-8 — Client vs server image order diverges** (client YMMT-first / trim-specific; server VIN-first / base trim) → same VIN, different image in-app vs email.

**F-9 — VDB labor is effectively unused** (weight 0.05). If anyone reads `labor_times` expecting VDB influence, they're wrong; labor comes from RepairPal/OLP/job-actuals.

**F-10 — Two divergent labor-bundling semantics** for the same data: `applyVDBMappingResult`/`fetchVDBRepairData` **sum** hours per slug; `mapVDBLaborToSlugs` is **first-match-wins**. Pick the wrong helper → different totals.

**F-11 — Interval derivation silently drops** any service with <2 mileage checkpoints or all gaps <5000mi (single-occurrence items like timing belt never yield a VDB interval; sub-5000mi severe-service intervals lost).

**F-12 — Static fallback is exact-string only** (~25 keys). VDB action vocab varies per make/year; when `ANTHROPIC_API_KEY` is absent or Haiku errors, most non-canonical actions map to `null` and drop.

**F-13 — Two slug namespaces.** `VDB_TO_SERVICE_SLUG` uses underscore slugs (`oil_change`); `packageRules.KNOWN_SERVICE_SLUGS` uses hyphenated catalog slugs (`oil-change`). Not interchangeable.

**Naming traps for future auditors:** `convex/vehicleEnrichment/nhtsa.ts` makes **no** NHTSA call (it's a DB reader; real vPIC call is `vehicle_pipeline.ts:26`). `marketplaceScraper.ts` is **VIN discovery, not parts pricing** (and its crons are commented out — dead as shipped).

---

## 6. Verification note
6 of 7 audit slices were produced by parallel reader agents citing `file:line`. The 7th (`vin-decode-merge`) hit the structured-output size cap and was covered by first-hand reads of `vehicle_pipeline.ts:80-388`. Headline findings F-1 and F-2 were independently confirmed by direct file reads (`vdbCache.ts`, `utils/vehicleImage.ts:29`).
