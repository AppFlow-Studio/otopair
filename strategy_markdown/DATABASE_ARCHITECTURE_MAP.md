# OtoPair Database Architecture Map

**Generated:** January 31, 2026  
**Repository:** AppFlow-Studio/otopair  
**Current Branch:** waleeddev2  
**Database:** Convex (serverless backend-as-a-service)

---

## 1. DATABASE SCHEMA LOCATION

📍 **Single Source of Truth:** [`convex/schema.ts`](convex/schema.ts)

- **Framework:** Convex (NOT Prisma, NOT SQL migrations)
- **Type System:** Convex validators (`v.*`)
- **No SQL files or migrations directory** (Convex manages schema evolution)

---

## 2. TABLE INVENTORY: IMPLEMENTED vs MISSING

### ✅ IMPLEMENTED TABLES (18 of 21 requested)

| Table | Convex File | Status | Key Fields |
|-------|-------------|--------|-----------|
| **profiles** | `users.ts` | ✅ Implemented | `clerkUserId`, `email`, `first_name`, `last_name`, `profile_photo_url`, `onboardingCompleted` |
| **vehicles** | `user_vehicles.ts` | ✅ Implemented | `user_id`, `engine_id`, `year`, `mileage`, `nickname`, `license_plate`, `vin` |
| **vehicle_classes** | `vehicle_specs.ts` | ✅ Implemented (inverted) | `engine_id`, battery/oil specs, brake pads OEM numbers |
| **shops** | `shops.ts` | ✅ Implemented | `name`, `address`, `city`, `state`, `zip`, `lat`, `lng`, `labor_rate`, `rating`, `is_verified` |
| **shop_services** | `shop_services.ts` | ✅ Implemented | `shop_id`, `service_id`, `is_offered` |
| **shops_hours** | `shops_hours.ts` | ✅ Implemented | `shop_id`, `day_of_week`, `open_time`, `close_time`, `is_closed` |
| **mechanics** | `mechanics.ts` | ✅ Implemented | `shop_id`, `first_name`, `last_name`, `rating`, `review_count`, `is_active` |
| **mechanic_schedules** | `time_slots.ts` | ✅ Implemented (renamed) | `mechanic_id`, `shop_id`, `date`, `start_time`, `end_time`, `is_available` |
| **service_categories** | `service_categories.ts` | ✅ Implemented | `name`, `icon_name`, `display_order` |
| **service_menu** | `services.ts` | ✅ Implemented | `service_category_id`, `name`, `slug`, `description`, `default_labor_hours`, `has_options` |
| **bookings** | `bookings.ts` | ✅ Implemented | `user_id`, `user_vehicle_id`, `shop_id`, `service_id`, `time_slot_id`, `scheduled_date`, `status`, `total_cost` |
| **jobs** | `job_actuals.ts` | ✅ Implemented (extended) | `booking_id`, `mechanic_id`, `job_started_at`, `job_completed_at`, `actual_labor_minutes`, `actual_parts_cost`, `difficulty_rating` |
| **job_parts** | `job_actuals.ts` | ✅ Implemented (nested) | `parts_used` array within `job_actuals` |
| **job_findings** | `job_actuals.ts` | ✅ Implemented (nested) | `technician_notes` within `job_actuals` |
| **job_status_log** | (implicit in `bookings`) | ⚠️ Partial | Status tracked in `bookings.status` (single field, not historical) |
| **payments** | (implicit in `bookings`) | ⚠️ Partial | `labor_cost`, `parts_cost`, `total_cost` in `bookings` (no payment table) |
| **reviews** | `reviews.ts` | ✅ Implemented | `booking_id`, `user_id`, `shop_id`, `mechanic_id`, `rating`, `comment` |
| **service_options** | `service_options.ts` | ✅ Implemented | `service_id`, `option_label`, `labor_hours`, `parts_cost_low`, `parts_cost_high`, `state_fee` |

### ❌ MISSING TABLES (3 of 21 requested)

| Table | Purpose | Status | Notes |
|-------|---------|--------|-------|
| **follow_ups** | Service reminders, maintenance scheduling | ❌ Missing | No table; could use reminder system |
| **ai_conversations** | AI chat history | ❌ Missing | Client-side state in `scenarioEngine.ts`, not persisted |
| **ai_messages** | Individual AI messages | ❌ Missing | Same as above; ephemeral state |
| **analytics_events** | Event tracking (user actions) | ❌ Missing | No analytics collection |
| **conversion_funnels** | Booking/payment funnel tracking | ❌ Missing | No funnel analytics table |

---

## 3. DATABASE ACCESS LAYER

### Architecture Pattern: **Convex Query/Mutation Model**

```
App UI (React/Expo)
       ↓
     Hooks / Stores
       ↓
  Convex Client
       ↓
  convex/*.ts (Query/Mutation Handlers)
       ↓
    Database
```

### Implementation Files

**Query Handlers (Read-Only):**
- [`convex/bookings.ts`](convex/bookings.ts) - `list()`, `getById()`
- [`convex/reviews.ts`](convex/reviews.ts) - `list()`, `getById()`, `getByShopId()`
- [`convex/mechanics.ts`](convex/mechanics.ts) - `list()`, `getById()`, `getByShopId()`
- [`convex/services.ts`](convex/services.ts) - `list()`, `getById()`
- [`convex/shops.ts`](convex/shops.ts) - `list()`, `getById()`, filtered queries
- [`convex/user_vehicles.ts`](convex/user_vehicles.ts) - `list()`, `getById()`, `getByUserId()`
- [`convex/users.ts`](convex/users.ts) - `list()`, `getById()`, `getOrCreateMe()`
- [`convex/job_actuals.ts`](convex/job_actuals.ts) - `list()`, `getById()`, `getByBookingId()`, `getPrefillData()`
- [`convex/service_options.ts`](convex/service_options.ts) - `list()`, `getById()`
- [`convex/service_insights.ts`](convex/service_insights.ts) - `list()`, `getById()`, `getByServiceAndEngine()`

**Mutation Handlers (Write/Update):**
- [`convex/bookings.ts`](convex/bookings.ts) - `create()` (with race-condition guards on time slots)
- [`convex/reviews.ts`](convex/reviews.ts) - `create()`, `update()`, `delete()`
- [`convex/job_actuals.ts`](convex/job_actuals.ts) - `create()`, `update()`
- [`convex/user_vehicles.ts`](convex/user_vehicles.ts) - `create()`, `update()`, `delete()`

**Data Management:**
- [`convex/seed.ts`](convex/seed.ts) - Database seeding for demo data
- [`convex/migrations.ts`](convex/migrations.ts) - Schema migration helpers
- [`convex/auth.config.ts`](convex/auth.config.ts) - Clerk authentication integration

### Client-Side Layer

**Zustand Stores** (in [`stores/`](stores/)):
```
useUserStore.ts           → User profile, auth state
useVehicleStore.ts        → Vehicle management
useBookingStore.ts        → Booking state
useMechanicStore.ts       → Mechanic selection
useShopStore.ts           → Shop filtering
useScheduleStore.ts       → Time slot management
useAIChatStore.ts         → AI conversation state (ephemeral)
useAuthStore.ts           → Auth status
useOnboardingStore.ts     → Onboarding progress
usePaymentStore.ts        → Payment info
useSearchStore.ts         → Search filters
```

**No ORM** - Direct Convex API calls via `ctx.db.query()`, `ctx.db.get()`, `ctx.db.insert()`, `ctx.db.patch()`

---

## 4. EXISTING API ROUTES / CONTROLLERS / SERVICES

### Convex Query/Mutation Routes (No REST API)

All "routes" are Convex functions, not HTTP endpoints:

**Booking Domain:**
- `convex.bookings.list()` - All bookings
- `convex.bookings.getById(id)` - Single booking
- `convex.bookings.create({...})` - Create booking (w/ slot availability check)

**Review Domain:**
- `convex.reviews.list()` - All reviews (w/ joins)
- `convex.reviews.getById(id)` - Single review (w/ joins)
- `convex.reviews.getByShopId(shopId)` - Shop reviews
- `convex.reviews.create({...})` - Create review
- `convex.reviews.update(id, {...})` - Update review
- `convex.reviews.delete(id)` - Delete review

**Shop Domain:**
- `convex.shops.list()` - All shops
- `convex.shops.getById(id)` - Single shop
- `convex.shops.getByLocation({...})` - Geo-filtered shops (if implemented)

**Mechanic Domain:**
- `convex.mechanics.list()` - All mechanics (w/ shop join)
- `convex.mechanics.getById(id)` - Single mechanic
- `convex.mechanics.getByShopId(shopId)` - Shop mechanics

**Service Domain:**
- `convex.services.list()` - All services
- `convex.services.getById(id)` - Single service
- `convex.service_options.list()` - Service options
- `convex.service_insights.getByServiceAndEngine(...)` - Engine-specific insights

**Vehicle Domain:**
- `convex.user_vehicles.getByUserId(userId)` - User's vehicles
- `convex.user_vehicles.create({...})` - Add vehicle
- `convex.user_vehicles.update(id, {...})` - Update vehicle

**User Domain:**
- `convex.users.getOrCreateMe()` - Auth flow + user creation
- `convex.users.getById(id)` - Single user profile

**Job/Work Domain:**
- `convex.job_actuals.getByBookingId(bookingId)` - Job details for booking
- `convex.job_actuals.getPrefillData(bookingId)` - Pre-filled form data
- `convex.job_actuals.create({...})` - Log job completion

### Service Layer (Client-Side AI)

**AI Chat Service** (in [`services/ai/`](services/ai/)):
- [`scenarioEngine.ts`](services/ai/scenarioEngine.ts) - Conversation state machine (client-side only)
- [`scenarios.ts`](services/ai/scenarios.ts) - Scenario definitions & rules
- [`types.ts`](services/ai/types.ts) - AI chat TypeScript types

**Status:** AI is NOT persisted to DB; runs client-side with mock data from [`stores/data/mockShops.ts`](stores/data/mockShops.ts)

---

## 5. IMPLEMENTATION STATUS SUMMARY

### Fully Implemented Domains ✅
- **Users/Profiles:** Complete CRUD via `users.ts`, auth via Clerk
- **Vehicles:** Complete CRUD, VIN/year/specs tracked
- **Shops:** Full data model with location & hours
- **Mechanics:** Assigned to shops, ratings tracked
- **Services:** Menu + pricing options + engine-specific insights
- **Bookings:** Creation with availability checks, cost calculation
- **Reviews:** Full review system (shop + mechanic)
- **Job Tracking:** Actual labor/parts logged, difficulty ratings

### Partially Implemented ⚠️
- **Payments:** Cost fields exist but no separate payment records/transactions
- **Job Status History:** Single status field (not historical log)

### Not Implemented ❌
- **Follow-ups:** Maintenance reminders, service notifications
- **AI Conversations:** Chat history not persisted to database
- **Analytics:** No event tracking or funnel analysis
- **Push Notifications:** Notification service not in schema

---

## 6. SAFEST NEXT 3 COMMITS

Based on dependency order and feature completeness:

### Commit 1: Payment System Enhancement
**Goal:** Separate payment records from bookings  
**Why it's safe:** Bookings already track costs; this is additive  
**Changes:**
- Add `payments` table to schema with fields:
  - `booking_id`, `user_id`, `amount`, `payment_method`, `status`, `transaction_id`, `created_at`, `updated_at`
- Create `convex/payments.ts` with CRUD operations
- Add mutation `bookings.markPaid()` to link payment
- Update `bookings.create()` to optionally link payment

**Impact:** No breaking changes; `bookings` already has amount fields  
**Time:** ~3-4 hours including testing

---

### Commit 2: Job Status History Log
**Goal:** Track booking/job status progression  
**Why it's safe:** Extends existing status field, doesn't break it  
**Changes:**
- Add `job_status_log` table:
  - `booking_id`, `old_status`, `new_status`, `changed_by`, `reason`, `timestamp`
- Create `convex/job_status_log.ts` with query helpers
- Update `bookings.patch()` to auto-insert history records
- Add query `job_status_log.getByBookingId()` for timeline view

**Impact:** Additive only; status field still works  
**Time:** ~2-3 hours

---

### Commit 3: AI Conversation Persistence
**Goal:** Store AI chat history for analytics & UX  
**Why it's safe:** No impact on booking/payment flow; opt-in feature  
**Changes:**
- Add `ai_conversations` table:
  - `user_id`, `started_at`, `ended_at`, `scenario_detected`, `led_to_booking`, `booking_id`
- Add `ai_messages` table:
  - `conversation_id`, `role` (user|system), `content`, `timestamp`, `confidence_score`
- Create `convex/ai_conversations.ts` and `convex/ai_messages.ts`
- Update [`services/ai/scenarioEngine.ts`](services/ai/scenarioEngine.ts) to call `saveChatMessage()` mutation
- Create `useAIChatStore` method to sync with backend

**Impact:** Purely additive; AI still works without persistence  
**Time:** ~4-5 hours including UI updates

---

## 7. ARCHITECTURE NOTES

### Why Convex (Not Prisma/SQL)?

- **Serverless:** No server management
- **Real-time subscriptions:** Built-in reactivity
- **Type-safe:** TypeScript validators → type generation
- **Instant deploys:** No migration scripts
- **Free tier:** Generous for prototyping

### Key Patterns Observed

1. **Thin mutation layer:** Most logic is in handlers, not domain services
2. **Client-side state management:** Heavy use of Zustand for local state
3. **Data relationships:** Joins done in queries (not database-enforced)
4. **No soft deletes:** Hard deletes only
5. **Immutable IDs:** Convex IDs used for all relations

### Next Steps for Production

- [ ] Add database triggers for audit logs (Convex functions)
- [ ] Implement role-based access control (RBAC) in mutation handlers
- [ ] Add rate limiting for sensitive mutations
- [ ] Set up automated backups (Convex provides)
- [ ] Implement API logging for debugging

---

**End of Document**
