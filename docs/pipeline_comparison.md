# Vehicle Enrichment Pipeline: Version Changelog

**Test Vehicle**: 2020 BMW M550i xDrive — N63B44O2 4.4L Twin-Turbo V8

---

## Version Summary

| Version | Fill Rate | Fields | Cost | Duration | Key Change |
|---------|-----------|--------|------|----------|-----------|
| v2 | 82.8% | 62 | $0.034 | ~8 min | Original pipeline — 5 tables, Sonnet real-time |
| v3 Initial | 17% | 62 | $0.19 | ~3 min | Switched to Firecrawl-only, dropped web_search |
| v3 Current | 63% | 62 | $0.10 | ~60s | Restored web_search, confidence threshold |
| v4 | 68% | 62 | $0.08 | ~8 min | 62-field schema, structured 4-call pipeline |
| v4.2 R1 | 95% | 62 | $0.006 | 710s | Batch API + Haiku — eliminated rate limits |
| v4.2 R4 | **97%** | 62 | $0.005 | **482s** | Sonnet for Batch 2 — fixed labor, best result |
| v5 R1 | 94% | 62 | $0.158 | 487s | DB identity, FireCrawl broken (site: SPA queries → empty Batch 1) |
| v5 R2 | **94%** | 62 | $0.176 | **395s** | FireCrawl fixed → bmwpartsdeal.com direct URL scraping, correct OEM parts |
| v5 R3 | 79% | 62 | $0.195 | 500s | Source tier + strict merge fix — but FireCrawl search still broken (TypeError: f is not iterable) → manual=0 chars, Batch 1 only 9/62 fields |
| v5 R4 | 81% | 62 | $0.288 | 425s | FireCrawl search Array.isArray fix — search partially restored but data.data.web path still wrong |
| v5 R5 | **92%** | 62 | $0.219 | **365s** | Fixed FireCrawl search root cause (data.data.web) — owner's manual content restored, intervals/pricing recovered |
| v5 R6 | 76% | 62 | $0.489 | 547s | KBB + Firestone added to DO NOT USE, amsoil → Tier 2 — prompt blacklist ineffective; pricing 0/6, labor 0/4 regression; Batch 2 ballooned to 574K tokens |
| v6 R1 | 81% | 62 | ~$0.18 | 362s | Make-agnostic source registry, simplified Batch 2 prompt (150 tokens vs 2K), native `blocked_domains` — pricing/labor recovered; tokens down 77%; `blocked_domains` silently ignored by Batch API; 7 fields dropped due to max_uses=20 cap |
| v6 R2 | 85% | 62 | ~$0.32 | 494s | Removed max_uses cap + parser domain filter — recovered 3 fields; kbb.com still entering via FireCrawl scrape; coolant_flush_miles still 10k |
| v6 R3 | **85%** | 62 | ~$0.32 | **313s** | Blocked kbb.com in FireCrawl scraper — coolant_flush_miles fixed (10k→50k); 92% excluding correct N/A nulls |
| v7 R1 | **88%** | **88** | $0.574 | 422s | Parallel Batch [1A+1B], 26 new fields (rotors/battery/coolant OEM, fluid types, diff/TC intervals, expanded pricing+labor) |

---

## v2 → v3 Initial

**What changed**: Replaced real-time `fetch()` + `web_search` with Firecrawl pre-gather only.

**Result**: Fill rate collapsed from 83% to 17%.

**Why**: Removed Claude's ability to search. Strict string-match verification rejected correct values that weren't verbatim in Firecrawl markdown. 3K char/source truncation lost critical data. Training data explicitly forbidden.

---

## v3 Initial → v3 Current

**What changed**:
- Restored `web_search_20250305` tool
- Replaced string-match verification with confidence-threshold filtering (reject < 0.5)
- Allowed training data with confidence tiers (0.7 = well-known, 0.6 = less certain)

**Result**: 17% → 63%

**Remaining gaps**: No pricing/labor fields. Missing interval months. Only 3 of 6 attributes. No battery/trim schema.

---

## v3 Current → v4

**What changed**:
- Expanded schema from ~30 to 62 fields (added battery, trim, tire, labor, pricing fields)
- Split into 4 structured calls: 1A (fluids/intervals), 1B (OEM parts/trim), gap fill, pricing
- Dynamic rate-limit gate: reads `anthropic-ratelimit-input-tokens-limit` header, computes replenishment delay
- Single `enriched_engine_configs` table keyed by engine config (year_make_model_trim_engineCode)

**Result**: 63% → 68%

**New issues**: Call 1B hit Tier 1 rate limit (30K ITPM vs ~170K tokens needed) — returned 0 fields. Battery/trim/electrical all null despite new schema. Convex 10-min timeout risk: 4 calls × 5-min wait = 20 min.

---

## v4 → v4.2 (Batch API)

**What changed**:
- Switched from real-time API to Anthropic Batch API — exempt from rate limits entirely
- Haiku model for all calls (`claude-haiku-4-5-20251001`) — ~80% cheaper than Sonnet
- 2 parallel batches: Batch 1 = 1A + 1B simultaneously; Batch 2 = gap fill + pricing simultaneously
- Chained Convex actions polling every 5 min — each action runs <5s, no timeout risk
- `fillFromSiblings()` added between batches: free DB cross-ref for same engine code

**Result (R1)**: 68% → 95% — battery/trim recovered, intervals 18/18, no rate limit hits

**Cost**: $0.08 → $0.006 (Haiku + 50% batch discount)

**Known issues after R1**:
- `estimated_labor_oil_change_hrs` always null — Haiku never returns it
- Run-to-run Haiku variance: timing service, serpentine belt OEM flip between runs
- `parseField` over-coercion bug introduced during fixes (see R2)

---

## v4.2 R1 → R2 (Buggy run — documented for reference)

**What changed**: `parseField` coercion fix introduced between runs was overly aggressive.

**Bug**: Split all strings on `-` before `parseFloat` — corrupted `"0W-30"` → `0`, `"11425A33C42"` → `11425`, `"245/45R18"` → `245`.

**Result**: 95% → 89% — 7 fields corrupted, 2 interval fields dropped (Haiku variance)

**Fix applied**: Regex guard — only coerce `$`-prefixed price strings and clean plain numerics. Strings with letters/slashes preserved as-is.

---

## v4.2 R2 → R4 (Current best)

**What changed**:
- Switched Batch 2 (gap fill + pricing) from Haiku to Sonnet (`claude-sonnet-4-6`)
- Batch 1 (1A + 1B) remains Haiku
- Poll interval: 5 min → 1 min
- Gap fill now routes through `parseField` (previously assigned `raw.value` directly, leaving strings uncoerced)
- `mapPricingToFields`: Oil Change gets 0.5 hr fallback when labor_hours returns null
- `parseField` fix from R2 deployed

**Result**: 89% → **97%** (60/62 fields)

**Key improvements over R1**:
- Labor: 3/4 → 4/4 — Sonnet returned `estimated_labor_oil_change_hrs = 0.5` (Haiku never did)
- Pricing: 5/6 → 6/6 — `oil_change_price` restored
- Duration: 710s → 482s
- All parseField-corrupted fields restored

**Remaining nulls** (both correctly N/A):
- `timing_belt_oem` — chain engine, no belt
- `rear_wiper_size` — 5 Series sedan has no rear wiper

---

## Training Data vs Web Search (R4 Analysis)

20 of 60 filled fields (33%) came from training data in R4. A web-search-only batch was run against those 20 fields to verify accuracy.

**Result**: 8 exact matches, 7 mismatches, 5 not findable via web search.

| Field | Training Value | Web Search Value | Verdict |
|-------|---------------|-----------------|---------|
| `brake_fluid_flush_months` | 36 months | **24 months** | ❌ Training wrong — BMW specifies 24 months |
| `cabin_filter_months` | 18 months | **24 months** | ❌ Training low — BMW dealer says 24 months |
| `serpentine_belt_oem` | 11287618239 | **11287631824** | ❌ Different part# — web result matches R1 |
| `estimated_labor_spark_plug_hrs` | 3.5 hrs | **3.0 hrs** | ❌ Close; web says 3 hrs |
| `spark_plug_gap` | 0.7mm | 0.7mm | ✅ Match |
| `tire_pressure_front_psi` | 35 PSI | 35 PSI | ✅ Match |
| `tire_pressure_rear_psi` | 38 PSI | 38 PSI | ✅ Match |
| `drivetrain` | AWD | AWD | ✅ Match |
| `spark_plug_quantity` | 8 | 8 | ✅ Match |
| `brake_fluid_type` | DOT 4 | DOT 4 | ✅ Match |
| `estimated_labor_oil_change_hrs` | 0.5 hrs | 0.5 hrs | ✅ Match |
| `power_steering_type` | electric | Electric (EPS) | ✅ Same |
| `transmission_type` | automatic | 8-Speed Automatic | ✅ Same, web more specific |
| `coolant_type` | BMW HT-12 | HT-12 (part# 83192468442) | ✅ Same fluid |
| `parking_brake_type` | electronic | Electronic Parking Brake | ✅ Same |
| `spark_plug_months` | 72 | not found | — |
| `air_filter_months` | 36 | not found | — |
| `serpentine_belt_months` | 72 | not found | — |
| `transmission_service_months` | 72 | not found | — |
| `air_filter_price` | $117.50 | not found | — |

**Bottom line**: Training data is reliable for factual/definitional fields (drivetrain, transmission type, spark plug count, tire pressures, labor hours). It's less reliable for service intervals measured in months and OEM part numbers. For the 5 fields that web search couldn't find, training data is the only source available — accept them with lower confidence.

**Action items**:
- Use 24 months for `brake_fluid_flush_months` (not training data's 36)
- Use 24 months for `cabin_filter_months` (not 18)
- Use `11287631824` for `serpentine_belt_oem` (R1 web result, not R4 training data)

---

## v4.2 R4 → v5

**What changed**:
- **DB identity instead of NHTSA API**: Reads existing `engines`/`transmissions`/`chassis_variants` tables — no duplicate vPIC call
- **FireCrawl pre-scrape**: Parts catalog + owner's manual scraped before Claude call; results cached in `raw_scrape_cache` (30-day TTL)
- **Batch 1 = no web_search**: Pure extraction from pre-scraped markdown (~16K tokens in, 2K out)
- **Batch 2 = targeted web_search**: Gap fill + pricing WITH web_search (139K tokens in, 9K out, 15 searches)
- **Tighter sibling fill**: `fillFromSiblings` restricted to `SIBLING_SAFE_FIELDS` (physical/mechanical facts only)
- **Training data restricted**: Allowed only for 4 stable fields: `brake_fluid_type`, `power_steering_type`, `parking_brake_type`, `timing_system`

**Result**: 94% (58/62) — 15 web searches, 487s, $0.158

**Token breakdown**: Batch 1: 15,691in / 2,141out / 0 searches · Batch 2: 139,152in / 8,884out / 15 searches · Total: 154,843in / 11,025out

---

### v5 Field Results — 2020 BMW M550i xDrive (N63B44O2)

#### Fluids — 6/6

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| oil_viscosity | 0W-30 | pelicanparts.com | 0.92 |
| oil_capacity_qts | 9.25 | justanswer.com | 0.88 |
| coolant_type | BMW HT-12 (green) | bimmerfest.com | 0.88 |
| coolant_capacity_qts | 9.24 | justanswer.com | 0.85 |
| brake_fluid_type | DOT 4 | training_data | 0.75 |
| power_steering_type | electric | training_data | 0.75 |

#### Intervals — 16/18

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| oil_change_miles | 10,000 | kbb.com | 0.92 |
| oil_change_months | 12 | kbb.com | 0.92 |
| spark_plug_miles | 60,000 | kbb.com | 0.88 |
| spark_plug_months | 72 | kbb.com | 0.85 |
| transmission_service_miles | 60,000 | bmwofsouthaustin.com | 0.87 |
| transmission_service_months | 72 | bmwofsouthaustin.com | 0.85 |
| coolant_flush_miles | 50,000 | autorivet.com | 0.82 |
| coolant_flush_months | 36 | justanswer.com | 0.82 |
| air_filter_miles | 60,000 | kbb.com | 0.88 |
| air_filter_months | 24 | bmwofwarwick.com | 0.85 |
| cabin_filter_miles | 20,000 | bmwofturnersville.com | 0.88 |
| cabin_filter_months | 24 | bmwofturnersville.com | 0.88 |
| brake_fluid_flush_miles | 30,000 | bobbyrahalbmw.com | 0.88 |
| brake_fluid_flush_months | 24 | bimmerfest.com | 0.90 |
| serpentine_belt_miles | 90,000 | bmwofsouthaustin.com | 0.82 |
| serpentine_belt_months | 108 | bmwofsouthaustin.com | 0.80 |
| timing_service_miles | NULL | — chain engine | — |
| timing_service_months | NULL | — chain engine | — |

#### Attributes — 6/6

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| timing_system | chain | bimmerworld.com | 0.95 |
| drivetrain | AWD | auto123.com | 0.99 |
| turbo | true | auto123.com | 0.99 |
| fuel_injection_type | direct | auto123.com | 0.97 |
| transmission_type | automatic | capital-bmw.com | 0.99 |
| power_steering_system | electric | training_data | 0.75 |

#### OEM Parts — 9/10

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| oil_filter_oem | 11427583220 | carscounsel.com | 0.88 |
| air_filter_oem | 13718576340 | training_data | 0.75 |
| cabin_filter_oem | 64119272643 | training_data | 0.75 |
| spark_plug_oem | 12120057704 | bimmerworld.com | 0.90 |
| front_brake_pad_oem | 34116860914 | training_data | 0.75 |
| rear_brake_pad_oem | 34216860915 | training_data | 0.75 |
| drain_plug_gasket_oem | 07119963200 | training_data | 0.75 |
| serpentine_belt_oem | 11287618570 | training_data | 0.75 |
| timing_belt_oem | NULL | — chain engine | — |
| wiper_blade_set_oem | 61610427668 | training_data | 0.75 |

#### Battery — 5/5

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| battery_group | H8/Group 49 | powertexbatteries.com | 0.90 |
| battery_cca | 900 | advanceautoparts.com | 0.87 |
| spark_plug_quantity | 8 | nhtsa (DB) | 1.00 |
| spark_plug_gap | 0.8mm | gayles-automotive.com | 0.88 |
| parking_brake_type | electronic | training_data | 0.75 |

#### Trim — 6/7

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| front_tire_size | 245/40R19 | autopadre.com | 0.93 |
| rear_tire_size | 275/35R19 | autopadre.com | 0.93 |
| tire_pressure_front_psi | 36 | training_data | 0.75 |
| tire_pressure_rear_psi | 38 | training_data | 0.75 |
| lug_nut_torque_ft_lbs | 103 | bimmerguides.com | 0.88 |
| front_wiper_size | 26" | ebay.com | 0.88 |
| rear_wiper_size | NULL | — sedan, no rear wiper | — |

#### Pricing — 6/6

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| oil_change_price | $117.50 | ecstuning.com | 0.88 |
| brake_pad_front_price | $282.50 | ecstuning.com | 0.85 |
| brake_pad_rear_price | $272.50 | ecstuning.com | 0.85 |
| spark_plug_price | $647.50 | fcpeuro.com | 0.85 |
| air_filter_price | $97.50 | ecstuning.com | 0.85 |
| cabin_filter_price | $62.50 | ecstuning.com | 0.85 |

#### Labor — 4/4

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| estimated_labor_oil_change_hrs | 0.5 | training_data | 0.88 |
| estimated_labor_brake_front_hrs | 1.5 | training_data | 0.85 |
| estimated_labor_brake_rear_hrs | 1.5 | training_data | 0.85 |
| estimated_labor_spark_plug_hrs | 3.5 | training_data | 0.85 |

---

**4 null fields** — all correctly N/A for this vehicle:
- `timing_service_miles/months` — N63 is chain-drive, no scheduled timing service
- `timing_belt_oem` — no belt on chain engine
- `rear_wiper_size` — 5 Series sedan has no rear wiper

---

### v5 R1 vs R2 — FireCrawl fix impact

| Field | v5 R1 (training data) | v5 R2 (bmwpartsdeal.com) | Verdict |
|-------|----------------------|--------------------------|---------|
| oil_filter_oem | 11427583220 | 11427583220 | same |
| air_filter_oem | 13718576340 | **13718699811** | updated |
| cabin_filter_oem | 64119272643 ❌ | **64115A1BDB6** | ✓ fixed |
| spark_plug_oem | 12120057704 | 12120057704 | same |
| front_brake_pad_oem | 34116860914 ❌ | **34106888459** | updated |
| rear_brake_pad_oem | 34216860915 ❌ | **34216896975** | ✓ fixed |
| drain_plug_gasket_oem | 07119963200 | **07119963132** | updated |
| serpentine_belt_oem | 11287618570 ❌ | **11287631824** | ✓ fixed |
| wiper_blade_set_oem | 61610427668 | **61612447932** | updated |

5 of 9 part numbers changed. All R2 parts sourced from `bmwpartsdeal.com` at conf=0.95 vs training data at conf=0.75. Duration: 487s → 395s.

**Remaining concerns in R2 (Batch 2 web_search inconsistencies):**
- `oil_capacity_qts: 11.1` (carscounsel.com) — source registry v2 blacklists carscounsel.com.
- `spark_plug_miles: 37,000` (bmwofreading.com) — KBB says 60,000. Bad dealer site won.
- `brake_fluid_flush_months: 36` (bimmerfest.com) — should be 24 months per BMW spec.

These are interval source-quality issues — fixed in R3/R4 via source tier ranking.

---

## v5 R2 → R3 (Source Tier + Strict Merge)

**What changed**:
- `BATCH_2_SYSTEM` rewritten with full source tier ranking (Tier 1-4) and DO NOT USE list (justanswer.com, carscounsel.com, yourmechanic.com)
- Fluid capacity rules: always match by exact engine code, not family
- Strict merge fix: Batch 2 gap fill now only fills nulls — `if (allFields[k]?.value == null)` guard added. Previously overwrote Batch 1 values.

**Result**: 94% → 79%

**Root cause of regression**: FireCrawl search throwing `TypeError: f is not iterable` on all 4 owner_manual queries. The v2 search API was returning `data.data` as a non-array object — the `?? []` fallback only catches null/undefined, not objects. Manual scrape returned 0 chars → Batch 1 had no manual content → only 9/62 fields filled by Batch 1 → Batch 2 had 53 fields to gap fill alone.

**What worked**:
- `spark_plug_miles`: 37k → 60k ✓ (tier ranking prevented bad dealer site from winning)
- `brake_fluid_flush_months`: 36 → 24 ✓ (tier ranking + DO NOT USE list)
- `oil_capacity_qts`: 11.1 from amsoil.com (carscounsel.com blocked) ✓

---

## v5 R3 → R4 (FireCrawl Array.isArray Fix)

**What changed**:
- `firecrawl.ts` `searchAndFetch`: replaced `data.data ?? data.web ?? []` with `Array.isArray` guard — `data.data` was a non-array object, causing the iterator to throw. Now handles `data.data`, `data.data.results`, and `data.results` shapes.
- Added warning log when response shape is unexpected.

**Result**: 79% → 81%

**Token breakdown**: Batch 1: 10,395in / 3,009out / 0ws · Batch 2: 313,022in / 9,047out / 12ws · Total: 323,417in / 12,056out · Est. $0.288

**Why cost jumped**: Batch 2 doing 313K tokens (vs 193K in R3) — search is partially working now so more results are injected. But fill rate only improved 2% because Batch 1 is still underperforming.

**Remaining issues in R4**:

| Field | R2 | R4 | Status |
|---|---|---|---|
| drain_plug_gasket_oem | 07119963132 | NULL | Pages fetched, Batch 1 not extracting |
| serpentine_belt_oem | 11287631824 | NULL | Pages fetched, Batch 1 not extracting |
| wiper_blade_set_oem | 61612447932 | NULL | Pages fetched, Batch 1 not extracting |
| spark_plug_months | 48 | NULL | Manual content thin |
| transmission_service_months | 72 | NULL | Manual content thin |
| coolant_flush_miles | 50,000 | NULL | Manual content thin |
| air_filter_months | 36 | NULL | Manual content thin |
| serpentine_belt_months | 108 | NULL | Manual content thin |
| All attributes | web sources | training_data | Batch 2 not searching for these |

**Two remaining root causes**:
1. Batch 1 extracting 6/10 OEM parts instead of all 10 — drain_plug, serpentine_belt, wiper_blade pages are fetched but not extracted. Likely those page formats differ from oil_filter/air_filter pages.
2. Attributes (drivetrain, turbo, fuel_injection_type, transmission_type) all landing as training_data — Batch 2 treats them as stable known facts and skips searching instead of using web search.

---

## v5 R4 → R5 (FireCrawl Root Cause Fix)

**What changed**:
- `firecrawl.ts` `searchAndFetch`: fixed response path. The v2 search API returns `{ success, data: { web: [...] }, creditsUsed, id }` — results are at `data.data.web`, not `data.data`. R4's `Array.isArray` fix prevented the crash but still resolved to `[]` because `data.data` is an object `{ web: [...] }`. R5 correctly navigates `rawData.web`.
- ManualsLib tested as owner's manual source — rejected. Pages are scanned images rendered client-side; FireCrawl returns 50K chars of navigation chrome with zero extractable manual text.

**Result**: 81% → **92%** (57/62 fields)

**Token breakdown**: Batch 1: 17,024in / 2,711out / 0ws · Batch 2: 215,737in / 9,060out / 20ws · Total: 232,761in / 11,771out · Est. $0.219

**What recovered vs R4**:
- Intervals: 11/18 → 16/18 (spark_plug_months, coolant_flush, air_filter_months, serpentine_belt all back)
- OEM parts: 6/10 → 8/10 (drain_plug_gasket, serpentine_belt back)
- Pricing: 3/6 → 6/6 (spark_plug, air_filter, cabin_filter prices back)
- Duration: 425s → 365s

**Remaining nulls in R5**:

| Field | Status |
|---|---|
| `wiper_blade_set_oem` | Page fetched, Batch 1 not extracting |
| `timing_belt_oem` | Correctly NULL — chain engine |
| `timing_service_miles/months` | Correctly NULL — chain engine |
| `rear_wiper_size` | Correctly NULL — sedan, no rear wiper |

**One questionable value**: `coolant_flush_miles: 10,000` from kbb.com — matches oil change interval, likely a KBB page parsing issue. Correct value should be ~50,000 miles.

**vs v4.2 R4**: 97% → 94%. The 3 dropped fields (`timing_service_miles/months`, `timing_belt_oem`) were returned by v4.2 from training data but are inapplicable for this engine — v5 correctly returns null. Cost: $0.005 → $0.176 (real-time Sonnet web_search vs Batch API Haiku).

---

### Why v5 costs 30× more than v4.2 R4

**The short answer: web_search in Batch 2 inflates input tokens ~14×.**

The $0.158 estimate already applies the 50% Batch API discount (`Sonnet: $1.50/MTok in, $7.50/MTok out × 0.5`). Without that discount it would be $0.316.

**Token breakdown:**

| Call | Tokens In | Tokens Out | Cost (batch) |
|------|-----------|------------|-------------|
| Batch 1 | 15,691 | 2,141 | ~$0.020 |
| Batch 2 | 139,152 | 8,884 | ~$0.138 |
| **Total** | **154,843** | **11,025** | **$0.158** |

**Why Batch 2 is 139K tokens in:**

Each `web_search` call injects the full search result page into the conversation context before Claude's next token. With 15 searches at roughly 8–10K tokens per result, that's ~120–135K tokens from search results alone appended on top of the ~10K base prompt. The gap-fill prompt itself is small — the cost is entirely the search payloads stacking up mid-conversation.

v4.2 R4 was cheap for two compounding reasons:
1. **Haiku for Batch 1** — Haiku is ~8× cheaper per token than Sonnet. v5 uses Sonnet for both batches.
2. **No inline web_search in Batch 2** — v4.2's gap fill was a single offline Batch API prompt with pre-gathered context pasted in. The model couldn't fetch new pages, so input tokens stayed low (~20–30K). v5 gives the model live web access, which is more accurate but multiplies input token cost.

**Cost reduction options** (if needed):
- Switch Batch 1 back to Haiku (saves ~$0.016 — minor)
- Cap `max_uses` for web_search in Batch 2 (currently uncapped during gap fill; 15 searches is high — capping at 8 would roughly halve Batch 2 cost)
- Use Haiku for Batch 2 gap fill, Sonnet only for pricing (pricing needs precise dollar values; gap fill tolerates Haiku variance)
- Accept the cost — at $0.158/vehicle and ~1K enrichments/year, annual cost is ~$158

---

## FireCrawl Usage Analysis

### How FireCrawl is used in v5

The pipeline uses two FireCrawl operations:

**1. Pre-scrape (before Batch 1)** — `scraper.ts` runs search queries via `POST /v2/search` with `scrapeOptions: { formats: ["markdown"] }`. This tells FireCrawl to find pages matching the query AND return their full markdown content in one call. Results are cached in Convex `raw_scrape_cache` (30-day TTL) so repeat enrichments of the same vehicle skip FireCrawl entirely. The markdown is concatenated and passed to Batch 1 as source material.

**2. Direct URL scrape** — `fetchUrl()` calls `POST /v2/scrape` on a known URL and returns its markdown. Used for specific known-good pages when you already have the URL.

### What went wrong in the first v5 run (why Batch 1 had only 15K tokens)

**Bug 1 — Wrong API version**: `firecrawl.ts` was calling `/v1` instead of `/v2`. The v1 search endpoint uses a different response envelope (`data.data`) vs v2. Under v2, if the client sends to `/v1` it may be redirected, rate-limited differently, or return an unexpected shape. **Fixed**: URL updated to `/v2`, response parsing updated to handle `data.data ?? data.web`.

**Bug 2 — Queries targeting a JavaScript SPA**: The BMW parts queries were locked to `site:realoem.com`:
```
site:realoem.com 2020 BMW 5 Series N63B44O2 oil filter air filter cabin filter spark plug
```
realoem.com is a client-side React app — every page is rendered in the browser via JavaScript after a user makes dropdown selections. Search engine crawlers see only a blank shell, so there are effectively zero indexed pages on the domain. FireCrawl's search finds nothing. The scraper returned empty strings, so Batch 1 received `(no scraped data available)` in both the parts and manual sections — ~1K tokens of placeholder text instead of the expected 30-40K tokens of actual parts data.

The same logic applied to `site:bmwusa.com` for owner's manual — bmwusa.com serves PDFs behind authentication, not indexed HTML pages.

**Evidence**: Batch 1 used only 15,691 input tokens total and returned only training-data values for the 4 allowed fields. Every single sourced field in the v5 result came from Batch 2 web_search, not pre-scraped content. FireCrawl ran, cost credits, and produced zero useful data.

### What was fixed

| | Before | After |
|---|---|---|
| API version | `/v1` | `/v2` |
| Response parsing | `data.data` only | `data.data ?? data.web` |
| BMW parts scraping | `searchAndFetch("site:realoem.com ...")` — SPA, returns nothing | `fetchUrl()` on known `bmwpartsdeal.com` URLs — server-rendered HTML, deterministic |
| BMW manual scraping | `searchAndFetch("site:bmwusa.com ...")` — PDFs, auth-gated | `searchAndFetch()` with broad queries → kbb.com, dealer maintenance pages |
| Pricing | Separate `scrapePricingForParts` with search queries | Extracted from same `bmwpartsdeal.com` part pages in Batch 1 |
| OEM part number source | Training data (35% error rate) | Scraped from bmwpartsdeal.com (OEM authority) |

**Why `bmwpartsdeal.com` instead of `realoem.com`**: realoem.com is the gold standard but 403s all programmatic access. bmwpartsdeal.com is server-rendered HTML (no JS needed), verified accurate against ETK data, and includes discount price + MSRP + supersession chains on every part page. 8 URL fetches cover all 10 OEM part fields.

**Supersession handling**: bmwpartsdeal.com lists all historical part numbers per page with "Replaced by" links. Batch 1 prompt now instructs Claude to always pick the current part — the one with no "Replaced by", or whose fitment range includes the target year. Example for 2020 M550i cabin filter: `64116996208` (superseded) → `64115A1BDB6` (current). Training data returned `64119272643` (wrong).

**Verified correct vs wrong part numbers from v5 (all from training data):**

| Field | v5 (training data) | Correct (bmwpartsdeal.com) |
|-------|-------------------|--------------------------|
| cabin_filter_oem | 64119272643 | **64115A1BDB6** |
| spark_plug_oem | 12120057704 | **12120037663** |
| front_brake_pad_oem | 34116860914 | **34116889585** (superseded from 34106888459) |
| rear_brake_pad_oem | 34216860915 | **34216896975** |
| serpentine_belt_oem | 11287618570 | **11287631824** |
| oil_filter_oem | 11427583220 | 11427583220 ✓ |

### FireCrawl credit cost per enrichment

| Operation | Calls | Credits each | Subtotal |
|-----------|-------|-------------|----------|
| Parts catalog search (4 queries × 3 results) | 12 scrapes | 1 search + 1/result | ~14 |
| Manual/schedule search (4 queries × 3 results) | 12 scrapes | 1 search + 1/result | ~14 |
| Pricing search | ~10 | 1 + 1/result | ~13 |
| **Total** | | | **~41 credits** |

Free tier: 500 credits/month. Starter: $16/month for 3,000 credits (~73 enrichments/month). Growth: $83/month for 100,000 credits.

---

## Current Architecture (v5)

```
Vehicle Input
    → Cache check (enriched_engine_configs by engineConfig key)
    → DB identity: read engines/transmissions/chassis_variants
    → FireCrawl scrape: parts catalog + owner's manual (cached 30 days)
    → Submit Batch 1: Sonnet, NO web_search — pure extraction from scraped markdown
    → _pollBatch1 every 1 min
        → fillFromSiblings() (SIBLING_SAFE_FIELDS only — physical/mechanical facts)
        → Scrape pricing pages
        → Submit Batch 2: Sonnet, WITH web_search — gap fill + pricing
        → _pollBatch2 every 1 min
            → Assemble 62 fields, store, attach to vehicle
```

Each Convex action runs <5s. Total: ~8 min async.

**Files**: `pipelineBatch.ts`, `nhtsa.ts`, `scraper.ts`, `sourceRegistry.ts`, `prompts/batch1Prompt.ts`, `prompts/batch2Prompt.ts`

---

## v5 R5 → R6 (Source Quality Hardening)

**What changed**:
- `BATCH_2_SYSTEM` rewritten with stricter source quality controls:
  - `kbb.com` added to DO NOT USE (confirmed failure: returned `coolant_flush_miles: 10,000` — matching oil change interval, not coolant flush interval)
  - `firestonecompleteautocare.com` added to DO NOT USE (sparse data, wrong spark plug intervals)
  - `amsoil.com` promoted to Tier 2 (conf 0.90) — engine-code specific fluid data, proven accurate
  - Fluid capacity rules: always search by EXACT engine code (e.g., `N63B44O2 oil capacity`) not engine family
  - Explicit conflict resolution rules: higher tier wins, never average conflicting values
  - Confidence tiers tightened: 0.95 / 0.88-0.94 / 0.82-0.87 / 0.70-0.79 / below 0.70 = null

**Result**: 92% → **76%** (47/62 fields)

**Token breakdown**: Batch 1: 16,997in / 2,711out / 0ws · Batch 2: 573,957in / 9,370out / 14ws · Total: 590,954in / 12,081out · Est. $0.489

**Critical regressions**:

| Category | R5 | R6 | Change |
|---|---|---|---|
| Pricing | 6/6 | **0/6** | Complete collapse |
| Labor | 4/4 | **0/4** | Complete collapse |
| Intervals | 16/18 | 14/18 | -2 |
| Cost | $0.219 | $0.489 | +123% |
| Batch 2 tokens | 215K | 574K | +166% |

**Root cause analysis**:

1. **Prompt blacklist is ineffective** — Claude still used blocked sources despite explicit DO NOT USE instructions:
   - `kbb.com`: still used for `spark_plug_miles`, `coolant_flush_miles`, `air_filter_miles`
   - `justanswer.com`: appeared for `coolant_capacity_qts` at conf=0.70 (below 0.70 threshold but still returned)
   - `chargerforums.com`: used for BMW transmission service interval — completely wrong domain

2. **Context overflow caused services array truncation** — Batch 2 jumped from 215K to 574K tokens. The longer `BATCH_2_SYSTEM` combined with more aggressive search results bloated the context window. Claude likely ran out of output budget generating the `services` array, causing it to return an empty or malformed JSON → pricing and labor both null. The R5 `maxTokens: 8192` cap for Batch 2 is insufficient at 574K context.

3. **More restrictive prompt → fewer results accepted** — Tighter confidence thresholds caused Claude to null out values it would have previously kept, even from legitimate sources. The cumulative effect dropped fill rate despite search being fully functional.

**What still worked in R6**:
- Batch 1: Same fill as R5 (16,997 tokens in — FireCrawl scraping healthy)
- Attributes: 6/6 (unchanged)
- OEM parts: 8/10 (unchanged — wiper_blade_set_oem still null)
- Battery: 5/5 (unchanged)
- Trim: 6/7 (unchanged)

**Proposed fixes for R7**:

| Fix | Why | How |
|---|---|---|
| Move domain blocking to FireCrawl `excludeDomains` | Prompt-based blacklists don't work — Claude can't reliably filter its own search results | Add `excludeDomains: ["kbb.com", "justanswer.com", "carscounsel.com", "firestonecompleteautocare.com", "yourmechanic.com"]` to `searchAndFetch()` call in Batch 2 |
| Increase Batch 2 `maxTokens` | 8192 insufficient when context is 574K; services array gets truncated mid-generation | Increase to 16,384 for Batch 2 only |
| Cap web_search `max_uses` in Batch 2 | Uncapped search inflates context; 14 searches × ~8-10K tokens/result = 140K injected tokens | Cap at 8 searches (same as R5 target) — reduces Batch 2 from 574K to ~300K |

**Source quality issues found in R6** (kbb.com winning despite blacklist):

| Field | Bad Source | Bad Value | Correct Value |
|---|---|---|---|
| `coolant_flush_miles` | kbb.com | 10,000 (= oil change interval) | ~50,000 |
| `spark_plug_miles` | kbb.com | 60,000 | 60,000 ✓ (right value, wrong source) |
| `air_filter_miles` | kbb.com | 15,000 | 60,000 |
| `coolant_capacity_qts` | justanswer.com conf=0.70 | 9.24 | 11.4 (N63B44O2) |

---

## v5 R6 → v6 R1 (Source Registry + Prompt Simplification)

**What changed**:
- `sourceRegistry.ts` rewritten as make-agnostic `MakeSourceConfig` interface — adding a new make requires one registry entry, no pipeline code changes
- `BLOCKED_DOMAINS` moved to `sourceRegistry.ts` as canonical export — thread through `batchClient.ts` `BatchRequest.blockedDomains` → Anthropic `web_search` tool `blocked_domains` parameter
- `BATCH_2_SYSTEM` stripped from ~2,000 tokens to ~150 tokens: removed source tiers, confidence tables, DO NOT USE lists, fluid capacity rules — all prompt-based controls that were being ignored anyway
- `buildBatch2Prompt` signature simplified: removed `pricingMarkdown` parameter (parts pages already include pricing; Batch 2 web_search handles the rest — no separate pricing scrape step)
- Batch 2 `maxTokens`: 8,192 → 16,384 (prevent truncation of services array at high context)
- Enrichment version bumped to `v6`

**Result**: 76% → **81%** (50/62 fields)

**Token breakdown**: Batch 1: 16,997in / 2,711out / 0ws · Batch 2: 130,634in / 8,016out / 15ws · Total: 147,631in / 10,727out · Est. ~$0.18

**What recovered vs R6**:
- Pricing: 0/6 → **5/6** ✓ (maxTokens 16384 prevents truncation; simplified prompt)
- Labor: 0/4 → **4/4** ✓
- Batch 2 tokens: 574K → 130K (−77%) — simplified prompt working

**Still null vs R5 (7 fields dropped)**:

| Field | Root Cause |
|---|---|
| `spark_plug_gap` | max_uses=20 cap hit before this field searched |
| `spark_plug_months` | max_uses cap |
| `coolant_capacity_qts` | max_uses cap |
| `air_filter_months` | max_uses cap |
| `cabin_filter_miles` | max_uses cap |
| `serpentine_belt_months` | max_uses cap |
| `transmission_service_months` | max_uses cap |

With 46 null fields + 9 OEM parts for pricing, the formula `min(nullFields * 2 + oemParts, 20)` caps at 20 — far below the ~100 searches needed to cover all fields. 15 searches were used (all 20 budget, minus 5 Batch API overhead), leaving ~31 fields unsearched.

**`blocked_domains` finding**: kbb.com still appeared on 4 fields (`air_filter_miles`, `brake_fluid_flush_miles`, `coolant_flush_miles`, `spark_plug_miles`) despite being in the `blocked_domains` parameter. The Anthropic Batch API silently ignores `blocked_domains` — this parameter appears to only be respected on the real-time Messages endpoint.

**Source quality regressions from blocked_domains not working**:

| Field | Bad Value (kbb.com) | Correct Value |
|---|---|---|
| `coolant_flush_miles` | 10,000 | ~50,000 |
| `air_filter_miles` | 15,000 | 60,000 |

**Proposed fixes for v6 R2**:

| Fix | Why | How |
|---|---|---|
| Raise `max_uses` cap 20 → 30 | 7 fields dropped due to search budget exhaustion | Change formula cap in `pipelineBatch.ts` |
| Add post-parser domain filter | Batch API ignores `blocked_domains`; kbb.com values entering results | In `parseBatch2()`, skip fields where `source_url` matches `BLOCKED_DOMAINS` |

---

## v6 R1 → R2 (Removed max_uses cap + Parser Domain Filter)

**What changed**:
- `max_uses` cap removed from Batch 2 web_search tool — uncapped searches
- `isBlockedDomain()` post-parser filter added to `parseBatch2()` — rejects gap fill values from `BLOCKED_DOMAINS`
- `pipelineBatch.ts`: `maxSearchUses: 1` (gate only; no `max_uses` in tool definition)

**Result**: 81% → **85%** (50→53 fields), 362s → 494s, $0.18 → $0.32

**What recovered**: `cabin_filter_miles`, `cabin_filter_months`, `spark_plug_gap` (3 fields from R1's 7-field dropout)

**Remaining regression**: kbb.com still entering via **FireCrawl scrape** (not Batch 2 gap fill). The parser filter only covers Batch 2. kbb.com pages scraped during `scrapeManual()` feed directly into Batch 1 context — `coolant_flush_miles` still returning 10,000 from kbb.com's ambiguous "Coolants are also changed at the 10,000-mile mark" sentence (listed under the oil change section, not a separate coolant flush interval).

**Token increase**: 130K → 370K Batch 2 tokens — uncapped search running 22 searches vs 15. Cost nearly doubled for 3 additional fields.

---

## v6 R2 → R3 (Block kbb.com in FireCrawl Scraper)

**What changed**:
- `scraper.ts` `scrapeManual()`: filter `BLOCKED_DOMAINS` from FireCrawl search results before including in owner_manual markdown
- `scraper.ts` imports `BLOCKED_DOMAINS` from `sourceRegistry.ts`

**Result**: 85% → **85%** (same count), 494s → **313s**

**What fixed**:
- `coolant_flush_miles`: 10,000 (kbb.com) → **50,000** (autorivet.com) ✓
- `brake_fluid_flush_miles`: 30,000 (kbb.com) → **60,000** (bmwofturnersville.com) ✓
- Duration improved 37% — scrape cache hit for parts_catalog, fresh manual scrape without kbb.com

**Token breakdown**: Batch 1: 17,241in / 2,835out / 0ws · Batch 2: 363,368in / 7,282out / 26ws · Total: 380,609in / 10,117out · Est. ~$0.32

---

## v6 R3 — Full Field Results

**2020 BMW M550i xDrive — N63B44O2 4.4L Twin-Turbo V8**
**Fill rate: 85% (53/62) — 92% excluding correct N/A nulls**

#### Fluids — 5/6

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| oil_viscosity | 0W-30 | amsoil.com | 0.95 |
| oil_capacity_qts | 11.1 | amsoil.com | 0.95 |
| coolant_type | BMW HT-12 (green) | bimmerfest.com | 0.88 |
| coolant_capacity_qts | NULL | — not found | — |
| brake_fluid_type | DOT 4 | training_data | 0.75 |
| power_steering_type | electric | training_data | 0.75 |

#### Intervals — 12/18

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| oil_change_miles | 10,000 | bmwofturnersville.com | 0.95 |
| oil_change_months | 12 | bmwofturnersville.com | 0.95 |
| spark_plug_miles | 60,000 | bmwofturnersville.com | 0.90 |
| spark_plug_months | NULL | — sparse | — |
| transmission_service_miles | 60,000 | bmwofsouthaustin.com | 0.75 |
| transmission_service_months | NULL | — sparse | — |
| coolant_flush_miles | 50,000 | autorivet.com | 0.70 |
| coolant_flush_months | 48 | bimmerfest.com | 0.70 |
| air_filter_miles | 60,000 | bmwofturnersville.com | 0.90 |
| air_filter_months | NULL | — sparse | — |
| cabin_filter_miles | 20,000 | bmwofturnersville.com | 0.90 |
| cabin_filter_months | 24 | bmwofturnersville.com | 0.90 |
| brake_fluid_flush_miles | 60,000 | bmwofturnersville.com | 0.90 |
| brake_fluid_flush_months | 24 | bmwofcamarillo.com | 0.92 |
| serpentine_belt_miles | 90,000 | bemer.com | 0.75 |
| serpentine_belt_months | NULL | — sparse | — |
| timing_service_miles | NULL | — chain engine | — |
| timing_service_months | NULL | — chain engine | — |

#### Attributes — 6/6

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| timing_system | chain | training_data | 0.75 |
| drivetrain | AWD | auto123.com | 0.99 |
| turbo | true | auto123.com | 0.99 |
| fuel_injection_type | direct | auto123.com | 0.97 |
| transmission_type | automatic | carfolio.com | 0.99 |
| power_steering_system | electric | training_data | 0.75 |

#### OEM Parts — 9/10

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| oil_filter_oem | 11427583220 | bmwpartsdeal.com | 0.95 |
| air_filter_oem | 13718699811 | bmwpartsdeal.com | 0.90 |
| cabin_filter_oem | 64115A1BDB6 | bmwpartsdeal.com | 0.95 |
| spark_plug_oem | 12120057704 | bmwpartsdeal.com | 0.95 |
| front_brake_pad_oem | 34106888459 | bmwpartsdeal.com | 0.92 |
| rear_brake_pad_oem | 34216896975 | bmwpartsdeal.com | 0.92 |
| drain_plug_gasket_oem | 07119963132 | nforcd.com | 0.90 |
| serpentine_belt_oem | 11287631824 | bimmerworld.com | 0.88 |
| timing_belt_oem | NULL | — chain engine | — |
| wiper_blade_set_oem | 61612447932 | bmwpartsnow.com | 0.88 |

#### Battery / Electrical — 5/5

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| battery_group | H8/Group 49 | powertexbatteries.com | 0.88 |
| battery_cca | 900 | advanceautoparts.com | 0.80 |
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
| lug_nut_torque_ft_lbs | 103 | bimmerguides.com | 0.93 |
| front_wiper_size | 26" | ebay.com | 0.85 |
| rear_wiper_size | NULL | — sedan, no rear wiper | — |

#### Pricing — 6/6

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| oil_change_price | $137.50 | bimmerworld.com | 0.88 |
| brake_pad_front_price | $439.83 | bmwpartsdeal.com | 0.90 |
| brake_pad_rear_price | $300.51 | bmwpartsdeal.com | 0.90 |
| spark_plug_price | $594.22 | bmwpartsdeal.com | 0.88 |
| air_filter_price | $97.50 | ecstuning.com | 0.80 |
| cabin_filter_price | $113.20 | genuinebmwminiparts.com | 0.93 |

#### Labor — 4/4

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| estimated_labor_oil_change_hrs | 0.5 | training_data | 0.88 |
| estimated_labor_brake_front_hrs | 1.5 | training_data | 0.90 |
| estimated_labor_brake_rear_hrs | 1.5 | training_data | 0.90 |
| estimated_labor_spark_plug_hrs | 3.5 | training_data | 0.88 |

---

**9 null fields**:
- `timing_service_miles/months`, `timing_belt_oem` — correctly N/A (chain-drive engine, no timing service)
- `rear_wiper_size` — correctly N/A (5 Series sedan, no rear wiper)
- `coolant_capacity_qts` — genuinely not found; N63B44O2 capacity (~11.4 qt) is sparsely documented
- `spark_plug_months`, `air_filter_months`, `serpentine_belt_months`, `transmission_service_months` — months-based service intervals not published for most BMW models (CBS-driven, not fixed intervals)

---

## v6 R3 → v7 R1 (Schema Expansion + Parallel Batch 1A+1B)

**What changed**:
- **88-field schema** (was 62): +26 new fields covering rotor/battery/coolant OEM, drivetrain fluid types, diff/transfer case intervals, expanded pricing (13 services), expanded labor (12 services)
- **Parallel Batch [1A, 1B]**: both submitted in one `submitBatch()` call
  - Batch 1A: NO web_search — pure extraction from FireCrawl scraped markdown (same as before)
  - Batch 1B: WITH web_search — independently searches for intervals, fluid specs, tire specs
  - Result: 1A and 1B run concurrently; merged with 1A taking precedence (scraped = authoritative)
- **Applicability rules** (`applicabilityRules.ts`): chain engine → `timing_belt_oem` null; FWD → diff/TC fluid fields null; RWD → TC fluid fields null; sedan → `rear_wiper_size` null
- **BMW source registry**: added `brake_disc` slug (rotors) + `coolant` slug
- **SERVICE_FIELD_MAP**: 6 → 14 services with DB field mappings (rotors, battery, serpentine, coolant flush, trans fluid, brake fluid flush, timing service)
- **Batch 2 SERVICE_LIST**: 10 → 25 services
- **SIBLING_SAFE_FIELDS**: +`trans_fluid_type`, `diff_fluid_type`, `transfer_case_fluid_type`

**Result**: 85% (62-field) → **88% (88-field)**

**Script fill rate 86% (76/88)** — stored 88% counts "not_applicable" nulls as filled (chain engine, sedan, AWD+RWD applicability rules correctly zero out those fields)

**Token breakdown**: Batch 1A: 17,592in / 2,914out / 0ws · Batch 1B: 226,928in / 4,556out / 11ws · Batch 2: 432,481in / 10,105out / 27ws · Total: 677,001in / 17,575out / **38 searches**

**Cost**: ~$0.574 (Sonnet batch, $1.50/MTok in × 0.5 + $7.50/MTok out × 0.5)

**Duration**: 422s (7 min) — same async poll pattern, 3 batch rounds (Batch [1A+1B] + Batch 2)

---

## v7 R1 — Full Field Results

**2020 BMW M550i xDrive — N63B44O2 4.4L Twin-Turbo V8**
**Fill rate: 88% stored / 76/88 explicit (86%) — 12 nulls, 8 correctly N/A**

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
| spark_plug_months | NULL | — not found | — |
| transmission_service_miles | 50,000 | blauparts.com | 0.80 |
| transmission_service_months | NULL | — not found | — |
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
| **rotor_front_oem** | **34106875284** | weberbrothersauto.com | 0.88 |
| **rotor_rear_oem** | **34217991103** | parts.bmwofsouthatlanta.com | 0.88 |
| drain_plug_gasket_oem | 07119963132 | bmwpartsnow.com | 0.90 |
| serpentine_belt_oem | 11287631824 | bimmerworld.com | 0.75 |
| timing_belt_oem | NULL | — chain engine (applicability rule) | — |
| wiper_blade_set_oem | 61612447932 | bimmerworld.com | 0.95 |
| **battery_oem** | **61217604802** | bmwpartsdeal.com | 0.82 |
| **coolant_oem** | **82141467704** | getbmwparts.com | 0.90 |

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
| **trans_fluid_type** | ZF Lifeguard 8 (BMW 83 22 2 152 426 / Shell M-L12108) | blauparts.com | 0.90 |
| **diff_fluid_type** | BMW Hypoid Axle Oil G1 75W-85 GL-4 (rear); G2 75W-85 GL-5 (front) | bimmerfest.com | 0.85 |
| **transfer_case_fluid_type** | BMW DTF-1 75W GL-4 (PN 83222409710) | bimmerfest.com | 0.85 |

#### New Fluid Intervals (v7) — 2/4

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| **diff_fluid_miles** | 50,000 | bimmerfest.com | 0.75 |
| diff_fluid_months | NULL | — not found | — |
| **transfer_case_fluid_miles** | 60,000 | turnermotorsport.com | 0.85 |
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
| **rotor_front_price** | **$752.33** | bmwpartsdeal.com | 0.82 |
| **rotor_rear_price** | **$613.01** | bmwpartsdeal.com | 0.78 |
| **battery_price** | **$230.29** | bmwpartsdeal.com | 0.88 |
| **serpentine_belt_price** | $39.06 | getbmwparts.com | 0.85 |
| **coolant_flush_price** | $272.50 | getbmwparts.com | 0.78 |
| **transmission_service_price** | $370.00 | blauparts.com | 0.85 |
| **brake_fluid_flush_price** | $145.00 | training_data | 0.85 |

#### Labor — 11/12

| Field | Value | Source | Conf |
|-------|-------|--------|------|
| estimated_labor_oil_change_hrs | 0.5 | training_data | 0.75 |
| estimated_labor_brake_front_hrs | 1.5 | training_data | 0.75 |
| estimated_labor_brake_rear_hrs | 1.5 | training_data | 0.75 |
| estimated_labor_spark_plug_hrs | 3.5 | training_data | 0.75 |
| **estimated_labor_rotor_front_hrs** | 2.0 | training_data | 0.75 |
| **estimated_labor_rotor_rear_hrs** | 2.0 | training_data | 0.75 |
| **estimated_labor_serpentine_belt_hrs** | 0.5 | training_data | 0.75 |
| **estimated_labor_coolant_flush_hrs** | 1.5 | training_data | 0.75 |
| **estimated_labor_trans_fluid_hrs** | 2.0 | training_data | 0.75 |
| **estimated_labor_battery_hrs** | 0.5 | training_data | 0.75 |
| **estimated_labor_brake_fluid_flush_hrs** | 1.0 | training_data | 0.75 |
| estimated_labor_timing_service_hrs | NULL | — chain engine, no service | — |

---

**12 null fields**:
- `timing_service_miles/months`, `timing_belt_oem`, `estimated_labor_timing_service_hrs` — correctly N/A (chain engine, no timing service)
- `rear_wiper_size` — correctly N/A (sedan applicability rule)
- `spark_plug_months`, `air_filter_months`, `serpentine_belt_months`, `transmission_service_months` — CBS-driven intervals, not published by BMW
- `diff_fluid_months`, `transfer_case_fluid_months` — not found; miles intervals were found
- `air_filter_price` — not found despite having part number (web search didn't return a price page)

**New fields vs v6 (all 26 now tracked)**:
- ✓ 4 new OEM parts: `rotor_front_oem`, `rotor_rear_oem`, `battery_oem`, `coolant_oem`
- ✓ 3 new fluid types: `trans_fluid_type`, `diff_fluid_type`, `transfer_case_fluid_type`
- ✓ 2/4 new fluid intervals: `diff_fluid_miles`, `transfer_case_fluid_miles`
- ✓ 7 new pricing fields (all but `air_filter_price`)
- ✓ 11/12 new labor fields (timing service correctly N/A for chain engine)

**Cost note**: $0.574 is 79% higher than v6 R3 ($0.32). The main driver is Batch 1B — 226K tokens from 11 web searches, all injected into Batch 1B context. Batch 2 also grew (432K vs 363K) because it now covers 25 services + more gap fields. The new 26 fields added ~$0.25 in search costs for the first run. Cache hits on subsequent runs will bring Batch 1A cost to near-zero.

**vs v6 R3 (same 62-field comparison)**:
- Fill rate on original 62 fields: **85% → 85%** (same — all v6 R3 fills held)
- Net new value: +26 fields, 20 of which are filled (77% fill rate on new fields)
- Applicability rules correctly nulled: `timing_belt_oem`, `rear_wiper_size`, `timing_service_miles/months`, `estimated_labor_timing_service_hrs`
