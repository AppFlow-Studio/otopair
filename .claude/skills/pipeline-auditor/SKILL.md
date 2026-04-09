---
name: pipeline-auditor
description: Validates vehicle enrichment pipeline data integrity. Checks evidence chains, confidence scores, cache consistency, and data completeness across normalized tables.
context: fork
agent: Explore
allowed-tools: Read Grep Glob Bash
---

# Skill: Pipeline Auditor

## When To Use
After modifying any file in convex/vehicleEnrichment/ or related tables.

## Process

### Step 1: Evidence Chain
- Every enrichment value has a corresponding enrichment_evidence record
- Source URL is valid (not placeholder)
- Confidence score is within 0-1 range
- Domain is in source_registry (not blocked)

### Step 2: Data Completeness
- vehicle_configs row has all required fields
- Linked engine, transmission records exist
- service_intervals populated for common services (oil change, brake, filter)
- oem_parts linked via part_fitments

### Step 3: Cache Consistency
- Config key format: `{year}_{make}_{model}_{trim}_{engineCode}` (normalized)
- No duplicate config keys
- Cache hit path returns complete data

### Step 4: API Cost Awareness
- Tier 1 should be $0.50-0.60/vehicle
- Excessive FireCrawl calls? Check scrape_cache hit rate.
- Batch sizes reasonable (not 1-at-a-time)

### Step 5: Error Handling
- Failed enrichment logged in enrichment_runs
- Partial data marked appropriately
- Retry logic doesn't infinite-loop

## Must Read First
- `docs/ENRICHMENT_PIPELINE_COMPLETE.md` — Full spec (67KB)
- `ENRICHMENT_PIPELINE_V8_HANDOFF.md` — Handoff notes

## Output
```
## Pipeline Audit: [Change Description]
- [ ] Evidence chains intact
- [ ] Data completeness verified
- [ ] Cache consistency
- [ ] Cost within bounds
- [ ] Error handling robust
**Issues:** [list or "None"]
```
