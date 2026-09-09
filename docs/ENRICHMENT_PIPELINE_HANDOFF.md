# Otopair — Enrichment Pipeline & Schema Handoff

**Audience:** Developer or reviewer taking over the enrichment work.
**Source of truth:** This doc reflects the actual code in `convex/vehicleEnrichment/v3pipeline.ts`, `convex/vehicleEnrichment/v3mutations.ts`, `convex/lib/vehicleDatabases.ts`, and `convex/schema.ts` as deployed.

---

## Part 1 — Pipeline at a glance

**Entry point:** `internal.vehicleEnrichment.v3pipeline.enrichVehicleBatchV3`
- Triggered from `vehicleEnrichment/runPublic:go` (manual test) or `vehicle_pipeline:processVin` (production VIN add)
- Wall-clock time per fresh vehicle: ~7-8 min
- Output: a fully populated `vehicle_configs` row with linked engine/transmission/drivetrain specs, OEM part fitments, service intervals, labor times, and full evidence chain

**Three Claude batches run sequentially:**

| Batch | Model | Web search | Job |
|---|---|---|---|
| **1A** | Sonnet | no | Extract from FireCrawl markdown (parts catalog + owner's manual) — fluids/intervals/parts/specs |
| **1B** | Sonnet | yes | Independent fields via web search — intervals, fluid specs, tire specs, battery |
| **1C** | Haiku | no | Map VDB action strings → 23-service slugs (`fetchVDBRepairRaw` output) |
| **2** | Sonnet | yes | Gap fill + pricing — extracts whatever 1A/1B missed |

Plus async post-passes:
- **Adversarial verification** (Haiku, scheduled) — sanity-checks outliers
- **Source scoring** — auto-registers reliable domains in `source_registry`
- **Service/labor fallback** — fills missing services with defaults from `services.default_labor_hours`

---

## Part 1B — Data model: definition vs passport, and how dedup works

The whole pipeline is structured around a three-layer model. Internalize this before reading the stage-by-stage walkthrough — it's why the same year+model can produce different fitments for different VINs (engine/trim variation), and why two users with the exact same car share the same enrichment.

### The three layers

| Layer | Table | Cardinality | What it represents |
|---|---|---|---|
| **Definition** | `vehicle_configs` | One per unique `{year}_{make}_{model}_{trim}_{engineCode}` | The generic spec for that exact build configuration. Shared across every VIN that matches. Holds `engine_id`, `transmission_id`, `drivetrain`, `trim_name`, `chassis_code`, `packages_available[]`, `enrichment_status`, `fill_rate`, `last_enriched_at`. |
| **Passport** | `vehicles` | One per VIN | One specific physical car. Carries `vin`, `image_url`, plus FK `vehicle_config_id` pointing at which definition this car follows. |
| **Ownership** | `vehicle_owners` | One per (user × VIN) | Per-user claim on a specific car. Carries `nickname`, `is_primary`, `confirmed_packages[]`, `denied_packages[]`, `active_classification_id`, `vehicle_mode`, `owner_segment`. Same VIN can have multiple owners (transfer/fleet). |

**Walked top to bottom:**

```
user (auth)
  ↓
vehicle_owners ← per-user nickname, package confirmations, classification pointer
  ↓
vehicles ← per-VIN passport (image, year, FK to definition)
  ↓
vehicle_configs ← shared definition: 1 row covers thousands of matching VINs
  ├── engines, transmissions, drivetrain_configs, trim_specs, chassis_specs
  ├── part_fitments → oem_parts → part_prices
  ├── service_intervals, labor_times
  └── packages_available[] (from STAGE 3C — package detection)
```

### Cache keys — the dedup units

The pipeline carries **two** dedup keys on every `vehicle_configs` row. They look up the same definition from different starting points in the pipeline's life cycle:

```
config_key      = `{year}_{make}_{model}_{trim}_{engineCode}`
                  e.g. "2020_volkswagen_jetta_r_line_ea211"

nhtsa_vin_key   = `{year}_{make}_{model}_{trim}_{displacementL}l_{cylinders}cyl_{fuel}`
                  e.g. "2020_volkswagen_jetta_r_line_1.4l_4cyl_gasoline"
```

**Why two keys?** `config_key` requires the resolved OEM `engineCode` (e.g. `EA211`), but for a chunk of the lineup NHTSA only returns a marketing **descriptor** (e.g. `1.4 TSI`, `EcoBoost`, `Smartstream`). The real OEM code is recovered later in STAGE 1B by a Haiku call. So at VIN-decode time — before any Claude call — `config_key` literally cannot be computed for those makes.

`nhtsa_vin_key` solves that. It's built entirely from raw NHTSA vPIC fields (`Make`, `Model`, `ModelYear`, `Trim`, `DisplacementL`, `EngineCylinders`, `FuelTypePrimary`), all of which come back deterministically from a free, always-available API. It doesn't need VDB (which can 403) and doesn't need Haiku (which costs a call). It's stamped onto the `vehicle_configs` row at STAGE 4 alongside `config_key`.

| Key | Computed when | Used by | Affected by |
|---|---|---|---|
| `config_key` | After STAGE 1B engine code resolution | STAGE 0 cache check, STAGE 3B fuzzy dedup | engineCode (post-Haiku) |
| `nhtsa_vin_key` | At VIN decode time (`vehicle_pipeline.processVin`) | `confirmVehicleForUser` (early dedup, primary path) | NHTSA vPIC raw fields |

Both are finer than `year + model` because trim and engine genuinely change parts:
- 2020 Jetta R-Line (1.4T, EA211) → brake set A, oil filter X
- 2020 Jetta GLI (2.0T, EA888) → brake set B, oil filter Y

Same year + model, different definitions. Both keys correctly separate them.

Both are coarser than VIN because two VINs of the exact same trim+engine genuinely share parts — no reason to enrich each individually.

**Why we need the NHTSA key specifically:** without it, `confirmVehicleForUser` would build `configKey` from the *raw* `engineCode` it got from `decodeVin` (e.g. `"1.4 TSI"`), but the matching `vehicle_configs` row stores the *resolved* `engineCode` (e.g. `"EA211"`). Lookup misses 100% of the time for VW / Hyundai / Kia / Ford EcoBoost / similar descriptor-emitting makes, and the pipeline runs from scratch when it shouldn't. The NHTSA key sidesteps Haiku resolution entirely.

### The cache decision — two checkpoints

There are **two** dedup checkpoints in the request flow. The earlier one runs in `vehicle_pipeline.confirmVehicleForUser` (the action the app calls when the user confirms a decoded VIN). The later one runs in `enrichVehicleBatchV3` STAGE 0 once the action is already scheduled.

#### Checkpoint A — `confirmVehicleForUser` (NHTSA-key first, configKey fallback)

This is the fast path. It runs in the user-facing action so it can short-circuit BEFORE the scheduler even spins up `enrichVehicleBatchV3`. Saves ~2-3 sec of action overhead per duplicate add.

```
1. Try nhtsa_vin_key  → getVehicleConfigByNhtsaVinKey
   hit?  yes ↓
              fresh (status complete/verified AND < 180 days)
                → attachVehicleConfig + return cache_hit (source="nhtsa_vin_key")
              not fresh → fall through to enrichVehicleBatchV3
         no  ↓
2. Try config_key  → getVehicleConfigByKey  (only if engineCode present)
   hit?  yes ↓
              fresh → attachVehicleConfig + return cache_hit (source="config_key")
              not fresh → fall through
         no  ↓
3. Schedule enrichVehicleBatchV3 with nhtsaVinKey threaded through
```

The action's response includes `cache_hit_source: "nhtsa_vin_key" | "config_key" | "none"` so callers can tell which key matched.

#### Checkpoint B — `enrichVehicleBatchV3` STAGE 0 (config_key only)

If checkpoint A missed (or wasn't called — e.g. the marketplace VIN queue path), the pipeline runs and STAGE 0 does its own check. This catches races and legacy paths that don't pass `nhtsaVinKey`.

```
config_key looked up via getVehicleConfigByKey
  ↓
exists?  no  → proceed to full enrichment
         yes ↓
              status is enriching/scraping/batch1/batch2/started
                AND last update < 4h ago
                  → return "already_enriching" (concurrency guard)
              status is complete/verified
                AND last_enriched_at < 180 days ago
                  → return "cache_hit" (attaches existing config to new vehicle, no Claude calls)
              status is complete/verified
                AND last_enriched_at >= 180 days ago
                  → schedule cacheValidation.validateCachedConfig
                  → return "cache_hit_validating" (use cache now, validate in background)
              status is partial (< 70% fill) or failed
                  → proceed to full enrichment (try again)
```

STAGE 0 also re-checks `config_key` AFTER STAGE 1B rewrites the engine code, so a vehicle whose NHTSA key didn't dedup (e.g. first-time descriptor make) but resolves to a known OEM code still gets attached to the existing config.

### The "once a year per definition" rule

Production behavior matches your intent:
- **First VIN of a definition**: full enrichment runs (~7-8 min, ~$0.20-0.50 in Claude tokens).
- **Every subsequent VIN of the same definition for the next 180 days**: cache hit. The new vehicle row is attached to the existing `vehicle_configs` row in milliseconds. Zero Claude calls.
- **After 180 days**: the next VIN triggers `cacheValidation.validateCachedConfig` — a lighter re-validation that catches data drift (manufacturer recalls, supersession chain updates) without redoing everything.

### Sibling backfill ≠ redundant enrichment

When STAGE 6C/6D find a sibling config (same chassis_code or same engine_id), the pipeline calls `cloneFromChassisMatch` / `cloneFromEngineSibling`. These are **clones** of `service_intervals`, `labor_times`, `part_fitments` from the sibling — given as a head start to the new config, **before** the Claude batches run. Then the Claude batches fill in only the gaps specific to this trim+engine. Net effect: a new BMW M340i config with an existing 5-Series M550i sibling on the same G30 chassis enriches faster and cheaper because the platform-level data (chassis_specs, brake fluid type, lug nut torque) is reused.

### The processVinQueue dedup gap

`marketplaceScraper.ts:processVinQueue` dedupes pending VINs against the `vehicles` table by VIN — it skips queueing a VIN that's already a known vehicle. But two different VINs that resolve to the same `config_key` will both schedule `enrichVehicleBatchV3`. The second one short-circuits at STAGE 0 (cache_hit), so no Claude tokens are wasted, but ~2-3 sec of action overhead is.

The user-facing path (`confirmVehicleForUser`) already does early dedup using `nhtsa_vin_key` then `config_key` — see Checkpoint A above. The marketplace queue could do the same: call `getVehicleConfigByNhtsaVinKey` (if it has the NHTSA fields) or `getVehicleConfigByKey` before scheduling, and skip-attach when fresh.

### Quick reference

| Question | Answer |
|---|---|
| "I have 100 VINs of 2020 Jetta R-Line 1.4T. How many full enrichments run?" | **1.** First VIN does the work, the other 99 hit on `nhtsa_vin_key` at `confirmVehicleForUser`. |
| "I have 1 VIN each of 2020 Jetta R-Line and 2020 Jetta GLI. How many?" | **2.** Different displacement/cylinders → different `nhtsa_vin_key` AND different `config_key`. |
| "What if I rerun the same VIN 6 months later?" | Same `nhtsa_vin_key` → revalidation path; Claude doesn't run, but `cacheValidation.validateCachedConfig` does a quick health check. |
| "What if I rerun the same VIN 1 year later?" | `last_enriched_at >= 180 days` → revalidation triggers, may schedule a fresh enrichment depending on what changed. |
| "Two users add the same exact VIN" | Same vehicle row, two `vehicle_owners` rows. Each user gets independent `vehicle_classifications` and `vehicle_service_states`. |
| "Two users add different VINs of the same trim+engine" | Two vehicle rows, same `vehicle_config_id`. Each user gets independent classification + service states; they share the part fitments and intervals. |
| "First VW Jetta gets enriched today, then a second Jetta VIN comes in tomorrow — does it cache_hit even before Haiku resolves the engine code?" | **Yes.** Both VINs produce the same `nhtsa_vin_key` from raw NHTSA fields. `confirmVehicleForUser` finds the existing config, attaches the new vehicle, and never schedules `enrichVehicleBatchV3`. |

---

## Part 2 — Stage-by-stage walkthrough

Each stage lists: **what happens** → **which mutation/query** → **which table is written**.

### STAGE 0 — Cache + concurrency check
- Looks up `vehicle_configs` by `config_key` via `v3queries.getVehicleConfigByKey`.
- If status is `enriching`/`scraping`/`batch1`/`batch2`/`started` and < 4h old → skip (return `already_enriching`).
- If `complete`/`verified` and < 180 days old → return `cache_hit`.
- If stale → schedule `cacheValidation.validateCachedConfig` and return `cache_hit_validating`.

**Tables read:** `vehicle_configs`

---

### STAGE 1 — VIN identity
- Reads NHTSA + VDB identity via `internal.vehicleEnrichment.nhtsa.getIdentity` (set earlier by `vehicle_pipeline.processVin`).
- VDB call: `lib/vehicleDatabases.ts:advancedVinDecode(vin)` → cached in `lib/vdbCache.ts`.

**Logged:** `[v8] DB identity: drivetrain=X, cylinders=Y`

---

### STAGE 1B — Engine code resolution
- If `args.engineCode` looks like a placeholder (NHTSA descriptor like `1.4 TSI`, VDB placeholder `STDEN`, synthetic like `3.6l_3.6cyl`, or has underscores), call `utils/engineCodeLookup.ts:resolveEngineCode` → Haiku call returns the real OEM code.
- If resolved, swap `vehicle.engineCode` and rebuild `configKey`. Re-check cache under new key.
- Persist resolved code via `v3mutations.patchEngineCode` after Stage 3 loads `vehicle.engine_id`.

**Tables written:** `engines.engine_code`
**Logged:** `[v8] Engine code resolved: "1.4 TSI" → "EA211"` and `[v8] Persisted resolved engine code "EA211" to engines.engine_code`

---

### STAGE 2-3 — Make/model/transmission lookup
- `v3queries.getMakeByName` → reads `makes`. Aborts if missing.
- `v3queries.getModelByMakeAndName` → reads `models`. Inserts via `v3queries.createModel` if missing.
- `v3queries.getVehicle` → reads `vehicles` row to get `engine_id`, `transmission_id`, `vin`.
- VDB advanced decode: `advancedVinDecode(vin)` returns full VDB blob; `extractVDBFields(vdbRaw)` returns flat object (year/make/model/engine code/tires/battery CCA/brake rotor diameters/steering type).
- If transmission_id is null, creates placeholder via `api.transmissions.upsertTransmission`.

**Tables written:** `models` (insert if missing), `transmissions` (placeholder if missing), `vehicles.transmission_id` (link)

---

### STAGE 3B — Fuzzy dedup
- `v3queries.findSimilarConfig` reads `vehicle_configs` by engine + year + make. If a config_key drift exists, reuse the existing one.

**Tables read:** `vehicle_configs`

---

### STAGE 3C — Package detection (service-impacting upgrade packages)

This is what tells the booking flow "the user might have ordered the M Performance Brake Package — ask them before quoting."

- `lib/vehicleDatabases.ts:assessAvailablePackages({ vdbRaw, make, model, trim, year })` runs.
- It walks the VDB raw response via `collectPackageStrings`, pulling strings from `optional_options`, `standard_options`, `installed_equipment`, `equipment`, `packages`, `trim_packages`. Each string gets tagged with `detected_from`: `vdb_optional_options` / `vdb_standard_options` / `vdb_installed_equipment` / `rules_table`.
- It applies two rule sets from `lib/packageRules.ts`:
  1. **`PACKAGE_RULES[]`** — explicit regex matches (e.g. `/\bM\s*Performance\s+Brake/i` → `code: "m_performance_brakes"`). Higher confidence.
  2. **`TRIM_INFERENCE_RULES[]`** — fallback regex against the trim name when no explicit option string matched. Lower confidence.
- Both rule sets are filtered against `KNOWN_SERVICE_SLUGS` — rules whose `services_affected[]` doesn't intersect the 23 services get dropped, so the result is always actionable.
- Returns `DetectedPackage[]` with shape `{ code, label, services_affected[], detected_from, confidence }`. Deduped by `code`.
- Persisted to **`vehicle_configs.packages_available`** via `v3mutations.patchVehicleConfig` (only when the array is non-empty).
- `detectedPackages` is then passed into `buildBatch1Prompt` so Sonnet returns per-package OEM parts (see STAGE 8).

**Tables written:** `vehicle_configs.packages_available`
**Logged:** `[v8-packages] Detected N service-impacting package(s): code1, code2, ...` — only fires when ≥1 package matched. A trim like "1.4T R-Line" with no upgrade options produces nothing in the logs.

**Reference:** `docs/PACKAGE_AWARE_PARTS.md` is the full design doc.

---

### STAGE 4 — vehicle_config upsert
- Drivetrain priority: `args.drivetrain` (from processVin) > VDB > `"unknown"`.
- `v3mutations.upsertVehicleConfig` → inserts or patches `vehicle_configs` with status `enriching`, fill_rate 0.
- **NHTSA-key stamping:** if `args.nhtsaVinKey` was passed in (from `confirmVehicleForUser` → `enrichVehicleBatchV3`), it's written to `vehicle_configs.nhtsa_vin_key`. First-writer-wins — a later run won't overwrite an existing key, so the original NHTSA fingerprint is stable across re-enrichments. This is what makes Checkpoint A (early dedup) possible for the *next* VIN of the same trim+engine.

**Tables written:** `vehicle_configs` (including `config_key`, `nhtsa_vin_key`)

---

### STAGE 5 — enrichment run
- `v3mutations.createEnrichmentRun` → inserts row in `enrichment_runs` with `version: "v8"`, `trigger: "new_vehicle"`.
- All subsequent batches log token/search counts back to this run.

**Tables written:** `enrichment_runs`

---

### STAGE 6 — Drivetrain config (early)
- If NHTSA returned a real drivetrain (not unknown), `v3mutations.upsertDrivetrainConfig` writes `drivetrain_configs` with `has_differential` (true if not FWD) and `has_transfer_case` (true if AWD/4WD). Fluid types deferred to Batch 1B.

**Tables written:** `drivetrain_configs`

---

### STAGE 6B — VDB repair estimates (raw fetch)
- `lib/vehicleDatabases.ts:fetchVDBRepairRaw(vin)` — fetches `https://api.vehicledatabases.com/repair-estimates/{vin}` and returns `{ blocks, actions: string[] }`.
- Action mapping piggybacked on Batch 1 as request `customId: "batch1c"` (Haiku, no web search).
- Result applied in `_pollBatch1V3` via `applyVDBMappingResult(blocks, actionMap)` → produces `{ intervals, labor }`.
- Each interval written via `v3mutations.upsertServiceInterval` (`service_intervals` table, `data_quality: "vdb_schedule"`, `confidence: 0.9`).
- Each labor entry written via `v3mutations.upsertLaborTime` (`labor_times` table, `source: "vdb_repair_estimates"`, `confidence: 0.9`).

**Tables written:** `service_intervals`, `labor_times`
**Logged:** `[vdb-mapper] Haiku mapped N/M actions`, `[vdb-repair] {vin}: N intervals, M labor`

---

### STAGE 6C — Chassis code lookup
- `utils/chassisLookup.ts:lookupChassisCode(year, make, model, trim)` — Haiku web search returns the OEM chassis code (e.g. `MK7`, `F90`, `G30`).
- Patches the code onto `vehicle_configs.chassis_code` via `v3mutations.patchVehicleConfig`.
- Ensures a `chassis_specs` record exists via `v3mutations.upsertChassisSpecs` (seeds with VDB steering type if available).
- `v3queries.findBestChassisMatch` looks for sibling configs sharing the chassis code. If found, `v3mutations.cloneFromChassisMatch` clones service_intervals + labor_times + part_fitments + drivetrain_configs + trim_specs from the sibling as a head start.

**Tables written:** `vehicle_configs.chassis_code`, `chassis_specs`, plus cloned: `service_intervals`, `labor_times`, `part_fitments`, `drivetrain_configs`, `trim_specs`

---

### STAGE 6D — Engine sibling matching
- `v3queries.findBestEngineSibling` finds another config with the same `engine_id`. If found, `v3mutations.cloneFromEngineSibling` clones engine-bound service data.

**Tables written:** `service_intervals`, `labor_times`, `part_fitments` (cloned)

---

### STAGE 6E — VDB trim specs (battery CCA seed)
- If `vdbFields.cca` is present, `v3mutations.upsertTrimSpecs` seeds `trim_specs.battery_cca`.

**Tables written:** `trim_specs`

---

### STAGE 7 — FireCrawl scrape
- `vehicleEnrichment/scraper.ts:scrapeVehicleSources(ctx, vehicle)` — runs in parallel:
  1. Parts catalog open-web search (`searchAndFetch` × 3 queries, ~5 pages, ~40K chars)
  2. Owner's manual search (~6 sources, ~30K chars)
  3. Wheel-size API call → tire fitments + size cache
- Caches markdown in `scrape_cache` (TTL 30d for parts, 7d for owner's manual).

**Tables written:** `scrape_cache`
**Tables read:** `scrape_cache` (cache hit path)

---

### STAGE 8 — Submit Batch 1
- Three requests submitted via `utils/batchClient.ts:submitBatch`:
  - **batch1a** — Sonnet, 8K max_tokens, no web search. System: `prompts/batch1Prompt.ts:BATCH_1_SYSTEM`. Reads scraped parts catalog + manual markdown. **Receives `detectedPackages` from STAGE 3C** — when non-empty, the prompt instructs Sonnet to return a top-level `packages: { <code>: { oem_parts: { ... } } }` block alongside the base OEM parts.
  - **batch1b** — Sonnet, 16K max_tokens, web search (1 use, blocked domains). System: `prompts/batch1bPrompt.ts:BATCH_1B_SYSTEM`. Independent fields.
  - **batch1c** — Haiku, 4K max_tokens, no web search. System: `lib/vehicleDatabases.ts:HAIKU_SYSTEM`. Maps VDB action strings.
- Updates `enrichment_runs.status = "batch1"`.
- Schedules `_pollBatch1V3` after 60s.

**Tables written:** `enrichment_runs.status`

---

### STAGE 9 — Poll Batch 1 (`_pollBatch1V3`)
- Polls `getBatchStatus(batchId)` every 60s, max 180 attempts.
- On `ended`: parses `r1a`, `r1b`, `r1c`.
- **Field merge**: `mergeBatch1(fields1a, fields1b)` — 1A (scraped, authoritative) takes precedence; 1B fills nulls. Then `applyApplicabilityRules` (e.g. timing belt N/A on chain engines, diff fluid N/A on FWD).
- **VDB mapping (1C)**: `parseVDBMappingResponse(r1c.data, args.vdbRepairActions)` → action→slug map. `applyVDBMappingResult(args.vdbRepairBlocks, actionMap)` → `{ intervals, labor }`. Each row written via `upsertServiceInterval` / `upsertLaborTime` with confidence 0.9.
- Calls `writeNormalizedData(fields, vehicleConfigId, ...)` (defined in v3pipeline.ts at line ~580):
  - **A. Engine specs** — `v3mutations.updateEngineSpecs` patches `engines` row with oil/coolant/timing/fuel injection/aspiration/spark plug fields.
  - **B. Transmission specs** — `v3mutations.updateTransmissionSpecs` patches `transmissions` with fluid_type.
  - **C. Drivetrain config** — final `upsertDrivetrainConfig` with resolved drivetrain + diff/TC fluid.
  - **D. Trim specs** — `v3mutations.upsertTrimSpecs` writes tire pressures, lug nut torque, wiper sizes, battery CCA/group/type/location, tire_options.
  - **E. Vehicle config** — `v3mutations.patchVehicleConfig` writes brake_fluid_type, ps_fluid_type, has_brake_pad_sensor.
  - **E2. Chassis specs** — `v3mutations.upsertChassisSpecs` dual-writes platform-level fields (steering_type, parking_brake_type, lug_nut_torque, etc.).
  - **F. OEM parts + fitments** — iterates `PART_FIELD_MAP` (lines 486-509). For each non-null part field, calls `v3mutations.upsertPartAndFitment` which inserts/patches `oem_parts` + `part_fitments`.
  - **F2. Package-specific OEM parts** — `parsePackageParts(r1a.data)` (line 176 in v3pipeline.ts) extracts the `packages.<code>.oem_parts.<field>` block Sonnet returned. For each package code, runs the SAME `PART_FIELD_MAP` loop but writes each `part_fitments` row with `package_code: <code>` set. Logs: `[v8/_pollBatch1] Package-specific parts returned for: m_performance_brakes, ...`. At booking time, the system filters fitments by `package_code` once the user confirms which package they have.
  - **G. Service intervals** — iterates `INTERVAL_TO_SERVICE` (lines 512-523). Each interval prefix → service slug. `v3mutations.upsertServiceInterval` writes one `service_intervals` row per slug.
  - **H. Evidence batch** — for every `V4_FIELD_KEYS` field with a value, builds an `enrichment_evidence` row with `entity_type` (engine / transmission / trim_spec / vehicle_config / drivetrain_config), `entity_id`, `field_name`, `observed_value`, `source_url`, `source_domain`, `source_type`, `confidence`. Inserted in batches of 50 via `v3mutations.addEvidenceBatch`.
- Submits Batch 2 with `nullFields[]` + extracted `oemParts{}`. Schedules `_pollBatch2V3`.

**Tables written:** `engines`, `transmissions`, `drivetrain_configs`, `trim_specs`, `vehicle_configs`, `chassis_specs`, `oem_parts`, `part_fitments`, `service_intervals`, `labor_times`, `enrichment_evidence`

---

### STAGE 10 — Poll Batch 2 (`_pollBatch2V3`)
- Polls until `ended`.
- Same `parseBatch2(data, nullFields)` returns `{ gapFields, services }`.
- **Sanity checks**: `validation/sanityChecks.ts:runSanityChecks` flags out-of-range values (oil capacity > 12 qt, etc.) and nulls them before write.
- **OEM validation**: `validation/oemValidation.ts:validateAllOemParts` checks part numbers against per-make patterns.
- Re-runs `writeNormalizedData` with merged fields (1A+1B+2). PART_FIELD_MAP loop now writes any parts Batch 2 found that 1A missed.
- **Pricing → labor_times**: `mapPricingToFields(services)` extracts labor hours per service. Each writes `labor_times` row via `upsertLaborTime` with `source: "web_search"` or `"training_data"`, confidence 0.85 / 0.75.
- **Pricing → part_prices**: For each priced service, looks up fitments via `v3queries.getFitmentsByConfigAndService`, divides price evenly across fitments, writes `part_prices` rows via `upsertPartPrice`.

**Tables written:** Same as Stage 9 + `part_prices`

---

### STAGE 11 — Finalization
- `v3mutations.updateEnrichmentRun` finalizes the run row with `status: "complete"`, total tokens in/out, web searches, fill_rate, fields_changed, errors.
- `v3mutations.upsertVehicleConfig` finalizes the vehicle_config with status `complete` (≥70% fill) or `partial`.
- `v3mutations.patchVehicleConfig` writes weighted-average confidence + last_enriched_at.
- `v3mutations.attachVehicleConfig` links the vehicle row to its enriched config.

**Tables written:** `enrichment_runs`, `vehicle_configs`, `vehicles.vehicle_config_id`

---

### STAGE 12 — Source scoring
- `v3mutations.runSourceScoring` reads all evidence for this run (`enrichment_evidence` filtered by `enrichment_run_id`), counts agreement per source domain, auto-registers high-confidence domains in `source_registry`.

**Tables written:** `source_registry`
**Tables read:** `enrichment_evidence`

---

### STAGE 13 — Source discovery (conditional)
- If make has < 3 registered sources, schedules `vehicleEnrichment.sourceDiscovery.discoverSourcesForMake` after 5s.

---

### STAGE 14 — Chassis backfill
- If chassis_code is set, `v3queries.findChassisGroupSiblings` finds other configs on the same chassis. `v3mutations.backfillChassisSiblings` pushes newly discovered service_intervals/labor_times/part_fitments to siblings.
- Also re-writes `chassis_specs` with the latest platform-level fields.

**Tables written:** `service_intervals`, `labor_times`, `part_fitments` (siblings), `chassis_specs`

---

### STAGE 15 — Engine sibling backfill
- `v3queries.findEngineSiblings` finds other configs sharing the engine. `v3mutations.backfillEngineSiblings` pushes engine-bound data.

**Tables written:** `service_intervals`, `labor_times`, `part_fitments` (siblings)

---

### STAGE 16 — Service/labor fallbacks
- `v3mutations.ensureAllServiceIntervals` walks all 23 services. For any without an interval, inserts a default from a hardcoded fallback table.
- `v3mutations.ensureAllLaborTimes` walks all 23 services. For any without labor, inserts `services.default_labor_hours` with confidence 0.45.
- Recalculates fill rate post-fallback and re-writes `vehicle_configs.fill_rate`.

**Tables written:** `service_intervals`, `labor_times`, `vehicle_configs`

---

### STAGE 17 — Adversarial verification (async)
- Schedules `vehicleEnrichment.adversarialVerification.runAdversarialVerification` after 10s.
- Haiku challenges suspicious values (outlier capacities, mismatched specs). Updates `enrichment_evidence` if challenged.

**Tables written:** `enrichment_evidence` (potentially)

---

## Part 3 — What gets logged where

### A. Console logs (Convex dashboard `Logs` tab)
Every stage emits log lines prefixed with `[v8]`, `[v8/_pollBatch1]`, `[v8/_pollBatch2]`, `[scraper]`, `[batch]`, `[chassis]`, `[vdb-repair]`, `[vdb-mapper]`, `[wheel-size-api]`, `[v8-parts]`, `[v8-debug]`. These are ephemeral — kept by Convex for ~7 days.

### B. Persistent enrichment audit
Every value the AI writes leaves a row in **`enrichment_evidence`** with:
- `entity_type` — which downstream entity (engine, transmission, trim_spec, vehicle_config, drivetrain_config)
- `entity_id` — the row ID
- `field_name` — the field on that entity
- `observed_value` — sanitized stringified value
- `observed_type` — number/boolean/string
- `source_url` — full URL that the value came from
- `source_domain` — eTLD+1 of source_url
- `source_type` — `scraped` / `web_search` / `training_data` / `nhtsa` / `vdb_schedule` / `sibling_engine` / `mechanic`
- `confidence` — 0.0-1.0
- `enrichment_run_id` — links back to the run
- `observed_at` / `is_latest` / `created_at`

Insert path: `v3mutations.addEvidenceBatch` (batches of 50).
Indexes: `by_entity`, `by_entity_field`, `by_source_domain`, `by_enrichment_run`.

### C. Run metadata
Each pipeline invocation creates one **`enrichment_runs`** row with `version: "v8"`. Final values: `total_tokens_in`, `total_tokens_out`, `total_web_searches`, `total_firecrawl_credits`, `estimated_cost_usd`, `duration_ms`, `fields_filled`, `fields_total`, `fill_rate`, `fields_changed[]`, `errors[]`, `batch_ids[]`, `scrape_cache_hit`, `started_at`, `completed_at`.

### D. Source reliability
**`source_registry`** stores per-domain reliability scores. After every run, `runSourceScoring` updates `total_observations`, `accuracy_rate`, `reliability_score`, `last_scraped_at`. **`blocked_domains`** holds domains the team has manually blocked (also enforced inline via `BLOCKED_DOMAINS` constant in `sourceRegistry.ts`).

### E. Cache layer
**`scrape_cache`** — FireCrawl results keyed by `cache_key` (e.g. `bmw_5-series_2020_parts_catalog`). Stores `markdown`, `markdown_length`, `scraped_at`, `expires_at`, `scrape_success`, `http_status`.

---

## Part 4 — Schema by domain (vehicle / parts / pipeline)

### CORE VEHICLE REFERENCE (the make/model/engine taxonomy)

| Table | Purpose | Key columns | Indexes |
|---|---|---|---|
| `makes` | Brand reference | `name`, `slug`, `country`, `oem_part_pattern`, `oem_part_pattern_alt`, `parent_group` | by_name, by_slug |
| `models` | Model under a make | `make_id`, `name`, `slug`, `category` | by_make_id |
| `generations` | DEPRECATED — use chassis_specs | (retired) | — |
| `trims` | Trim level under a model | `model_id`, `name`, `year_start`, `year_end`, `steering_type` | by_model_id |
| `engines` | Engine spec, 24 fields | `trim_id`, `make_id`, `engine_code`, `cylinders`, `displacement_l`, `configuration`, `aspiration`, `fuel_injection`, `timing_system`, `oil_viscosity`, `oil_capacity_qts`, `coolant_type`, `coolant_capacity_qts`, `spark_plug_quantity`, `spark_plug_gap_mm`, ... | by_trim_id, by_engine_code, by_engine_family, by_make |
| `transmissions` | Transmission spec, 16 fields | `trim_id`, `make_id`, `transmission_type`, `code`, `speeds`, `manufacturer`, `fluid_type`, `fluid_capacity_drain_fill_qts`, `is_lifetime_fill`, `has_serviceable_filter` | by_trim, by_trim_type |
| `chassis_variants` | Drivetrain variants per trim | `trim_id`, `drivetrain_type` | by_trim, by_trim_drivetrain |
| `chassis_specs` | Platform-level specs shared across all vehicles on the same chassis (e.g. `MK7`, `F90`) | `chassis_code`, `make_id`, brake/PS fluid types & capacities, lug_nut_torque, wiper sizes, battery group/location/type, has_brake_pad_sensor, steering_type, parking_brake_type, has_rear_wiper, cabin_filter_access | by_chassis_code, by_make |

---

### CANONICAL VEHICLE CONFIG (the join key for all enrichment)

| Table | Purpose | Key columns | Indexes |
|---|---|---|---|
| `vehicle_configs` | The canonical "this exact year+make+model+trim+engine combo" — every other enrichment table joins to this | `config_key` (e.g. `2020_volkswagen_jetta_r_line_ea211`), `nhtsa_vin_key` (e.g. `2020_volkswagen_jetta_r_line_1.4l_4cyl_gasoline` — built from raw NHTSA fields, used by `confirmVehicleForUser` for early dedup BEFORE Haiku engine code resolution), `year`, `make_id`, `model_id`, `trim_name`, `trim_slug`, `engine_id`, `transmission_id`, `drivetrain`, `brake_fluid_type`, `ps_fluid_type`, `chassis_code`, `packages_available[]` (`{code, label, services_affected[], detected_from, confidence}` — populated by STAGE 3C), `enrichment_status`, `fill_rate`, `confidence_avg`, `last_enriched_at`, `enrichment_version`, `cloned_from_config_id` | by_config_key, **by_nhtsa_vin_key**, by_engine, by_make_model_year, by_enrichment_status, by_fill_rate, by_chassis_code |
| `drivetrain_configs` | Diff/transfer-case fluid + presence flags | `vehicle_config_id`, `drivetrain_type`, `has_differential`, `diff_fluid_type`, `diff_fluid_capacity_qts`, `lsd_additive_required`, `has_transfer_case`, `tc_fluid_type`, `tc_fluid_capacity_qts` | by_vehicle_config |
| `trim_specs` | Trim-specific variable data — tires, battery CCA, wiper sizes | `trim_id` or `vehicle_config_id`, `tire_size_front/rear`, `recommended_tire_pressure_front/rear_psi`, `is_staggered`, `is_run_flat`, `tire_options[]` (full OEM fitment list with sizes/pressures/load index/speed rating), `battery_cca`, `has_brake_pad_sensor`, `parking_brake_type` | by_trim, by_vehicle_config |

---

### PARTS & FITMENTS

| Table | Purpose | Key columns | Indexes |
|---|---|---|---|
| `oem_parts` | One row per unique OEM part number (deduplicated across all vehicles). Carries v9 disambiguation signals: `also_known_as`, `footnotes`, `applications`, `description`, `image_url`, `full_image_url`, `fulfillment_hash`, `is_hazmat`, `replaces[]`, `superseded_by_skus[]`, `ai_notes` (object with `package`, `confidence`, `reasoning`, `evidence_sources[]`, `is_relevant`, `sources_used[]`, `annotated_at`, `annotator_model`) | `oem_part_number`, `name`, `category`, `subcategory`, `make_id`, `is_current`, `superseded_by`, `supersedes`, `source_count`, `data_quality` | by_part_number, by_category, by_subcategory, by_make_category |
| `part_fitments` | Many-to-many: which parts fit which vehicle_config for which service | `part_id`, `vehicle_config_id`, `service_type`, `position` (front/rear/front_left/etc.), `quantity_needed`, `package_code` (set by STAGE 9 F2 when the part came from a package-specific block in Batch 1A's response — e.g. `m_performance_brakes`. Booking-time filter uses this), `confidence`, `source_count`, `mechanic_verified`, `data_quality` | by_vehicle_config, by_part, by_config_service |
| `part_prices` | OEM part pricing observations from scrapers | `part_id`, `price`, `price_type` (`msrp` / `online_discount`), `source_url`, `source_domain`, `refreshed_at` | by_part, by_part_source |

---

### ENRICHMENT PIPELINE (audit + meta)

| Table | Purpose | Key columns | Indexes |
|---|---|---|---|
| `enrichment_evidence` | One row per enriched value — full provenance | `entity_type`, `entity_id`, `field_name`, `observed_value`, `observed_type`, `source_url`, `source_domain`, `source_type`, `confidence`, `enrichment_run_id`, `observed_at`, `is_latest` | by_entity, by_entity_field, by_source_domain, by_enrichment_run |
| `enrichment_runs` | Per-vehicle pipeline invocation | `vehicle_config_id`, `version`, `trigger`, `status`, `total_tokens_in/out`, `total_web_searches`, `total_firecrawl_credits`, `estimated_cost_usd`, `duration_ms`, `fill_rate`, `fields_changed[]`, `errors[]`, `batch_ids[]`, `scrape_cache_hit` | by_vehicle_config, by_status, by_created_at |
| `source_registry` | Per-domain reliability scoring | `make_id`, `source_type`, `domain`, `url_template`, `slug_fn_type`, `part_slug_map`, `manual_queries`, `reliability_score`, `total_observations`, `accuracy_rate`, `is_blocked`, `block_reason` | by_make, by_domain, by_blocked |
| `blocked_domains` | Manually blocked domains (kbb, justanswer, etc.) | `domain`, `reason`, `blocked_at`, `blocked_by`, `accuracy_at_block` | by_domain |
| `scrape_cache` | Cached FireCrawl markdown | `cache_key`, `url`, `domain`, `source_type` (`parts_catalog` / `owner_manual` / `pricing`), `make_id`, `model_id`, `year`, `markdown`, `markdown_length`, `scraped_at`, `expires_at`, `ttl_days`, `scrape_success`, `http_status` | by_cache_key, by_expires_at, by_make_year |
| `scrape_jobs` | Scraping job audit (less used) | `source`, `search_params`, `status`, `listings_found`, `vins_extracted`, `new_vins` | — |
| `mechanic_verifications` | Mechanic-corrected enrichment values | (per-row corrections) | — |

---

### SERVICES & SCHEDULING

| Table | Purpose | Key columns | Indexes |
|---|---|---|---|
| `services` | Master list of 23 services | `name`, `slug`, `description`, `default_labor_hours`, `display_order`, `service_category_id`, `requires_parts`, `requires_fluids`, `requires_ice_engine`, `requires_differential`, `requires_hydraulic_ps`, `requires_timing_belt`, `requires_state_inspection`, `requires_emissions_test`, `requires_rotatable_tires`, `is_labor_only`, `min_model_year`, `has_options` | by_slug |
| `service_categories` | Diagnostics / Inspections / Maintenance / Tires / Brakes / Battery / Fluids | `name`, `display_order` | — |
| `service_options` | Sub-options per service (front-only vs front+rear brake pads, etc.) | `service_id`, `name`, `slug` | — |
| `service_intervals` | Per-vehicle_config: when this service is due | `vehicle_config_id`, `service_id`, `interval_miles`, `interval_months`, `status` (`scheduled` / `not_applicable` / `on_demand`), `confidence`, `data_quality`, `display_string` | (by config, by service) |
| `labor_times` | Per-vehicle_config: book hours per service | `vehicle_config_id`, `service_id`, `book_hours`, `source`, `confidence`, `engine_family` | (by config, by service) |
| `service_vehicle_specs` | (Older table — Pipeline 1 writes flat OEM fields here for `job_actuals` consumption) | `vehicle_id`, flat `oil_filter_oem`, `front_brake_pad_oem`, etc. | — |

---

### USER VEHICLES (the actual cars in the system)

| Table | Purpose | Key columns | Indexes |
|---|---|---|---|
| `vehicles` | One row per VIN | `vin`, `trim_id`, `engine_id`, `transmission_id`, `chassis_id`, `year`, `vehicle_config_id`, `metadata`, `image_url`, `enriched_engine_config_id` | by_vin |
| `vehicle_owners` | Many-to-many users ↔ vehicles | `vehicle_id`, `user_id`, `nickname`, `is_primary` | (by user, by vehicle) |
| `vehicle_owner_specs` | Per-owner overrides on the canonical specs | (per-field overrides) | — |
| `odometer_history` | Mileage points over time | `vehicle_id`, `mileage`, `recorded_at` | (by vehicle) |
| `smartcar_connections` | OAuth links to Smartcar API | `vehicle_id`, `smartcar_vehicle_id`, `tokens` | — |
| `vehicle_tiers` | Tier classification per vehicle | `vehicle_id`, `tier` | — |
| `vehicle_checkins` | Service checkins | `vehicle_id`, `mileage`, `notes` | — |
| `vehicle_classifications` | Classification metadata | (per-vehicle classification) | — |
| `vehicle_driving_profiles` | Inferred usage patterns | `vehicle_id`, profile fields | — |
| `vehicle_service_states` | "When was X last done" state | `vehicle_id`, `service_id`, `last_done_at`, `last_done_mileage` | — |
| `maintenance_records` | Historical service records | `vehicle_id`, `service_id`, `performed_at`, `mileage`, `shop_id` | — |
| `vehicle_health_snapshots` | Periodic health assessments | `vehicle_id`, `snapshot_at`, health metrics | — |
| `vin_queue` | Queue of VINs to process | `vin`, `status`, `priority` | — |

---

### TIRES (separate from `oem_parts` — own subsystem)

| Table | Purpose | Key columns | Indexes |
|---|---|---|---|
| `tire_brands` | Brand → tier classification (V2 NYC launch list — 45 curated + 222 unlisted) | `brand`, `tier` (`elite` / `select` / `standard` / `unlisted`), `parent_company`, `is_sub_brand`, `appearance_count`, `review_flagged` | by_brand, by_tier |
| `tire_size_cache` | Per-size scrape cache | `size` (canonical "245/40R19"), `scraped_at`, `total_count`, `source_url` | by_size |
| `tire_models` | Specific tire SKUs by brand/model/size | `brand`, `model`, `size`, `tire_type`, `load_index`, `speed_rating`, `part_number`, `source_url`, `tier` | by_size, by_brand, by_tier, by_brand_model_size |
| `tire_pricing` | Tire pricing observations | `tire_model_id`, `source` (simpletire/tirerack/walmart), `source_url`, `price_per_tire`, `regular_price`, `has_deal`, `in_stock`, `scraped_at` | by_tire_model, by_source, by_tire_model_source |

---

### USERS / SHOPS / BOOKINGS / PAYMENTS (out of pipeline scope but listed for completeness)

`users`, `user_settings_preferences`, `user_mechanic_preferences`, `user_contribution_claims`, `user_reward_wallets`, `onboarding_questions_answers`, `shops`, `shops_hours`, `shop_services`, `shop_portfolio`, `shop_users`, `shop_invitations`, `block_time_types`, `mechanics`, `time_slots`, `bookings`, `booking_status_history`, `payments`, `payment_status_history`, `transactions`, `ownership_credit_transactions`, `reward_deals`, `reviews`, `spec_confirmations`, `spec_variances`, `follow_ups`, `job_actuals`, `ai_conversations`, `ai_messages`, `analytics_events`, `conversion_funnels`, `cdn_assets`, `client_logs`.

---

## Part 5 — File map

### Pipeline orchestration
- `convex/vehicleEnrichment/v3pipeline.ts` — main entry, all three batches, polling, finalization, fallbacks. `enrichVehicleBatchV3` accepts `nhtsaVinKey` and threads it through to STAGE 4's `upsertVehicleConfig`.
- `convex/vehicleEnrichment/v3mutations.ts` — every write the pipeline does. `upsertVehicleConfig` accepts `nhtsa_vin_key` (first-writer-wins).
- `convex/vehicleEnrichment/v3queries.ts` — every read the pipeline does. Includes `getVehicleConfigByKey` (config_key path) and `getVehicleConfigByNhtsaVinKey` (NHTSA-key path used by `confirmVehicleForUser`).
- `convex/vehicleEnrichment/types.ts` — `buildEngineKey` (post-resolution config_key) and `buildNhtsaVinKey` (NHTSA-only base key, deterministic per VIN).
- `convex/vehicle_pipeline.ts` — `processVin` (VIN decode + computes `nhtsaVinKey` from raw NHTSA fields), `decodeVin` (returns it to client), `confirmVehicleForUser` (early dedup using `nhtsaVinKey` then `config_key`).
- `convex/vehicleEnrichment/runPublic.ts` — manual test action `go(vin)`

### Prompts
- `convex/vehicleEnrichment/prompts/batch1Prompt.ts` — Batch 1A
- `convex/vehicleEnrichment/prompts/batch1bPrompt.ts` — Batch 1B
- `convex/vehicleEnrichment/prompts/batch2Prompt.ts` — Batch 2

### Helpers
- `convex/vehicleEnrichment/utils/batchClient.ts` — Anthropic Batch API wrapper
- `convex/vehicleEnrichment/utils/claudeClient.ts` — synchronous Claude calls + rate-limit gate
- `convex/vehicleEnrichment/utils/chassisLookup.ts` — Haiku chassis-code lookup
- `convex/vehicleEnrichment/utils/engineCodeLookup.ts` — Haiku engine-code resolver (`isNhtsaDescriptor`, `resolveEngineCode`)
- `convex/vehicleEnrichment/utils/wheelSizeScraper.ts` — Wheel-Size API client
- `convex/vehicleEnrichment/scraper.ts` — FireCrawl orchestration (parts + manual + wheel-size)
- `convex/vehicleEnrichment/firecrawl.ts` — FireCrawl v2 API wrapper
- `convex/vehicleEnrichment/scraperQueries.ts` — `scrape_cache` mutations/queries
- `convex/vehicleEnrichment/sourceRegistry.ts` — `BLOCKED_DOMAINS` constant + per-make source config (legacy parts URL templates retained for reference)

### VDB
- `convex/lib/vehicleDatabases.ts` — `advancedVinDecode`, `extractVDBFields`, `fetchVDBRepairRaw`, `applyVDBMappingResult`, `buildVDBMappingPrompt`, `parseVDBMappingResponse`, `mapVDBActionsToSlugsWithHaiku`, static fallback `VDB_TO_SERVICE_SLUG`, package detection (`assessAvailablePackages`, `collectPackageStrings`)
- `convex/lib/packageRules.ts` — `PACKAGE_RULES[]` (explicit VDB-string regex rules), `TRIM_INFERENCE_RULES[]` (trim-name fallback rules), `KNOWN_SERVICE_SLUGS[]`, `PackageRule` interface. Curated rules table that drives `assessAvailablePackages`. Expand as new make-specific packages are encountered.
- `convex/lib/vdbCache.ts` — local VIN→VDB-response cache
- `docs/PACKAGE_AWARE_PARTS.md` — full design doc for the package-aware parts subsystem

### Validation + post-passes
- `convex/vehicleEnrichment/applicabilityRules.ts` — `applyApplicabilityRules` (chain → timing N/A, FWD → diff N/A, etc.)
- `convex/vehicleEnrichment/validation/sanityChecks.ts` — out-of-range value detection
- `convex/vehicleEnrichment/validation/oemValidation.ts` — per-make part number pattern validation
- `convex/vehicleEnrichment/contentSanitization.ts` — `sanitizeNumber`, `sanitizeString`, `sanitizePartNumber`, `sanitizeUrl`
- `convex/vehicleEnrichment/adversarialVerification.ts` — Haiku post-pass on outliers
- `convex/vehicleEnrichment/sourceDiscovery.ts` — auto-discovers new source domains for makes with < 3 registered

---

## Part 6 — Run it

```bash
# Push schema + functions
npx convex dev --once

# Trigger a fresh enrichment
npx convex run vehicleEnrichment/runPublic:go '{"vin":"3VWN57BU5LM004513"}'
```

**Logs to expect** (anatomy of a healthy run):
```
[run] VIN: 3VWN57BU5LM004513
[decode] VDB: 2020 Volkswagen Jetta 1.4T R-Line
[v8] Starting enrichment for 2020_volkswagen_jetta_1_4t_r_line_ea211
[v8] Drivetrain from decode: fwd
[vdb-mapper] Haiku mapped N/M actions
[vdb-repair] {vin}: N intervals, M labor (mapped X/Y actions via Haiku)
[chassis] Found chassis code: MK7 for ...
[wheel-size-api] N tire options for ...
[scraper] {year} {make} {model}: parts={N} chars, manual={N} chars
[batch] Submitted 2-3 requests → batchId={id}
[v8/_pollBatch1] N/88 fields after merge+applicability
[v8-parts] {field}: raw={mpn} ... Writing part: {mpn} as {subcategory} for service {slug}
[batch] Submitted 1 requests → batchId={id}     # batch 2
[v8/_pollBatch2] {N} fields filled
[v8] Fill rate: {X}% (flat: {Y}%)
[v8] Breakdown: engine=8/8, trans=1/1, dt=1/1, trim=8/8, vc=2/2, parts=12/14, intervals=8/23, labor=14/23, prices=11/12
[v8] Service fallback: added N defaults
[v8] Labor fallback: added N defaults
[v8] Fill rate updated post-fallback: 71% → 88%
[v8] Adversarial verification scheduled
[v8] COMPLETE: 2020_volkswagen_jetta_1_4t_r_line_ea211 — fillRate=88%, time=460s
```

---

## Part 7 — Known caveats / next-steps

1. **Multi-candidate parts disambiguation via oempartsonline** — **deferred to post-MVP.** The full plan: scrape every "Fits Your Vehicle" candidate from oempartsonline category pages, dedupe by package via Haiku annotation, store all candidates with `is_relevant` flag. Files (`oempartsonlineScraper.ts`, `filterPass.ts`, `annotationPass.ts`, `vdbPackages.ts`) were built and rolled back as too fragile against the per-vehicle URL resolver. Design lives in `docs/SERVICE_PARTS_REQUIREMENTS.md`.
   - **What did ship:** package *detection* via `assessAvailablePackages` + `packageRules.ts` (curated rules table) + per-package OEM-part extraction in Batch 1A → `part_fitments.package_code`. See STAGE 3C and STAGE 9 F2. This handles the M-Performance-vs-base disambiguation case for any make/package we add to the rules table.
2. **Batch 1A's parts hit rate is low** (typically 1-3 of 14 OEM fields). Batch 2 web search picks up the rest. Acceptable for MVP cost-wise; revisit if Batch 2 token spend grows.
3. **Pipeline 1 (`vehicle_pipeline:enrichVehicleSpecs`)** still writes flat OEM fields to `service_vehicle_specs` for `job_actuals` to read. v3pipeline.ts uses the normalized `oem_parts` / `part_fitments` schema. The two pipelines coexist; long-term migration: `job_actuals` reads from `part_fitments` instead of flat fields.
4. **Convex action timeout: 600s.** Healthy runs land at 450-490s. If a Batch 2 web search pulls 60K+ tokens of search results, we approach the limit. Worth monitoring p95.
5. **Make coverage in the *current* pipeline: all US makes work uniformly.** NHTSA + VDB + FireCrawl + Batch 2 web search are make-agnostic — no per-make adapter required. The make-specific gap (Mercedes-Benz on `mbpartsgiant.com`, Tesla / Rivian / Lucid having no traditional OEM catalog, Lincoln / Genesis / Mini needing make-specific subdomains) **only matters for the deferred post-MVP oempartsonline scraper**, which is the only path that talks to per-make catalog sites directly. As long as you're on the current pipeline, every US-sold make goes through the same code path.
