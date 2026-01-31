# Convex API Surface

**Generated:** January 31, 2026  
**Status:** Partial coverage (12/19 modules have queries/mutations)  
**Source:** Convex files in `/workspaces/otopair/convex/*.ts`

---

## Module Overview

### ✅ Fully Implemented (Queries + Mutations)

#### **bookings.ts**
- `list()` — Get all bookings
- `getById(id)` — Get single booking
- `create(user_id, vin, shop_id, service_id, ...)` — Create booking + reserve time slot
- `getByUserId(userId)` — Get user's bookings
- `getByShopId(shopId)` — Get shop's bookings
- `updateStatus(id, newStatus, reason)` — Update booking status with FSM validation + async history log

#### **payments.ts**
- `list()` — Get all payments
- `getById(id)` — Get payment by ID
- `getByBookingId(bookingId)` — Get payment for a booking (unique)
- `getByUserId(userId)` — Get user's payments
- `create(booking_id, user_id, amount, payment_method, ...)` — Create payment record
- `updateStatus(id, status, error_code?, transaction_id?)` — Update payment status with FSM validation + async history log

#### **job_actuals.ts**
- `list()` — Get all job actuals
- `getById(id)` — Get job actual by ID
- `getByBookingId(bookingId)` — Get job actual for booking (unique)
- `getPrefillData(bookingId)` — Get vehicle + service + mechanic prefill data for job form
- `startJob(bookingId, mechanic_id)` — Mark job started, record timestamp
- `completeJob(bookingId)` — Mark job completed
- `submitJobActuals(bookingId, actual_labor_minutes, actual_parts_cost, parts_used, difficulty_rating, ...)` — Submit final job details + track variance

#### **follow_ups.ts**
- `list()` — Get all follow-ups
- `getById(id)` — Get follow-up by ID
- `getByUserId(userId)` — Get user's follow-ups
- `getByVin(vin)` — Get follow-ups for a vehicle (NEW: uses VIN)
- `getPendingReminders(beforeTimestamp)` — Get pending reminders before a time
- `create(user_id, vin, service_id, follow_up_type, scheduled_for, message)` — Create reminder (NEW: uses VIN)
- `updateStatus(id, status)` — Update follow-up status (pending/sent/completed/dismissed)
- `dismiss(id)` — Dismiss a follow-up

#### **reviews.ts**
- `list()` — Get all reviews
- `getById(id)` — Get review by ID
- `getByShopId(shopId)` — Get shop's reviews (indexed)
- `getByUserId(userId)` — Get user's reviews (indexed)
- `submit(booking_id, shop_id, mechanic_id?, rating, comment)` — Submit review with invariant checks

#### **booking_status_history.ts** (Append-Only Audit Log)
- `getByBookingId(bookingId)` — Get all status transitions for a booking
- `getHistory(bookingId)` — Get chronologically ordered history (oldest first)
- `getLatestStatus(bookingId)` — Get most recent status transition
- `validateTransition(oldStatus, newStatus)` — FSM validation (returns error msg or null)
- `isTerminal(status)` — Check if status is terminal (no transitions allowed)
- `getValidNextStates(status)` — Get allowed next states from current status
- `log(internal)` — Internal mutation for async history recording

#### **payment_status_history.ts** (Append-Only Audit Log)
- Same interface as booking_status_history

#### **ai_conversations.ts**
- `list()` — Get all conversations
- `getById(id)` — Get conversation by ID
- `create(user_id, session_id, scenario_detected?)` — Start conversation
- `end(id)` — End conversation
- `getByUserId(userId)` — Get user's conversations
- `getBySessionId(sessionId)` — Get conversation by session UUID
- `markLedToBooking(id, booking_id)` — Mark that AI chat led to a booking

#### **ai_messages.ts**
- `list()` — Get all messages
- `getById(id)` — Get message by ID
- `create(conversation_id, role, content, confidence_score?, metadata?)` — Add message
- `getByConversationId(conversationId)` — Get messages in a conversation (indexed)

#### **analytics_events.ts**
- `list()` — Get all events
- `track(event_type, event_category, user_id?, session_id?, event_data?)` — Track user action
- `getByEventType(eventType)` — Get events of a type
- `getByUserId(userId)` — Get user's events
- `getConversionFunnelStats(funnelType)` — Get funnel completion rates

#### **conversion_funnels.ts**
- `list()` — Get all funnel entries
- `getById(id)` — Get funnel entry by ID
- `enterStage(user_id, funnel_type, stage, booking_id?)` — User enters funnel stage
- `exitStage(id, drop_off_reason?)` — User exits funnel (completed or dropped off)
- `markCompleted(id)` — Mark funnel as completed
- `getByUserId(userId)` — Get user's funnel entries

---

### 🟡 Schema-Only (Table Exists, No Access Layer)

#### **engines.ts** — No queries/mutations
- Seeded catalog of engine specs (cylinders, displacement, fuel type)

#### **makes.ts** — No queries/mutations
- Seeded catalog of car manufacturers

#### **models.ts** — No queries/mutations
- Seeded catalog of car models per make

#### **trims.ts** — No queries/mutations
- Seeded catalog of trim variants per model

#### **vehicle_specs.ts** — No queries/mutations
- OEM part numbers and fluid specs per engine

#### **services.ts** — No queries/mutations
- Service definitions (oil change, brake pads, etc.)

#### **service_categories.ts** — No queries/mutations
- Category grouping for services

#### **service_options.ts** — No queries/mutations
- Labor/parts cost options per service

#### **service_vehicle_specs.ts** — No queries/mutations
- Service specs per engine (labor hours, parts cost estimates, confidence)

#### **shop_services.ts** — No queries/mutations
- Which services each shop offers

#### **ai_enrichment_logs.ts** — No queries/mutations
- AI-generated spec enrichment records

#### **manual_review_queue.ts** — No queries/mutations
- Queue of low-confidence AI enrichments for human review

#### **spec_variances.ts** — No queries/mutations
- Tracking of predicted vs actual labor/costs

#### **spec_confirmations.ts** — No queries/mutations
- User confirmations of spec accuracy

---

### ❌ Missing Access Layers (Tables Deleted or Not Created)

#### **vehicles.ts** — MISSING (needs creation)
**Purpose:** Manage canonical vehicle catalog (unique by VIN)

**Planned Mutations:**
```typescript
upsertVehicle({
  vin: string,
  trim_id?: Id<"trims">,
  engine_id?: Id<"engines">,
  year?: number,
  metadata?: any
}): Promise<Doc<"vehicles">>

addOwner({
  vin: string,
  userId: Id<"users">,
  nickname?: string,
  is_primary?: boolean,
  mileage?: number
}): Promise<Id<"vehicle_owners">>

removeOwner({
  vin: string,
  userId: Id<"users">
}): Promise<void>
```

**Planned Queries:**
```typescript
listVehiclesByUser({
  userId: Id<"users">
}): Promise<Array<{ vin, vehicle, ownership }>>

getVehicleWithOwners({
  vin: string
}): Promise<{ vehicle, owners: Array<ownership> }>
```

#### **vehicle_owners.ts** — MISSING (needs creation)
**Purpose:** Join table for ownership relationships (soft-delete support)

**Planned Queries:**
```typescript
getByVin(vin: string): Promise<Array<ownership>>
getByUser(userId: Id<"users">): Promise<Array<ownership>>
getActiveByUser(userId: Id<"users">): Promise<Array<ownership>>
```

#### **user_vehicles.ts** — DEPRECATED (old schema)
**Status:** Still exists but references deleted table in old bookings
**Action:** Remove after vehicles.ts fully operational

---

### Other Infrastructure (Not User-Facing)

#### **users.ts**
- Clerk authentication integration
- User profile queries/mutations

#### **shops.ts**
- Shop directory and profile queries/mutations

#### **mechanics.ts**
- Mechanic profile queries (filtered by shop, active status)

#### **shops_hours.ts**
- Shop operating hours queries

#### **time_slots.ts**
- Available booking slots (queried during booking flow)

#### **user_question_answers.ts**
- Onboarding question options

#### **onboarding_questions.ts**
- Onboarding flow structure

---

## Call Patterns

### Typical User Flow

1. **Onboarding**
   - `users.create(clerkUserId, email, ...)` 
   - `conversion_funnels.enterStage("onboarding")`
   - `user_question_answers.getByQuestionId(...)` (prefill UI)

2. **Add Vehicle**
   - `vehicles.upsertVehicle(vin, trim_id, engine_id, year)` → auto-lookup via VIN scan
   - `vehicles.addOwner(vin, userId, nickname="My Car")` → create ownership
   - `follow_ups.create(user_id, vin, service_id, follow_up_type="maintenance_due", ...)` → setup reminders

3. **Find Services & Book**
   - `conversion_funnels.enterStage("booking_flow", "service_selected")`
   - `shops.list()` + geo filter (in app)
   - `shop_services.getByShop(shop_id)` → available services
   - `time_slots.getByShopAndDate(shop_id, date)` → available times
   - `bookings.create(user_id, vin, shop_id, service_id, time_slot_id)` → confirm booking
   - `conversion_funnels.exitStage("booking_flow", completed=true)`

4. **Pay**
   - `conversion_funnels.enterStage("payment_flow")`
   - `payments.create(booking_id, user_id, amount, payment_method)` → initiate
   - `payments.updateStatus(payment_id, "completed", transaction_id)` → confirm
   - `conversion_funnels.exitStage("payment_flow", completed=true)`

5. **Job Execution**
   - `job_actuals.startJob(booking_id, mechanic_id)` → mechanic clocks in
   - `job_actuals.getPrefillData(booking_id)` → suggest parts for OEM numbers
   - `job_actuals.submitJobActuals(booking_id, ...)` → complete job + track variance
   - `spec_variances.create(...)` (internal) → ML training data

6. **AI Diagnostics**
   - `ai_conversations.create(user_id, session_id)` → start chat
   - `ai_messages.create(conversation_id, "user", "My car won't start")` → user query
   - `ai_messages.create(conversation_id, "assistant", "Could be battery...", metadata)` → AI response
   - `analytics_events.track("ai_chat", "service_suggested", event_data={service_id, confidence})`
   - `ai_conversations.end(conversation_id)` → close chat

7. **Analytics**
   - All events tracked via `analytics_events.track(...)`
   - Conversion funnels tracked via `conversion_funnels.enterStage/exitStage(...)`

---

## Performance Notes

### Indexed Queries (O(log n) ~ 1-5ms)
- All transaction lookups (bookings.getByUserId, payments.getByStatus, etc.)
- History queries (booking_status_history.getByBookingId)
- Vehicle owner queries (vehicle_owners.by_user_status)

### Unique Lookups (O(1) ~ <1ms)
- payments.getByBookingId (unique per booking)
- job_actuals.getByBookingId (unique per booking)
- vehicles by VIN (unique per VIN)

### Full Table Scans (AVOID)
- None in access layer; all queries use indexes

---

## Next Steps

### High Priority
1. Create `vehicles.ts` with upsertVehicle, addOwner, removeOwner mutations
2. Create `vehicle_owners.ts` with query helpers
3. Update `bookings.create` to accept `vin` parameter instead of `user_vehicle_id`
4. Update frontend to call new vehicles API

### Medium Priority
1. Test all FSM transitions (valid + invalid)
2. Verify invariants (unique job_actuals, unique reviews per booking)
3. Add createUser flow tests

### Low Priority
1. Implement read-only catalog queries (engines, makes, models, etc.)
2. Add analytics dashboard queries
3. Performance profiling with real load

---

**Last Updated:** January 31, 2026
