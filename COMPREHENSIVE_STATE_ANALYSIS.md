# Comprehensive Database State Analysis

**Date:** January 31, 2026  
**Branch:** waleedcodespace  
**Status:** Schema complete, access layers partially implemented  
**Scope:** Full Convex database and API coverage for OtoPair

---

## Executive Summary

### Current State
- **Schema:** ✅ Fully defined with 36 tables, 74+ indexes
- **Access Layers:** 12/19 implemented (63%)
- **New Vehicle Model:** ✅ Schema ready, ❌ **access layer missing**
- **Production Status:** 🟡 Blocked on vehicles/vehicle_owners implementations

### Critical Blockers
1. **Missing `vehicles.ts`** — No way to upsert/manage canonical vehicle catalog
2. **Missing `vehicle_owners.ts`** — No way to manage soft-delete ownership
3. **Stale `bookings.ts`** — Still references `user_vehicle_id` (deprecated)
4. **Stale `follow_ups.ts`** — Partially migrated to VIN (missing queries)

### What Works Now ✅
- 12 fully implemented modules (bookings, payments, reviews, job_actuals, AI chat, analytics, etc.)
- All core transaction tables with full CRUD
- 36 tables with schema validation and indexes
- Append-only audit logs (booking_status_history, payment_status_history)

---

## Part 1: What We Have Now

### 📊 Complete Table Inventory (36 Tables)

#### **Core Transaction Hub (3 tables)**
| Table | Purpose | Status | Access Layer |
|-------|---------|--------|---------------|
| **bookings** | Service appointments, links users→shops→services | ✅ Schema | ✅ Full (but stale: uses `user_vehicle_id`) |
| **payments** | Payment tracking per booking | ✅ Schema | ✅ Full |
| **job_actuals** | Mechanic logs and actual work completed | ✅ Schema | ✅ Full |

#### **Vehicle Management (2 tables) — NEW MODEL**
| Table | Purpose | Status | Access Layer |
|-------|---------|--------|---------------|
| **vehicles** | Canonical catalog: unique by VIN | ✅ Schema | ❌ **MISSING** |
| **vehicle_owners** | Soft-delete join table: users ↔ vehicles | ✅ Schema | ❌ **MISSING** |

**Schema Details:**
```typescript
// vehicles: canonical VIN catalog
vehicles: {
  vin: string,                      // unique identifier (indexed by_vin)
  trim_id?: Id<"trims">,           // vehicle variant
  engine_id?: Id<"engines">,       // engine specs
  year?: number,                    // model year
  metadata?: any,                   // extensible metadata
  created_at: float64,              // Unix ms
  updated_at: float64,              // Unix ms
}

// vehicle_owners: soft-delete join
vehicle_owners: {
  vin: string,                      // FK-like to vehicles (indexed)
  user_id: Id<"users">,           // ownership relationship
  status: "active" | "removed",    // soft-delete flag
  nickname?: string,                // per-owner nickname
  is_primary?: boolean,            // primary vehicle for user
  mileage?: number,                 // current mileage
  added_at: float64,               // when ownership added
  removed_at?: float64,            // when ownership removed (soft-delete)
}

// Indexes on vehicle_owners:
// - by_vin
// - by_user_id
// - by_vin_user (composite, unique per owner pair)
// - by_user_status (active ownerships per user)
```

#### **Vehicle Catalog (5 tables) — Read-Only**
| Table | Purpose | Status |
|-------|---------|--------|
| **makes** | Car manufacturers (Toyota, Honda, etc.) | Seeded |
| **models** | Models under make (Camry under Toyota) | Seeded |
| **trims** | Trim variants (LE, XLE with year bounds) | Seeded |
| **engines** | Engine specs (cylinders, displacement, fuel type) | Seeded |
| **vehicle_specs** | OEM part numbers & fluid specs per engine | Seeded |

#### **Services & Shop Operations (8 tables)**
| Table | Purpose | Status |
|-------|---------|--------|
| **services** | Service types (oil change, brake pads, etc.) | Seeded |
| **service_categories** | Category grouping | Seeded |
| **service_options** | Labor/parts variants per service | Seeded |
| **service_vehicle_specs** | Service specs per engine (labor hours, confidence) | Seeded |
| **shop_services** | Which services each shop offers | Seeded |
| **shops** | Service centers (name, address, rating) | ✅ Access layer |
| **shops_hours** | Operating hours per shop | Seeded |
| **mechanics** | Individual mechanics (ratings, shop association) | ✅ Access layer |
| **time_slots** | Available booking slots | Seeded |

#### **AI & Chat (2 tables) — IMPLEMENTED ✅**
| Table | Purpose | Status |
|-------|---------|--------|
| **ai_conversations** | Chat sessions between user and AI | ✅ Full |
| **ai_messages** | Individual messages in conversation | ✅ Full |

#### **Analytics (2 tables) — IMPLEMENTED ✅**
| Table | Purpose | Status |
|-------|---------|--------|
| **analytics_events** | All user actions (clicks, booking events) | ✅ Full |
| **conversion_funnels** | Funnel stages (onboarding, booking, payment) | ✅ Full |

#### **Spec Intelligence Pipeline (4 tables) — SCHEMA-ONLY**
| Table | Purpose | Status |
|-------|---------|--------|
| **ai_enrichment_logs** | AI-generated enrichments for service specs | Schema-only |
| **manual_review_queue** | Low-confidence enrichments for human review | Schema-only |
| **spec_variances** | Predicted vs actual labor/cost tracking | Schema-only |
| **spec_confirmations** | User feedback on spec accuracy | Schema-only |

#### **Audit Logs (2 tables) — IMPLEMENTED ✅**
| Table | Purpose | Status |
|-------|---------|--------|
| **booking_status_history** | Append-only FSM transition log | ✅ Full |
| **payment_status_history** | Append-only FSM transition log | ✅ Full |

#### **User & Onboarding (2 tables)**
| Table | Purpose | Status |
|-------|---------|--------|
| **users** | User profiles (Clerk auth integration) | ✅ Access layer |
| **user_question_answers** | Onboarding responses | ✅ Access layer |

#### **Configuration (1 table)**
| Table | Purpose | Status |
|-------|---------|--------|
| **onboarding_questions** | Onboarding survey structure | Seeded |

#### **DEPRECATED (1 table)**
| Table | Purpose | Status |
|-------|---------|--------|
| **user_vehicles** | OLD schema (replaced by vehicles + vehicle_owners) | ⚠️ Stale, still referenced |

---

### 📍 Key Relationships

#### **Vehicle Model (NEW)**
```
users
  ↓ (N:N via vehicle_owners join table)
vehicles (unique by VIN)
  ├→ trim_id → trims → model → makes
  └→ engine_id → engines → trim
```

**Soft-Delete Pattern:**
- Removing a vehicle does NOT delete the row
- Updates `vehicle_owners.status = "removed"` + `vehicle_owners.removed_at = Date.now()`
- Vehicle catalog remains for other owners/analytics

#### **Booking Hub**
```
bookings (central transaction hub)
  ├→ user_id → users
  ├→ vin → vehicles (string reference, NEW)
  ├→ shop_id → shops
  ├→ mechanic_id → mechanics (optional)
  ├→ service_id → services
  ├→ time_slot_id → time_slots
  └→ 1:1 via job_actuals.booking_id
      └→ job_actuals
          └→ mechanic_id → mechanics
```

#### **Follow-ups Model**
```
follow_ups (maintenance reminders)
  ├→ user_id → users
  ├→ vin → vehicles (string reference, NEW)
  ├→ service_id → services
  └→ booking_id → bookings (optional, for specific reminders)
```

---

### 🔍 Index Coverage (74 Total)

#### **Transaction Tables (14 indexes)**
- **bookings (9):** user_id, shop_id, status, scheduled_date, service_id, created_at + 3 composite
- **payments (5):** booking_id, user_id, status, idempotency_key, created_at
- **job_actuals (3):** booking_id, mechanic_id, created_at

#### **Vehicle Management (4 indexes)**
- **vehicles (3):** vin, engine_id, trim_id
- **vehicle_owners (4):** vin, user_id, vin+user_id (composite), user_id+status (composite)

#### **Master Data (28 indexes)**
- mechanics (2), shops_hours (1), time_slots (4), reviews (4)
- ai_conversations (4), ai_messages (3), analytics_events (5), conversion_funnels (6)
- follow_ups (4), service_vehicle_specs (3), shop_services (3)

#### **Spec Intelligence (18 indexes)**
- ai_enrichment_logs (4), manual_review_queue (5), spec_variances (6), spec_confirmations (4)

#### **Audit Logs (4 indexes)**
- booking_status_history (2), payment_status_history (2)

#### **User (4 indexes)**
- users (2), user_question_answers (2)

---

### ✅ Implemented Access Layers (12 Modules)

#### **Bookings** ✅
```typescript
// Queries
list()                          // all bookings
getById(id)                     // by ID
getByUserId(userId)             // user's bookings
getByShopId(shopId)             // shop's bookings

// Mutations
create(...)                     // with time slot reservation, analytics tracking
updateStatus(id, newStatus)     // FSM validation + async history logging
```

**Issue:** Still uses deprecated `user_vehicle_id` parameter instead of `vin`

#### **Payments** ✅
```typescript
// Queries
list()
getById(id)
getByBookingId(bookingId)       // unique per booking
getByUserId(userId)

// Mutations
create(...)                     // with idempotency_key
updateStatus(...)               // FSM validation + async history logging
```

#### **Job Actuals** ✅
```typescript
// Queries
list()
getById(id)
getByBookingId(bookingId)       // unique per booking
getPrefillData(bookingId)

// Mutations
startJob(bookingId, mechanic_id)
completeJob(bookingId)
submitJobActuals(...)           // variance tracking
```

#### **Reviews** ✅
```typescript
// Queries
list()
getById(id)
getByShopId(shopId)             // indexed
getByUserId(userId)             // indexed

// Mutations
submit(...)                     // unique per booking, requires completed status
```

#### **Follow-ups** ✅ (Partially Migrated)
```typescript
// Queries
list()
getById(id)
getByUserId(userId)
getByVin(vin)                   // NEW: uses canonical VIN
getPendingReminders(beforeTimestamp)

// Mutations
create(...)                     // NEW: uses VIN
updateStatus(id, status)
dismiss(id)
```

**Issue:** Still references some old schema, missing mutation for VIN-based creates

#### **Booking Status History** ✅
```typescript
// Queries
getByBookingId(bookingId)
getHistory(bookingId)           // chronologically sorted
getLatestStatus(bookingId)
getValidNextStates(status)
isTerminal(status)

// Internal Mutations
log(...)                        // append-only
```

**FSM Definition:**
```
pending → confirmed|cancelled
confirmed → in_progress|cancelled|no_show
in_progress → completed
completed, cancelled, no_show → (terminal)
```

#### **Payment Status History** ✅
```typescript
// Same interface as booking_status_history

// FSM Definition:
// pending → processing|cancelled
// processing → completed|failed
// completed → refunded
// failed, refunded, cancelled → (terminal)
```

#### **AI Conversations** ✅
```typescript
// Queries
list()
getById(id)
getByUserId(userId)
getBySessionId(sessionId)

// Mutations
create(...)
end(id)
markLedToBooking(id, booking_id)
```

#### **AI Messages** ✅
```typescript
// Queries
list()
getById(id)
getByConversationId(conversationId)    // indexed

// Mutations
create(...)                            // with optional confidence_score, metadata
```

#### **Analytics Events** ✅
```typescript
// Queries
list()
getByEventType(eventType)
getByUserId(userId)
getConversionFunnelStats(funnelType)

// Mutations
track(...)                     // event_type, event_category, event_data, etc.
```

#### **Conversion Funnels** ✅
```typescript
// Queries
list()
getById(id)
getByUserId(userId)

// Mutations
enterStage(...)                // user enters funnel stage
exitStage(...)                 // user exits (completed or dropped)
markCompleted(id)
```

---

### 🟡 Schema-Only Modules (14 Tables)

These tables have schemas but NO access layers (read-only, seeded data):

1. **engines.ts** — Engine master data (cylinders, displacement, etc.)
2. **makes.ts** — Car manufacturers
3. **models.ts** — Car models per make
4. **trims.ts** — Trim variants per model with year bounds
5. **vehicle_specs.ts** — OEM parts & fluid specs per engine
6. **services.ts** — Available service types
7. **service_categories.ts** — Service grouping
8. **service_options.ts** — Labor/parts variants
9. **service_vehicle_specs.ts** — Service specs per engine (labor hours, confidence)
10. **shop_services.ts** — Which services each shop offers
11. **ai_enrichment_logs.ts** — AI-generated spec enrichments
12. **manual_review_queue.ts** — Low-confidence enrichments for review
13. **spec_variances.ts** — Predicted vs actual tracking
14. **spec_confirmations.ts** — User confirmations

---

## Part 2: What's Missing / Broken

### ⚠️ CRITICAL BLOCKERS

#### 1. **vehicles.ts — MISSING** 🚨
**Impact:** Blocks entire vehicle management workflow

**What's needed:**
- Upsert operation for canonical VIN catalog
- Add/remove owner operations
- Query vehicle with all owners

**Current Gap:**
- Schema exists but NO access layer file
- Bookings can't reference vehicles
- User vehicles can't be queried

**Required Mutations:**
```typescript
upsertVehicle(vin, trim_id?, engine_id?, year?, metadata?)
  → Creates or updates vehicle by VIN, enforces uniqueness

addOwner(vin, userId, nickname?, is_primary?, mileage?)
  → Adds ownership or reactivates removed ownership

removeOwner(vin, userId)
  → Soft-deletes ownership (sets status="removed", removed_at=Date.now())

updateOwnershipPrimary(vin, userId, is_primary)
  → Sets this as primary vehicle for user (ensures single primary)
```

**Required Queries:**
```typescript
listVehiclesByUser(userId)
  → Returns active ownerships + full vehicle data

getVehicleWithOwners(vin)
  → Returns vehicle + all active owners

getVehicleOwner(vin, userId)
  → Returns single ownership record

listOwnedVINsByUser(userId)
  → Just the VINs user owns (active)
```

#### 2. **vehicle_owners.ts — MISSING** 🚨
**Impact:** Blocks soft-delete ownership management

**What's needed:**
- Query helpers for ownership relationships
- Soft-delete aware filtering
- Reactivation logic

**Required Queries:**
```typescript
getByVin(vin)
  → All ownership records (active + removed)

getActiveByVin(vin)
  → Only active owners for this VIN

getByUser(userId)
  → All ownerships (active + removed)

getActiveByUser(userId)
  → Only active vehicles owned by user

getByVinAndUser(vin, userId)
  → Single ownership record (active or removed)
```

#### 3. **bookings.ts — STALE** ⚠️
**Issue:** Still uses deprecated `user_vehicle_id` parameter

**Current Code:**
```typescript
export const create = mutation({
  args: {
    user_vehicle_id: v.id("user_vehicles"),  // ❌ DEPRECATED
    // ... other args
  },
  // ...
});
```

**What's needed:**
- Remove `user_vehicle_id` parameter
- Add `vin` parameter (string)
- Validate VIN references valid vehicle
- Update caller sites

**New Signature:**
```typescript
export const create = mutation({
  args: {
    user_id: v.id("users"),
    vin: v.string(),                    // ✅ NEW
    shop_id: v.id("shops"),
    // ... rest of args
  },
});
```

#### 4. **follow_ups.ts — PARTIAL MIGRATION** ⚠️
**Issue:** Queries updated but mutations still incomplete

**Current Status:**
- ✅ getByVin() uses VIN-based index
- ❌ create() signature unclear if it uses VIN or old schema
- ❌ Missing updateMileage, etc.

---

### 🔴 References to Deprecated Schema

#### **In bookings.ts:**
```typescript
// Line ~23
user_vehicle_id: v.id("user_vehicles"),  // ❌ Should be vin: v.string()
```

#### **In follow_ups.ts:**
- May have old references in create() signature (need full review)

#### **Still existing but deprecated:**
- `/workspaces/otopair/convex/user_vehicles.ts` — Can delete after vehicles.ts done

---

### 📋 Invariants Not Yet Enforced

1. **Vehicle uniqueness by VIN** — Code-level only, not DB-level unique constraint
2. **Single primary vehicle per user** — No enforcement in ownership creation
3. **Soft-delete reactivation** — No automatic status toggle in addOwner

---

## Part 3: Next Steps

### 🎯 Priority 1: Critical (Blocks Production)

#### Task 1.1: Implement vehicles.ts Access Layer
**Effort:** 2-3 hours  
**Files:** Create `/workspaces/otopair/convex/vehicles.ts`

**Mutations needed:**
- `upsertVehicle(vin, trim_id?, engine_id?, year?, metadata?)` — Idempotent create/update
- `addOwner(vin, userId, nickname?, is_primary?, mileage?)` — Add/reactivate ownership
- `removeOwner(vin, userId)` — Soft-delete ownership
- `updateOwnershipPrimary(vin, userId, is_primary)` — Enforce single primary

**Queries needed:**
- `listVehiclesByUser(userId)` — Active vehicles for user
- `getVehicleWithOwners(vin)` — Full vehicle + all active owners
- `getVehicleOwner(vin, userId)` — Single ownership
- `listOwnedVINsByUser(userId)` — Just the VINs

**Indexes used:**
- vehicles.by_vin (unique lookup)
- vehicle_owners.by_vin_user (unique lookup for ownership pair)
- vehicle_owners.by_user_status (list active by user)

**Smoke Tests:**
```typescript
// Create vehicle with VIN
const v1 = await upsertVehicle({ vin: "12345ABC" });

// Add owner
await addOwner({ vin: "12345ABC", userId: user1._id, is_primary: true });

// List vehicles by user
const vehicles = await listVehiclesByUser({ userId: user1._id });
assert(vehicles.length === 1);

// Get vehicle with owners
const withOwners = await getVehicleWithOwners({ vin: "12345ABC" });
assert(withOwners.vehicle.vin === "12345ABC");
assert(withOwners.owners.length === 1);

// Add second owner
await addOwner({ vin: "12345ABC", userId: user2._id });

// Get full ownership
const own = await getVehicleOwner({ vin: "12345ABC", userId: user1._id });
assert(own.is_primary === true);

// Remove owner (soft-delete)
await removeOwner({ vin: "12345ABC", userId: user2._id });

// Reactivate
await addOwner({ vin: "12345ABC", userId: user2._id });

// List shows only active
const active = await listVehiclesByUser({ userId: user1._id });
```

---

#### Task 1.2: Implement vehicle_owners.ts Access Layer
**Effort:** 1-2 hours  
**Files:** Create `/workspaces/otopair/convex/vehicle_owners.ts`

**Queries needed:**
- `getByVin(vin)` — All ownerships (active + removed)
- `getActiveByVin(vin)` — Only active owners
- `getByUser(userId)` — All ownerships
- `getActiveByUser(userId)` — Only active vehicles
- `getByVinAndUser(vin, userId)` — Single record
- `isOwned(vin, userId)` — Boolean helper (active ownership exists)

**Indexes used:**
- vehicle_owners.by_vin
- vehicle_owners.by_user_id
- vehicle_owners.by_user_status

**Smoke Tests:**
```typescript
// Get all ownerships (including removed)
const all = await getByVin({ vin: "12345ABC" });
assert(all.length >= 0);

// Get only active
const active = await getActiveByVin({ vin: "12345ABC" });
assert(all.length >= active.length);  // active ≤ all

// Get by user
const userOwns = await getActiveByUser({ userId: user1._id });
assert(userOwns.every(o => o.user_id === user1._id));

// Check ownership
const isOwner = await isOwned({ vin: "12345ABC", userId: user1._id });
assert(isOwner === true);
```

---

#### Task 1.3: Fix bookings.ts to Use VIN
**Effort:** 1 hour  
**Files:** [convex/bookings.ts](convex/bookings.ts)

**Changes:**
```typescript
// BEFORE
export const create = mutation({
  args: {
    user_vehicle_id: v.id("user_vehicles"),  // ❌
    // ...
  },
  handler: async (ctx, args) => {
    // ...
  },
});

// AFTER
export const create = mutation({
  args: {
    vin: v.string(),                         // ✅
    // ... rest unchanged
  },
  handler: async (ctx, args) => {
    // 1. Validate vehicle exists
    const vehicle = await ctx.db
      .query("vehicles")
      .withIndex("by_vin", (q) => q.eq("vin", args.vin))
      .unique();
    if (!vehicle) throw new Error("Vehicle not found");

    // 2. Validate user owns this vehicle (active ownership)
    const ownership = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_vin_user", (q) =>
        q.eq("vin", args.vin).eq("user_id", args.user_id)
      )
      .unique();
    if (!ownership || ownership.status !== "active") {
      throw new Error("User does not own this vehicle");
    }

    // 3. Rest of create logic, now use args.vin
    const bookingId = await ctx.db.insert("bookings", {
      vin: args.vin,  // Store canonical VIN
      // ... other fields
    });
    
    // ... rest of logic
  },
});
```

**Smoke Tests:**
```typescript
// Create booking with VIN
const bookingId = await bookings.create({
  user_id: user1._id,
  vin: "12345ABC",  // Now uses VIN
  shop_id: shop1._id,
  service_id: service1._id,
  // ... other args
});

// Booking should have VIN
const booking = await bookings.getById({ id: bookingId });
assert(booking.vin === "12345ABC");

// Should fail if vehicle doesn't exist
try {
  await bookings.create({
    user_id: user1._id,
    vin: "INVALID",
    // ...
  });
  assert(false, "Should have thrown");
} catch (e) {
  assert(e.message.includes("Vehicle not found"));
}

// Should fail if user doesn't own vehicle
try {
  await bookings.create({
    user_id: user2._id,
    vin: "12345ABC",  // Only user1 owns this
    // ...
  });
  assert(false, "Should have thrown");
} catch (e) {
  assert(e.message.includes("does not own"));
}
```

---

### 🎯 Priority 2: High (Complete Vehicle Model)

#### Task 2.1: Complete follow_ups.ts Migration
**Effort:** 30 mins  
**Files:** [convex/follow_ups.ts](convex/follow_ups.ts)

**Changes:**
- Ensure create() uses VIN (not old user_vehicle_id)
- Add any missing mutations (updateMileage?, etc.)
- Verify all queries use indexed lookups

**Smoke Tests:**
```typescript
// Create follow-up with VIN
const followUpId = await follow_ups.create({
  user_id: user1._id,
  vin: "12345ABC",  // Uses canonical VIN
  service_id: service1._id,
  follow_up_type: "maintenance_due",
  scheduled_for: Date.now() + 90 * 24 * 60 * 60 * 1000,
  message: "Time for oil change",
});

// Query by VIN
const reminders = await follow_ups.getByVin({ vin: "12345ABC" });
assert(reminders.some(r => r._id === followUpId));
```

---

#### Task 2.2: Remove Deprecated user_vehicles References
**Effort:** 1-2 hours  
**Files:** 
- Delete or stub `/workspaces/otopair/convex/user_vehicles.ts`
- Search for other references

**Steps:**
1. `grep -r "user_vehicles" /workspaces/otopair/convex` — Find all references
2. Update references to use vehicles + vehicle_owners
3. Update frontend imports
4. Delete user_vehicles.ts when fully migrated

---

### 🎯 Priority 3: Medium (Documentation & Polish)

#### Task 3.1: Update Documentation Tables
**Effort:** 30 mins  
**Files:**
- [docs/DB_STATUS.md](docs/DB_STATUS.md)
- [docs/API_STATUS.md](docs/API_STATUS.md)
- [docs/GAP_REPORT.md](docs/GAP_REPORT.md)

**Changes:**
- Mark vehicles.ts as ✅ Implemented (once done)
- Mark vehicle_owners.ts as ✅ Implemented (once done)
- Remove stale user_vehicles references
- Update coverage percentage

---

#### Task 3.2: Archive Stale Strategy Markdown
**Effort:** 15 mins  
**Files:**
- Move to docs/archive/ if they conflict with current schema:
  - `strategy_markdown/1st_final_summary.md` (already done, past state)
  - Any other outdated planning docs

---

### 🎯 Priority 4: Optional (Optimization)

#### Task 4.1: Add Catalog Access Layers (Optional)
**Status:** Schema-only, but useful queries

**Could add simple getters:**
- `makes.list()`
- `models.getByMakeId(makeId)`
- `trims.getByModelAndYear(modelId, year)`
- `engines.getByTrimId(trimId)`
- `services.list()`, `services.getByCategory(categoryId)`

**Effort:** 2-3 hours  
**Impact:** Better UX (prefill dropdowns, etc.)

---

## Summary: Actionable To-Do

### Phase 1: Fix Critical Blockers (4-5 hours)
1. ✏️ Create `/workspaces/otopair/convex/vehicles.ts` (2-3 hours)
2. ✏️ Create `/workspaces/otopair/convex/vehicle_owners.ts` (1-2 hours)
3. ✏️ Update [convex/bookings.ts](convex/bookings.ts) to use VIN (1 hour)
4. ✏️ Complete [convex/follow_ups.ts](convex/follow_ups.ts) migration (30 mins)

### Phase 2: Clean Up (1-2 hours)
5. 🔍 Remove deprecated user_vehicles references (1 hour)
6. 📝 Update docs to match real state (30 mins)

### Phase 3: Optional (2-3 hours)
7. ➕ Add catalog access layers (optional, 2-3 hours)

---

## Test Checklist

After implementing, verify:

- [ ] `vehicles.upsertVehicle()` creates new vehicle
- [ ] `vehicles.upsertVehicle()` patches existing by VIN
- [ ] `vehicles.addOwner()` adds ownership
- [ ] `vehicles.addOwner()` reactivates removed ownership
- [ ] `vehicles.removeOwner()` soft-deletes (status="removed")
- [ ] `vehicle_owners.getActiveByUser()` returns only status="active"
- [ ] `bookings.create()` accepts VIN parameter
- [ ] `bookings.create()` validates vehicle exists
- [ ] `bookings.create()` validates user owns vehicle
- [ ] `follow_ups.create()` uses VIN
- [ ] All queries use indexes (no full table scans)
- [ ] Deployment: `npx convex dev` compiles with no errors

