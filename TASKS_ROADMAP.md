# OtoPair v9 Enrichment Pipeline — Tasks Roadmap

**Last updated:** April 6, 2026

---

## Completed

| # | Task | Complexity | Notes |
|---|------|-----------|-------|
| 20 | 30K-Mile Ceiling | — | Crossed off — solved by existing architecture + Task 27 anomaly detection |
| 21 | 23-Service Default Fallback | Low | ✅ Wired into pipeline. Auto-fills missing services with conservative defaults post-enrichment |
| 22 | Chassis Merge-and-Continue | Medium | ✅ Wired into pipeline. Clone from best sibling (any status), continue full enrichment, backfill siblings |
| 24 | Duplicate Makes Cleanup | Low | ✅ Case-insensitive slug matching in `upsertMake` + `getMakeByName`. Migration ran: 3 dupes merged, 47 refs re-pointed |
| 25 | Partial Enrichment | Medium | ✅ Standalone action. `diagnoseFillGaps` → targeted Haiku call for missing fields only. For configs at 70-90% fill |
| 27 | Cross-Config Anomaly Detection | Medium | ✅ Standalone action. Z-scores (threshold 2.5, min 3 samples) across intervals, labor times, engine specs. Pure compute |
| 28 | Source Discovery Expansion | Medium | ✅ Already built and wired into pipeline. Auto-discovers new sources per make when < 3 registered. FireCrawl + regex scoring |
| 29 | Evidence Consensus Scoring | Medium | ✅ Standalone action. Batch consensus across all configs, flags conflicts, updates source reliability, auto-blocks bad domains |
| — | Marketplace VIN Scraper Pipeline | Medium | ✅ CarGurus/Cars.com scraper → `vin_queue` → dedup → staggered enrichment. Rate limited: 3 concurrent max, 30s stagger. Crons: 2x daily scrape + 30min queue processor |

---

## Pre-Batch (do before running large-scale enrichment)

| # | Task | Complexity | Description |
|---|------|-----------|-------------|
| 17 | ~~Content Sanitization~~ | Low | ✅ Done. `contentSanitization.ts` — sanitizeString/sanitizeNumber/sanitizePartNumber/sanitizeUrl. Wired into asString()/asNumber() + part write path + evidence batch. Strips HTML, markdown, units, preamble, smart quotes. Validates part numbers against OEM patterns per make. Zero LLM cost |
| 26 | ~~Adversarial Self-Verification~~ | High | ✅ Done. `adversarialVerification.ts` — pre-screens with plausibility ranges + Z-scores (threshold 2.0), challenges suspects via Haiku. Wired as Hook 5 in `_pollBatch2V3` (async, 10s delay). Writes `source_type: "adversarial_verification"` to enrichment_evidence, auto-corrects bad values |
| — | Buy VDB Tokens | — | VehicleDatabases.com API tokens exhausted. Required for trim-level data (tires, battery, specs) during VIN decode. Without it, NHTSA decode still works but fill rates will be lower |

---

## Post-Batch (improve the system over time)

| # | Task | Complexity | Description |
|---|------|-----------|-------------|
| 10 | Empirical Learning | High | Feed real mechanic labor times and part prices from bookings back into the system. Adjusts estimates based on actual data. Requires mechanics actively using the app first |
| 15 | Price Refresh Cron | Medium | Weekly cron re-scraping pricing sources for existing parts. OEM prices go stale over months. FireCrawl + regex extraction on known source URLs from `source_registry` |
| 23 | Cross-Brand Platform Patterns | High | Shared platforms across brands (Toyota 86 / Subaru BRZ, Audi Q7 / VW Touareg). Recognize platform siblings and share enrichment data cross-make. Requires platform mapping table |
| 30 | Chassis Delta Models | Medium | When new model year drops for existing chassis code, identify what actually changed vs prior year. Haiku batch comparing year-over-year specs. Avoids full re-enrichment for minor refreshes |
| 31 | Mechanic Feedback Learning Loop | Medium | When mechanics confirm or reject values, update confidence scores and evidence records. Pure DB mutations — no LLM. Feeds into consensus scoring |

---

## Infrastructure / Non-Engineering

| # | Task | Complexity | Description |
|---|------|-----------|-------------|
| 7 | Evidence + Consensus Expansion | Medium | Extend normalization rules for more field types, add field-level confidence thresholds. Mostly covered by Task 29 — remaining work is incremental |
| 16 | Admin Dashboard | Frontend | React Native screen showing enrichment health: fill rates, anomaly flags, consensus conflicts, source reliability, queue status. All backend data exists already |
| 18 | Legacy Cleanup | Low | Delete old pipeline files (v1, v2), unused imports, dead queries. Housekeeping only |
| 19 | Handoff Doc | Documentation | Technical documentation for the enrichment system — architecture, data flow, how to add makes/services, troubleshooting |

---

## Architecture Notes

**Pipeline hooks (auto-triggered per enrichment):**
1. Source scoring → updates `source_registry` reliability
2. Chassis backfill → pushes data to same-chassis siblings
3. 23-service default fallback → fills missing service intervals
4. Source discovery → finds new data sources if make has < 3
5. Adversarial verification → challenges suspicious values with Haiku (Task 26)

**Standalone batch jobs (run periodically or manually):**
- `runAnomalyDetection` — flag statistical outliers across all configs
- `runBatchConsensus` — score all evidence, flag conflicts, update source reliability
- `partialEnrich` — targeted gap-fill for incomplete configs
- `processVinQueue` — cron every 30min, picks up marketplace-discovered VINs

**Rate limits:**
- Marketplace scraper: 1 make per scrape run, Haiku with 10 web searches
- Queue processor: max 3 concurrent enrichments, 30s stagger between starts
- Enrichment self-check: `enrichAndTrack` re-queues with 60s delay if concurrency cap hit
- Daily budget: 10 enrichments per processor run (configurable `ENRICHMENT_BATCH_SIZE`)
