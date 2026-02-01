# Database Status Report

**Date:** February 1, 2026  
**Schema Version:** Current (VIN catalog + normalized subsystems + AI confidence)  
**Source of Truth:** `convex/schema.ts`  
**Status:** Normalized vehicle intelligence schema in place; access layers summarized below.

---

## Documentation Coverage
All Convex files follow the booking-style documentation pattern:
- File header (purpose, relationships, use cases, owner)
- Table section (fields + indexes)
- Query/mutation docs (args, returns, errors, examples)

---

## Current Tables (see schema.ts for full list)

### Core Transactions
| Table | Purpose |
|---|---|
| bookings | Service appointments hub linking users, shops, services, and VINs |
| payments | Payment records per booking with idempotency |
| job_actuals | Actual work completed on a booking |

### Vehicle Management
| Table | Purpose |
|---|---|
| vehicles | Canonical vehicle catalog; unique by VIN; links trim, engine, transmission, chassis_variant |
| vehicle_owners | Join table: which users own which VINs (soft-delete via status) |

### Vehicle Catalog (normalized)
| Table | Purpose |
|---|---|
| makes | Manufacturer (e.g., Toyota, Honda) |
| models | Model under a make |
| trims | Trim under a model (year bounds) |
| engines | Engine variants under a trim |
| transmissions | Trim-scoped transmission variants; AI-populated rows include confidence_score (0.0-1.0) |
| chassis_variants | Trim-scoped drivetrain/chassis variants; AI-populated rows include confidence_score (0.0-1.0) |
| oem_parts | Normalized OEM parts catalog (unique oem_part_number) |

### Services & Shops
| Table | Purpose |
|---|---|
| services | Service definitions |
| service_categories | Category grouping for services |
| service_options | Labor/parts cost options per service |
| shop_services | Which services each shop offers |
| shops | Service centers |
| mechanics | Shop staff |

### Shop Schedule
| Table | Purpose |
|---|---|
| shops_hours | Operating hours per shop |
| time_slots | Available booking slots per shop/mechanic |

### Reviews & Quality
| Table | Purpose |
|---|---|
| reviews | Customer reviews of shops/mechanics per booking |

### AI & Chat
| Table | Purpose |
|---|---|
| ai_conversations | Chat sessions between user and AI assistant |
| ai_messages | Individual messages in a conversation |

### Analytics & Tracking
| Table | Purpose |
|---|---|
| analytics_events | User actions (clicks, page views, booking events) |
| conversion_funnels | Funnel stages (onboarding, booking flow, payment flow) |

### Follow-ups & Reminders
| Table | Purpose |
|---|---|
| follow_ups | Maintenance reminders keyed by VIN |

### Vehicle Intelligence (AI-populated with confidence_score 0.0-1.0 where applicable)
| Table | Purpose |
|---|---|
| engine_specs | Engine fluids/intervals with confidence_score |
| transmission_specs | Transmission fluid/capacity/interval with confidence_score |
| trim_specs | Trim-level specs with confidence_score |
| engine_part_fitments | Part fitments by engine + role + confidence_score |
| transmission_part_fitments | Part fitments by transmission + role + confidence_score |
| trim_part_fitments | Part fitments by trim + role + confidence_score |
| service_vehicle_specs | Service labor/parts predictions per engine + confidence_score |
| ai_enrichment_logs | AI-generated enrichments with confidence_score |
| manual_review_queue | Human review workflow for low-confidence enrichments |
| spec_variances | Predicted vs actual variance tracking |
| spec_confirmations | User confirmations of spec accuracy |

### Audit Logs
| Table | Purpose |
|---|---|
| booking_status_history | Append-only log of booking status transitions |
| payment_status_history | Append-only log of payment status transitions |

### User & Onboarding
| Table | Purpose |
|---|---|
| users | User profiles linked to Clerk authentication |
| user_question_answers | Onboarding questionnaire responses |

### Configuration
| Table | Purpose |
|---|---|
| onboarding_questions | Onboarding survey questions and answer options |

---

## Key Relationships

### Vehicle Catalog
```
make -> model -> trim
trim -> engines
trim -> transmissions
trim -> chassis_variants
vehicle (VIN) -> trim | engine | transmission | chassis_variant
```

### Spec & Parts Intelligence
```
engine -> engine_specs -> engine_part_fitments -> oem_parts
transmission -> transmission_specs -> transmission_part_fitments -> oem_parts
trim -> trim_specs -> trim_part_fitments -> oem_parts
service_vehicle_specs <-> engine
ai_enrichment_logs -> manual_review_queue -> spec_confirmations/spec_variances
```

---

## Confidence Score Policy
- confidence_score is required on every AI-populated intelligence table.
- Applies to: transmissions, chassis_variants, engine_specs, transmission_specs, trim_specs,
  engine_part_fitments, transmission_part_fitments, trim_part_fitments,
  service_vehicle_specs, ai_enrichment_logs.
- oem_parts is a normalized catalog and does not use confidence_score.
- manual_review_queue, spec_variances, and spec_confirmations are workflow/feedback tables
  and do not use confidence_score.

---

## Invariants & Constraints

### Vehicle Uniqueness
- One vehicle per VIN in vehicles (enforced in upsert logic)
- One ownership row per (vin, user_id)

### Ownership Lifecycle
- active: user owns/uses this vehicle
- removed: user soft-deleted this vehicle (is_primary forced to false, removed_at set)
- Single primary per user: only one active ownership per user can be is_primary=true

### Booking Invariants
- Unique job_actuals per booking
- Unique review per booking
- Review requires completed booking

### FSM Validation
- Booking status: pending -> confirmed|cancelled; confirmed -> in_progress|cancelled|no_show;
  in_progress -> completed; terminal: completed, cancelled, no_show
- Payment status: pending -> processing|cancelled; processing -> completed|failed;
  completed -> refunded; terminal: failed, refunded, cancelled

### Timestamps
- All timestamps are float64 Unix milliseconds (Date.now())

---

## Access Layer Coverage

### Implemented
- vehicles.ts, vehicle_owners.ts
- bookings.ts, payments.ts, job_actuals.ts, reviews.ts, follow_ups.ts
- booking_status_history.ts, payment_status_history.ts
- ai_conversations.ts, ai_messages.ts
- analytics_events.ts, conversion_funnels.ts

### Schema-Only
- makes.ts, models.ts, trims.ts, engines.ts
- services.ts, service_categories.ts, service_options.ts, service_vehicle_specs.ts, shop_services.ts
- oem_parts.ts, engine_part_fitments.ts, transmission_part_fitments.ts, trim_part_fitments.ts
- engine_specs.ts, transmission_specs.ts, trim_specs.ts
- transmissions.ts, chassis_variants.ts
- ai_enrichment_logs.ts, manual_review_queue.ts, spec_variances.ts, spec_confirmations.ts

---

## NEXT CHECKLIST (priority-ordered)
1) Expose read/write APIs for intelligence tables: oem_parts, engine/transmission/trim fitments,
   engine/transmission/trim specs, and propagate confidence_score on insert/patch.
2) Add read APIs for transmissions and chassis_variants; ensure vehicle mutations can set
   transmission_id and chassis_id.
3) Seed/demo data for new tables to unblock UI/spec testing.
4) Frontend: consume consolidated spec pack (engine + transmission + trim specs + fitments)
   and surface confidence to users.

**Last Updated:** February 1, 2026
