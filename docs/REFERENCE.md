# OtoPair Database & API Reference

**Single source of truth for schema, access layers, and implementation status.**  
**Source:** [convex/schema.ts](../convex/schema.ts) and `convex/*.ts`  
**Last verified:** February 2026

For high-level and per-part diagrams, see [docs/diagrams.md](diagrams.md). For plan details, see [.cursor/plans](../.cursor/plans).

---

## Table of contents

1. [How to use this doc](#how-to-use-this-doc)
2. [Database overview](#database-overview)
3. [Tables by domain (44 total)](#tables-by-domain-44-total)
4. [Key relationships and concepts](#key-relationships-and-concepts)
5. [Invariants, FSM, timestamps](#invariants-fsm-timestamps)
6. [Access layer: what’s implemented](#access-layer-whats-implemented)
7. [API reference by module](#api-reference-by-module)
8. [Implementation status and next steps](#implementation-status-and-next-steps)
9. [Code examples](#code-examples)

---

## How to use this doc

- **“What tables exist? What are the relationships?”** → Sections 2–3, 4.
- **“What queries/mutations exist? What are the correct names?”** → Sections 6–7.
- **“What’s done vs what’s left?”** → Section 8.
- **“How do I call the API from the app?”** → Section 9.

---

## Database overview

- **46 tables** in Convex; VIN-centric vehicles + vehicle_owners; vehicle_specs for engine-level OEM parts.
- **VIN-centric model:** One vehicle per VIN; ownership is `vehicle_owners` (soft-delete via status). Bookings and follow-ups reference `vin`.
- **Vehicle intelligence:** Normalized OEM parts, subsystem specs (engine/transmission/trim), and fitments; optional `confidence_score` (0–1) on AI-populated rows.
- **Audit:** Append-only `booking_status_history` and `payment_status_history` with FSM validation.

---

## Tables by domain (46 total)

### Core transactions (5)

| Table                  | Purpose                                                                     |
| ---------------------- | --------------------------------------------------------------------------- |
| bookings               | One row per appointment; links user, vin, shop, time_slot; `service_ids` array (service IDs), aggregated labor/parts cost; `total_cost` = labor + parts + taxes_and_fees + platform_fee (full amount customer pays); `estimated_labor_minutes`; status FSM; **`live_stage`** (optional, when status is `in_progress`): `"booking_confirmed"` \| `"service_in_progress"` \| `"vehicle_ready"` for Live Tracker stage |
| payments               | Payment per booking; idempotency_key; status FSM                            |
| job_actuals            | Actual work per booking (labor, parts, notes); one per booking              |
| booking_status_history | Append-only booking status transitions                                      |
| payment_status_history | Append-only payment status transitions                                      |

### Vehicle management (2)

| Table          | Purpose                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------- |
| vehicles       | Canonical vehicle by VIN; optional trim_id, engine_id, transmission_id, chassis_id, year, metadata |
| vehicle_owners | User–vehicle ownership; status active/removed; is_primary, mileage, nickname                       |

### Vehicle catalog (6)

| Table            | Purpose                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| makes            | Manufacturer                                                              |
| models           | Model under make                                                          |
| trims            | Trim under model (year bounds)                                            |
| engines          | Engine variants per trim                                                  |
| transmissions    | Transmission variants per trim; optional confidence_score                 |
| chassis_variants | Drivetrain variants per trim (fwd/rwd/awd/4wd); optional confidence_score |

### Vehicle intelligence (9)

| Table                      | Purpose                                                                        |
| -------------------------- | ------------------------------------------------------------------------------ |
| oem_parts                  | Normalized parts catalog; unique oem_part_number                               |
| engine_specs               | Engine fluids/intervals per engine; optional confidence_score                  |
| transmission_specs         | Transmission fluid/interval per transmission; optional confidence_score        |
| trim_specs                 | Trim-level specs (tires, lug torque, parking brake); optional confidence_score |
| engine_part_fitments       | Part fitments by engine + role; optional confidence_score                      |
| transmission_part_fitments | Part fitments by transmission + role; optional confidence_score                |
| trim_part_fitments         | Part fitments by trim + role; optional confidence_score                        |
| service_vehicle_specs      | Service labor/parts predictions per engine+service; confidence_score           |
| ai_enrichment_logs         | AI-generated enrichments; confidence_score; review_status                      |

### Spec pipeline (4)

| Table               | Purpose                                         |
| ------------------- | ----------------------------------------------- |
| manual_review_queue | Low-confidence items for human review           |
| spec_variances      | Predicted vs actual (e.g. job_actuals) variance |
| spec_confirmations  | User confirmations of spec accuracy             |

### Services & shops (12)

| Table              | Purpose                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| services           | Service definitions; link to service_categories; no price—use formula (labor×rate + parts + tax + fees) |
| service_categories | Category grouping                                                                                       |
| service_options    | Labor/parts options per service                                                                         |
| shop_services      | Which services each shop offers                                                                         |
| shops              | Service centers                                                                                         |
| mechanics          | Shop staff; optional **`photo`** → cdn_assets for profile/avatar image                                  |
| shops_hours        | Operating hours per shop                                                                                |
| time_slots         | Booking slots per shop/mechanic                                                                         |
| service_insights   | Aggregated engine+service performance data                                                              |
| cdn_assets         | CDN/content URLs (portfolio images, logos, mechanic photos); referenced by shop_portfolio, makes.logo, mechanics.photo |
| shop_portfolio     | Links shops to cdn_assets for portfolio/gallery display (content_id, display_order)                       |

### Reviews & follow-ups (2)

| Table      | Purpose                                                              |
| ---------- | -------------------------------------------------------------------- |
| reviews    | One per booking; user, shop, mechanic_id (optional), rating, comment; indexes: by_shop_id, by_mechanic_id, by_user_id |
| follow_ups | Maintenance reminders; keyed by user_id, vin, service_id, booking_id |

### User & onboarding (4)

| Table                       | Purpose                                                 |
| --------------------------- | ------------------------------------------------------- |
| users                       | Profiles; Clerk auth (clerkUserId)                      |
| onboarding_questions        | Survey questions and steps                              |
| onboarding_question_answers | Answer options per question                             |
| user_question_answers       | User’s chosen answers (user_id, question_id, answer_id) |

### AI & analytics (4)

| Table              | Purpose                                                          |
| ------------------ | ---------------------------------------------------------------- |
| ai_conversations   | Chat sessions; session_id, scenario_detected, booking_id         |
| ai_messages        | Messages per conversation; role, content, confidence_score       |
| analytics_events   | Event tracking (event_type, event_category, user_id, session_id) |
| conversion_funnels | Funnel stages (user, funnel_type, stage, booking_id, completed)  |

---

## Key relationships and concepts

### Vehicle catalog hierarchy

```
makes → models → trims
trims → engines | transmissions | chassis_variants
vehicles (VIN) → trim_id | engine_id | transmission_id | chassis_id (all optional)
vehicle_owners → vehicles (vin), users (user_id)
```

### Spec and parts intelligence

```
engine → engine_specs, engine_part_fitments ← oem_parts
transmission → transmission_specs, transmission_part_fitments ← oem_parts
trim → trim_specs, trim_part_fitments ← oem_parts
service_vehicle_specs, service_insights ← engines, services
ai_enrichment_logs → manual_review_queue; spec_variances, spec_confirmations ← engines, services, job_actuals
```

### Confidence score

- **Where it applies:** transmissions, chassis_variants; engine_specs, transmission_specs, trim_specs; engine/transmission/trim_part_fitments; service_vehicle_specs; ai_enrichment_logs. Schema: optional `v.optional(v.float64())`; access layer mutations often require 0–1 on insert/upsert.
- **Where it does not:** oem_parts (catalog); manual_review_queue, spec_variances, spec_confirmations (workflow/feedback).

### Service pricing (no stored price)

- Services do **not** have a fixed `price` field. Price is **computed at booking time** using:
  - **Formula:** `(labor_hours × shop.labor_rate) + parts` per service, summed; plus %taxes + %service_fees.
- **Sources (priority order):**
  1. **Car-specific:** `service_vehicle_specs` (engine_id + service_id) → `labor_hours`, `parts_cost_low`, `parts_cost_high` (use avg). Used when selected vehicle has `engine_id`.
  2. **Fallback:** `services.default_labor_hours`, `service_options` (first option) → `parts_cost_low`, `parts_cost_high` (use avg).
- **Shop labor rate:** Only the shop’s declared `shops.labor_rate` is used; there is no default labor rate. In the UI, `laborRate = shop?.labor_rate`; fallback only at calculation sites where a number is required. useCreateBookingConvex requires shop and labor_rate when creating a booking (throws otherwise). createBatch receives per-service labor/parts from the hook: `labor_cost = shop.labor_rate × default_labor_hours`, `parts_cost = default_parts_estimate`.
- **Display format:** `Oil change + x more... $80` (service names first, total price last) in ShopCard and footer.
- Use this formula wherever the app needs a “price” or “total” for a service (e.g. booking flow, review & pay).

---

## Invariants, FSM, timestamps

### Vehicle

- One vehicle per VIN (enforced in vehicles upsert).
- One ownership row per (vin, user_id). Status: active | removed; at most one active is_primary per user.

### Booking

- One job_actuals per booking; one review per booking; review only when booking status is completed.

### Live Tracker (My Bookings)

- **Stored stage:** When `bookings.status === "in_progress"`, optional **`live_stage`** holds the current Live Tracker stage: `"booking_confirmed"` | `"service_in_progress"` | `"vehicle_ready"`. Cleared when status becomes completed/cancelled/no_show.
- **Query:** `bookings.getByUserIdWithDetails(userId)` returns for each booking: `liveStage`, `currentStage` (display title), `progressPercent` (from job_actuals elapsed time when available, else from stage-based fallback), `mechanicImageUrl` (mechanic.photo → cdn_assets.url).
- **Adapter:** `utils/bookingAdapter.ts` — `stagesFromLiveStage(liveStage, progressPercent)` builds the four UI stages (completed/current/pending) from stored `live_stage`; when `liveStage` is missing, falls back to progress-based heuristic. `adaptConvexBookingWithDetailsToLiveTracking(row)` uses `row.liveStage` and `row.progressPercent` for LiveTrackerCard.
- **Mutations:** `bookings.updateStatus(..., "in_progress")` sets `live_stage = "service_in_progress"`; transition to completed/cancelled/no_show clears `live_stage`. **`bookings.updateLiveStage(bookingId, liveStage)`** — mechanic/shop can advance stage to `"vehicle_ready"` etc.; only allowed when booking is in_progress.

### FSM (booking status)

- pending → confirmed | cancelled
- confirmed → in_progress | cancelled | no_show
- in_progress → completed
- Terminal: completed, cancelled, no_show

### FSM (payment status)

- pending → processing | cancelled
- processing → completed | failed
- completed → refunded
- Terminal: failed, refunded, cancelled

### Timestamps

- Stored as float64 Unix milliseconds (Date.now()).

---

## Access layer: what’s implemented

### Fully implemented (queries + mutations where applicable)

- **Core:** vehicles.ts, vehicle_owners.ts, bookings.ts, payments.ts, job_actuals.ts, reviews.ts, follow_ups.ts, booking_status_history.ts, payment_status_history.ts
- **Vehicle intelligence:** oemParts.ts, specs.ts (includes getFullVehicleSpecPack(vin)), fitments.ts, transmissions.ts, chassis_variants.ts
- **AI & analytics:** ai_conversations.ts, ai_messages.ts, analytics_events.ts, conversion_funnels.ts
- **Spec pipeline:** ai_enrichment_logs.ts, manual_review_queue.ts, spec_variances.ts, spec_confirmations.ts (Convex files exist; confirm exports if needed)
- **Services/shops:** services.ts, service_categories.ts, service_options.ts, service_vehicle_specs.ts, shop_services.ts, shops.ts, mechanics.ts, shops_hours.ts, time_slots.ts, service_insights.ts, cdn_assets.ts, shop_portfolio.ts
- **User/infra:** users.ts (getOrCreateMe, list, getById), plus onboarding and user_question_answers as present in convex

### Catalog (read-style)

- makes.ts, models.ts, trims.ts, engines.ts – list/getById/getBy\* queries.

---

## API reference by module

### vehicles.ts

- list(), getById(id), getByVin(vin), getVehicleWithOwners(vin), getVehicleOwner(vin, userId), listVehiclesByUser(userId), listOwnedVINsByUser(userId)
- upsertVehicle(vin, trim_id?, engine_id?, transmission_id?, chassis_id?, year?, metadata?), addOwner(vin, userId, nickname?, is_primary?, mileage?), removeOwner(vin, userId), updateOwnershipPrimary(vin, userId, is_primary), updateMileage(vin, userId, mileage)

### vehicle_owners.ts

- getByVin(vin), getActiveByVin(vin), getByUser(userId), getActiveByUser(userId), getByVinAndUser(vin, userId), getPrimaryVehicle(userId), isOwnedByUser(vin, userId), getOwnerCount(vin)

### bookings.ts

- list(), getById(id), getByUserId(userId), **getByUserIdWithDetails(userId)** (bookings with shop/mechanic/vehicle/service names, **liveStage**, progressPercent, currentStage, delayMinutes, mechanicImageUrl; used by My Bookings Live Tracker / Upcoming / History), **getRecentlyBookedShopIdsByUserId(userId, limit?)**, **getRecentlyBookedMechanicIdsByUserId(userId, limit?)**, getByShopId(shopId), create(...), **createBatch(...)** (one booking per appointment; initial status `pending`), **updateStatus(bookingId, newStatus, reason?)** (sets `live_stage` when newStatus is `in_progress`, clears when completed/cancelled/no_show), **updateLiveStage(bookingId, liveStage)** (`"booking_confirmed"` | `"service_in_progress"` | `"vehicle_ready"`; only when booking is in_progress)

### payments.ts

- list(), getById(id), getByBookingId(bookingId), getByUserId(userId), create(...), updateStatus(id, status, error_code?, transaction_id?)

### job_actuals.ts

- list(), getById(id), getByBookingId(bookingId), getPrefillData(bookingId), startJob(bookingId, mechanic_id), completeJob(bookingId), submitJobActuals(...)

### follow_ups.ts

- list(), getById(id), getByUserId(userId), getByVin(vin), getByStatus(status), getByBookingId(bookingId), getPendingReminders(beforeTimestamp), create(...), updateStatus(id, status), dismiss(id)

### reviews.ts

- list(), getById(id), getByShopId(shopId), getByMechanicId(mechanicId), getByUserId(userId), submit(booking_id, shop_id, mechanic_id?, rating, comment)

### cdn_assets.ts

- list(), getById(id)

### mechanics.ts

- list(), getById(id), getByShopId(shopId) – each returns mechanic(s) with resolved **photoUrl** (mechanic.photo → cdn_assets.url); list/getById also include **shop** object

### shop_portfolio.ts

- listByShopId(shopId) – portfolio items for a shop with resolved asset URLs (join with cdn_assets); ordered by display_order

### booking_status_history.ts / payment_status_history.ts

- getByBookingId(bookingId) / getByPaymentId(paymentId), getHistory(id), getLatestStatus(id), validateTransition(old, new), isTerminal(status), getValidNextStates(status); internal log(...)

### ai_conversations.ts, ai_messages.ts

- Conversations: list(), getById(id), create(user_id, session_id, scenario_detected?), end(id), getByUserId(userId), getBySessionId(sessionId), markLedToBooking(id, booking_id)
- Messages: list(), getById(id), create(conversation_id, role, content, confidence_score?, metadata?), getByConversationId(conversationId)

### analytics_events.ts

- list(), track(event_type, event_category, user_id?, session_id?, event_data?), getByEventType(eventType), getByUserId(userId), getConversionFunnelStats(funnelType)

### conversion_funnels.ts (correct names)

- list(), getById(id), getByUserId(userId), getByBookingId(bookingId)
- **startFunnel**(user_id, funnel_type, stage, booking_id?) – create funnel; returns id
- **updateStage**(id, stage) – update stage
- **completeFunnel**(id, booking_id?) – set completed, exited_at
- **abandonFunnel**(id, drop_off_reason?) – set exited_at, drop_off_reason

### oemParts.ts

- upsert(oem_part_number, name?, category?, notes?), getById(id), getByOemPartNumber(oem_part_number), listByIds(ids), listByCategory(category), list(limit?)

### specs.ts

- upsertEngineSpecs(engine_id, ...fields, confidence_score), upsertTransmissionSpecs(transmission_id, ...fields, confidence_score), upsertTrimSpecs(trim_id, ...fields, confidence_score)
- getByEngine(id), getByTransmission(id), getByTrim(id)
- **getFullVehicleSpecPack(vin)** – consolidated engine + transmission + trim specs and fitments for a vehicle

### fitments.ts

- upsertEnginePartFitment(engine_id, part_id, role, ..., confidence_score), upsertTransmissionPartFitment(...), upsertTrimPartFitment(...)
- listByEngine(engine_id, attachPart?), listByTransmission(transmission_id, attachPart?), listByTrim(trim_id, attachPart?), listByPart(part_id)

### transmissions.ts

- upsertTransmission(trim_id, transmission_type, code?, notes?, confidence_score), getById(id), listByTrimId(trim_id)

### chassis_variants.ts

- upsertChassisVariant(trim_id, drivetrain_type, notes?, confidence_score), getById(id), listByTrimId(trim_id)

### service_vehicle_specs.ts

- list(), getById(id)
- **getByEngineAndService**(engineId, serviceId) – single engine+service spec
- **getSpecsForEngineAndServices**(engineId, serviceIds[]) – car-specific labor/parts for pricing; returns map of serviceId → { labor_hours, parts_cost_avg }

---

## Implementation status and next steps

### Done

- Schema: 46 tables; VIN-based vehicles + vehicle_owners; normalized vehicle intelligence; cdn_assets + shop_portfolio for portfolio images. **bookings.live_stage** (optional, when in_progress); **mechanics.photo** → cdn_assets.
- Core: vehicles, vehicle_owners, bookings, payments, job_actuals, reviews, follow_ups, status history with FSM. **My Bookings / Live Tracker:** getByUserIdWithDetails (liveStage, progressPercent, currentStage, mechanicImageUrl), updateStatus sets/clears live_stage, updateLiveStage(bookingId, liveStage); adapter stagesFromLiveStage; mechanics list/getById/getByShopId return photoUrl.
- **Seed (demo):** seedPastBookingsForJohnDoe (past bookings for History tab), seedLiveBookingForJohnDoe (one in_progress booking for Live Tracker).
- Vehicle intelligence: oemParts, specs (including getFullVehicleSpecPack), fitments, transmissions, chassis_variants.
- AI, analytics, conversion_funnels (use startFunnel, updateStage, completeFunnel, abandonFunnel).
- Spec pipeline and services/shops Convex files exist (confirm as needed).
- **Confirmation screen (post-booking):** Shop from `api.shops.getById(shopId)`; **Directions** via `utils/linking.openMapsForAddress(address)` (Google Maps); **Contact** via `utils/linking.openPhone(shop.phone)` (native dialer); **Add to Calendar** via expo-calendar (permission, createEventAsync with shop name, scheduled date/time, location). Store Shop type and useShopsFromConvex include `phone` for Contact on confirmation and shop carousel cards.

### Next steps (priority)

1. **Docs:** Keep this REFERENCE.md as single source of truth; update any remaining references to old doc names or “schema-only” for vehicle intelligence.
2. **Seed/demo data:** Populate oem_parts, specs, fitments, transmissions, chassis_variants (and catalog) to unblock UI and getFullVehicleSpecPack testing.
3. **Frontend:** Consume getFullVehicleSpecPack(vin), show spec pack and confidence where relevant (e.g. add-car, maintenance).
4. **Wiring:** Ensure add-car and booking flows use the Convex APIs above and conversion_funnels use startFunnel/updateStage/completeFunnel/abandonFunnel.

### Optional later

- Deeper CRUD for shops_hours / time_slots if product needs it.
- FSM and invariant tests.

---

## Code examples

### Add vehicle and owner

```typescript
await upsertVehicle({ vin, trim_id, engine_id, year });
await addOwner({ vin, userId, nickname: "My Car", is_primary: true, mileage: 42000 });
```

### Create booking (VIN-based)

**Single-service:** `bookings.create(...)` – one row with `service_ids: [service_id]`.

**Multi-service (one appointment):** `bookings.createBatch(...)` – one row per appointment; `services` array (per-service labor_cost, parts_cost from shop labor rate only: labor_cost = shop.labor_rate × default_labor_hours, parts_cost = default_parts_estimate); aggregated costs and `estimated_labor_minutes`; initial status `pending`; returns `[bookingId]`.

```typescript
await createBatch({
  user_id, vin, shop_id, mechanic_id?, time_slot_id,
  scheduled_date, scheduled_time,
  services: [{ service_id, labor_cost, parts_cost, labor_hours? }, ...], // payload; DB stores service_ids (array of IDs only)
  taxes_and_fees?, platform_fee?, // optional; included in total_cost (full amount customer pays)
  session_id?, funnel_id?,
});
```

### Conversion funnel (correct API)

```typescript
const funnelId = await startFunnel({ user_id, funnel_type: "booking_flow", stage: "service_selected" });
await updateStage({ id: funnelId, stage: "date_selected" });
await completeFunnel({ id: funnelId, booking_id }); // or abandonFunnel({ id: funnelId, drop_off_reason: "..." });
```

### Spec pack by VIN

```typescript
const pack = await getFullVehicleSpecPack({ vin });
// pack: engine/transmission/trim specs + fitments (with optional part details)
```

### Live Tracker: update stage (mechanic/shop)

```typescript
// Only when booking.status === "in_progress"
await updateLiveStage({ bookingId, liveStage: "vehicle_ready" });
// liveStage: "booking_confirmed" | "service_in_progress" | "vehicle_ready"
```

### Seed: past and live bookings (John Doe demo)

```bash
# Past bookings for History tab (clerkUserId: user_38uSI8ArZJ0HMY9AwvQLOZiIo53)
npx convex run seed:seedPastBookingsForJohnDoe

# One in-progress booking for Live Tracker tab (same user)
npx convex run seed:seedLiveBookingForJohnDoe
```
