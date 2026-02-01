# Gap Report: Database & API Coverage

**Date:** February 1, 2026  
**Scope:** OtoPair backend database and Convex API surface  
**Source of Truth:** DB_STATUS.md (current schema + access layer coverage)

---

## Summary by Status

| Status | Meaning | Examples |
|---|---|---|
| Implemented | Access layers exist and are documented | vehicles, vehicle_owners, bookings, payments, job_actuals, reviews, follow_ups, audit logs, AI chat, analytics |
| Schema-Only | Table exists, no access layer yet | makes, models, trims, engines, services, service_categories, service_options, service_vehicle_specs, shop_services, oem_parts, specs, fitments, transmissions, chassis_variants, ai_enrichment_logs, manual_review_queue, spec_variances, spec_confirmations |

---

## Active Gaps (Access Layer Needed)
1. oemParts.ts for oem_parts
2. fitments.ts for engine_part_fitments, transmission_part_fitments, trim_part_fitments
3. specs.ts for engine_specs, transmission_specs, trim_specs, plus getFullVehicleSpecPack(vin)
4. transmissions.ts read helpers by trim (and type)
5. chassis_variants.ts read helpers by trim (and drivetrain)

---

## Normalized Vehicle Intelligence Model (authoritative)
- make -> model -> trim
- trim -> engines, transmissions, chassis_variants
- engine_specs / transmission_specs / trim_specs
- oem_parts + engine/trans/trim fitments
- confidence_score (0.0-1.0) on every AI-populated intelligence table

---

## NEXT CHECKLIST (priority-ordered)
1) Implement missing access layers: `convex/oemParts.ts`, `convex/fitments.ts`, `convex/specs.ts`, `convex/transmissions.ts`, `convex/chassis_variants.ts`
2) Implement `getFullVehicleSpecPack(vin)` in `convex/specs.ts`
3) Add variant read helpers by trim (transmissions, chassis_variants)
4) Seed demo data (minimum viable)
5) Frontend consumes spec pack by VIN

**Last Updated:** February 1, 2026
