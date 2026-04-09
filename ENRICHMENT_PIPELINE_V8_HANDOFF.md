# Vehicle Enrichment Pipeline v8 -- Technical Handoff

> **Otopair** | AppFlow Studios
> **Pipeline version**: v8 (normalized tables, 3-tier enrichment)
> **Last updated**: 2026-03-23
> **Codebase root**: `convex/vehicleEnrichment/`
> **Backend**: Convex (real-time, serverless, TypeScript)

---

## 1. System Overview

The Vehicle Enrichment Pipeline takes a bare vehicle identity (year, make, model, trim, engine code) and produces a fully populated set of normalized maintenance records: fluid specifications, service intervals, OEM part numbers with fitment data, retail pricing, labor time estimates, and drivetrain/trim specifications.

The system operates in three tiers:

| Tier | Entry Point | Method | Cost | Latency |
|------|------------|--------|------|---------|
| **Tier 1** | `enrichVehicleBatchV3` | Anthropic Message Batches API (Claude Haiku 4.5) with FireCrawl scraping | ~$0.50--0.60 per vehicle | 7--13 minutes |
| **Tier 2** | `runTier2Enrichment` | Site-scoped FireCrawl searches on discovered source domains, regex extraction, consensus | ~30 FireCrawl credits (~$0) | 2--5 minutes |
| **Tier 3** | `processMechanicVerification` | Mechanic feedback after completing jobs | $0 | Instant |

Data flows through normalized tables (engines, transmissions, vehicle_configs, trim_specs, drivetrain_configs, oem_parts, part_fitments, part_prices, service_intervals, labor_times) rather than the deprecated flat `enriched_engine_configs` table. An evidence-based provenance layer (enrichment_evidence, enrichment_runs) tracks every observed value back to its source URL, domain, confidence, and enrichment run.

### Trigger

Enrichment is triggered when a vehicle is confirmed after VIN decode. The `vehicle_pipeline.ts:processVin` action decodes the VIN via NHTSA vPIC, creates make/model/trim/engine records, and then schedules `enrichVehicleBatchV3` via Convex's scheduler.

### Cache

If a `vehicle_configs` row already exists for the computed `config_key` (format: `{year}_{make}_{model}_{trim}_{engineCode}` lowercased, spaces replaced with underscores, non-alphanumeric stripped), the pipeline returns immediately with `status: "cache_hit"` and attaches the existing config to the vehicle record. No API calls are made.

---

## 2. Schema Reference

All tables live in `convex/schema.ts`. Field types use Convex's value system (`v.string()`, `v.float64()`, `v.boolean()`, `v.id("table")`, `v.optional(...)`, `v.array(...)`, `v.object(...)`, `v.any()`, `v.union(...)`, `v.literal(...)`).

### 2.1 makes

Stores vehicle manufacturers. Seeded with 30 makes via `seeds/seedMakes.ts`.

| Field | Type | Description |
|-------|------|-------------|
| name | string | Make name (e.g., "BMW", "Toyota") |
| logo | optional id("cdn_assets") | Reference to CDN asset for logo |
| logo_url | optional string | Direct URL to logo image |
| slug | optional string | URL-safe slug (e.g., "mercedes-benz") |
| country | optional string | Country of origin (e.g., "Germany", "Japan") |
| oem_part_pattern | optional string | Regex pattern for validating OEM part numbers |
| oem_part_pattern_alt | optional string | Alternate regex pattern |
| parent_group | optional string | Parent corporate group |
| created_at | optional float64 | Epoch ms timestamp |

**Indexes**: `by_slug` (slug), `by_name` (name)

### 2.2 models

Vehicle models linked to makes.

| Field | Type | Description |
|-------|------|-------------|
| make_id | id("makes") | Parent make |
| name | string | Model name (e.g., "5 Series", "Camry") |
| slug | optional string | URL-safe slug |
| category | optional string | Vehicle category (e.g., "sedan", "SUV") |
| created_at | optional float64 | Epoch ms timestamp |

**Index**: `by_make_id` (make_id)

### 2.3 generations

Platform generations for a model (e.g., G30 BMW 5 Series 2017--2023).

| Field | Type | Description |
|-------|------|-------------|
| model_id | id("models") | Parent model |
| name | string | Generation name (e.g., "G30") |
| start_year | float64 | First model year |
| end_year | optional float64 | Last model year (null if current) |
| platform | optional string | Platform code |
| body_class | string | Body type (sedan, SUV, truck, etc.) |
| steering_type | string | "electric" or "hydraulic" |
| parking_brake_type | string | "electronic", "manual_drum", or "manual_disc" |
| has_rear_wiper | boolean | Whether the generation has a rear wiper |
| cabin_filter_access | optional string | Location description for cabin filter |
| created_at | float64 | Epoch ms timestamp |

**Indexes**: `by_model` (model_id), `by_years` (start_year)

### 2.4 engines

Engine specifications. Created at VIN decode time with basic data; enriched by Tier 1 with fluid specs, timing system, and other details.

| Field | Type | Description |
|-------|------|-------------|
| trim_id | id("trims") | Parent trim |
| cylinders | float64 | Number of cylinders |
| displacement_liters | string | Displacement as string (e.g., "4.4") |
| engine_code | string | Engine code (e.g., "N63B44TU2") |
| fuel_type | string | Fuel type (e.g., "gasoline", "diesel", "electric") |
| engine_family | optional string | Engine family (e.g., "N63") |
| make_id | optional id("makes") | Make reference for cross-queries |
| displacement_l | optional float64 | Displacement as numeric |
| configuration | optional string | Engine configuration (e.g., "V", "Inline", "Flat") |
| aspiration | optional string | "turbo", "twin-turbo", "supercharged", "natural" |
| fuel_injection | optional string | "direct", "port", "dual" |
| timing_system | optional string | "chain", "belt", or "gear" |
| has_serpentine_belt | optional boolean | Whether engine uses a serpentine belt |
| oil_viscosity | optional string | OEM oil spec (e.g., "0W-30") |
| oil_spec_standard | optional string | Oil standard (e.g., "BMW LL-01") |
| oil_capacity_qts | optional float64 | Oil capacity in quarts including filter |
| coolant_type | optional string | Coolant spec (e.g., "BMW HT-12") |
| coolant_capacity_qts | optional float64 | Cooling system capacity in quarts |
| spark_plug_quantity | optional float64 | Number of spark plugs |
| spark_plug_gap_mm | optional float64 | Spark plug gap in mm |
| timing_idler_count | optional float64 | Number of timing idler pulleys |
| water_pump_timing_driven | optional boolean | Whether water pump is driven by timing system |
| data_quality | optional string | "scraped", "web_search", "training_data", "mechanic_verified" |
| created_at | optional float64 | Epoch ms timestamp |

**Indexes**: `by_trim_id` (trim_id), `by_engine_code` (engine_code), `by_engine_family` (engine_family), `by_make` (make_id)

### 2.5 transmissions

Transmission specifications.

| Field | Type | Description |
|-------|------|-------------|
| trim_id | id("trims") | Parent trim |
| transmission_type | string | Base type at VIN decode |
| code | optional string | Transmission code (e.g., "8HP75") |
| notes | optional string | Free-text notes |
| created_at | float64 | Epoch ms timestamp |
| confidence_score | optional float64 | Data confidence 0.0--1.0 |
| type | optional string | Enriched type (e.g., "automatic", "CVT", "DCT") |
| speeds | optional float64 | Number of speeds/gears |
| make_id | optional id("makes") | Make reference |
| manufacturer | optional string | Transmission manufacturer (e.g., "ZF", "Aisin") |
| fluid_type | optional string | OEM fluid spec (e.g., "ZF Lifeguard 8") |
| fluid_capacity_drain_fill_qts | optional float64 | Drain-and-fill capacity in quarts |
| is_lifetime_fill | optional boolean | Whether OEM considers fluid "lifetime" |
| has_serviceable_filter | optional boolean | Whether the transmission has a user-replaceable filter |
| service_method | optional string | "drain_fill", "flush", "pan_drop" |
| data_quality | optional string | Source quality indicator |

**Indexes**: `by_trim` (trim_id), `by_trim_type` (trim_id, transmission_type), `by_code` (code), `by_make` (make_id)

### 2.6 vehicle_configs

The central enrichment record. One row per unique year+make+model+trim+engine combination. Links to all other enrichment tables.

| Field | Type | Description |
|-------|------|-------------|
| config_key | string | Deterministic key: `{year}_{make}_{model}_{trim}_{engineCode}` normalized |
| year | float64 | Model year |
| make_id | id("makes") | Make reference |
| model_id | id("models") | Model reference |
| generation_id | optional id("generations") | Generation reference |
| trim_name | string | Trim name (e.g., "M550i xDrive") |
| trim_slug | string | URL-safe trim slug |
| engine_id | id("engines") | Engine reference |
| transmission_id | optional id("transmissions") | Transmission reference |
| drivetrain | string | "FWD", "RWD", "AWD", or "4WD" |
| has_brake_pad_sensor | optional boolean | European luxury vehicles typically true |
| brake_fluid_type | optional string | Brake fluid spec (e.g., "DOT 4") |
| brake_fluid_capacity_oz | optional float64 | Brake fluid capacity in ounces |
| ps_fluid_type | optional string | Power steering fluid spec |
| ps_fluid_capacity_oz | optional float64 | Power steering fluid capacity in ounces |
| enrichment_status | string | "pending", "in_progress", "complete", "partial", "failed", "verified" |
| fill_rate | float64 | Data completeness percentage 0--100 |
| confidence_avg | optional float64 | Average confidence across all fields |
| last_enriched_at | optional float64 | Epoch ms of last enrichment run |
| last_verified_at | optional float64 | Epoch ms of last mechanic verification |
| enrichment_version | optional string | Pipeline version (e.g., "v8") |
| verification_count | float64 | Number of mechanic verifications received |
| created_at | float64 | Epoch ms timestamp |

**Indexes**: `by_config_key` (config_key), `by_engine` (engine_id), `by_make_model_year` (make_id, model_id, year), `by_enrichment_status` (enrichment_status), `by_fill_rate` (fill_rate)

### 2.7 drivetrain_configs

Drivetrain-specific fluid and component data, linked to vehicle_configs.

| Field | Type | Description |
|-------|------|-------------|
| vehicle_config_id | id("vehicle_configs") | Parent config |
| drivetrain_type | string | "FWD", "RWD", "AWD", "4WD" |
| has_differential | boolean | Whether vehicle has a serviceable differential |
| diff_fluid_type | optional string | Differential fluid spec |
| diff_fluid_capacity_qts | optional float64 | Differential fluid capacity in quarts |
| lsd_additive_required | optional boolean | Whether LSD additive is needed |
| has_transfer_case | boolean | Whether vehicle has a transfer case |
| tc_fluid_type | optional string | Transfer case fluid spec |
| tc_fluid_capacity_qts | optional float64 | Transfer case fluid capacity in quarts |
| data_quality | optional string | Source quality indicator |
| created_at | float64 | Epoch ms timestamp |

**Index**: `by_vehicle_config` (vehicle_config_id)

### 2.8 trim_specs

Tire, wheel, wiper, and battery specifications.

| Field | Type | Description |
|-------|------|-------------|
| trim_id | optional id("trims") | Legacy trim reference |
| tire_size_front | optional string | Front tire size (e.g., "245/45R18") |
| tire_size_rear | optional string | Rear tire size |
| recommended_tire_pressure_front_psi | optional float64 | Front tire pressure in PSI |
| recommended_tire_pressure_rear_psi | optional float64 | Rear tire pressure in PSI |
| lug_nut_torque_ft_lbs | optional float64 | Lug nut torque in ft-lbs |
| wiper_blade_driver_size_in | optional float64 | Driver-side wiper blade size in inches |
| wiper_blade_passenger_size_in | optional float64 | Passenger-side wiper blade size in inches |
| wiper_blade_rear_size_in | optional float64 | Rear wiper blade size in inches |
| parking_brake_type | optional string | Parking brake type |
| confidence_score | optional float64 | Data confidence 0.0--1.0 |
| created_at | float64 | Epoch ms timestamp |
| vehicle_config_id | optional id("vehicle_configs") | Vehicle config reference |
| is_staggered | optional boolean | Whether front/rear tire sizes differ |
| tire_directional | optional boolean | Whether tires are directional |
| is_run_flat | optional boolean | Whether tires are run-flat |
| alignment_type | optional string | Alignment type |
| battery_group | optional string | Battery group size (e.g., "H8/Group 49") |
| battery_cca | optional float64 | Cold cranking amps |
| battery_type | optional string | Battery chemistry (e.g., "AGM", "lead-acid") |
| battery_location | optional string | Battery location (e.g., "trunk", "engine bay") |
| data_quality | optional string | Source quality indicator |

**Indexes**: `by_trim` (trim_id), `by_vehicle_config` (vehicle_config_id)

**Note on dual field names**: The schema uses legacy names (`tire_size_front`, `wiper_blade_driver_size_in`) but the pipeline passes v3 names (`front_tire_size`, `front_wiper_size_in`). The `upsertTrimSpecs` mutation maps between them. When reading, check both: `trim.tire_size_front ?? trim.front_tire_size`.

### 2.9 oem_parts

OEM part catalog with supersession tracking.

| Field | Type | Description |
|-------|------|-------------|
| oem_part_number | string | OEM part number (e.g., "11427583220") |
| name | optional string | Human-readable part name |
| category | optional string | Top-level category (e.g., "filter", "brake") |
| notes | optional string | Free-text notes |
| created_at | float64 | Epoch ms timestamp |
| part_number_formatted | optional string | Formatted display version |
| make_id | optional id("makes") | Make this part belongs to |
| subcategory | optional string | Specific subcategory (e.g., "oil_filter", "front_brake_pad") |
| is_current | optional boolean | Whether this is the current (not superseded) part |
| superseded_by | optional string | Part number that replaces this one |
| supersedes | optional string | Part number this one replaced |
| first_seen_at | optional float64 | First time this part was observed |
| last_confirmed_at | optional float64 | Last time this part was confirmed by a source |
| source_count | optional float64 | Number of independent sources confirming this part |
| data_quality | optional string | Source quality indicator |

**Indexes**: `by_part_number` (oem_part_number), `by_category` (category), `by_subcategory` (subcategory), `by_make_category` (make_id, category)

### 2.10 part_fitments

Links parts to vehicle configs for specific services.

| Field | Type | Description |
|-------|------|-------------|
| part_id | id("oem_parts") | Part reference |
| vehicle_config_id | id("vehicle_configs") | Vehicle config reference |
| service_type | string | Service slug this part is used for |
| quantity_needed | float64 | How many of this part are needed |
| position | optional string | "front", "rear", "left", "right" |
| confidence | optional float64 | Fitment confidence 0.0--1.0 |
| source_count | optional float64 | Number of sources confirming this fitment |
| first_confirmed_at | optional float64 | First confirmation timestamp |
| last_confirmed_at | optional float64 | Last confirmation timestamp |
| mechanic_verified | optional boolean | Whether a mechanic has confirmed this fitment |
| data_quality | optional string | Source quality indicator |
| created_at | float64 | Epoch ms timestamp |

**Indexes**: `by_vehicle_config` (vehicle_config_id), `by_part` (part_id), `by_config_service` (vehicle_config_id, service_type)

### 2.11 part_prices

Retail pricing per part per source.

| Field | Type | Description |
|-------|------|-------------|
| part_id | id("oem_parts") | Part reference |
| price | float64 | Price in USD |
| price_type | string | "discount", "msrp", "dealer" |
| source_url | optional string | URL where price was found |
| source_domain | string | Domain of the source |
| refreshed_at | float64 | When this price was last refreshed |
| created_at | float64 | Epoch ms timestamp |

**Indexes**: `by_part` (part_id), `by_part_source` (part_id, source_domain)

### 2.12 services

Service catalog. Seeded with 23 services across 7 categories via `seeds/seedServices.ts`.

| Field | Type | Description |
|-------|------|-------------|
| default_labor_hours | float64 | Default book time in hours |
| description | string | Human-readable description |
| display_order | float64 | UI ordering |
| has_options | boolean | Whether service has user-selectable options |
| is_labor_only | boolean | Whether service requires no parts |
| name | string | Service name (e.g., "Oil Change") |
| service_category_id | id("service_categories") | Category reference |
| slug | string | URL-safe slug (e.g., "oil_change") |
| requires_parts | optional boolean | Whether service requires parts |
| requires_fluids | optional boolean | Whether service requires fluids |
| requires_ice_engine | optional boolean | If true, not applicable to EVs |
| requires_timing_belt | optional boolean | If true, only for belt engines |
| requires_hydraulic_ps | optional boolean | If true, only for hydraulic PS |
| requires_differential | optional boolean | If true, only for vehicles with serviceable diff |
| requires_rotatable_tires | optional boolean | If true, not applicable if staggered+directional |
| requires_state_inspection | optional boolean | State inspection requirement |
| requires_emissions_test | optional boolean | Emissions test requirement |
| min_model_year | optional float64 | Minimum model year (e.g., 1996 for OBD-II) |
| created_at | optional float64 | Epoch ms timestamp |

**Indexes**: `by_slug` (slug), `by_category` (service_category_id)

### 2.13 service_intervals

Vehicle-specific maintenance intervals.

| Field | Type | Description |
|-------|------|-------------|
| vehicle_config_id | id("vehicle_configs") | Vehicle config reference |
| service_id | id("services") | Service reference |
| interval_miles | optional float64 | Miles between service |
| interval_months | optional float64 | Months between service |
| status | string | "scheduled", "inspect_only", "conditional_severe", "not_applicable", "cbs_driven" |
| display_string | optional string | Human-readable display (e.g., "Every 10,000 miles or 12 months") |
| confidence | optional float64 | Interval confidence 0.0--1.0 |
| source_count | optional float64 | Number of sources confirming this interval |
| mechanic_verified | optional boolean | Whether a mechanic has confirmed this interval |
| data_quality | optional string | Source quality indicator |
| created_at | float64 | Epoch ms timestamp |

**Indexes**: `by_vehicle_config` (vehicle_config_id), `by_config_service` (vehicle_config_id, service_id)

### 2.14 labor_times

Labor time estimates per vehicle per service.

| Field | Type | Description |
|-------|------|-------------|
| vehicle_config_id | optional id("vehicle_configs") | Vehicle config reference |
| engine_family | optional string | Engine family for cross-reference |
| service_id | id("services") | Service reference |
| book_hours | float64 | Standard book time in hours |
| empirical_hours | optional float64 | Rolling average of actual mechanic-reported hours |
| empirical_sample_size | float64 | Number of mechanic data points |
| empirical_p25 | optional float64 | 25th percentile empirical hours |
| empirical_p75 | optional float64 | 75th percentile empirical hours |
| source | string | "training_data", "web_search", "scraped", "mechanic_verified", "empirical" |
| confidence | optional float64 | Confidence 0.0--1.0 |
| data_quality | optional string | Source quality indicator |
| created_at | float64 | Epoch ms timestamp |

**Indexes**: `by_vehicle_config` (vehicle_config_id, service_id), `by_engine_family` (engine_family)

### 2.15 enrichment_evidence

Per-field provenance. Every observed value from every source gets a row. This is what the consensus engine uses to resolve conflicts.

| Field | Type | Description |
|-------|------|-------------|
| entity_type | string | "engine", "transmission", "vehicle_config", "trim_spec", "drivetrain_config", "part" |
| entity_id | string | Stringified Convex ID of the entity |
| field_name | string | Field name within the entity |
| observed_value | string | The observed value (stringified) |
| observed_type | string | "string" or "number" |
| source_url | optional string | URL where value was observed |
| source_domain | optional string | Domain of the source |
| source_type | string | "scraped", "web_search", "training_data", "mechanic", "sibling_engine", "gap_fill", "nhtsa" |
| confidence | float64 | Source confidence 0.0--1.0 |
| enrichment_run_id | optional id("enrichment_runs") | Which run produced this evidence |
| observed_at | float64 | When this observation was made |
| is_latest | boolean | Whether this is the most recent observation for this entity+field |
| created_at | float64 | Epoch ms timestamp |

**Indexes**: `by_entity` (entity_type, entity_id, field_name), `by_entity_field` (entity_id, field_name), `by_source_domain` (source_domain), `by_enrichment_run` (enrichment_run_id)

### 2.16 enrichment_runs

Audit log for each enrichment execution.

| Field | Type | Description |
|-------|------|-------------|
| vehicle_config_id | optional id("vehicle_configs") | Vehicle config (null for discovery-only runs) |
| version | string | Pipeline version (e.g., "v8") |
| trigger | string | What triggered this run (e.g., "vin_decode", "manual", "test") |
| status | string | "started", "batch1_submitted", "batch1_complete", "batch2_submitted", "complete", "failed" |
| total_tokens_in | optional float64 | Total input tokens across all API calls |
| total_tokens_out | optional float64 | Total output tokens |
| total_web_searches | optional float64 | Total web searches performed |
| total_firecrawl_credits | optional float64 | Total FireCrawl credits used |
| estimated_cost_usd | optional float64 | Estimated dollar cost |
| started_at | float64 | Epoch ms when run started |
| completed_at | optional float64 | Epoch ms when run completed |
| duration_ms | optional float64 | Total duration in milliseconds |
| fields_filled | optional float64 | Number of fields with non-null values |
| fields_total | optional float64 | Total number of fields tracked |
| fill_rate | optional float64 | Percentage of fields filled |
| fields_changed | optional array of string | List of field names that changed values |
| errors | optional array of string | List of error messages |
| batch_ids | optional any | Batch API IDs for debugging |
| scrape_cache_hit | optional boolean | Whether scrape cache was used |
| created_at | float64 | Epoch ms timestamp |

**Indexes**: `by_vehicle_config` (vehicle_config_id), `by_status` (status), `by_created_at` (created_at)

### 2.17 mechanic_verifications

Post-job feedback from mechanics.

| Field | Type | Description |
|-------|------|-------------|
| mechanic_id | id("mechanics") | Mechanic who verified |
| vehicle_config_id | id("vehicle_configs") | Vehicle config verified |
| job_id | optional id("job_actuals") | The job this verification is for |
| service_id | id("services") | Service that was performed |
| verifications | array of objects | Array of `{ field_name: string, our_value: string, status: string, corrected_value?: string, notes?: string }` |
| actual_labor_hours | optional float64 | Actual hours the mechanic spent |
| parts_used_correct | optional boolean | Whether OEM parts matched |
| overall_accuracy | string | "accurate", "mostly_accurate", "needs_correction" |
| verified_at | float64 | When the verification was submitted |
| created_at | float64 | Epoch ms timestamp |

**Indexes**: `by_vehicle_config` (vehicle_config_id), `by_mechanic` (mechanic_id), `by_job` (job_id), `by_service` (service_id)

### 2.18 source_registry

Discovered and tracked data sources per make.

| Field | Type | Description |
|-------|------|-------------|
| make_id | id("makes") | Make this source covers |
| source_type | string | "parts_catalog", "oem_catalog", "owner_manual", "parts_retailer" |
| domain | string | Domain name (e.g., "bmwpartsdeal.com") |
| url_template | string | URL template with `{year}`, `{make}`, `{modelSlug}`, `{trimSlug}` placeholders |
| slug_fn_type | string | "trim_only" or "model_trim" |
| part_slug_map | optional any | Maps part field names to URL slug segments |
| manual_queries | optional array of string | Search queries for this source |
| reliability_score | optional float64 | Computed reliability 0.0--1.0 |
| total_observations | optional float64 | Total evidence rows from this source |
| accuracy_rate | optional float64 | Percentage of observations matching consensus |
| is_blocked | boolean | Whether this source is blocked |
| block_reason | optional string | Why it was blocked |
| last_scraped_at | optional float64 | When this source was last scraped |
| last_scrape_success | optional boolean | Whether the last scrape succeeded |
| created_at | float64 | Epoch ms timestamp |

**Indexes**: `by_make` (make_id), `by_domain` (domain), `by_blocked` (is_blocked)

### 2.19 blocked_domains

Domains explicitly blocked from all pipeline usage.

| Field | Type | Description |
|-------|------|-------------|
| domain | string | Domain name |
| reason | string | Why it was blocked |
| blocked_at | float64 | When it was blocked |
| blocked_by | string | "manual", "auto_accuracy", "seed" |
| accuracy_at_block | optional float64 | Accuracy rate when auto-blocked |
| created_at | float64 | Epoch ms timestamp |

**Index**: `by_domain` (domain)

### 2.20 scrape_cache

Cached FireCrawl results to avoid re-scraping.

| Field | Type | Description |
|-------|------|-------------|
| cache_key | string | Deterministic key: `{make}_{model}_{year}_{sourceType}` lowercased |
| url | string | URL that was scraped |
| domain | string | Domain of the URL |
| source_type | string | "parts_catalog", "owner_manual", "pricing" |
| make_id | optional id("makes") | Make reference |
| model_id | optional id("models") | Model reference |
| year | optional float64 | Vehicle year |
| markdown | string | Scraped markdown content |
| markdown_length | float64 | Content length in characters |
| scraped_at | float64 | When the scrape was performed |
| expires_at | float64 | When this cache entry expires |
| ttl_days | float64 | TTL in days (30 for parts, 90 for manuals, 7 for pricing) |
| scrape_success | boolean | Whether the scrape was successful |
| http_status | optional float64 | HTTP status code from scrape |
| created_at | float64 | Epoch ms timestamp |

**Indexes**: `by_cache_key` (cache_key), `by_expires_at` (expires_at), `by_make_year` (make_id, year)

---

## 3. File Inventory

All files live under `convex/vehicleEnrichment/` unless otherwise noted.

### 3.1 v3pipeline.ts (Main Pipeline Orchestrator)

The primary entry point. Implements Tier 1 enrichment via Anthropic Message Batches API.

**Exports**:

- `enrichVehicleBatchV3` -- `internalAction`. Main entry point. Accepts `vehicleId`, `year`, `make`, `model`, `trim`, `engineCode`, `displacement`. Checks for cache hit, resolves make/model IDs, scrapes sources, creates enrichment run, submits Batch 1A+1B in parallel, schedules poll.
- `_pollBatch1` -- `internalAction`. Polls Batch 1A+1B status every 60 seconds (up to 180 attempts). On completion: parses both batches, merges (1A wins on conflicts), applies applicability rules, runs sanity checks, validates OEM parts, submits Batch 2, schedules Batch 2 poll.
- `_pollBatch2` -- `internalAction`. Polls Batch 2 status. On completion: parses gap fields and service pricing, merges into final fields, writes all normalized data to the database, computes fill rate, completes the enrichment run, attaches vehicle_config to the vehicle record.

**Internal functions** (not exported but critical):

- `parseField(raw)` -- Coerces raw Claude output into a `FieldResult`. Handles dollar strings, numeric strings, type normalization.
- `parseInterval(raw)` -- Parses interval objects into miles/months/status/display_string.
- `parseBatch1a(data)` -- Parses Batch 1A response into flat `Record<string, FieldResult>`: fluids, intervals, attributes, OEM parts, pricing, battery, spark plug, trim specs.
- `parseBatch1b(data)` -- Parses Batch 1B response. Extends 1A parser with trans_fluid_type, diff_fluid_type, transfer_case_fluid_type, diff/transfer_case intervals.
- `mergeBatch1(a, b)` -- Merges 1A and 1B results. 1A values take priority; 1B fills nulls. Ensures all V4_FIELD_KEYS exist.
- `parseBatch2(data, nullFields)` -- Parses gap fields (with blocked domain filtering) and service pricing array.
- `mapPricingToFields(services)` -- Maps service pricing results to flat field names using `SERVICE_FIELD_MAP`.
- `writeNormalizedData(ctx, fields, ...)` -- Writes parsed fields to all normalized tables: engines, transmissions, vehicle_configs, drivetrain_configs, trim_specs, OEM parts+fitments, service intervals, labor times, part prices, evidence rows.
- `calculateV3FillRate(ctx, vehicleConfigId, engineId, transmissionId)` -- Counts filled fields across all normalized tables. Returns percentage and breakdown string.
- `calculateFlatFillRate(fields)` -- Legacy flat-field fill rate for logging comparison.

**Constants**:

- `MAX_POLL_ATTEMPTS = 180`
- `POLL_INTERVAL_MS = 60,000` (1 minute)
- `MAKES_WITH_BRAKE_PAD_SENSORS` -- Set: BMW, Mercedes-Benz, Porsche, Audi, Mini, Rolls-Royce
- `SERVICE_NAME_TO_SLUG` -- Maps Batch 2 service names to service table slugs
- `PART_FIELD_MAP` -- Maps OEM part field names to `{ name, category, subcategory, serviceSlug, position }`
- `INTERVAL_TO_SERVICE` -- Maps interval field prefixes to service slugs
- `SERVICE_FIELD_MAP` -- Maps service names to pricing and labor field names

### 3.2 v3mutations.ts (Database Write Layer)

All mutations are `internalMutation` (not callable from clients).

**Exports (16 mutations)**:

1. `upsertVehicleConfig` -- Creates or updates vehicle_configs by config_key. Sets verification_count to 0 on create.
2. `patchVehicleConfig` -- Patches individual fields on an existing vehicle_configs row (brake pad sensor, brake fluid, PS fluid, enrichment status, fill rate, confidence, timestamps).
3. `upsertDrivetrainConfig` -- Creates or updates drivetrain_configs by vehicle_config_id.
4. `upsertTrimSpecs` -- Creates or updates trim_specs by vehicle_config_id. **Maps v3 arg names to legacy schema names**: front_tire_size -> tire_size_front, tire_pressure_front -> recommended_tire_pressure_front_psi, front_wiper_size_in -> wiper_blade_driver_size_in (parsed from string to float).
5. `updateEngineSpecs` -- Patches engine record with enriched specs (oil, coolant, timing, fuel injection, aspiration, spark plug, etc.).
6. `updateTransmissionSpecs` -- Patches transmission record with enriched specs (fluid type, capacity, lifetime fill, filter, service method, manufacturer, speeds, type).
7. `upsertPartAndFitment` -- Upserts into oem_parts by oem_part_number AND upserts into part_fitments by config+service+part. Increments source_count on both.
8. `upsertPartPrice` -- Upserts into part_prices by part_id+source_domain.
9. `upsertServiceInterval` -- Upserts into service_intervals by vehicle_config_id+service_id.
10. `upsertLaborTime` -- Upserts into labor_times by vehicle_config_id+service_id. **Will not overwrite mechanic-verified data**: only updates if existing source is "training_data" (lowest priority).
11. `addEvidenceBatch` -- Batch-inserts enrichment_evidence rows. Accepts an array of evidence objects. Sets is_latest=true on all new rows.
12. `createEnrichmentRun` -- Creates an enrichment_runs record with status "started".
13. `updateEnrichmentRun` -- Patches an existing enrichment_runs record with status, metrics, errors, etc.
14. `attachVehicleConfig` -- Sets vehicle_config_id on the vehicles table record.
15. `runSourceScoring` -- Delegates to `services/sourceScoring.ts:updateSourceScores`.
16. `addSourceRegistry` -- Inserts a new source_registry record. Skips if domain already exists.

### 3.3 v3queries.ts (Database Read Layer)

All queries are `internalQuery` (not callable from clients), except two helper mutations.

**Exports (28 functions)**:

1. `getVehicleConfigByKey(configKey)` -- Looks up vehicle_configs by config_key.
2. `getMakeByName(name)` -- Looks up makes by name.
3. `getModelByMakeAndName(makeId, name)` -- Finds a model by make_id and name.
4. `createModel(make_id, name)` -- **internalMutation**. Creates a new model record.
5. `getVehicle(vehicleId)` -- Gets a vehicle by ID.
6. `getEngine(engineId)` -- Gets an engine by ID.
7. `getTransmission(transmissionId)` -- Gets a transmission by ID.
8. `getServiceBySlug(slug)` -- Looks up a service by slug.
9. `getFitmentsByConfigAndService(vehicleConfigId, serviceType)` -- Gets fitments for a config+service.
10. `getVehicleConfigById(vehicleConfigId)` -- Gets a vehicle config by ID.
11. `getDrivetrainConfig(vehicleConfigId)` -- Gets drivetrain config for a vehicle config.
12. `getTrimSpecs(vehicleConfigId)` -- Gets trim specs for a vehicle config.
13. `getPartFitments(vehicleConfigId)` -- Gets all fitments for a vehicle config.
14. `getServiceIntervals(vehicleConfigId)` -- Gets all service intervals for a vehicle config.
15. `getLaborTimes(vehicleConfigId)` -- Gets all labor times for a vehicle config.
16. `getPricedPartCount(vehicleConfigId)` -- Counts fitments that have at least one part_price row.
17. `getSourcesForMake(make_id)` -- Gets all source_registry entries for a make.
18. `getBlockedDomains()` -- Gets all blocked_domains rows.
19. `getAllMakes()` -- Gets all makes.
20. `getMakeById(makeId)` -- Gets a make by ID.
21. `getModelById(modelId)` -- Gets a model by ID.
22. `getEvidenceForField(entityId, fieldName)` -- Gets all evidence for a specific entity+field.
23. `getEvidenceCount(entityId)` -- Counts total evidence rows for an entity.
24. `getEvidenceForEntity(entityId)` -- Gets all evidence rows for an entity.
25. `getEnrichmentRuns(vehicleConfigId)` -- Gets all enrichment runs for a vehicle config.
26. `getAllServices()` -- Gets all service records.
27. `getPartById(partId)` -- Gets an OEM part by ID.
28. `getFirstShop()` -- Gets the first shop record (test helper).
29. `createTestShop()` -- **internalMutation**. Creates a test shop (test helper).
30. `getOrCreateTestMechanic(shopId)` -- **internalMutation**. Finds or creates a test mechanic (test helper).

### 3.4 types.ts (Type Definitions)

**Exports**:

- `FieldResult` -- Interface: `{ value, source_url, source_type, confidence, flagged, flag_reason }`. Source types: "web_search", "scraped", "training_data", "sibling_engine", "gap_fill", "nhtsa".
- `VehicleIdentity` -- Interface for NHTSA vPIC decoded data: drivetrain, turbo, transmission_type, fuel_injection_type, timing_system, cylinders, displacement_l, fuel_type, body_class, engine_config, make, model, model_year, plant_city, plant_country.
- `IntervalResult` -- Interface: `{ miles: FieldResult, months: FieldResult, status, display_string }`.
- `ServicePricingResult` -- Interface for Batch 2 pricing: service_name, is_applicable, labor_hours, parts_cost_low, parts_cost_high, total_cost_low, total_cost_high, confidence, tech_notes.
- `VehicleInput` -- Interface: `{ vehicleId, year, make, model, trim, engineCode, displacement, cylinders?, fuelType? }`.
- `Call1AResults` -- Full typed structure for Batch 1A output (fluids, intervals, attributes).
- `Call1BResults` -- Full typed structure for Batch 1B output (oem_parts, battery, spark_plug, parking_brake_type, trim_specs).
- `CallLogEntry` -- Interface: `{ call, tokensIn, tokensOut, webSearches, durationMs }`.
- `emptyField()` -- Factory: returns a FieldResult with all null values.
- `emptyInterval()` -- Factory: returns an IntervalResult with empty fields.
- `buildEngineKey(input)` -- Builds deterministic config key from VehicleInput.
- `SIBLING_SAFE_FIELDS` -- Set of 11 field names safe to copy from sibling engine records: timing_system, drivetrain, turbo, power_steering_type, parking_brake_type, spark_plug_quantity, fuel_injection_type, transmission_type, trans_fluid_type, diff_fluid_type, transfer_case_fluid_type.
- `V4_FIELD_KEYS` -- Const array of 80 flat field keys for fill rate calculation. Covers fluids (6), intervals (18), attributes (6), OEM parts (10), battery/electrical (5), trim (7), pricing (6), labor (4), plus v7 additions: 4 new OEM parts, 3 new fluids, 4 new fluid intervals, 7 new pricing, 8 new labor.
- `SERVICE_LIST` -- Const array of 22 service names for pricing.

### 3.5 helpers.ts (Legacy Types)

Legacy type definitions from the pre-v3 pipeline. Still imported by `gapFill.ts`, `sourceVerifier.ts`, and `firecrawl.ts`.

**Exports**:

- `FieldResult` (legacy) -- Interface with `{ value, source, confidence, verified, apiConfirmed, apiDisagreed, apiValue }`. Different from types.ts FieldResult.
- `EnrichedVehicleData` -- Legacy flat enrichment record type (deprecated).
- `VehicleInput` -- Same shape as types.ts VehicleInput (without optional fields).
- `FirecrawlResult` -- Interface: `{ url, markdown, title }`.
- `ApiVerificationResult` -- Legacy verification result type.
- `ENRICHMENT_FIELD_KEYS` -- Legacy list of 30 field keys.
- `CALL_1A_FIELDS` -- 21 fields extracted by Call 1A.
- `CALL_1B_FIELDS` -- 10 fields extracted by Call 1B.
- `buildEngineKey(input)` -- Legacy key builder (slightly different normalization than types.ts version).
- `emptyFieldResult()` -- Legacy empty field factory.

### 3.6 firecrawl.ts (Web Scraping)

Wraps the FireCrawl v2 API.

**Exports**:

- `searchAndFetch(query, numResults?)` -- Searches FireCrawl and returns results with inline markdown. Uses `POST /v2/search` with `scrapeOptions: { formats: ["markdown"] }`. Returns `FirecrawlResult[]`. Empty array on error.
- `fetchUrl(url)` -- Scrapes a single known URL. Uses `POST /v2/scrape`. Returns markdown string or null.

### 3.7 nhtsa.ts (Vehicle Identity from DB)

No external API call -- reads from the existing DB tables populated at VIN decode time.

**Exports**:

- `getIdentity(vehicleId)` -- `internalQuery`. Loads vehicle, engine, transmission, chassis from DB. Returns `VehicleIdentity` with drivetrain, cylinders, displacement, fuel_type, transmission_type. Fields not stored at decode time (turbo, fuel_injection_type, timing_system) are null.

### 3.8 scraper.ts (Scraping Orchestrator)

Orchestrates parts catalog scraping (direct URL fetch) and owner's manual search with caching.

**Exports**:

- `scrapeVehicleSources(ctx, vehicle)` -- Main scraping function. Returns `ScrapedSources` with `partsMarkdown`, `manualMarkdown`, `partsSourceUrls`, `manualSourceUrls`. Checks scrape_cache first (30-day TTL). Falls back from year-specific to generic URLs for parts. Filters blocked domains from manual search results. Max 40,000 chars total, 8,000 chars per page.

**Internal functions**:

- `scrapePartsPages(ctx, vehicle, yearSpecificUrls, genericUrls)` -- Direct URL fetch with year-specific -> generic fallback chain. Caches results.
- `scrapeManual(ctx, vehicle, queries)` -- Search-based manual/maintenance schedule scraping. Caches results.

### 3.9 scraperQueries.ts (Scrape Cache DB Layer)

**Exports**:

- `getCachedScrape(vehicleMake, vehicleModel, vehicleYear, sourceType)` -- `internalQuery`. Returns cached scrape if not expired, null otherwise.
- `debugClearVehicleCache(vehicleMake, vehicleModel, vehicleYear)` -- `mutation` (public). Test helper to clear cache for a vehicle.
- `storeScrapeCache(url, scrapedAt, markdown, vehicleMake, vehicleModel, vehicleYear, sourceType, expiresAt)` -- `internalMutation`. Upserts scrape cache by cache_key. TTL: 30 days for parts, 90 days for manuals, 7 days for pricing.

### 3.10 sourceRegistry.ts (Make-to-Source Mapping)

Static registry mapping vehicle makes to OEM parts source configs.

**Exports**:

- `BLOCKED_DOMAINS` -- Array of 6 blocked domains: kbb.com, justanswer.com, carscounsel.com, firestonecompleteautocare.com, yourmechanic.com, chargerforums.com.
- `MakeSourceConfig` -- Interface defining parts URL patterns and manual search queries per make.
- `SOURCE_REGISTRY` -- Record mapping 28 make names to MakeSourceConfig. Phase 1: BMW (bmwpartsdeal.com), Toyota (toyotapartsdeal.com), Honda (hondapartsdeal.com). Phase 2/3: 25 makes via oempartsonline.com subdomains.
- `getPartsPageUrls(config, vehicle)` -- Returns deduplicated year-specific parts page URLs.
- `getGenericPartsPageUrls(config, vehicle)` -- Returns generic (no-year) fallback URLs.
- `getManualSearchQueries(config, vehicle)` -- Returns search queries for manual/maintenance schedule.
- `hasSources(make)` -- Returns true if make has a registry entry.
- `getSourceConfig(make)` -- Returns the MakeSourceConfig for a make (case-insensitive), or null.

### 3.11 sourceDiscovery.ts (Automated Source Discovery)

Finds new data sources per make via FireCrawl search, tests them, and promotes viable ones to source_registry.

**Exports**:

- `extractFieldsFromMarkdown(markdown, fieldsNeeded, make)` -- Regex extraction of OEM parts, viscosity, tire sizes, prices from raw markdown. Uses make-specific OEM patterns.
- `buildUrlFromTemplate(template, year, make, model, trim)` -- Replaces `{year}`, `{make}`, `{modelSlug}`, `{trimSlug}` placeholders in a URL template.
- `discoverSourcesForMake(make_id, make_name, test_year, test_model, test_trim)` -- `internalAction`. Runs 7 discovery queries, scores domains (parts: 3pt each max 30, prices: 2pt max 20, specs: 2pt max 10, content quality: 5+5, vehicle-specific URL: 10), takes top 5 candidates, tests each via fetchUrl, promotes viable ones (extractable fields OR score >= 20) to source_registry via `addSourceRegistry`.
- `discoverAllSources()` -- `internalAction`. Runs discovery for all makes with test vehicles. 30-second stagger between makes to avoid rate limits.

**Constants**:

- `OEM_PATTERNS` -- Make-specific regex for 12 makes plus general fallback.
- `DISCOVERY_BLOCKLIST` -- 11 marketplace domains: ebay, amazon, walmart, alibaba, aliexpress, wish, temu, facebook, craigslist, offerup, mercari.
- `TEST_VEHICLES` -- 30 test vehicles (one per make).

### 3.12 blockedDomains.ts

Re-exports `BLOCKED_DOMAINS` from `sourceRegistry.ts`. Exists for import convenience.

### 3.13 applicabilityRules.ts (Field Nulling)

Nulls out fields that are definitively N/A for a given vehicle based on physical facts.

**Exports**:

- `applyApplicabilityRules(fields, vPicData)` -- Modifies fields in place. Rules:
  - Chain engine -> timing_belt_oem = null
  - FWD -> diff_fluid_*, transfer_case_fluid_* = null
  - RWD -> transfer_case_fluid_* = null
  - Sedan/coupe/convertible -> rear_wiper_size = null (only if not already set)

### 3.14 sourceVerifier.ts (Confidence Filter)

Legacy confidence-based filtering for the pre-v3 pipeline. Still used by `gapFill.ts`.

**Exports**:

- `filterByConfidence(extracted, make)` -- Rejects fields with confidence < 0.6, validates OEM part number formats via brand-specific regex (18 makes), normalizes part numbers by stripping spaces, sets verified=true for confidence >= 0.8.

**Constants**:

- `PART_NUMBER_PATTERNS` -- Brand-specific regex arrays for 18 makes.

### 3.15 gapFill.ts (Sibling Engine + Targeted Retry)

Two strategies to fill null fields. Legacy module used by the pre-v3 pipeline.

**Exports**:

- `fillFromSiblingEngines(engineCode, nullFields, ctx)` -- Queries enriched_engine_configs by engine code. Copies high-confidence values from sibling trims with -0.1 confidence penalty. Only copies CROSS_REF_SAFE fields (16 engine-specific fields).
- `retryNullFields(vehicle, nullFields, allSources)` -- Single Claude call with web_search for up to 5 null fields. Uses `callClaudeWithWebSearch` + `filterByConfidence`.

### 3.16 tier2Enrichment.ts (Tier 2 Multi-Source)

Post-Tier-1 enrichment using source_registry domains.

**Exports**:

- `runTier2Enrichment(vehicle_config_id)` -- `internalAction`. Loads vehicle config, identifies fields needing more evidence (< 3 evidence rows), searches each active source with site-scoped queries, extracts fields via regex, filters garbage values (`isGarbageValue`: undefined, null, NaN, empty, "0", length < 2 or > 50), deduplicates by source+field, writes evidence batch, runs consensus on fields with new multi-source evidence, logs summary. Returns metrics including queriesRun, sourcesWithData, evidenceWritten, skippedGarbage, consensusChanges, totalEvidence, estimatedCredits.

**Constants**:

- `ENRICHABLE_FIELDS` -- 16 fields that benefit from multi-source evidence (13 OEM parts + oil_viscosity, front/rear_tire_size).
- `MIN_EVIDENCE_FOR_FIELD = 3`

### 3.17 prompts/batch1Prompt.ts

**Exports**:

- `BATCH_1_SYSTEM` -- System prompt for Batch 1A. Data extraction specialist. Rules: extract only from source documents, training data allowed only for 4 fields (brake_fluid_type, power_steering_type, parking_brake_type, timing_system at confidence 0.75). Handles supersession chains, pricing extraction, NHTSA overrides.
- `buildBatch1Prompt(vehicle, vPicData, partsMarkdown, manualMarkdown)` -- Builds user prompt with NHTSA data section, OEM parts catalog section (max 20K chars), owner's manual section (max 20K chars), and full JSON schema example.

### 3.18 prompts/batch1bPrompt.ts

**Exports**:

- `BATCH_1B_SYSTEM` -- System prompt for Batch 1B. Web search specialist for intervals, fluids, and specs. Confidence tiers: 0.95 OEM, 0.85 reputable, 0.75 training data.
- `buildBatch1bPrompt(vehicle)` -- Builds user prompt with vehicle identity and full JSON schema. Covers all intervals including diff_fluid and transfer_case_fluid, all fluid specs, battery, attributes, and trim specs.

### 3.19 prompts/batch2Prompt.ts

**Exports**:

- `BATCH_2_SYSTEM` -- System prompt for Batch 2. Two jobs: gap fill (web search for missing fields) and pricing+labor (look up OEM part prices, determine labor hours). Intentionally minimal -- no DO NOT USE lists (learned from R6).
- `buildBatch2Prompt(vehicle, nullFields, oemParts)` -- Builds user prompt with gap field list, OEM part numbers for pricing lookup, and full service list (25 services). Uses `FIELD_DESCRIPTIONS` for human-readable field descriptions.
- `SERVICE_LIST` -- Array of 25 service names.
- `FIELD_DESCRIPTIONS` -- Record mapping field names to descriptions.

### 3.20 utils/batchClient.ts (Anthropic Batch API)

**Exports**:

- `MODEL_HAIKU = "claude-haiku-4-5-20251001"` -- Structured extraction model.
- `MODEL_SONNET = "claude-sonnet-4-6"` -- Not used in batch pipeline.
- `BatchRequest` -- Interface: customId, system, userPrompt, maxTokens, temperature, maxSearchUses, blockedDomains, model.
- `BatchResultEntry` -- Interface: customId, data, usage, error.
- `submitBatch(requests)` -- Submits batch via Anthropic SDK. Returns batch ID. Includes web_search tool with blocked_domains when maxSearchUses > 0.
- `getBatchStatus(batchId)` -- Returns "in_progress" or "ended".
- `getBatchResults(batchId)` -- Retrieves and parses all results. Uses `extractJsonFromContentBlocks` to handle mixed content.

### 3.21 utils/claudeClient.ts (Claude SDK Wrapper)

Real-time Claude API wrapper with rate limiting. Used by legacy `gapFill.ts` and `claudeExtractor.ts`.

**Exports**:

- `RateLimitInfo` -- Interface with tokensRemaining, inputTokensRemaining, inputTokensLimit, outputTokensRemaining, requestsRemaining, msUntilReset, resetBreakdown, webSearchesUsed, retryAfterMs.
- `ClaudeCallResult` -- Interface: `{ data, rateLimitInfo, usage }`.
- `computeSmartDelay(info, nextCallEstimatedTokens)` -- Returns delay in ms based on gate state. Min 5s, max 120s.
- `extractJsonFromContentBlocks(content)` -- Extracts JSON from Claude response content blocks. Handles markdown fences, mixed web_search responses, bracket-matching for partial responses.
- `callClaudeWithWebSearch(params)` -- Calls Claude with web_search tool. Gate-based rate limiting (waits for token budget). Up to 3 attempts with 429 retry-after handling.
- `callClaudeExtractOnly(params)` -- Calls Claude without tools. Same gate-based rate limiting.

**Internal state**:

- `_gate` -- Shared rate limit gate: `{ apiReadyAt, inputTokensRemaining, inputTokensLimit, lastResponseMs }`. Token replenishment formula: `replenishMs = (tokensNeeded - tokensAvailable) / (inputTokensLimit / 60_000)`.

### 3.22 validation/sanityChecks.ts

**Exports**:

- `SanityFlag` -- Interface: `{ field, severity, reason, value }`.
- `runSanityChecks(fields, cylinders?)` -- Runs range, enum, and format validation on all fields. Two severity levels:
  - **reject**: nulls the value (e.g., coolant_flush_miles <= 15,000 -- known KBB contamination)
  - **flag**: keeps the value but marks `flagged: true`

**Rules**:

| Field | Type | Range/Values | Severity |
|-------|------|-------------|----------|
| oil_capacity_qts | range | 3--16 (flag), 1--20 (reject) | flag/reject |
| coolant_capacity_qts | range | 4--20 | flag |
| oil_viscosity | format | `^\d+[Ww]-\d+$` | flag |
| battery_cca | range | 400--1200 (flag), 200--2000 (reject) | flag/reject |
| oil_change_miles | range | 3,000--20,000 | flag |
| spark_plug_miles | range | 20,000--120,000 | flag |
| transmission_service_miles | range | 20,000--150,000 | flag |
| coolant_flush_miles | range | 15,001--150,000 | **reject** |
| coolant_flush_months | range | 19--120 | **reject** |
| air_filter_miles | range | 10,000--100,000 | flag |
| cabin_filter_miles | range | 10,000--60,000 | flag |
| oil_change_months | range | 3--24 | flag |
| lug_nut_torque_ft_lbs | range | 60--150 | flag |
| tire_pressure_front/rear_psi | range | 28--44 | flag |
| spark_plug_gap | range | 0.4--1.5 | flag |
| timing_system | enum | chain, belt, gear | reject |
| drivetrain | enum | FWD, RWD, AWD, 4WD | reject |
| parking_brake_type | enum | electronic, manual_drum, manual_disc | reject |
| fuel_injection_type | enum | direct, port, dual | reject |
| transmission_type | enum | automatic, manual, CVT, DCT, AMT | reject |
| power_steering_system | enum | electric, hydraulic, electro-hydraulic | reject |

**Engine-specific rules** (`getEngineSpecificRules`):
- V8+: oil_capacity_qts range 7--16 (flag)
- 4-cyl: oil_capacity_qts range 3--7 (flag)
- Spark plug quantity must equal cylinder count or 2x cylinder count (flag)

### 3.23 validation/oemValidation.ts

**Exports**:

- `validateOemPartNumber(make, partNumber)` -- Validates a single part number against brand-specific regex. Returns `{ valid, matchedPattern }`. Falls back to general pattern: `^[A-Za-z0-9][A-Za-z0-9\s\-\.]{2,22}[A-Za-z0-9]$`.
- `validateAllOemParts(fields, make)` -- Validates all 10 OEM part fields. Invalid parts are **flagged** (not nulled). Returns issue list.

**Brand patterns** (14 makes): BMW (11 digits), Toyota (5-5), Honda (segmented), Hyundai (5-5), Kia (5-5), Mercedes-Benz, Audi, Volkswagen, Ford, Chevrolet (7-8 digits), GMC, Nissan, Subaru, Mazda, Lexus, Acura, Infiniti.

### 3.24 v3TestSuite.ts

**Exports**:

- `runFullTestSuite()` -- `internalAction`. Runs 8 test vehicles through 7 phases.

**Test vehicles**:
1. BMW M550i xDrive (VIN: WBAJS7C01LBN96146) -- AWD, chain, twin-turbo V8, electric PS, EPB, DI
2. Toyota Camry (VIN: 4T1B11HK5LU946972) -- FWD, chain, port injection, no EPB
3. Subaru Outback (VIN: 4S4BSANC1J3256478) -- AWD, timing BELT, hydraulic PS
4. Ford F-150 (VIN: 1FTFW1E57LFA12345) -- 4WD, twin-turbo V6, electronic locking diff
5. Honda Civic (VIN: 19XFC2F59KE039685) -- FWD, chain, CVT, port injection
6. Hyundai Tucson (VIN: 5NMJFDAE1NH123456) -- AWD, DCT, sparse data coverage
7. Toyota RAV4 (VIN: 2T3P1RFV6LC123456) -- AWD SUV, has rear wiper, CVT
8. Chevy Bolt EV (VIN: 1G1FY6S03J4123456) -- Electric, FWD, should skip all ICE services

**Phases**:
1. VIN decode + vehicle creation (30s stagger between vehicles)
2. Wait for Tier 1 enrichment (poll every 60s, max 20 min). Post-checks: cache hit, vehicle attach, sanity rejection, blocked domain filtering, type coercion.
3. Source discovery (per unique make, 20s stagger)
4. Tier 2 multi-source enrichment (20s stagger). Checks garbage filter.
5. Source scoring validation (accuracy, auto-blocking)
6. Consensus quality report (multi-source agreement/conflict)
7. Mechanic verification simulation (BMW oil change: confirm filter, correct capacity, set labor hours)

**24 feature validations**: VIN decode, cache hit, vehicle attach, scraper, batch merge, sanity checks, blocked domain filtering, type coercion, applicability rules, fill rate > 70%, OEM parts > 5, part prices, service intervals > 3, labor times > 5, evidence rows > 50, source discovery, discovery blocklist, Tier 2, garbage filter, consensus, source scoring, mechanic verification, mechanic -> evidence, mechanic -> labor empirical.

**Run command**: `npx convex run vehicleEnrichment/v3TestSuite:runFullTestSuite`

---

## 4. Service Layer (convex/services/)

### 4.1 applicability.ts

**Exports**:

- `isServiceApplicable(service, engine, generation, drivetrainConfig, trimSpecs, vehicleConfig)` -- Pure function. 6 checks:
  1. ICE-only services don't apply to EVs (`fuel_type === "electric"`)
  2. Timing belt services only for belt engines (`timing_system !== "belt"`)
  3. Hydraulic PS services not for electric steering (`steering_type === "electric"`)
  4. Differential services require `has_differential === true`
  5. Tire rotation blocked if `is_staggered && tire_directional`
  6. Min model year check for OBD-II services

- `getApplicableServices(ctx, vehicleConfigId)` -- Loads vehicle config + related entities in parallel, filters full service list through `isServiceApplicable`.

### 4.2 consensus.ts

**Exports**:

- `ConsensusResult` -- Interface: `{ value, confidence, source_count, is_verified, has_conflict, needs_review }`.
- `computeConsensus(evidence, make?)` -- Computes consensus from multiple enrichment_evidence observations.
  1. Filters to `is_latest === true` only
  2. Normalizes observed values before grouping (via `normalizeFieldValue`)
  3. Groups by normalized value
  4. Scores each group: `0.4 * avgConfidence + 0.3 * (sourceCount / total) + 0.3 * maxConfidence`
  5. Mechanic boost: `score * 1.2` (capped at 1.0)
  6. Conflict if second-place score > 0.5
  7. Needs review if conflict and no mechanic verification
- `getConsensusForField(ctx, entityType, entityId, fieldName, make?)` -- Queries evidence and computes consensus. Returns null if no evidence.

### 4.3 normalization.ts

**Exports**:

- `normalizePartNumber(raw, make?)` -- Strips spaces/hyphens/dots, uppercases. Make-specific: BMW (11 digits), Toyota/Lexus (5+5), Honda/Acura (8-14 alphanumeric).
- `normalizeFluidSpec(raw)` -- Extracts viscosity pattern (XW-YY), normalizes DOT fluid, BMW HT-12 variants, ZF Lifeguard variants.
- `normalizeInterval(raw)` -- Parses to number. Handles "10k" -> 10000, strips "miles"/"months" suffixes.
- `normalizeTireSize(raw)` -- Normalizes "245/40R19" variants to "245/40r19".
- `normalizeGeneric(raw)` -- Lowercases, trims, collapses whitespace.
- `normalizeFieldValue(fieldName, value, make?)` -- Router: dispatches to appropriate normalizer based on field name suffix (`_oem`, fluid fields, `_miles`/`_months`, `tire_size`, or generic).

### 4.4 sourceScoring.ts

**Exports**:

- `updateSourceScores(ctx, enrichmentRunId)` -- Runs after enrichment completes. Groups evidence by field, computes consensus for each, checks which sources agreed/disagreed, updates source_registry:
  - `accuracy_rate = totalAgreements / totalObservations`
  - `reliability_score = accuracy * 0.7 + (min(observations, 100) / 100) * 0.3`
  - **Auto-blocks** sources below 40% accuracy after 20+ observations. Inserts into blocked_domains table.

### 4.5 verification.ts

**Exports**:

- `processMechanicVerification(mechanic_id, vehicle_config_id, job_id?, service_id, verifications, actual_labor_hours?, parts_used_correct?, overall_accuracy)` -- `internalMutation`. 5 steps:
  1. Stores mechanic_verifications record
  2. For "confirmed" fields: inserts evidence with source_type "mechanic", confidence 0.98
  3. For "corrected" fields: marks all previous evidence as `is_latest: false`, inserts corrected value with confidence 0.99
  4. Updates labor_times: computes rolling average of `empirical_hours`, increments `empirical_sample_size`, promotes source to "empirical" at 3+ samples
  5. Increments `verification_count` on vehicle_configs, promotes to "verified" at 3+ verifications

---

## 5. Pipeline Flow (Tier 1 Detailed)

```
enrichVehicleBatchV3
  |
  +--> [Cache check] --> config_key exists? --> return "cache_hit", attachVehicleConfig
  |
  +--> Resolve make_id, model_id (create model if needed)
  +--> Create enrichment run (status: "started")
  +--> getIdentity (read VehicleIdentity from DB)
  +--> scrapeVehicleSources (FireCrawl: parts catalog + owner's manual)
  |
  +--> submitBatch (parallel):
  |      Batch 1A: extractFromSources (no web search)
  |        - system: BATCH_1_SYSTEM
  |        - prompt: buildBatch1Prompt (vehicle + vPIC + partsMarkdown + manualMarkdown)
  |        - model: MODEL_HAIKU
  |        - maxSearchUses: 0
  |
  |      Batch 1B: webSearchForSpecs (with web search)
  |        - system: BATCH_1B_SYSTEM
  |        - prompt: buildBatch1bPrompt (vehicle only)
  |        - model: MODEL_HAIKU
  |        - maxSearchUses: 15
  |        - blockedDomains: BLOCKED_DOMAINS
  |
  +--> Schedule _pollBatch1 (60s delay)

_pollBatch1  (polls every 60s, up to 180 attempts)
  |
  +--> getBatchStatus for both 1A and 1B
  +--> Both ended?
  |      NO  --> reschedule _pollBatch1 (+60s)
  |      YES --> getBatchResults for both
  |
  +--> parseBatch1a(resultA.data) --> Record<string, FieldResult>
  +--> parseBatch1b(resultB.data) --> Record<string, FieldResult>
  +--> mergeBatch1(a, b) --> merged (1A wins on conflicts, 1B fills nulls)
  +--> applyApplicabilityRules(merged, vPicData)
  +--> runSanityChecks(merged, cylinders)
  +--> validateAllOemParts(merged, make)
  |
  +--> getNullFields(merged) --> fields still null
  +--> getOemParts(merged) --> part numbers for pricing
  |
  +--> submitBatch:
  |      Batch 2: gapFillAndPricing (with web search)
  |        - system: BATCH_2_SYSTEM
  |        - prompt: buildBatch2Prompt (vehicle + nullFields + oemParts)
  |        - model: MODEL_HAIKU
  |        - maxSearchUses: 20
  |        - blockedDomains: BLOCKED_DOMAINS
  |
  +--> Schedule _pollBatch2 (60s delay)

_pollBatch2  (polls every 60s, up to 180 attempts)
  |
  +--> getBatchStatus --> ended?
  |      NO  --> reschedule _pollBatch2 (+60s)
  |      YES --> getBatchResults
  |
  +--> parseBatch2(result.data, nullFields) --> { gapFields, services }
  +--> mapPricingToFields(services) --> pricing fields
  +--> Merge gap fields + pricing into final fields
  |
  +--> writeNormalizedData:
  |      A. updateEngineSpecs (oil, coolant, timing, aspiration, spark plug, etc.)
  |      B. updateTransmissionSpecs (fluid, capacity, filter, service method)
  |      C. upsertDrivetrainConfig (diff, transfer case, fluid types)
  |      D. upsertTrimSpecs (tires, wipers, battery)
  |      E. patchVehicleConfig (brake fluid, PS fluid, brake pad sensor)
  |      F. For each OEM part field: upsertPartAndFitment + upsertPartPrice
  |      G. For each interval field: upsertServiceInterval
  |      H. For each service: upsertLaborTime
  |      I. addEvidenceBatch (all fields with non-null values)
  |
  +--> calculateV3FillRate
  +--> patchVehicleConfig (enrichment_status: "complete", fill_rate, confidence_avg)
  +--> updateEnrichmentRun (status: "complete", metrics)
  +--> attachVehicleConfig (link vehicle_configs to vehicles table)
  +--> runSourceScoring (update source reliability)
```

---

## 6. Pipeline Flow (Tier 2 Detailed)

```
runTier2Enrichment(vehicle_config_id)
  |
  +--> Load vehicle_config, make, model
  +--> For each ENRICHABLE_FIELD (16 fields):
  |      getEvidenceForField --> count existing evidence
  |      If < 3 evidence rows --> add to fieldsNeedingEvidence
  |
  +--> Load active sources from source_registry (filter blocked)
  |
  +--> For each active source:
  |      +--> Group fieldsNeedingEvidence by type (parts, fluids, specs)
  |      +--> Build site-scoped queries: "site:{domain} {vehicleDesc} ..."
  |      +--> searchAndFetch(query, 3)
  |      +--> extractFieldsFromMarkdown (regex extraction)
  |      +--> Filter: isGarbageValue, dedup by source+field
  |      +--> Accumulate evidence rows
  |
  +--> addEvidenceBatch (write all rows, batched by 50)
  |
  +--> For each field with new evidence:
  |      +--> getEvidenceForField (all evidence)
  |      +--> computeConsensus
  |      +--> Log: CONFIRMED or CHANGED
  |
  +--> Return metrics
```

---

## 7. Pipeline Flow (Tier 3 Detailed)

```
processMechanicVerification(mechanic_id, vehicle_config_id, service_id, verifications, ...)
  |
  +--> Insert mechanic_verifications record
  |
  +--> For each verification:
  |      "confirmed" --> Insert evidence (confidence: 0.98, source_type: "mechanic")
  |      "corrected" --> Mark old evidence is_latest=false, insert corrected (confidence: 0.99)
  |      "unknown"   --> No action
  |
  +--> If actual_labor_hours provided:
  |      +--> Find existing labor_times
  |      +--> Update: empirical_hours = rolling average, increment sample_size
  |      +--> Source -> "empirical" at 3+ samples
  |
  +--> Increment vehicle_configs.verification_count
  +--> Status -> "verified" at 3+ verifications
```

---

## 8. Batch API Strategy

The pipeline uses the Anthropic Message Batches API (`client.messages.batches.create`), which is processed asynchronously (usually within minutes) and is 50% cheaper than real-time API calls. Batches do not count against standard rate limits.

**Model**: `claude-haiku-4-5-20251001` for all three batch requests (1A, 1B, 2). Haiku handles structured extraction well and is significantly cheaper than Sonnet.

**Batch 1A** (extract from scraped content):
- No web search (`maxSearchUses: 0`)
- Input: NHTSA data + scraped parts catalog markdown (max 20K chars) + scraped owner's manual markdown (max 20K chars)
- Output: fluids, intervals, attributes, OEM parts, pricing, battery, trim specs

**Batch 1B** (web search for specs):
- With web search (`maxSearchUses: 15`)
- Input: vehicle identity only (no scraped content)
- Output: same schema as 1A plus trans_fluid_type, diff_fluid_type, transfer_case_fluid_type, diff/transfer_case intervals
- `blockedDomains` parameter passed to API

**Batch 2** (gap fill + pricing):
- With web search (`maxSearchUses: 20`)
- Input: null field list with descriptions + OEM part numbers for pricing lookup
- Output: gap fields + 25-service pricing array (labor_hours, parts_cost_low, parts_cost_high)
- `blockedDomains` parameter passed to API

**Merge priority**: Batch 1A > Batch 1B > Batch 2. Scraped data is most authoritative; web search fills gaps; training data is lowest priority.

---

## 9. Scraping Architecture

### Parts Catalog (Direct URL Fetch)

Parts are scraped via direct URL fetch (`fetchUrl`), not search. URLs are deterministic from the source registry:

- **Phase 1** (BMW, Toyota, Honda): Brand-specific `*partsdeal.com` sites with server-rendered HTML.
  - BMW: `bmwpartsdeal.com/oem-{year}-bmw-{trimSlug}-{partSlug}.html`
  - Toyota: `toyotapartsdeal.com/oem-{year}-toyota-{modelTrimSlug}-{partSlug}.html`
  - Honda: `hondapartsdeal.com/oem-{year}-honda-{modelTrimSlug}-{partSlug}.html`

- **Phase 2/3** (25 makes): `oempartsonline.com` subdomains.
  - Pattern: `{subdomain}.oempartsonline.com/oem-{year}-{makeLower}-{modelTrimSlug}-{partSlug}.html`

**Fallback chain**: Year-specific URL -> generic URL (no year) -> skip (Batch 2 fills via web_search).

**Part slugs** (deduplicated before fetching):
- BMW: 14 slugs (oil_filter, air_filter, cabin_air_filter, spark_plug, brake_pads, brake_disc, serpentine_belt, drain_plug, wiper_blade, battery, coolant)
- Toyota/Honda: 8 slugs
- Other makes: 8 slugs via oempartsonline.com

### Owner's Manual (Search-Based)

Manual/maintenance schedule data is found via FireCrawl search (`searchAndFetch`). 2 queries per make, 3 results per query. Blocked domains are filtered at the scraper level.

### Caching

All scrapes are cached in the `scrape_cache` table:
- Cache key: `{make}_{model}_{year}_{sourceType}` lowercased
- TTL: 30 days (parts), 90 days (manuals), 7 days (pricing)
- Cache hit skips FireCrawl entirely

---

## 10. Source Discovery

Automated discovery of new data sources per make. Run via `discoverSourcesForMake` or `discoverAllSources`.

### Process

1. **Search**: 7 discovery queries per make (OEM parts catalog, genuine parts online, maintenance schedule, oil filter part number, brake pads OEM, tire size specs, transmission fluid type)
2. **Score**: Each domain scored by:
   - Part numbers found: 3 pts each, max 30
   - Prices found: 2 pts each, max 20
   - Specs found (viscosity, tires, intervals): 2 pts each, max 10
   - Content > 500 chars: 5 pts
   - Content > 2,000 chars: 5 pts
   - Vehicle-specific URL: 10 pts
   - Minimum viability: score > 5
3. **Rank**: Top 5 candidates by score
4. **Test**: Fetch each candidate via `fetchUrl`, extract fields via regex. Viable if extractable fields > 0 OR score >= 20.
5. **Promote**: Insert into `source_registry` with `reliability_score: 0.5`, `total_observations: 0`.

### Blocklists

- **BLOCKED_DOMAINS** (sourceRegistry.ts): kbb.com, justanswer.com, carscounsel.com, firestonecompleteautocare.com, yourmechanic.com, chargerforums.com
- **DISCOVERY_BLOCKLIST** (sourceDiscovery.ts): ebay.com, amazon.com, walmart.com, alibaba.com, aliexpress.com, wish.com, temu.com, facebook.com, craigslist.org, offerup.com, mercari.com
- **blocked_domains table**: Seeds (6) + ebay.com (manual) + any auto-blocked sources

### URL Template Derivation

`deriveUrlTemplate` replaces year, make, model, and trim in a discovered URL with `{year}`, `{make}`, `{modelSlug}`, `{trimSlug}` placeholders, allowing the URL to be reused for other vehicles of the same make.

---

## 11. Consensus Engine

Located in `convex/services/consensus.ts`.

### Algorithm

1. Filter evidence to `is_latest === true` only
2. Normalize all `observed_value` strings via `normalizeFieldValue` (so "11 42 7 583 220" and "11427583220" group together)
3. Group by normalized value
4. Score each group:
   ```
   score = avgConfidence * 0.4
         + (sourceCount / totalObservations) * 0.3
         + maxConfidence * 0.3
   ```
5. **Mechanic boost**: if any observation in the group has `source_type === "mechanic"`, multiply score by 1.2 (capped at 1.0)
6. Winner = highest score
7. Conflict = second-place score > 0.5
8. Needs review = conflict AND no mechanic verification on winner

### Normalization (before grouping)

| Field type | Normalizer | Example |
|-----------|-----------|---------|
| `*_oem` | `normalizePartNumber` | "11 42 7 583 220" -> "11427583220" |
| Fluid fields | `normalizeFluidSpec` | "5W-30", "5w30" -> "5w-30" |
| `*_miles`, `*_months` | `normalizeInterval` | "10,000 miles" -> "10000" |
| `*tire_size*` | `normalizeTireSize` | "245/40R19" -> "245/40r19" |
| Other | `normalizeGeneric` | Lowercase, trim, collapse whitespace |

---

## 12. Source Scoring

Located in `convex/services/sourceScoring.ts`. Runs after each enrichment via `runSourceScoring`.

### Algorithm

1. Get all evidence rows for the enrichment run
2. Group by field_name
3. For each field with 2+ observations: compute consensus across ALL evidence (not just this run)
4. For each evidence row from THIS run: check if normalized value matches consensus winner
5. Update source_registry:
   - `total_observations += new observations`
   - `accuracy_rate = totalAgreements / totalObservations`
   - `reliability_score = accuracy * 0.7 + (min(observations, 100) / 100) * 0.3`
6. **Auto-block**: If accuracy < 40% AND observations > 20 AND not already blocked:
   - Set `is_blocked: true` on source_registry
   - Insert into `blocked_domains` table with `blocked_by: "auto_accuracy"`

---

## 13. Validation Pipeline

Validation runs between Batch 1 merge and Batch 2 submission.

### Execution Order

1. `applyApplicabilityRules(merged, vPicData)` -- Null out N/A fields based on drivetrain, timing system, body class
2. `runSanityChecks(merged, cylinders)` -- Range/enum/format validation. Reject or flag.
3. `validateAllOemParts(merged, make)` -- Brand-specific OEM part number format validation. Flag only (not reject).

### Post-Batch-2 Validation

- `isBlockedDomain(url)` -- Parser-level blocked domain filtering. Applied to every gap field from Batch 2 before merging. Prevents blocked domain data from entering the pipeline even if the Batch API silently ignores the `blocked_domains` parameter.

---

## 14. Applicability Rules

Two separate implementations:

### Pipeline-Level (applicabilityRules.ts)

Runs during Tier 1 after Batch 1 merge. Nulls fields in the flat FieldResult map:

- Chain engine -> `timing_belt_oem` = null (does NOT null timing_service_miles/months to preserve "inspect at X miles" guidance)
- FWD -> `diff_fluid_type`, `diff_fluid_miles`, `diff_fluid_months`, `transfer_case_fluid_type`, `transfer_case_fluid_miles`, `transfer_case_fluid_months` = null
- RWD -> `transfer_case_fluid_*` = null
- Sedan/coupe/convertible -> `rear_wiper_size` = null (only if not already set)

### Service-Level (services/applicability.ts)

Used at query time to filter which services are shown to users:

1. `requires_ice_engine` -- Skip for EVs
2. `requires_timing_belt` -- Skip if timing_system != "belt"
3. `requires_hydraulic_ps` -- Skip if steering_type = "electric"
4. `requires_differential` -- Skip if `has_differential` != true
5. `requires_rotatable_tires` -- Skip if `is_staggered && tire_directional`
6. `min_model_year` -- Skip if vehicle year < threshold

---

## 15. Seed Data

### seedMakes.ts

30 makes with OEM part patterns and countries. Run: `npx convex run seeds/seedMakes:seedMakes`. Safe to re-run (skips if data exists).

Makes: BMW, Toyota, Honda, Hyundai, Kia, Mercedes-Benz, Audi, Volkswagen, Ford, Chevrolet, GMC, Cadillac, Buick, Chrysler, Dodge, Jeep, Ram, Subaru, Nissan, Infiniti, Mazda, Volvo, Porsche, Lexus, Land Rover, Jaguar, Mitsubishi, Genesis, Lincoln, Acura.

### seedServices.ts

7 categories + 23 services with full applicability flags. Run: `npx convex run seeds/seedServices:seedServices`. Safe to re-run.

Categories: Diagnostics, Compliance, Routine Maintenance, Tires, Brakes, Battery, Fluids.

### seedBlockedDomains.ts

6 domains blocked at seed time: kbb.com, justanswer.com, carscounsel.com, firestonecompleteautocare.com, yourmechanic.com, chargerforums.com. Plus ebay.com added manually.

---

## 16. Known Issues and Workarounds

### Batch API silently ignores blocked_domains parameter

**Impact**: Blocked domain content can enter Claude's context and produce hallucinated data.
**Workaround**: Parser-level filtering in `parseBatch2` via `isBlockedDomain(url)`. Every gap field from Batch 2 is checked before merging. Also enforced in `scrapeManual` for search results.

### BMW 11-digit part numbers parse as JS numbers

**Impact**: "11427583220" can be parsed as a number and lose precision or type.
**Workaround**: `String()` coercion in `parseField` and `upsertPartAndFitment`. Type coercion test in v3TestSuite validates all part numbers are strings.

### KBB coolant data contamination

**Impact**: kbb.com coolant flush data is baked into Claude's training set. Returns 10,000 mile intervals (which is the oil change interval, not coolant).
**Workaround**: Hard floor in sanity checks: `coolant_flush_miles <= 15,000` -> **reject**. Also `coolant_flush_months <= 18` -> reject.

### eBay/marketplace data looks valid but is garbage

**Impact**: Marketplace listings contain OEM part numbers but wrong fitment, pricing, and specs.
**Workaround**: Blocked in BLOCKED_DOMAINS + DISCOVERY_BLOCKLIST. Blocked in source_registry.

### NHTSA drivetrain often returns null

**Impact**: Many vehicles don't have drivetrain in NHTSA vPIC response.
**Workaround**: Pipeline defaults to "FWD" if null. Batch 1A/1B web search attempts to determine drivetrain.

### Labor times are all "training_data" source

**Impact**: No web search sources for labor times yet.
**Workaround**: `upsertLaborTime` only overwrites if existing source is "training_data". Mechanic empirical data takes priority. Source promotes to "empirical" at 3+ samples.

### Tier 2 effectiveness depends on source registry density

**Impact**: If no sources discovered for a make, Tier 2 does nothing.
**Workaround**: Run `discoverAllSources` periodically. Test vehicles exist for 30 makes.

### trim_specs dual field names

**Impact**: Legacy schema uses `tire_size_front` but pipeline uses `front_tire_size`.
**Workaround**: `upsertTrimSpecs` maps v3 -> legacy. Reads check both: `trim.tire_size_front ?? trim.front_tire_size`.

---

## 17. Environment Variables

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | batchClient.ts, claudeClient.ts | Anthropic API key for Batch API and real-time calls |
| `FIRECRAWL_API_KEY` | Yes | firecrawl.ts | FireCrawl API key for web scraping and search |

Both are accessed via `process.env` at runtime. The Convex environment must have these set.

---

## 18. Adding a New Make

1. **seedMakes.ts**: Add a new entry with `name`, `oem_part_pattern` regex, and `country`.
2. **sourceRegistry.ts**: Add to `SOURCE_REGISTRY`. If using oempartsonline.com, just add to `OEM_PARTS_ONLINE_SUBDOMAINS`. If using a brand-specific site, create a full `MakeSourceConfig` entry (see BMW/Toyota/Honda as examples).
3. **oemValidation.ts**: Add brand-specific regex patterns to `OEM_PATTERNS`.
4. **sourceVerifier.ts**: Add to `PART_NUMBER_PATTERNS` if not using general fallback.
5. **sourceDiscovery.ts**: Add to `OEM_PATTERNS` for regex extraction. Add to `TEST_VEHICLES` for automated discovery.
6. Run `npx convex run seeds/seedMakes:seedMakes` to seed the make.
7. Optionally run discovery: `npx convex run vehicleEnrichment/sourceDiscovery:discoverSourcesForMake` with test vehicle params.

No pipeline code changes are needed -- the registry pattern makes adding a make a configuration-only change.

---

## 19. Extending the Pipeline

### Adding a new field

1. Add the field to the appropriate schema table in `convex/schema.ts`.
2. Add to `V4_FIELD_KEYS` in `types.ts` for fill rate tracking.
3. Add extraction in the appropriate prompt (batch1Prompt.ts or batch1bPrompt.ts).
4. Add parsing in `parseBatch1a` or `parseBatch1b` in v3pipeline.ts.
5. Add write logic in `writeNormalizedData` in v3pipeline.ts.
6. Add to `FIELD_DESCRIPTIONS` in batch2Prompt.ts for gap fill.
7. Optionally add sanity check in `sanityChecks.ts`.

### Adding a new service

1. Add to `seeds/seedServices.ts` with applicability flags.
2. Add to `SERVICE_LIST` in types.ts and batch2Prompt.ts.
3. Add mapping in `SERVICE_NAME_TO_SLUG` in v3pipeline.ts.
4. Add to `SERVICE_FIELD_MAP` if it has a pricing or labor field.
5. Run seed: `npx convex run seeds/seedServices:seedServices`.

### Adding a new validation rule

Add to `SANITY_RULES` in `validation/sanityChecks.ts`:
```typescript
{ field: "field_name", type: "range", min: X, max: Y, severity: "flag" | "reject", reason: "description" }
```

### Adding a new blocked domain

1. Add to `BLOCKED_DOMAINS` array in `sourceRegistry.ts` (prevents web_search usage).
2. Insert into `blocked_domains` table via Convex dashboard or seed (prevents Tier 2 usage).

---

## 20. Runtime Costs

### Per-Vehicle Costs (Cold Enrichment)

| Component | Tokens In | Tokens Out | Web Searches | FireCrawl Credits | Cost |
|-----------|----------|-----------|-------------|-------------------|------|
| Batch 1A (extract) | ~5-10K | ~3-5K | 0 | 8-14 (parts pages) | ~$0.01 |
| Batch 1B (web search) | ~200-300K | ~5-10K | 15-20 | 0 | ~$0.20-0.30 |
| Batch 2 (gap fill + pricing) | ~200-400K | ~5-15K | 15-20 | 0 | ~$0.20-0.30 |
| **Total Tier 1** | **~590-700K** | **~13-30K** | **31-37** | **8-14** | **~$0.50-0.60** |
| Tier 2 (multi-source) | 0 | 0 | 0 | ~30-45 | ~$0 (free tier) |

### Cache Hit

$0, instant. No API calls made.

### Monthly Projections

| Volume | Enrichment Cost | FireCrawl Credits | Total |
|--------|----------------|-------------------|-------|
| 100 vehicles | $50-60 | ~300 credits | ~$60 |
| 1,000 vehicles | $500-600 | ~3,000 credits | ~$600 |
| 10,000 vehicles | $5,000-6,000 | ~30,000 credits | ~$6,000 |

FireCrawl free tier includes 500 credits/month. Beyond that, credits are ~$0.001 each.

### Latency

| Phase | Duration |
|-------|----------|
| Scraping (parts + manual) | 30-60 seconds |
| Batch 1A+1B (parallel, queue + processing) | 3-8 minutes |
| Batch 2 (queue + processing) | 2-5 minutes |
| Normalized writes | 5-15 seconds |
| **Total Tier 1** | **7-13 minutes** |
| Tier 2 | 2-5 minutes |
| Mechanic verification | Instant |

---

## Appendix A: Deprecated Files

These files are kept for backward compatibility but are not used by the v3/v8 pipeline:

| File | Status | Replacement |
|------|--------|------------|
| `pipelineBatch.ts` | Marked deprecated | `v3pipeline.ts` |
| `mutations.ts` | Legacy | `v3mutations.ts` |
| `queries.ts` | Legacy | `v3queries.ts` |
| `claudeExtractor.ts` | Legacy (used by gapFill.ts) | `utils/batchClient.ts` + `utils/claudeClient.ts` |
| `extractionPrompts.ts` | Legacy (used by gapFill.ts) | `prompts/batch1Prompt.ts`, `prompts/batch1bPrompt.ts`, `prompts/batch2Prompt.ts` |
| `buildSearchQueries.ts` | Legacy | Inline in sourceRegistry.ts |
| `verificationApi.ts` | Legacy | `services/verification.ts` |
| `pipelineTest.ts` | Legacy | `v3TestSuite.ts` |

---

## Appendix B: Quick Reference Commands

```bash
# Seed makes
npx convex run seeds/seedMakes:seedMakes

# Seed services
npx convex run seeds/seedServices:seedServices

# Seed blocked domains
npx convex run seeds/seedBlockedDomains:seedBlockedDomains

# Run full test suite (8 vehicles, ~45 min)
npx convex run vehicleEnrichment/v3TestSuite:runFullTestSuite

# Discover sources for all makes
npx convex run vehicleEnrichment/sourceDiscovery:discoverAllSources

# Clear scrape cache for a vehicle (public mutation)
# Use Convex dashboard: scraperQueries:debugClearVehicleCache
```

---

## Appendix C: Data Flow Diagram (Table Relationships)

```
vehicles
  |-- vehicle_config_id --> vehicle_configs
                               |-- make_id --> makes
                               |-- model_id --> models
                               |-- generation_id --> generations
                               |-- engine_id --> engines
                               |-- transmission_id --> transmissions
                               |
                               |-- drivetrain_configs (by_vehicle_config)
                               |-- trim_specs (by_vehicle_config)
                               |-- part_fitments (by_vehicle_config)
                               |     |-- part_id --> oem_parts
                               |                       |-- part_prices (by_part)
                               |-- service_intervals (by_vehicle_config)
                               |     |-- service_id --> services
                               |-- labor_times (by_vehicle_config)
                               |     |-- service_id --> services
                               |-- enrichment_evidence (by entity_id = config._id)
                               |-- enrichment_runs (by_vehicle_config)
                               |-- mechanic_verifications (by_vehicle_config)

makes
  |-- source_registry (by_make)
  |-- oem_parts (by_make_category)

blocked_domains (standalone)
scrape_cache (standalone, keyed by make+model+year+sourceType)
```
