# Vehicle Enrichment Pipeline — Complete Technical Reference

**Test Vehicle (all benchmarks)**: 2020 BMW M550i xDrive — N63B44O2 4.4L Twin-Turbo V8
**Current Version**: v7
**Current Fill Rate**: 88% (88-field schema)
**Stack**: Convex (TypeScript) + Anthropic Batch API + Firecrawl v2

---

## Table of Contents

1. [What This System Does](#what-this-system-does)
2. [Current Architecture (v7)](#current-architecture-v7)
3. [Complete File Inventory](#complete-file-inventory)
4. [Data Model — All 88 Fields](#data-model--all-88-fields)
5. [Type System](#type-system)
6. [Pipeline Execution Flow (Step by Step)](#pipeline-execution-flow-step-by-step)
7. [Batch API Client](#batch-api-client)
8. [Claude Client (Real-Time)](#claude-client-real-time)
9. [Firecrawl Integration](#firecrawl-integration)
10. [Scraper — Parts Catalog + Owner's Manual](#scraper--parts-catalog--owners-manual)
11. [Source Registry — 30+ Makes](#source-registry--30-makes)
12. [Prompts — Batch 1A](#prompts--batch-1a)
13. [Prompts — Batch 1B](#prompts--batch-1b)
14. [Prompts — Batch 2](#prompts--batch-2)
15. [Merge Strategy](#merge-strategy)
16. [Applicability Rules](#applicability-rules)
17. [Sibling Engine Fill](#sibling-engine-fill)
18. [Validation Layer](#validation-layer)
19. [Database Layer](#database-layer)
20. [NHTSA / Vehicle Identity](#nhtsa--vehicle-identity)
21. [Blocked Domains](#blocked-domains)
22. [SERVICE_FIELD_MAP — 14 Services](#service_field_map--14-services)
23. [Fill Rate Calculation](#fill-rate-calculation)
24. [Version History & Test Results](#version-history--test-results)
25. [Cost Breakdown](#cost-breakdown)
26. [Known Limitations & Future Work](#known-limitations--future-work)

---

## What This System Does

When a user adds a vehicle to OtoPair, the enrichment pipeline automatically populates **88 data fields** about that vehicle's maintenance requirements: service intervals, OEM part numbers, fluid specifications, pricing, and labor hours for 25 services.

The data is stored in the `enriched_engine_configs` Convex table, keyed by `engineConfig` (a normalized string like `2020_bmw_5_series_m550i_xdrive_n63b44o2`). Every vehicle with the same engine+trim combination shares one enriched record — it is enriched once and reused via cache.

**Why this exists**: A user books an oil change. OtoPair needs to show them the correct OEM filter part number, current price, and labor time. Without enrichment, this requires the user or mechanic to look it up manually. With enrichment, it's instant and accurate.

---

## Current Architecture (v7)

```
Vehicle Added (VIN decoded at add time)
    │
    ▼
enrichVehicleBatch (Convex internalAction)
    │
    ├─ STEP 0: Cache check
    │   └─ If enriched_engine_configs has record with fillRate > 70% → attach + return
    │
    ├─ STEP 1: Vehicle Identity (from DB, free, deterministic)
    │   └─ Read engines / transmissions / chassis_variants tables
    │      → cylinders, drivetrain, displacement, transmission_type
    │
    ├─ STEP 2: FireCrawl Scrape (cached 30 days)
    │   ├─ Parts catalog: fetchUrl() on known registry URLs
    │   │   BMW: bmwpartsdeal.com/oem-{year}-bmw-{trimSlug}-{partSlug}.html
    │   │   Toyota: toyotapartsdeal.com / Honda: hondapartsdeal.com
    │   │   30+ makes: {make}.oempartsonline.com
    │   │   → Returns: OEM part numbers + prices + supersession chain
    │   │
    │   └─ Owner's manual: searchAndFetch() with broad maintenance queries
    │       → Returns: service intervals + fluid specs
    │
    ├─ STEP 3: submitBatch([batch1a, batch1b]) — ONE Batch API call, runs parallel
    │   ├─ Batch 1A: claude-sonnet-4-6, maxSearchUses: 0, maxTokens: 8192
    │   │   Input: NHTSA identity + parts catalog markdown + manual markdown
    │   │   Extracts: 14 OEM parts, pricing, fluids, intervals, attributes, trim specs
    │   │   No web search — pure extraction from scraped content
    │   │
    │   └─ Batch 1B: claude-sonnet-4-6, maxSearchUses: 1 (uncapped), maxTokens: 16384
    │       Input: vehicle identity only (year/make/model/trim/engineCode)
    │       Searches: maintenance schedules, fluid specs, tire specs
    │       Extracts: all intervals, 9 fluid types (incl. trans/diff/TC), tire specs, battery
    │
    ├─ STEP 4: _pollBatch1 (every 1 min, up to 180 attempts)
    │   ├─ getBatchStatus(batchId) → wait for "ended"
    │   ├─ getBatchResults(batchId) → parse batch1a + batch1b
    │   ├─ parseBatch1a() + parseBatch1b() → flat FieldResult maps
    │   ├─ mergeBatch1(fields1a, fields1b) → 1A takes precedence, 1B fills nulls
    │   ├─ applyApplicabilityRules(fields, vPicData) → null out N/A fields
    │   └─ fillFromSiblings() → copy SIBLING_SAFE_FIELDS from sibling DB records
    │
    ├─ STEP 5: submitBatch([batch2]) — gap fill + pricing
    │   └─ Batch 2: claude-sonnet-4-6, maxSearchUses: 1 (uncapped), maxTokens: 16384
    │       Input: remaining null fields + OEM part numbers (for pricing)
    │       Job 1: Gap fill — 1-2 targeted searches per null field
    │       Job 2: Pricing — look up retail prices for each OEM part number
    │       Blocked domains enforced via post-parser filter (Batch API ignores blocked_domains param)
    │
    └─ STEP 6: _pollBatch2 (every 1 min)
        ├─ getBatchResults(batchId) → parse batch2
        ├─ parseBatch2() → gapFields + services[]
        ├─ Apply gap fill (never overwrite 1A+1B values)
        ├─ Apply pricing → mapPricingToFields() via SERVICE_FIELD_MAP
        ├─ runSanityChecks() + validateAllOemParts()
        ├─ ensureAllFields() → fill missing keys with emptyField()
        ├─ calculateFillRate() (counts not_applicable as filled)
        ├─ buildDbRecord() with enrichmentVersion: "v7"
        └─ storeEnrichedData() / updateEnrichedData() + attachToVehicle()
```

**Total timing**: ~7 minutes async (Batch API processes within minutes, polled every 1 min)
**Convex execution**: Each action runs <5 seconds. Zero timeout risk.
**Cache behavior**: Second run on same vehicle returns in <1 second (cache hit).

---

## Complete File Inventory

```
convex/vehicleEnrichment/
├── pipelineBatch.ts          — Main orchestrator: enrichVehicleBatch + _pollBatch1 + _pollBatch2
├── types.ts                  — All TypeScript types + V4_FIELD_KEYS (88) + SIBLING_SAFE_FIELDS
├── sourceRegistry.ts         — Make→URL registry (30 makes), BLOCKED_DOMAINS
├── scraper.ts                — FireCrawl scraping with Convex cache (30-day TTL)
├── applicabilityRules.ts     — Code-side nulling for chain/FWD/RWD/sedan rules
├── nhtsa.ts                  — Vehicle identity from DB (engines/chassis tables)
├── firecrawl.ts              — FireCrawl v2 API wrapper (searchAndFetch, fetchUrl)
├── mutations.ts              — DB write: storeEnrichedData, updateEnrichedData, attachToVehicle
├── queries.ts                — DB read: getByEngineKey, getByEngineCode, getForVehicle
├── scraperQueries.ts         — raw_scrape_cache DB operations (get/store/clear)
├── helpers.ts                — FirecrawlResult type + misc helpers
├── gapFill.ts                — (Legacy) gap fill logic, largely superseded by pipelineBatch
├── searchPreGather.ts        — (Legacy) pre-gather orchestration
├── buildSearchQueries.ts     — (Legacy) query builder helpers
├── claudeExtractor.ts        — (Legacy) real-time Claude calls
├── extractionPrompts.ts      — (Legacy) prompt builders
├── sourceVerifier.ts         — (Legacy) confidence filter
├── verificationApi.ts        — Stub (no-op) API verification
│
├── prompts/
│   ├── batch1Prompt.ts       — Batch 1A system prompt + buildBatch1Prompt()
│   ├── batch1bPrompt.ts      — Batch 1B system prompt + buildBatch1bPrompt()
│   └── batch2Prompt.ts       — Batch 2 system prompt + buildBatch2Prompt()
│
├── utils/
│   ├── batchClient.ts        — Anthropic Batch API: submitBatch, getBatchStatus, getBatchResults
│   └── claudeClient.ts       — Real-time Claude: callClaudeWithWebSearch, extractJsonFromContentBlocks, rate-limit gate
│
└── validation/
    ├── oemValidation.ts      — Brand-specific OEM part number regex validation
    └── sanityChecks.ts       — Range + enum sanity rules for field values
```

**Active pipeline files**: `pipelineBatch.ts`, `types.ts`, `sourceRegistry.ts`, `scraper.ts`, `applicabilityRules.ts`, `nhtsa.ts`, `firecrawl.ts`, `mutations.ts`, `queries.ts`, `scraperQueries.ts`, all `prompts/`, all `utils/`, all `validation/`

---

## Data Model — All 88 Fields

Every field in the DB has this shape:
```typescript
{
  value: string | number | boolean | null,
  source: string | null,         // URL or "training_data" or "nhtsa" etc.
  confidence: number | null,     // 0.0–1.0
  verified: boolean,             // true if confidence >= 0.8
  apiConfirmed: boolean,         // reserved for future API verification
  apiDisagreed: boolean,
  apiValue: string | null,
}
```

### Category 1: Fluids (6 fields)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `oil_viscosity` | string | Engine oil viscosity spec | `"0W-30"` |
| `oil_capacity_qts` | number | Oil capacity incl. filter, in quarts | `11.1` |
| `coolant_type` | string | Coolant specification | `"BMW HT-12"` |
| `coolant_capacity_qts` | number | Cooling system capacity in quarts | `11.0` |
| `brake_fluid_type` | string | Brake fluid spec | `"DOT 4"` |
| `power_steering_type` | string | PS system type | `"electric"` |

### Category 2: Service Intervals (18 fields — 9 services × miles + months)

| Service | Miles Field | Months Field |
|---------|-------------|--------------|
| Oil Change | `oil_change_miles` | `oil_change_months` |
| Spark Plug | `spark_plug_miles` | `spark_plug_months` |
| Transmission Service | `transmission_service_miles` | `transmission_service_months` |
| Coolant Flush | `coolant_flush_miles` | `coolant_flush_months` |
| Air Filter | `air_filter_miles` | `air_filter_months` |
| Cabin Filter | `cabin_filter_miles` | `cabin_filter_months` |
| Brake Fluid Flush | `brake_fluid_flush_miles` | `brake_fluid_flush_months` |
| Serpentine Belt | `serpentine_belt_miles` | `serpentine_belt_months` |
| Timing Service | `timing_service_miles` | `timing_service_months` |

### Category 3: Vehicle Attributes (6 fields)

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `timing_system` | string | `"chain"`, `"belt"`, `"gear"` | Timing mechanism type |
| `drivetrain` | string | `"FWD"`, `"RWD"`, `"AWD"`, `"4WD"` | Drive type |
| `turbo` | boolean | `true`, `false` | Turbocharged? |
| `fuel_injection_type` | string | `"direct"`, `"port"`, `"dual"` | Injection method |
| `transmission_type` | string | `"automatic"`, `"manual"`, `"CVT"`, `"DCT"` | Transmission style |
| `power_steering_system` | string | `"electric"`, `"hydraulic"`, `"electro-hydraulic"` | PS mechanism |

### Category 4: OEM Parts — Original 10

| Field | Description |
|-------|-------------|
| `oil_filter_oem` | OEM oil filter part number |
| `air_filter_oem` | OEM engine air filter part number |
| `cabin_filter_oem` | OEM cabin air filter part number |
| `spark_plug_oem` | OEM spark plug part number |
| `front_brake_pad_oem` | OEM front brake pad part number |
| `rear_brake_pad_oem` | OEM rear brake pad part number |
| `drain_plug_gasket_oem` | OEM oil drain plug gasket part number |
| `serpentine_belt_oem` | OEM serpentine belt part number |
| `timing_belt_oem` | OEM timing belt part number (null for chain engines) |
| `wiper_blade_set_oem` | OEM wiper blade set part number |

### Category 4b: OEM Parts — v7 New (4 fields)

| Field | Description |
|-------|-------------|
| `rotor_front_oem` | OEM front brake rotor part number |
| `rotor_rear_oem` | OEM rear brake rotor part number |
| `battery_oem` | OEM battery part number |
| `coolant_oem` | OEM coolant/antifreeze product part number (not the coolant type string) |

### Category 5: Battery & Electrical (5 fields)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `battery_group` | string | Battery group size | `"H8/Group 49"` |
| `battery_cca` | number | Cold cranking amps | `950` |
| `spark_plug_quantity` | number | Number of spark plugs (= cylinder count) | `8` |
| `spark_plug_gap` | number | Spark plug gap in mm | `0.7` |
| `parking_brake_type` | string | `"electronic"`, `"manual_drum"`, `"manual_disc"` | `"electronic"` |

### Category 6: Trim Specs (7 fields)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `front_tire_size` | string | Front tire size | `"245/40R19"` |
| `rear_tire_size` | string | Rear tire size | `"275/35R19"` |
| `tire_pressure_front_psi` | number | Front tire pressure PSI | `35` |
| `tire_pressure_rear_psi` | number | Rear tire pressure PSI | `38` |
| `lug_nut_torque_ft_lbs` | number | Lug nut torque spec | `103` |
| `front_wiper_size` | string | Front wiper blade inches | `"26"` |
| `rear_wiper_size` | string | Rear wiper blade inches (null for sedans) | `null` |

### Category 7: v7 New Fluid Types (3 fields)

| Field | Description | Example |
|-------|-------------|---------|
| `trans_fluid_type` | Transmission fluid specification | `"ZF Lifeguard 8"` |
| `diff_fluid_type` | Differential fluid specification | `"BMW Hypoid Axle Oil G1 75W-85 GL-4"` |
| `transfer_case_fluid_type` | Transfer case fluid specification | `"BMW DTF-1 75W GL-4"` |

These are in `SIBLING_SAFE_FIELDS` — safe to copy between model year siblings.

### Category 8: v7 New Fluid Intervals (4 fields)

| Field | Description |
|-------|-------------|
| `diff_fluid_miles` | Differential fluid change interval in miles |
| `diff_fluid_months` | Differential fluid change interval in months |
| `transfer_case_fluid_miles` | Transfer case fluid change interval in miles |
| `transfer_case_fluid_months` | Transfer case fluid change interval in months |

FWD vehicles: all 4 are nulled by applicability rules.
RWD vehicles: `transfer_case_fluid_*` fields are nulled. `diff_fluid_*` remain.

### Category 9: Pricing (13 fields)

| Field | Description |
|-------|-------------|
| `oil_change_price` | Total oil change cost (parts + labor at $125/hr) |
| `brake_pad_front_price` | Front brake pad replacement total |
| `brake_pad_rear_price` | Rear brake pad replacement total |
| `spark_plug_price` | Spark plug replacement total |
| `air_filter_price` | Air filter replacement total |
| `cabin_filter_price` | Cabin air filter replacement total |
| `rotor_front_price` | Front brake pad + rotor replacement total (v7 new) |
| `rotor_rear_price` | Rear brake pad + rotor replacement total (v7 new) |
| `battery_price` | Battery replacement total (v7 new) |
| `serpentine_belt_price` | Serpentine belt replacement total (v7 new) |
| `coolant_flush_price` | Coolant flush total (v7 new) |
| `transmission_service_price` | Transmission fluid service total (v7 new) |
| `brake_fluid_flush_price` | Brake fluid flush total (v7 new) |

Pricing = parts cost (low online / discount price) + labor (hours × $125/hr fixed rate).

### Category 10: Labor Hours (12 fields)

| Field | Description |
|-------|-------------|
| `estimated_labor_oil_change_hrs` | Labor hours for oil change |
| `estimated_labor_brake_front_hrs` | Labor hours for front brake pads |
| `estimated_labor_brake_rear_hrs` | Labor hours for rear brake pads |
| `estimated_labor_spark_plug_hrs` | Labor hours for spark plugs |
| `estimated_labor_rotor_front_hrs` | Labor hours for front rotors (v7 new) |
| `estimated_labor_rotor_rear_hrs` | Labor hours for rear rotors (v7 new) |
| `estimated_labor_serpentine_belt_hrs` | Labor hours for serpentine belt (v7 new) |
| `estimated_labor_coolant_flush_hrs` | Labor hours for coolant flush (v7 new) |
| `estimated_labor_trans_fluid_hrs` | Labor hours for transmission fluid service (v7 new) |
| `estimated_labor_battery_hrs` | Labor hours for battery replacement (v7 new) |
| `estimated_labor_brake_fluid_flush_hrs` | Labor hours for brake fluid flush (v7 new) |
| `estimated_labor_timing_service_hrs` | Labor hours for timing service (v7 new, null for chain engines) |

Labor rate: **$125/hr fixed**. Claude uses training data for well-established book times (conf: 0.75).

---

## Type System

### `FieldResult` (per-field provenance)

```typescript
interface FieldResult {
  value: string | number | boolean | null;
  source_url: string | null;
  source_type: "web_search" | "scraped" | "training_data" | "sibling_engine" | "gap_fill" | "nhtsa" | null;
  confidence: number | null; // 0.0–1.0
  flagged: boolean;
  flag_reason: string | null; // e.g. "not_applicable", "OEM format mismatch for BMW"
}
```

### `VehicleIdentity` (from DB / NHTSA)

```typescript
interface VehicleIdentity {
  drivetrain: string | null;         // "AWD", "RWD", "FWD", "4WD"
  turbo: boolean | null;
  transmission_type: string | null;  // "Automatic", "Manual", "CVT"
  fuel_injection_type: string | null;
  timing_system: string | null;      // from ValveTrainDesign
  cylinders: number | null;
  displacement_l: number | null;
  fuel_type: string | null;
  body_class: string | null;         // used for sedan/coupe/convertible → rear_wiper_size rule
  engine_config: string | null;
  make: string | null;
  model: string | null;
  model_year: number | null;
  plant_city: string | null;
  plant_country: string | null;
}
```

### `VehicleInput` (pipeline input)

```typescript
interface VehicleInput {
  vehicleId: string;    // Convex vehicles table ID
  year: number;
  make: string;
  model: string;
  trim: string;
  engineCode: string;
  displacement: string; // e.g. "4.4"
  cylinders?: number;
  fuelType?: string;
}
```

### `ServicePricingResult` (from Batch 2)

```typescript
interface ServicePricingResult {
  service_name: string;
  is_applicable: boolean;
  labor_hours: FieldResult;
  parts_cost_low: FieldResult;   // best online/discount price
  parts_cost_high: FieldResult;  // dealership/retail price (20-40% higher)
  total_cost_low: number | null; // labor_hours * 125 + parts_cost_low
  total_cost_high: number | null;
  confidence: number;
  tech_notes: string | null;
}
```

### `IntervalResult` (for interval fields in prompts)

```typescript
interface IntervalResult {
  miles: FieldResult;
  months: FieldResult;
  status: "scheduled" | "inspect_only" | "conditional_severe" | "not_applicable";
  display_string: string | null; // e.g. "Every 10,000 miles or 12 months"
}
```

### Engine Config Key

Format: `{year}_{make}_{model}_{trim}_{engineCode}` — all lowercase, spaces → `_`, non-alphanumeric stripped.
Example: `2020_bmw_5_series_m550i_xdrive_n63b44o2`

---

## Pipeline Execution Flow (Step by Step)

### Entry: `enrichVehicleBatch`

Called from `vehicle_pipeline.ts:confirmVehicleForUser()` when a vehicle is confirmed.

```
args: vehicleId, year, make, model, trim, engineCode, displacement
```

**Step 0 — Cache check**
Queries `enriched_engine_configs` by `engineConfig` key. If record exists with `fillRate > 70%`, attaches it to the vehicle and returns `{ status: "cache_hit" }`. No API calls made.

**Step 1 — Vehicle identity**
`ctx.runQuery(internal.vehicleEnrichment.nhtsa.getIdentity, { vehicleId })` reads the `engines`, `transmissions`, and `chassis_variants` tables (populated when the VIN was decoded at vehicle-add time). Returns `VehicleIdentity` with drivetrain, cylinders, displacement, transmission_type.
- `turbo`, `fuel_injection_type`, `timing_system`, `body_class` are NOT stored at VIN-decode time → returned as `null`. Batch 1 determines these from scraped content.

**Step 2 — FireCrawl scrape**
`scrapeVehicleSources(ctx, vehicle)` runs two parallel operations:
1. **Parts catalog** (`scrapePartsPages`): Fetches `yearSpecificUrls` from the source registry. For each URL: tries year-specific first, falls back to generic URL if empty, caps at 8K chars/page, 40K total chars. Stores combined markdown in `raw_scrape_cache`.
2. **Owner's manual** (`scrapeManual`): Runs 2-4 broad maintenance schedule queries via `searchAndFetch()`, filters blocked domains, caps at 8K/page, 40K total. Stores in `raw_scrape_cache`.

Cache TTL: 30 days. Cache key: `(make, model, year, sourceType)`.

**Step 3 — Batch [1A, 1B] submitted**
Single `submitBatch()` call with two requests:
- `batch1a`: System = `BATCH_1_SYSTEM`, user prompt = `buildBatch1Prompt(vehicle, vPicData, partsMarkdown, manualMarkdown)`, `maxSearchUses: 0` (no web search), `maxTokens: 8192`
- `batch1b`: System = `BATCH_1B_SYSTEM`, user prompt = `buildBatch1bPrompt(vehicle)`, `maxSearchUses: 1` (uncapped), `maxTokens: 16384`, `blockedDomains: BLOCKED_DOMAINS`

Returns `batchId`. Convex schedules `_pollBatch1` to run after 1 minute.

**Step 4 — `_pollBatch1` (repeated)**
Calls `getBatchStatus(batchId)`. If `"in_progress"`, reschedules itself for 1 minute later (max 180 attempts = 3 hours).
When `"ended"`:
1. `getBatchResults(batchId)` → `{ batch1a: BatchResultEntry, batch1b: BatchResultEntry }`
2. `parseBatch1a(r1a.data)` → flat `Record<string, FieldResult>` (fluids, intervals, attributes, OEM parts, oem_pricing, battery, spark plug, trim)
3. `parseBatch1b(r1b.data)` → flat `Record<string, FieldResult>` (fluids + 3 new fluid types, intervals + diff/TC, attributes, battery, trim, spark plug gap)
4. `mergeBatch1(fields1a, fields1b)` → 1A wins, 1B fills nulls
5. `applyApplicabilityRules(fields, vPicData)` → null out definitively N/A fields
6. `fillFromSiblings(ctx, engineCode, fields, engineKey)` → copy `SIBLING_SAFE_FIELDS` from sibling records
7. `getOemParts(fields)` → dict of `{ field_name: part_number }` for pricing
8. `getNullFields(fields)` → list of still-null fields (skipping `not_applicable`)
9. `submitBatch([batch2])` → schedules `_pollBatch2`

**Step 5 — Batch 2 submitted**
Single request: `buildBatch2Prompt(vehicle, nullFields, oemParts)`, `maxSearchUses: 1` (uncapped), `maxTokens: 16384`, `blockedDomains: BLOCKED_DOMAINS`.

**Step 6 — `_pollBatch2` (repeated)**
When batch 2 ends:
1. `parseBatch2(r2.data, nullFields)` → `{ gapFields, services }`
   - `gapFields`: applies post-parser `isBlockedDomain()` filter — rejects values from blocked domains even if Batch API didn't block them
   - `services`: `parsePricing(data.services)` → 25 `ServicePricingResult` objects
2. Apply gap fields: `if (allFields[k]?.value == null)` guard — never overwrites 1A+1B
3. Apply pricing: `mapPricingToFields(services)` via `SERVICE_FIELD_MAP` → only fills null pricing fields
4. `runSanityChecks(allFields, cylinders)` → range + enum validation, rejects/flags bad values
5. `validateAllOemParts(allFields, make)` → brand-specific regex check, flags format mismatches
6. `ensureAllFields(allFields)` → ensures all 88 V4_FIELD_KEYS have an entry (uses `emptyField()` for any missing)
7. `calculateFillRate(complete)` → counts fields where `value != null || flag_reason === "not_applicable"`
8. `buildDbRecord(...)` → assembles the full DB document with `enrichmentVersion: "v7"`
9. `storeEnrichedData` or `updateEnrichedData` → writes to `enriched_engine_configs`
10. `attachToVehicle` → sets `enriched_engine_config_id` on the vehicles record

---

## Batch API Client

**File**: `convex/vehicleEnrichment/utils/batchClient.ts`

Uses Anthropic Message Batches API. Key properties:
- **50% cheaper** than real-time: Sonnet batch = $0.75/MTok in, $3.75/MTok out
- **No rate limits**: batch requests are async, processed within 24h (usually minutes)
- **Parallel execution**: multiple requests in one `batches.create()` call run concurrently

### Models

```typescript
export const MODEL_HAIKU  = "claude-haiku-4-5-20251001";
export const MODEL_SONNET = "claude-sonnet-4-6";
```

Current pipeline uses Sonnet for all batch calls (1A, 1B, 2).

### `BatchRequest` interface

```typescript
interface BatchRequest {
  customId: string;          // "batch1a", "batch1b", "batch2"
  system: string;            // system prompt
  userPrompt: string;        // user message
  maxTokens: number;
  temperature: number;       // 0 for all extraction tasks
  maxSearchUses: number;     // 0 = no web_search tool; 1 = enabled (uncapped)
  blockedDomains?: string[]; // NOTE: silently ignored by Batch API (only works real-time)
  model?: string;            // defaults to MODEL_SONNET
}
```

### `submitBatch(requests: BatchRequest[]): Promise<string>`

Creates a batch with `client.messages.batches.create()`. Returns the batch ID.
**Finding**: `blocked_domains` on the web_search tool is silently ignored by the Batch API. Only works on real-time Messages endpoint. Domain blocking in v7 is handled instead by post-parser `isBlockedDomain()` filter in `parseBatch2()`.

### `getBatchStatus(batchId): Promise<"in_progress" | "ended">`

Calls `client.messages.batches.retrieve(batchId)`. Returns `processing_status`.

### `getBatchResults(batchId): Promise<Record<string, BatchResultEntry>>`

Streams results with `client.messages.batches.results(batchId)`. For each succeeded item:
1. Extracts `content` blocks from the message
2. Counts `usage.server_tool_use.web_search_requests` for web search usage
3. Calls `extractJsonFromContentBlocks(content)` to parse JSON from mixed content blocks
4. Returns `{ customId, data, usage: { tokensIn, tokensOut, webSearches }, error }`

### `extractJsonFromContentBlocks(content[])`

Handles Claude responses that interleave `text`, `web_search_tool_result`, and `server_tool_use` blocks:
1. Filters for `type === "text"` blocks only
2. Strips markdown fences (` ```json ``` `)
3. Tries `JSON.parse()` first
4. Falls back to bracket-matching: finds outermost `{...}` or `[...]`, properly handles nested structures and escaped strings

---

## Claude Client (Real-Time)

**File**: `convex/vehicleEnrichment/utils/claudeClient.ts`
**Note**: The current v7 pipeline uses the Batch API exclusively. The real-time client is available but not called by `pipelineBatch.ts`. It's used by legacy pipeline files.

### Rate Limit Gate

Tier 1 limits: 30,000 input tokens/minute, 8,000 output/min, 50 RPM.
The gate maintains a shared `GateState`:
```typescript
interface GateState {
  apiReadyAt: number;           // earliest epoch-ms for next call
  inputTokensRemaining: number; // from last response headers
  inputTokensLimit: number;     // per-minute limit (30K Tier 1)
  lastResponseMs: number;       // epoch-ms of last successful response
}
```

Before each call, `waitForGate()` computes:
```
tokensAvailable = remaining + elapsed_ms * (limit / 60_000)  // continuous replenishment
if tokensAvailable < estimatedNeeded:
    wait = (needed - available) / (limit / 60_000) + 3s buffer
```

After each call, `updateGate()` updates remaining tokens from headers. On 429, pushes `apiReadyAt` forward by `retry-after + 2s`.

### `callClaudeWithWebSearch(params)`

Sends message with `tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearchUses }]`.
Up to 3 attempts on 429. Returns `{ data, rateLimitInfo, usage }`.

### `callClaudeExtractOnly(params)`

No tools. Pure extraction. Temperature 0. Used for simple JSON extraction from known content.

---

## Firecrawl Integration

**File**: `convex/vehicleEnrichment/firecrawl.ts`
**API**: Firecrawl v2 (`https://api.firecrawl.dev/v2`)
**Auth**: `FIRECRAWL_API_KEY` environment variable

### `searchAndFetch(query, numResults = 5): Promise<FirecrawlResult[]>`

`POST /v2/search` with `{ query, limit: numResults, scrapeOptions: { formats: ["markdown"] } }`
Returns results with inline markdown — no separate scrape step needed.
Response path: `data.data.web[]` — items have `{ url, markdown, title }`.
Filters out results with `markdown.length < 200` (blocked/empty pages).

### `fetchUrl(url): Promise<string | null>`

`POST /v2/scrape` with `{ url, formats: ["markdown"] }`
Returns `data.data.markdown` or null on failure.
Used for direct known-URL fetching (parts catalog pages).

### FireCrawl Credit Cost (per enrichment, cold)

| Operation | Credits |
|-----------|---------|
| Parts catalog: ~8 direct URL fetches | ~8 |
| Owner's manual: 2 queries × 3 results | ~8 |
| **Total (cold)** | **~16** |
| **Cache hit** | **0** |

Free tier: 500/month. Starter: $16/month for 3,000 credits (~187 cold enrichments/month).

---

## Scraper — Parts Catalog + Owner's Manual

**File**: `convex/vehicleEnrichment/scraper.ts`

### Constants

```typescript
const TTL_PARTS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_MARKDOWN_CHARS = 40_000;               // total budget across all pages
const MAX_PER_PAGE_CHARS = 8_000;                // per-page cap when concatenating
```

### Parts Catalog Scraping (`scrapePartsPages`)

1. Check `raw_scrape_cache` for `(make, model, year, "parts_catalog")` — return if fresh
2. Build `yearSpecificUrls` and `genericUrls` from source registry
3. For each URL (up to `MAX_MARKDOWN_CHARS`):
   - `fetchUrl(yearSpecificUrl)` — try year-specific
   - If empty/short (<100 chars), fall back to `fetchUrl(genericUrl)`
   - If still empty, log warning and skip (Batch 2 gap fill will cover via web_search)
   - Slice to `MAX_PER_PAGE_CHARS` and append with URL header
4. Store combined markdown in `raw_scrape_cache`

### Owner's Manual Scraping (`scrapeManual`)

1. Check cache for `(make, model, year, "owner_manual")`
2. Run each search query via `searchAndFetch(query, 3)`
3. Filter blocked domains from results
4. Slice per-page to `MAX_PER_PAGE_CHARS`, cap total at `MAX_MARKDOWN_CHARS`
5. Store in cache

### `ScrapedSources` return type

```typescript
interface ScrapedSources {
  partsMarkdown: string;      // combined parts catalog markdown
  manualMarkdown: string;     // combined owner's manual markdown
  partsSourceUrls: string[];  // URLs that were successfully fetched
  manualSourceUrls: string[]; // URLs from search results
}
```

---

## Source Registry — 30+ Makes

**File**: `convex/vehicleEnrichment/sourceRegistry.ts`

### Interface

```typescript
interface MakeSourceConfig {
  parts: {
    modelSlugFn: (model: string, trim: string) => string;
    yearSpecificUrl: (year: number, modelSlug: string, partSlug: string) => string;
    genericUrl: (modelSlug: string, partSlug: string) => string;
    partSlugs: Record<string, string>; // fieldName → URL slug
  };
  manual: {
    searchQueries: (year: number, make: string, model: string) => string[];
  };
}
```

### Phase 1: Brand-Specific Scrapers

**BMW** — `bmwpartsdeal.com/oem-{year}-bmw-{trimSlug}-{partSlug}.html`
URL uses trim-only slug: `"M550i xDrive"` → `"m550i_xdrive"`

```
BMW_PART_SLUGS:
  oil_filter_oem     → "oil_filter"
  air_filter_oem     → "air_filter"
  cabin_filter_oem   → "cabin_air_filter"
  spark_plug_oem     → "spark_plug"
  front_brake_pad_oem → "brake_pads"    (deduped with rear)
  rear_brake_pad_oem  → "brake_pads"
  rotor_front_oem    → "brake_disc"     (deduped with rear)
  rotor_rear_oem     → "brake_disc"
  serpentine_belt_oem → "serpentine_belt"
  drain_plug_gasket_oem → "drain_plug"
  wiper_blade_set_oem → "wiper_blade"
  battery_group      → "battery"        (deduped with battery_oem)
  battery_oem        → "battery"
  coolant_oem        → "coolant"
```
Total deduplicated fetches: 8 URLs (brake_pads×1, brake_disc×1, battery×1, etc.)

**Toyota** — `toyotapartsdeal.com` — model+trim slug, 8 part slugs (no rotors/battery/coolant)
**Honda** — `hondapartsdeal.com` — model+trim slug, 8 part slugs

### Phase 2/3: oempartsonline.com Subdomains

Pattern: `https://{subdomain}.oempartsonline.com/oem-{year}-{make}-{modelSlug}-{partSlug}.html`

| Make | Subdomain |
|------|-----------|
| Ford | ford |
| Chevrolet / GMC / Cadillac / Buick | g |
| Hyundai | hyundai |
| Kia | kia |
| Genesis | genesis |
| Mercedes-Benz / Mercedes | mercedes |
| Volkswagen | volkswagen |
| Audi | audi |
| Subaru | subaru |
| Nissan | nissan |
| Infiniti | infiniti |
| Mazda | mazda |
| Volvo | volvo |
| Porsche | porsche |
| Lexus | lexus |
| Chrysler / Dodge / Jeep / Ram | mopar |
| Land Rover | landrover |
| Jaguar | jaguar |
| Mitsubishi | mitsubishi |

**Adding a new make**: Add one entry to `SOURCE_REGISTRY`. No pipeline code changes.
**Unsupported make**: `getSourceConfig()` returns null → `scrapeVehicleSources()` returns empty strings → Batch 1A has no parts content → Batch 1B web search and Batch 2 cover all fields.

---

## Prompts — Batch 1A

**File**: `convex/vehicleEnrichment/prompts/batch1Prompt.ts`

### System Prompt (`BATCH_1_SYSTEM`)

Key rules:
- Extract **ONLY** from provided source documents — no web knowledge for OEM parts, intervals, capacities
- Training data allowed **ONLY** for 4 stable fields: `brake_fluid_type`, `power_steering_type`, `parking_brake_type`, `timing_system` (mark `source_type: "training_data"`, confidence 0.75)
- OEM part number format validation by make:
  - BMW: 11 digits numeric OR alphanumeric up to 13 chars
  - Toyota: 5-5 alphanumeric (e.g., `04152-YZZA1`)
  - Honda: segmented alphanumeric (e.g., `15400-PLM-A02`)
- Supersession handling: always pick the CURRENT part for the target year
- NHTSA data is authoritative — use directly, don't override
- Pricing extraction from parts pages: rotor front/rear prices + battery price into `oem_pricing` section

### Confidence Tiers

| Level | Meaning |
|-------|---------|
| 0.95–1.0 | Value extracted directly from OEM catalog or owner's manual |
| 0.85–0.94 | Inferred from adjacent data in source |
| 0.70–0.79 | Training data (only the 4 allowed fields) |
| < 0.70 | Return null |

### `buildBatch1Prompt(vehicle, vPicData, partsMarkdown, manualMarkdown): string`

Assembles 4 sections:
1. Vehicle identity line
2. NHTSA vPIC section (JSON of drivetrain/turbo/transmission/etc., or "(not available)")
3. OEM parts catalog markdown (capped at 20K chars)
4. Owner's manual markdown (capped at 20K chars)

Then the full JSON output schema with all sections:
- `fluids` (6 fields)
- `intervals` (9 services, each with miles/months/status/display_string)
- `attributes` (6 fields)
- `oem_parts` (14 fields: original 10 + rotor_front/rear, battery, coolant)
- `oem_pricing` (3 fields: rotor_front_price, rotor_rear_price, battery_price)
- `battery` (group + cca)
- `spark_plug` (quantity + gap_mm)
- `parking_brake_type`
- `trim_specs` (7 fields)

---

## Prompts — Batch 1B

**File**: `convex/vehicleEnrichment/prompts/batch1bPrompt.ts`

### System Prompt (`BATCH_1B_SYSTEM`)

Key rules:
- Search the web with 1-2 targeted queries per field
- Confidence: 0.95 = OEM source, 0.85 = reputable, 0.75 = training data (confident), <0.75 = null
- For FWD vehicles: diff/TC intervals → `status: "not_applicable"`, values null
- For chain engines: `timing_belt_or_chain_service` → `status: "not_applicable"` (typically no replacement)
- For ZF 8HP "lifetime" fluid: `transmission_service` → `status: "not_applicable"`

### `buildBatch1bPrompt(vehicle: VehicleInput): string`

Receives ONLY vehicle identity (year/make/model/trim/engineCode/displacement). No scraped content.
Instructs Claude to search for all intervals, fluids, tire specs independently.

### Output Schema

```json
{
  "intervals": {
    "oil_change": { "miles": {...}, "months": {...}, "status": "...", "display_string": "..." },
    "spark_plug": ...,
    "transmission_service": ...,
    "coolant_flush": ...,
    "air_filter": ...,
    "cabin_filter": ...,
    "brake_fluid_flush": ...,
    "serpentine_belt": ...,
    "timing_belt_or_chain_service": ...,
    "diff_fluid": { "miles": {...}, "months": {...}, "status": "scheduled", ... },
    "transfer_case_fluid": { ... }
  },
  "fluids": {
    "oil_viscosity": {...},
    "oil_capacity_qts": {...},
    "coolant_type": {...},
    "coolant_capacity_qts": {...},
    "brake_fluid_type": {...},
    "power_steering_type": {...},
    "trans_fluid_type": {...},
    "diff_fluid_type": {...},
    "transfer_case_fluid_type": {...}
  },
  "battery": { "battery_group": {...}, "battery_cca": {...} },
  "attributes": { "timing_system": {...}, "parking_brake_type": {...} },
  "trim_specs": { "front_tire_size": {...}, ..., "front_wiper_size": {...}, "rear_wiper_size": {...} },
  "spark_plug": { "gap_mm": {...} }
}
```

---

## Prompts — Batch 2

**File**: `convex/vehicleEnrichment/prompts/batch2Prompt.ts`

### System Prompt (`BATCH_2_SYSTEM`)

Two jobs:
1. **Gap fill**: 1-2 targeted queries per null field. `"[year] [make] [model] [field]"` pattern. Null after 1-2 searches if not found.
2. **Pricing + labor**: `"[part_number] OEM price"` for each OEM part. `parts_cost_low` = best online price. `parts_cost_high` = dealership/retail (20-40% higher). Labor rate: $125/hr fixed from training knowledge.

Design principle: **intentionally minimal** — no source tier rankings, no DO NOT USE lists. R6 proved prompt-based blacklists are ignored. Domain blocking is handled mechanically by `isBlockedDomain()` in the parser.

### `buildBatch2Prompt(vehicle, nullFields, oemParts): string`

Assembles:
1. `FIELDS NEEDING GAP FILL` — list of null fields with descriptions
2. `OEM PART NUMBERS` — dict of `field: "part_number"` for pricing lookups
3. Full JSON output schema: `{ gap_fields: {...}, services: [...] }`
4. Complete `SERVICE_LIST` (25 services) with applicability reminders

### SERVICE_LIST (25 services)

```
Oil Change, Spark Plug Replacement, Air Filter Replacement, Cabin Air Filter Replacement,
Brake Pad Replacement - Front, Brake Pad Replacement - Rear,
Brake Pad + Rotor Replacement - Front, Brake Pad + Rotor Replacement - Rear,
Brake Fluid Flush, Coolant Flush, Transmission Fluid Service, Serpentine Belt Replacement,
Timing Belt/Chain Service, Battery Replacement, Tire Rotation, Wheel Alignment (4-wheel),
Wiper Blade Replacement (set), Power Steering Fluid Flush, Differential Fluid Service,
Transfer Case Fluid Service, Engine Air Intake Cleaning, Fuel System Cleaning,
AC Recharge / Service, Wheel Bearing Replacement, Multi-Point Inspection / Diagnostic
```

Applicability reminders in the prompt:
- Oil Change: always applicable
- Serpentine Belt: only if vehicle uses one
- Differential Fluid Service: is_applicable: false for FWD
- Transfer Case Fluid Service: is_applicable: false for FWD/RWD
- Timing Belt/Chain Service: `is_applicable: false` or `tech_notes: "chain — no scheduled replacement"` for chain engines
- Power Steering Fluid Flush: is_applicable: false for electric PS
- Tire Rotation, Alignment, Multi-Point: always applicable, labor-only

### `FIELD_DESCRIPTIONS` (all 88 fields)

Maps each field name to a human-readable description. Used in gap fill prompt to tell Claude what to search for. Example: `"oil_change_miles": "Oil change interval in miles"`.

---

## Merge Strategy

**Function**: `mergeBatch1(a: Record<string, FieldResult>, b: Record<string, FieldResult>)`

Simple rule: **1A wins, 1B fills nulls.**

```typescript
const merged = { ...a };
for (const [k, bVal] of Object.entries(b)) {
  if (merged[k]?.value == null && bVal?.value != null) {
    merged[k] = bVal;
  }
}
```

Rationale: Batch 1A extracts from scraped OEM parts catalog — considered authoritative. Batch 1B uses web search which may find different (potentially less accurate) sources. 1A data is "ground truth from the manufacturer"; 1B data is "best available from the web."

**Batch 2 merge rule** (gap fill): `if (allFields[k]?.value == null)` — only fills remaining nulls. Pricing fields from Batch 1A (parts page pricing) take precedence over Batch 2 pricing.

---

## Applicability Rules

**File**: `convex/vehicleEnrichment/applicabilityRules.ts`

Called after Batch 1A+1B merge, before Batch 2. Prevents Batch 2 from wasting searches on definitively N/A fields.

### `naField(): FieldResult`

```typescript
{
  value: null,
  source_url: null,
  source_type: null,
  confidence: 1.0,    // we are 100% confident this is N/A
  flagged: false,
  flag_reason: "not_applicable",
}
```

### Rules Applied

**Chain engine** (`timing_system` contains "chain"):
- `timing_belt_oem` → `naField()`
- **Does NOT null** `timing_service_miles/months` — chain engines can have inspect-at-X-miles guidance

**FWD drivetrain**:
- `diff_fluid_type` → `naField()`
- `diff_fluid_miles` → `naField()`
- `diff_fluid_months` → `naField()`
- `transfer_case_fluid_type` → `naField()`
- `transfer_case_fluid_miles` → `naField()`
- `transfer_case_fluid_months` → `naField()`

**RWD drivetrain** (has diff, no transfer case):
- `transfer_case_fluid_type` → `naField()`
- `transfer_case_fluid_miles` → `naField()`
- `transfer_case_fluid_months` → `naField()`

**Sedan / Coupe / Convertible** (`body_class` contains "sedan", "coupe", or "convertible"):
- `rear_wiper_size` → `naField()` — only if not already explicitly set by a source

### Data Sources

`timing_system` — from `fields.timing_system.value` (if set by Batch 1A) OR `vPicData.timing_system` (from DB)
`drivetrain` — from `fields.drivetrain.value` OR `vPicData.drivetrain`
`body_class` — from `vPicData.body_class` only (not in field map)

**Note**: `body_class` is marked `null` in `nhtsa.ts` because it is not stored at VIN-decode time. If NHTSA body class is needed for applicability rules to work correctly, `body_class` must be stored when the VIN is decoded and returned by `getIdentity()`.

---

## Sibling Engine Fill

**Function**: `fillFromSiblings(ctx, engineCode, fields, currentEngineKey)`

Queries `getByEngineCode(engineCode)` to find all enriched records with the same engine code.
For each sibling (skipping current engine key):
- Copy only fields in `SIBLING_SAFE_FIELDS`
- Only if the field is currently null
- Set `source_type: "sibling_engine"`, `confidence: min(siblingConf * 0.9, 0.85)`
- Break after first sibling that fills at least one field

### `SIBLING_SAFE_FIELDS`

These are **physical/mechanical facts tied to the engine or platform** that cannot change between model years:

```
timing_system         — chain vs belt — engine-specific, never changes
drivetrain            — AWD/RWD — platform-specific
turbo                 — turbo vs NA — engine-specific
power_steering_type   — electric vs hydraulic — platform-specific
parking_brake_type    — electronic vs manual — platform-specific
spark_plug_quantity   — determined by cylinder count
fuel_injection_type   — direct vs port — engine-specific
transmission_type     — auto vs manual — platform-specific
trans_fluid_type      — ZF Lifetime, Dexron VI — transmission-specific
diff_fluid_type       — gear oil spec — axle-specific
transfer_case_fluid_type — transfer case fluid — platform-specific
```

Fields NOT in sibling safe list (could vary by year): intervals (service schedules change), OEM part numbers (supersession), pricing, tire specs, capacities, labor hours.

---

## Validation Layer

### OEM Part Number Validation

**File**: `convex/vehicleEnrichment/validation/oemValidation.ts`

Brand-specific regex patterns. Invalid parts are **flagged** (not nulled) — they keep their value but get `flagged: true, flag_reason: "OEM format mismatch for {make}"`.

| Make | Pattern Examples |
|------|-----------------|
| BMW | `^\d{11}$` or `^\d{2}\s\d\s\d\s\d{3}\s\d{3}$` |
| Toyota | `^\d{5}-[A-Z0-9]{5}$` or `^\d{10}$` |
| Honda | `^[A-Z0-9]{3,4}-[A-Z0-9]{3,6}-[A-Z0-9]{2,4}$` |
| Hyundai/Kia | `^\d{5}-[A-Z0-9]{5}$` |
| Mercedes-Benz | `^[A-Z]\d{3}\s?\d{3}\s?\d{2}\s?\d{2}$` |
| Audi/VW | `^[A-Z0-9]{3}\s?\d{3}\s?\d{3}\s?[A-Z]?$` |
| Ford | `^[A-Z0-9]{2,4}-[A-Z0-9]{4,6}-[A-Z0-9]{1,4}$` |
| Chevrolet/GMC | `^\d{7,8}$` or `^\d{10}$` |
| Nissan | `^\d{5}-[A-Z0-9]{2}[A-Z0-9]{2,4}$` |
| General fallback | `^[A-Za-z0-9][A-Za-z0-9\s\-\.]{2,22}[A-Za-z0-9]$` |

Fields validated: `oil_filter_oem`, `air_filter_oem`, `cabin_filter_oem`, `spark_plug_oem`, `front_brake_pad_oem`, `rear_brake_pad_oem`, `drain_plug_gasket_oem`, `serpentine_belt_oem`, `timing_belt_oem`, `wiper_blade_set_oem`.

### Sanity Checks

**File**: `convex/vehicleEnrichment/validation/sanityChecks.ts`

Two severity levels: `"reject"` (nulls the value) and `"flag"` (keeps value, marks flagged).

Key rules:
| Field | Rule | Severity |
|-------|------|---------|
| `oil_capacity_qts` | range 1–20 | reject (< 1 or > 20 is definitely wrong) |
| `oil_capacity_qts` | range 3–16 | flag (outside typical) |
| `battery_cca` | range 200–2000 | reject |
| `battery_cca` | range 400–1200 | flag |
| `oil_change_miles` | range 3000–20000 | flag |
| `spark_plug_miles` | range 20000–120000 | flag |
| `lug_nut_torque_ft_lbs` | range 60–150 | flag |
| `tire_pressure_*_psi` | range 28–44 | flag |
| `spark_plug_gap` | range 0.4–1.5mm | flag |
| `timing_system` | enum: chain/belt/gear | reject |
| `drivetrain` | enum: FWD/RWD/AWD/4WD | reject |
| `parking_brake_type` | enum | reject |
| `fuel_injection_type` | enum | reject |
| `transmission_type` | enum | reject |
| `power_steering_system` | enum | reject |
| `oil_viscosity` | format: `\d+[Ww]-\d+` | flag |

Engine-specific rules (based on cylinder count):
- V8+: `oil_capacity_qts < 7` → flag
- 4-cyl: `oil_capacity_qts > 7` → flag
- `spark_plug_quantity` must equal cylinders or cylinders×2

---

## Database Layer

### `enriched_engine_configs` Table

**Index**: `by_engine_config` on `engineConfig` (the normalized engine key string)
**Index**: `by_engine_code` on `engineCode` (for sibling lookup)

Top-level record fields:
```
engineConfig: string     — normalized key, e.g. "2020_bmw_5_series_m550i_xdrive_n63b44o2"
year: number
make: string
model: string
engineCode: string       — e.g. "N63B44O2"
enrichedAt: number       — timestamp ms
fillRate: number         — 0-100
sourceUrls: string[]     — deduplicated list of all source URLs used
enrichmentVersion: string — "v7"
enrichmentDurationMs: number
callLog: CallLogEntry[]  — [{ call, tokensIn, tokensOut, webSearches, durationMs }]
[all 88 field keys]: { value, source, confidence, verified, apiConfirmed, apiDisagreed, apiValue }
```

### `raw_scrape_cache` Table

**Index**: `by_vehicle` on `(vehicleMake, vehicleModel, vehicleYear)`

```
url: string
scrapedAt: number
markdown: string
vehicleMake: string
vehicleModel: string
vehicleYear: number
sourceType: "parts_catalog" | "owner_manual" | "pricing"
expiresAt: number        — scrapedAt + 30 days
```

### Mutations

- `storeEnrichedData(data)` — inserts new enriched record, returns `_id`
- `updateEnrichedData(id, data)` — replaces existing record
- `attachToVehicle(vehicleId, enrichedDataId)` — sets `enriched_engine_config_id` on vehicles record
- `debugScheduleEnrichment(...)` — [TEST] manually trigger enrichment for a vehicle
- `debugDeleteByEngineKey(engineKey)` — [TEST] delete enrichment record by key
- `debugCleanup(vehicleId, enrichedId)` — [TEST] unlink + delete

### Queries

- `getByEngineKey(engineKey)` — lookup by engine config key (cache check)
- `getByEngineCode(engineCode)` — all records sharing engine code (sibling fill)
- `getForVehicle(vehicleId)` — join vehicles → enriched record
- `debugGetByEngineKey(engineKey)` — [TEST] public query for test scripts
- `debugFindVehicle({ vin?, engineCode? })` — [TEST] find vehicle by VIN or engine code

---

## NHTSA / Vehicle Identity

**File**: `convex/vehicleEnrichment/nhtsa.ts`

No external API call. Reads existing DB tables populated at VIN-add time by `vehicle_pipeline.ts:processVin()`.

### `getIdentity(vehicleId): VehicleIdentity | null`

Reads:
- `vehicles` table → `engine_id`, `transmission_id`, `chassis_id`
- `engines` table → `cylinders`, `displacement_liters`, `fuel_type`
- `transmissions` table → `transmission_type`
- `chassis_variants` table → `drivetrain_type`

**Currently null** (not stored at VIN-decode time, determined by Batch 1):
- `turbo`, `fuel_injection_type`, `timing_system`, `body_class`, `engine_config`

---

## Blocked Domains

**File**: `convex/vehicleEnrichment/sourceRegistry.ts`

```typescript
export const BLOCKED_DOMAINS = [
  "kbb.com",                       // Empty maintenance pages, misparses intervals
                                   // (coolant flush → 10K = oil change interval)
  "justanswer.com",                // Paid Q&A, often wrong model year
  "carscounsel.com",               // Aggregated/AI-generated, unverified
  "firestonecompleteautocare.com", // Sparse data, wrong spark plug intervals
  "yourmechanic.com",              // Generic estimates, not model-specific
  "chargerforums.com",             // Wrong make entirely (used BMW data for Dodge in R6)
];
```

**How blocking works**:
1. `scraper.ts`: Filters `BLOCKED_DOMAINS` from FireCrawl search results during `scrapeManual()`
2. `pipelineBatch.ts:parseBatch2()`: `isBlockedDomain(source_url)` — rejects gap fill values from blocked domains
3. `pipelineBatch.ts:enrichVehicleBatch()`: Passes `blockedDomains` to `BatchRequest` for Batch 1B and Batch 2

**Critical finding**: The Anthropic Batch API **silently ignores** the `blocked_domains` parameter on the `web_search` tool. This parameter only works on the real-time Messages endpoint. That's why the post-parser filter in step 2 is essential.

---

## SERVICE_FIELD_MAP — 14 Services

Defined in `pipelineBatch.ts`. Maps service names from Batch 2 `services[]` to DB pricing/labor fields.

| Service Name | Price Field | Labor Field |
|-------------|-------------|-------------|
| Oil Change | `oil_change_price` | `estimated_labor_oil_change_hrs` |
| Brake Pad Replacement - Front | `brake_pad_front_price` | `estimated_labor_brake_front_hrs` |
| Brake Pad Replacement - Rear | `brake_pad_rear_price` | `estimated_labor_brake_rear_hrs` |
| Brake Pad + Rotor Replacement - Front | `rotor_front_price` | `estimated_labor_rotor_front_hrs` |
| Brake Pad + Rotor Replacement - Rear | `rotor_rear_price` | `estimated_labor_rotor_rear_hrs` |
| Spark Plug Replacement | `spark_plug_price` | `estimated_labor_spark_plug_hrs` |
| Air Filter Replacement | `air_filter_price` | _(no labor field)_ |
| Cabin Air Filter Replacement | `cabin_filter_price` | _(no labor field)_ |
| Serpentine Belt Replacement | `serpentine_belt_price` | `estimated_labor_serpentine_belt_hrs` |
| Coolant Flush | `coolant_flush_price` | `estimated_labor_coolant_flush_hrs` |
| Transmission Fluid Service | `transmission_service_price` | `estimated_labor_trans_fluid_hrs` |
| Battery Replacement | `battery_price` | `estimated_labor_battery_hrs` |
| Brake Fluid Flush | `brake_fluid_flush_price` | `estimated_labor_brake_fluid_flush_hrs` |
| Timing Belt/Chain Service | _(no price field)_ | `estimated_labor_timing_service_hrs` |

**Pricing logic** (`mapPricingToFields`):
- `price` field value = `total_cost_low` (= parts_cost_low + labor_hrs × $125) or `parts_cost_low` if total unavailable
- `labor` field value = labor_hours from services array, or fallback 0.5 for Oil Change

**Labor rate**: $125/hr (hardcoded in `BATCH_2_SYSTEM` and in `parsePricing()`).

---

## Fill Rate Calculation

```typescript
function calculateFillRate(fields: Record<string, FieldResult>): number {
  let filled = 0;
  for (const k of V4_FIELD_KEYS) {
    const f = fields[k];
    if (f?.value != null || f?.flag_reason === "not_applicable") filled++;
  }
  return Math.round((filled / V4_FIELD_KEYS.length) * 100);
}
```

**`not_applicable` fields count as filled** — they represent a correct answer (the field is definitively N/A for this vehicle), not a data gap.

**Example**: 2020 BMW M550i (AWD, chain engine, sedan):
- `timing_belt_oem` → `not_applicable` (chain) = filled
- `rear_wiper_size` → `not_applicable` (sedan) = filled
- Stored fill rate: 88% (77/88 filled including not_applicable)
- Script explicit count: 76/88 = 86% (counts only fields with actual values)

`getNullFields()` used for Batch 2 gap fill also skips `not_applicable` fields:
```typescript
if (f?.flag_reason === "not_applicable") return false; // don't try to fill
```

---

## Version History & Test Results

**Test vehicle**: 2020 BMW M550i xDrive — N63B44O2 4.4L Twin-Turbo V8

### Summary Table

| Version | Fill Rate | Fields | Cost | Duration | Key Change |
|---------|-----------|--------|------|----------|-----------|
| v2 | 82.8% | 62 | $0.034 | ~8 min | Original pipeline — 5 tables, Sonnet real-time |
| v3 Initial | 17% | 62 | $0.19 | ~3 min | Switched to Firecrawl-only, dropped web_search |
| v3 Current | 63% | 62 | $0.10 | ~60s | Restored web_search, confidence threshold |
| v4 | 68% | 62 | $0.08 | ~8 min | 62-field schema, structured 4-call pipeline |
| v4.2 R1 | 95% | 62 | $0.006 | 710s | Batch API + Haiku — eliminated rate limits |
| v4.2 R4 | **97%** | 62 | $0.005 | **482s** | Sonnet for Batch 2 — fixed labor, best result |
| v5 R1 | 94% | 62 | $0.158 | 487s | DB identity, FireCrawl broken (SPA queries → empty Batch 1) |
| v5 R2 | **94%** | 62 | $0.176 | **395s** | FireCrawl fixed → bmwpartsdeal.com direct URL scraping |
| v5 R3 | 79% | 62 | $0.195 | 500s | Source tier + strict merge fix — but FireCrawl search broken |
| v5 R4 | 81% | 62 | $0.288 | 425s | FireCrawl Array.isArray fix — search partially restored |
| v5 R5 | **92%** | 62 | $0.219 | **365s** | Fixed FireCrawl data.data.web path — intervals/pricing recovered |
| v5 R6 | 76% | 62 | $0.489 | 547s | Prompt blacklist ineffective; pricing/labor collapsed; 574K Batch 2 tokens |
| v6 R1 | 81% | 62 | ~$0.18 | 362s | Make-agnostic source registry; simplified Batch 2 prompt; native blocked_domains |
| v6 R2 | 85% | 62 | ~$0.32 | 494s | Removed max_uses cap + parser domain filter |
| v6 R3 | **85%** | 62 | ~$0.32 | **313s** | Blocked kbb.com in FireCrawl scraper |
| v7 R1 | **88%** | **88** | $0.574 | 422s | Parallel Batch [1A+1B], 26 new fields |

---

### v7 R1 — Full Field Results (2020 BMW M550i xDrive)

**Stored fill rate: 88% | Explicit: 76/88 = 86% | 12 nulls (8 correctly N/A)**

#### Fluids — 6/6
| Field | Value | Source | Conf |
|-------|-------|--------|------|
| oil_viscosity | 0W-30 | ecstuning.com | 0.90 |
| oil_capacity_qts | 11.1 | searchforparts.com | 0.85 |
| coolant_type | BMW HT-12 | turnermotorsport.com | 0.90 |
| coolant_capacity_qts | 11 | autohausaz.com | 0.65 |
| brake_fluid_type | DOT 4 | training_data | 0.75 |
| power_steering_type | electric | training_data | 0.75 |

#### Intervals — 12/18
| Field | Value | Source | Conf |
|-------|-------|--------|------|
| oil_change_miles | 10,000 | bmwofturnersville.com | 0.95 |
| oil_change_months | 12 | bmwofturnersville.com | 0.95 |
| spark_plug_miles | 60,000 | bmwofturnersville.com | 0.90 |
| spark_plug_months | NULL | — CBS-driven | — |
| transmission_service_miles | 50,000 | blauparts.com | 0.80 |
| transmission_service_months | NULL | — CBS-driven | — |
| coolant_flush_miles | 50,000 | bimmerfest.com | 0.65 |
| coolant_flush_months | 48 | training_data | 0.75 |
| air_filter_miles | 60,000 | bmwofturnersville.com | 0.90 |
| air_filter_months | NULL | — CBS-driven | — |
| cabin_filter_miles | 20,000 | bmwofturnersville.com | 0.90 |
| cabin_filter_months | 24 | bmwofturnersville.com | 0.90 |
| brake_fluid_flush_miles | 60,000 | bmwofturnersville.com | 0.90 |
| brake_fluid_flush_months | 24 | training_data | 0.75 |
| serpentine_belt_miles | 90,000 | bmwofsouthaustin.com | 0.75 |
| serpentine_belt_months | NULL | — CBS-driven | — |
| timing_service_miles | NULL | — chain engine | — |
| timing_service_months | NULL | — chain engine | — |

#### Attributes — 6/6
| Field | Value | Source | Conf |
|-------|-------|--------|------|
| timing_system | chain | training_data | 0.95 |
| drivetrain | AWD | edmunds.com | 0.99 |
| turbo | true | bimmerfile.com | 0.99 |
| fuel_injection_type | direct | bimmerfile.com | 0.97 |
| transmission_type | automatic | carfolio.com | 0.99 |
| power_steering_system | electric | training_data | 0.75 |

#### OEM Parts — 13/14
| Field | Value | Source | Conf |
|-------|-------|--------|------|
| oil_filter_oem | 11427583220 | bmwpartsdeal.com | 0.95 |
| air_filter_oem | 13718699811 | bmwpartsdeal.com | 0.90 |
| cabin_filter_oem | 64115A1BDB6 | bmwpartsdeal.com | 0.95 |
| spark_plug_oem | 12120057704 | bmwpartsdeal.com | 0.95 |
| front_brake_pad_oem | 34116889586 | bimmerworld.com | 0.92 |
| rear_brake_pad_oem | 34216896975 | bmwpartsdeal.com | 0.88 |
| rotor_front_oem | 34106875284 | weberbrothersauto.com | 0.88 |
| rotor_rear_oem | 34217991103 | parts.bmwofsouthatlanta.com | 0.88 |
| drain_plug_gasket_oem | 07119963132 | bmwpartsnow.com | 0.90 |
| serpentine_belt_oem | 11287631824 | bimmerworld.com | 0.75 |
| timing_belt_oem | NULL | — chain (applicability rule) | — |
| wiper_blade_set_oem | 61612447932 | bimmerworld.com | 0.95 |
| battery_oem | 61217604802 | bmwpartsdeal.com | 0.82 |
| coolant_oem | 82141467704 | getbmwparts.com | 0.90 |

#### Battery / Electrical — 5/5
| Field | Value | Source | Conf |
|-------|-------|--------|------|
| battery_group | H8/Group 49 | powertexbatteries.com | 0.85 |
| battery_cca | 950 | getbmwparts.com | 0.85 |
| spark_plug_quantity | 8 | nhtsa | 1.00 |
| spark_plug_gap | 0.7mm | burgertuning.com | 0.85 |
| parking_brake_type | electronic | training_data | 0.75 |

#### Trim — 6/7
| Field | Value | Source | Conf |
|-------|-------|--------|------|
| front_tire_size | 245/40R19 | tiresize.com | 0.90 |
| rear_tire_size | 275/35R19 | tiresize.com | 0.90 |
| tire_pressure_front_psi | 35 | bimmerfest.com | 0.80 |
| tire_pressure_rear_psi | 38 | bimmerfest.com | 0.80 |
| lug_nut_torque_ft_lbs | 103 | bimmerworld.com | 0.90 |
| front_wiper_size | 26" | amazon.com | 0.85 |
| rear_wiper_size | NULL | — sedan (applicability rule) | — |

#### New Fluid Types (v7) — 3/3
| Field | Value | Source | Conf |
|-------|-------|--------|------|
| trans_fluid_type | ZF Lifeguard 8 | blauparts.com | 0.90 |
| diff_fluid_type | BMW Hypoid Axle Oil G1 75W-85 GL-4 | bimmerfest.com | 0.85 |
| transfer_case_fluid_type | BMW DTF-1 75W GL-4 (PN 83222409710) | bimmerfest.com | 0.85 |

#### New Fluid Intervals (v7) — 2/4
| Field | Value | Source | Conf |
|-------|-------|--------|------|
| diff_fluid_miles | 50,000 | bimmerfest.com | 0.75 |
| diff_fluid_months | NULL | — not found | — |
| transfer_case_fluid_miles | 60,000 | turnermotorsport.com | 0.85 |
| transfer_case_fluid_months | NULL | — not found | — |

#### Pricing — 12/13
| Field | Value | Source | Conf |
|-------|-------|--------|------|
| oil_change_price | $107.50 | training_data | 0.85 |
| brake_pad_front_price | $252.33 | bmwpartsdeal.com | 0.88 |
| brake_pad_rear_price | $113.01 | bmwpartsdeal.com | 0.88 |
| spark_plug_price | $19.30 | bmwpartswholesale.com | 0.90 |
| air_filter_price | NULL | — not found | — |
| cabin_filter_price | $92.80 | bmwpartsdirect.com | 0.92 |
| rotor_front_price | $752.33 | bmwpartsdeal.com | 0.82 |
| rotor_rear_price | $613.01 | bmwpartsdeal.com | 0.78 |
| battery_price | $230.29 | bmwpartsdeal.com | 0.88 |
| serpentine_belt_price | $39.06 | getbmwparts.com | 0.85 |
| coolant_flush_price | $272.50 | getbmwparts.com | 0.78 |
| transmission_service_price | $370.00 | blauparts.com | 0.85 |
| brake_fluid_flush_price | $145.00 | training_data | 0.85 |

#### Labor — 11/12
| Field | Value | Source | Conf |
|-------|-------|--------|------|
| estimated_labor_oil_change_hrs | 0.5 | training_data | 0.75 |
| estimated_labor_brake_front_hrs | 1.5 | training_data | 0.75 |
| estimated_labor_brake_rear_hrs | 1.5 | training_data | 0.75 |
| estimated_labor_spark_plug_hrs | 3.5 | training_data | 0.75 |
| estimated_labor_rotor_front_hrs | 2.0 | training_data | 0.75 |
| estimated_labor_rotor_rear_hrs | 2.0 | training_data | 0.75 |
| estimated_labor_serpentine_belt_hrs | 0.5 | training_data | 0.75 |
| estimated_labor_coolant_flush_hrs | 1.5 | training_data | 0.75 |
| estimated_labor_trans_fluid_hrs | 2.0 | training_data | 0.75 |
| estimated_labor_battery_hrs | 0.5 | training_data | 0.75 |
| estimated_labor_brake_fluid_flush_hrs | 1.0 | training_data | 0.75 |
| estimated_labor_timing_service_hrs | NULL | — chain engine (applicability rule) | — |

#### v7 R1 Token Breakdown

| Call | Tokens In | Tokens Out | Web Searches |
|------|-----------|------------|--------------|
| Batch 1A | 17,592 | 2,914 | 0 |
| Batch 1B | 226,928 | 4,556 | 11 |
| Batch 2 | 432,481 | 10,105 | 27 |
| **Total** | **677,001** | **17,575** | **38** |

**Cost**: $0.574 at Sonnet batch pricing ($1.50/MTok in × 0.5 + $7.50/MTok out × 0.5)

**12 null fields explanation**:
- Chain engine (applicability rule): `timing_service_miles`, `timing_service_months`, `timing_belt_oem`, `estimated_labor_timing_service_hrs`
- Sedan (applicability rule): `rear_wiper_size`
- BMW CBS-driven (not published): `spark_plug_months`, `air_filter_months`, `serpentine_belt_months`, `transmission_service_months`
- Not found: `diff_fluid_months`, `transfer_case_fluid_months`
- Not found despite part number: `air_filter_price`

---

## Cost Breakdown

### v7 Pricing Model

Anthropic Batch API pricing (50% off real-time):
- Sonnet `claude-sonnet-4-6`: $0.75/MTok input, $3.75/MTok output

### Per-Vehicle Cost Estimate

| Scenario | Cost | Notes |
|----------|------|-------|
| v7 cold (full enrichment) | ~$0.57 | First time this vehicle config is enriched |
| v7 cache hit | ~$0.00 | Same vehicle config already enriched |
| v7 parts cache hit, manual fresh | ~$0.48 | Parts catalog cached, manual re-scraped |
| v6 R3 (62 fields) | ~$0.32 | Previous version for comparison |
| v4.2 R4 (Haiku, 62 fields) | ~$0.005 | Cheapest version (Haiku batch, less accurate) |

### Cost Driver: Batch 1B

Batch 1B accounts for 226K/677K = **33% of input tokens** despite no scraped content input. Each web_search result injects ~8-20K tokens of page content into the context. 11 searches × ~20K avg = 226K tokens for Batch 1B alone.

### Annual Cost Estimate

At 1,000 enrichments/year with 50% cache hit rate:
- 500 cold enrichments × $0.57 = **$285/year**
- 500 cache hits × $0.00 = $0
- **Total: ~$285/year**

---

## Known Limitations & Future Work

### Current Gaps

1. **BMW month-based intervals** — BMW uses Condition Based Service (CBS), not fixed calendar intervals. `spark_plug_months`, `air_filter_months`, `serpentine_belt_months`, `transmission_service_months` are systematically null for BMW vehicles because BMW doesn't publish fixed month intervals. This is correct behavior.

2. **`body_class` not in DB** — `nhtsa.ts:getIdentity()` returns `body_class: null` because it's not stored at VIN-decode time. The sedan/coupe applicability rule for `rear_wiper_size` only fires if `body_class` is available from vPicData. For many vehicles, `rear_wiper_size` will remain in the gap-fill queue even for sedans.

3. **`coolant_capacity_qts`** — Sparsely documented for N63B44O2 specifically. Often returned from low-confidence sources. Currently 0.65 confidence (below the 0.80 threshold for `verified: true`).

4. **Batch 1B cost** — At $0.57/vehicle, v7 is 79% more expensive than v6. Main driver: Batch 1B's 11 web searches. Potential optimization: cap Batch 1B web searches at 5-7.

5. **`blocked_domains` in Batch API** — Silently ignored. The post-parser domain filter (`isBlockedDomain()`) is the only effective enforcement. Any new bad domain must be added to `BLOCKED_DOMAINS` and the service must be redeployed.

6. **Training data accuracy** — Labor hours all come from training data (conf: 0.75). Known inaccuracies: BMW `brake_fluid_flush_months` = 36 (training) vs 24 (correct per BMW spec). Correct approach: use web search results if available, fall back to training data.

### Potential Improvements

- **Cap Batch 1B searches**: Limit to 5-7 web searches per Batch 1B call → reduces ~$0.15/vehicle
- **Haiku for Batch 1B**: Since Batch 1B is searching for stable facts (intervals, fluid specs), Haiku may be sufficient → saves ~$0.10/vehicle
- **Store `body_class` at VIN decode**: Would enable sedan/coupe/convertible applicability rule for `rear_wiper_size`
- **Add `rotor_front_oem`/`rotor_rear_oem` to oemValidation**: Currently only 10 original OEM fields are validated; the 4 new v7 OEM fields are not
- **Add make coverage for Acura/Lincoln/Genesis**: Currently missing from Phase 1 brand-specific scrapers (Genesis has oempartsonline.com entry but no brand-specific scraper)
- **Batch 1A temperature**: Currently 0 (pure extraction). Could raise to 0.1 for slightly more creative inference from ambiguous scraped text.
- **Service cache for 25-service pricing**: Currently all 25 services are re-priced on each enrichment. High-confidence pricing (e.g., dealer-published rates) could be cached similarly to parts catalog.

### Adding a New Make to the Source Registry

1. Check if `{make}.oempartsonline.com` exists and serves the right data
2. If yes: add one line to `SOURCE_REGISTRY` in `sourceRegistry.ts` using `oemPartsOnlineConfig(make)`
3. If no (brand-specific scraper needed): add to `OEM_PARTS_ONLINE_SUBDOMAINS` + implement a brand config block similar to BMW/Toyota/Honda
4. Add make's OEM part number format to `oemValidation.ts` `OEM_PATTERNS`
5. No changes to pipeline code required — `getSourceConfig()` handles the lookup

### Test Script

`scripts/run_v7_test.js`:
- Deploys code to Convex dev, clears enrichment record, schedules fresh enrichment
- Polls every 1 minute for up to 45 minutes
- On completion: prints all 88 fields by category, fill rate, token/cost breakdown
- Saves result to `scripts/v7result.json`

```bash
node scripts/run_v7_test.js
```
