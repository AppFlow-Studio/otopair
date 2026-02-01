# Convex API Surface

**Generated:** February 1, 2026  
**Status:** Production-ready vehicle model implemented with full code documentation  
**Source:** Convex files in `convex/*.ts`  
**Documentation:** All API files include comprehensive TypeScript comments following booking component pattern

---

## Module Overview

### Fully Implemented (Queries + Mutations)

#### vehicles.ts
- list() - Get all vehicles
- getById(id) - Get vehicle by ID
- getByVin(vin) - Get vehicle by canonical VIN (unique lookup)
- getVehicleWithOwners(vin) - Get vehicle + all active owners
- getVehicleOwner(vin, userId) - Get specific ownership record
- listVehiclesByUser(userId) - List active vehicles for user
- listOwnedVINsByUser(userId) - Just the VINs owned by user
- upsertVehicle(vin, trim_id?, engine_id?, year?, metadata?) - Create/update vehicle
- addOwner(vin, userId, nickname?, is_primary?, mileage?) - Add/reactivate ownership
- removeOwner(vin, userId) - Soft-delete ownership
- updateOwnershipPrimary(vin, userId, is_primary) - Set primary vehicle
- updateMileage(vin, userId, mileage) - Update current mileage

#### vehicle_owners.ts
- getByVin(vin) - All ownership records (active + removed)
- getActiveByVin(vin) - Only active owners
- getByUser(userId) - All ownerships (active + removed)
- getActiveByUser(userId) - Only active vehicles for user
- getByVinAndUser(vin, userId) - Single ownership record
- getPrimaryVehicle(userId) - Get user's primary vehicle
- isOwnedByUser(vin, userId) - Boolean: active ownership exists
- getOwnerCount(vin) - Count of active owners

#### bookings.ts
- list() - Get all bookings
- getById(id) - Get single booking
- getByUserId(userId) - Get user's bookings (indexed)
- getByShopId(shopId) - Get shop's bookings (indexed)
- create(user_id, vin, shop_id, service_id, ...) - Create booking with VIN
- updateStatus(id, newStatus, reason) - Update booking status with FSM validation + async history log

#### payments.ts
- list() - Get all payments
- getById(id) - Get payment by ID
- getByBookingId(bookingId) - Get payment for a booking (unique)
- getByUserId(userId) - Get user's payments
- create(booking_id, user_id, amount, payment_method, ...) - Create payment record
- updateStatus(id, status, error_code?, transaction_id?) - Update payment status with FSM validation + async history log

#### job_actuals.ts
- list() - Get all job actuals
- getById(id) - Get job actual by ID
- getByBookingId(bookingId) - Get job actual for booking (unique)
- getPrefillData(bookingId) - Get vehicle + service + mechanic prefill data for job form
- startJob(bookingId, mechanic_id) - Mark job started, record timestamp
- completeJob(bookingId) - Mark job completed
- submitJobActuals(bookingId, actual_labor_minutes, actual_parts_cost, parts_used, difficulty_rating, ...) - Submit final job details + track variance

#### follow_ups.ts
- list() - Get all follow-ups
- getById(id) - Get follow-up by ID
- getByUserId(userId) - Get user's follow-ups
- getByVin(vin) - Get follow-ups for a vehicle
- getByStatus(status) - Get follow-ups by status
- getByBookingId(bookingId) - Get follow-ups for a booking
- getPendingReminders(beforeTimestamp) - Get pending reminders before a time
- create(user_id, vin, service_id, follow_up_type, scheduled_for, message) - Create reminder
- updateStatus(id, status) - Update follow-up status (pending/sent/completed/dismissed)
- dismiss(id) - Dismiss a follow-up

#### reviews.ts
- list() - Get all reviews
- getById(id) - Get review by ID
- getByShopId(shopId) - Get shop's reviews (indexed)
- getByUserId(userId) - Get user's reviews (indexed)
- submit(booking_id, shop_id, mechanic_id?, rating, comment) - Submit review with invariant checks

#### booking_status_history.ts (Append-Only Audit Log)
- getByBookingId(bookingId) - Get all status transitions for a booking
- getHistory(bookingId) - Get chronologically ordered history (oldest first)
- getLatestStatus(bookingId) - Get most recent status transition
- validateTransition(oldStatus, newStatus) - FSM validation (returns error msg or null)
- isTerminal(status) - Check if status is terminal (no transitions allowed)
- getValidNextStates(status) - Get allowed next states from current status
- log(internal) - Internal mutation for async history recording

#### payment_status_history.ts (Append-Only Audit Log)
- Same interface as booking_status_history

#### ai_conversations.ts
- list() - Get all conversations
- getById(id) - Get conversation by ID
- create(user_id, session_id, scenario_detected?) - Start conversation
- end(id) - End conversation
- getByUserId(userId) - Get user's conversations
- getBySessionId(sessionId) - Get conversation by session UUID
- markLedToBooking(id, booking_id) - Mark that AI chat led to a booking

#### ai_messages.ts
- list() - Get all messages
- getById(id) - Get message by ID
- create(conversation_id, role, content, confidence_score?, metadata?) - Add message
- getByConversationId(conversationId) - Get messages in a conversation (indexed)

#### analytics_events.ts
- list() - Get all events
- track(event_type, event_category, user_id?, session_id?, event_data?) - Track user action
- getByEventType(eventType) - Get events of a type
- getByUserId(userId) - Get user's events
- getConversionFunnelStats(funnelType) - Get funnel completion rates

#### conversion_funnels.ts
- list() - Get all funnel entries
- getById(id) - Get funnel entry by ID
- enterStage(user_id, funnel_type, stage, booking_id?) - User enters funnel stage
- exitStage(id, drop_off_reason?) - User exits funnel (completed or dropped off)
- markCompleted(id) - Mark funnel as completed
- getByUserId(userId) - Get user's funnel entries

---

### Schema-Only (Table Exists, No Access Layer)
- engines.ts
- makes.ts
- models.ts
- trims.ts
- services.ts
- service_categories.ts
- service_options.ts
- service_vehicle_specs.ts
- shop_services.ts
- engine_specs.ts
- transmission_specs.ts
- trim_specs.ts
- oem_parts.ts
- engine_part_fitments.ts
- transmission_part_fitments.ts
- trim_part_fitments.ts
- transmissions.ts
- chassis_variants.ts
- ai_enrichment_logs.ts
- manual_review_queue.ts
- spec_variances.ts
- spec_confirmations.ts

---

### Planned / In Progress - Vehicle Intelligence APIs
| Module | Tables | Status | Notes |
|---|---|---|---|
| oemParts.ts | oem_parts | Planned | Upsert/search by part number/category; no confidence_score on parts. |
| fitments.ts | engine_part_fitments, transmission_part_fitments, trim_part_fitments | Planned | Role-allowlisted set*Fitment mutations; merge confidence_score on updates. |
| specs.ts | engine_specs, transmission_specs, trim_specs | Planned | Upsert with confidence_score merge; include getFullVehicleSpecPack(vin). |
| transmissions.ts | transmissions | Planned | Read helpers by trim (and type) with confidence_score support. |
| chassis_variants.ts | chassis_variants | Planned | Read helpers by trim (and drivetrain) with confidence_score support. |

---

### Other Infrastructure (Not User-Facing)
- users.ts
- shops.ts
- mechanics.ts
- shops_hours.ts
- time_slots.ts
- user_question_answers.ts
- onboarding_questions.ts

---

## Next Steps

### Completed (January 31, 2026)
1. Created vehicles.ts with full mutation/query support
2. Created vehicle_owners.ts with soft-delete aware helpers
3. Updated bookings.create to use vin
4. Updated job_actuals.ts to use VIN-based vehicle lookups
5. Updated follow_ups.ts to use VIN-based references

### High Priority
1. Ship access layers for vehicle intelligence: oemParts.ts, fitments.ts, specs.ts (confidence_score aware) and expose in generated API.
2. Add read helpers for transmissions.ts and chassis_variants.ts; thread through vehicles.upsert to accept ids.
3. Update frontend to consume consolidated spec pack (engine/trans/trim specs + fitments) with confidence badges.
4. Seed minimal demo data for new tables to unblock UI/spec testing.

### Medium Priority
1. Test all FSM transitions (valid + invalid)
2. Verify invariants (unique job_actuals, unique reviews per booking)
3. Add createUser flow tests

### Low Priority
1. Implement read-only catalog queries (engines, makes, models, trims)
2. Add analytics dashboard queries
3. Performance profiling with real load

---

**Last Updated:** February 1, 2026 - Vehicle intelligence APIs planned/in progress
