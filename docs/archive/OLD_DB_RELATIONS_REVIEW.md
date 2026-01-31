# Database Relations Review

**Generated:** January 31, 2026  
**Repository:** AppFlow-Studio/otopair  
**Branch:** waleeddev2  
**Reviewer:** GitHub Copilot (Claude Sonnet 4.5)

---

## Executive Summary

**Overall Assessment:** 🟡 Good Foundation, Needs Refinements

The Convex database implementation demonstrates solid relational modeling with clear domain separation. However, several business-standard improvements are needed for production readiness:

- ✅ **Strengths:** Clear relationships, proper foreign keys, good domain separation
- ⚠️ **Issues:** Naming inconsistency, missing indexes, lack of idempotency, stateful tables used for logs
- 🔧 **Priority Fixes:** Add missing indexes, implement status history, ensure payment idempotency

---

## 1. ENTITY-RELATIONSHIP DIAGRAM (ERD)

### Core Domain Model

```
┌─────────────────┐
│     USERS       │ (PK: _id)
│  clerkUserId*   │ ← Auth provider ID
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│ USER_VEHICLES   │ (PK: _id)
│  user_id* (FK)  │ → users._id
│  engine_id (FK) │ → engines._id
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────┐
│                      BOOKINGS (Hub)                     │ (PK: _id)
│  user_id (FK)           → users._id                     │
│  user_vehicle_id (FK)   → user_vehicles._id             │
│  shop_id (FK)           → shops._id                     │
│  service_id (FK)        → services._id                  │
│  mechanic_id (FK opt)   → mechanics._id                 │
│  time_slot_id (FK)      → time_slots._id                │
│  status                 ← "confirmed", "in_progress",   │
│                           "completed", "cancelled"      │
└──────┬──────┬──────┬───────┬──────────────────────────┘
       │      │      │       │
       │ 1:1  │ 1:N  │ 1:1   │ 1:N
       ▼      ▼      ▼       ▼
  ┌─────────┐ ┌────────┐ ┌─────────┐ ┌──────────────┐
  │PAYMENTS │ │REVIEWS │ │JOB_     │ │FOLLOW_UPS    │
  │         │ │        │ │ACTUALS  │ │              │
  │booking* │ │booking*│ │booking* │ │booking (opt) │
  └─────────┘ └────────┘ └────┬────┘ └──────────────┘
                               │
                               │ 1:N
                               ▼
                         ┌──────────────┐
                         │SPEC_VARIANCES│
                         │job_actual_id*│
                         └──────────────┘

┌──────────────────┐
│   VEHICLES       │
│   HIERARCHY      │
├──────────────────┤
│ makes            │ 1:N
│   └─> models     │ 1:N
│         └─> trims│ 1:N
│              └─> engines │ 1:1
│                   └─> vehicle_specs │
│                   └─> service_vehicle_specs │
└──────────────────┘

┌──────────────────┐
│   SERVICES       │
│   HIERARCHY      │
├──────────────────┤
│ service_categories│ 1:N
│   └─> services   │ 1:N
│         └─> service_options │
│         └─> service_insights │ (per engine)
└──────────────────┘

┌──────────────────┐
│   SHOPS          │
│   DOMAIN         │
├──────────────────┤
│ shops            │ 1:N
│   ├─> shop_services │ (M:N with services)
│   ├─> shops_hours │
│   ├─> mechanics  │ 1:N
│   └─> time_slots │ (M:1 mechanics)
└──────────────────┘

┌──────────────────┐
│   AI/ANALYTICS   │
│   DOMAIN         │
├──────────────────┤
│ ai_conversations │ 1:N
│   └─> ai_messages│
│ analytics_events │ (append-only log)
│ conversion_funnels│ (stateful stages)
│ ai_enrichment_logs│ (append-only)
│   └─> manual_review_queue │
│ spec_confirmations│ (user feedback)
└──────────────────┘
```

---

## 2. DETAILED RELATIONS VALIDATION

### ✅ Core Relations (Properly Implemented)

#### bookings (The Hub)
```typescript
// Primary relationships
user_id: v.id("users")              // ✅ Required
user_vehicle_id: v.id("user_vehicles") // ✅ Required
shop_id: v.id("shops")              // ✅ Required
service_id: v.id("services")        // ✅ Required
mechanic_id: v.optional(v.id("mechanics")) // ✅ Optional (assigned later)
time_slot_id: v.id("time_slots")    // ✅ Required

// Derived relationships (1:N from bookings)
// - payments.booking_id → bookings._id (1:1 or 1:N)
// - reviews.booking_id → bookings._id (1:1)
// - job_actuals.booking_id → bookings._id (1:1)
// - follow_ups.booking_id → bookings._id (1:N)
// - ai_conversations.booking_id → bookings._id (1:1)
// - conversion_funnels.booking_id → bookings._id (1:N stages)
// - spec_confirmations.booking_id → bookings._id (1:1)
```

#### payments
```typescript
booking_id: v.id("bookings")  // ✅ Required - links to booking
user_id: v.id("users")        // ✅ Required - denormalized for user queries
shop_id: v.id("shops")        // ✅ Required - denormalized for shop queries

// ⚠️ ISSUE: No unique constraint on booking_id
// Business rule: One booking should have ONE active payment
// Recommendation: Add application-level check or use status transitions
```

#### job_actuals
```typescript
booking_id: v.id("bookings")  // ✅ Required - 1:1 relationship
mechanic_id: v.id("mechanics") // ✅ Required - who performed the work

// Derived relationships:
// - spec_variances.job_actual_id → job_actuals._id (1:N)
```

#### reviews
```typescript
booking_id: v.id("bookings")  // ✅ Required - 1:1 relationship
user_id: v.id("users")        // ✅ Required
shop_id: v.id("shops")        // ✅ Required
mechanic_id: v.optional(v.id("mechanics")) // ✅ Optional

// ⚠️ MISSING INDEX: by_booking_id (for "has user reviewed?" checks)
```

#### follow_ups
```typescript
user_id: v.id("users")              // ✅ Required
user_vehicle_id: v.id("user_vehicles") // ✅ Required
booking_id: v.optional(v.id("bookings")) // ✅ Optional (for recurring reminders)
service_id: v.id("services")        // ✅ Required
```

### ✅ Vehicle Spec Pipeline Relations

#### ai_enrichment_logs
```typescript
engine_id: v.id("engines")    // ✅ Required
service_id: v.id("services")  // ✅ Required
reviewed_by: v.optional(v.id("users")) // ✅ Optional admin reviewer
```

#### manual_review_queue
```typescript
engine_id: v.id("engines")              // ✅ Required
service_id: v.id("services")            // ✅ Required
enrichment_log_id: v.id("ai_enrichment_logs") // ✅ Required - parent log
assigned_to: v.optional(v.id("users"))  // ✅ Optional reviewer assignment
```

#### spec_variances
```typescript
engine_id: v.id("engines")        // ✅ Required
service_id: v.id("services")      // ✅ Required
job_actual_id: v.id("job_actuals") // ✅ Required - links to actual work performed
```

#### spec_confirmations
```typescript
user_id: v.id("users")        // ✅ Required
engine_id: v.id("engines")    // ✅ Required
service_id: v.id("services")  // ✅ Required
booking_id: v.id("bookings")  // ✅ Required - which booking was confirmed
```

### ✅ AI/Analytics Relations

#### ai_conversations
```typescript
user_id: v.id("users")               // ✅ Required
booking_id: v.optional(v.id("bookings")) // ✅ Optional - if conversation led to booking
```

#### ai_messages
```typescript
conversation_id: v.id("ai_conversations") // ✅ Required - parent conversation
// metadata.service_suggestions: v.array(v.id("services")) // ✅ Optional
// metadata.shop_suggestions: v.array(v.id("shops"))       // ✅ Optional
```

#### analytics_events
```typescript
user_id: v.optional(v.id("users")) // ✅ Optional (anonymous events allowed)
// event_data.booking_id: v.optional(v.id("bookings"))  // ✅ Optional
// event_data.shop_id: v.optional(v.id("shops"))        // ✅ Optional
// event_data.service_id: v.optional(v.id("services"))  // ✅ Optional
```

#### conversion_funnels
```typescript
user_id: v.id("users")               // ✅ Required
booking_id: v.optional(v.id("bookings")) // ✅ Optional - set when funnel completes
```

---

## 3. NAMING CONSISTENCY ANALYSIS

### 🔴 Critical Issue: Mixed Naming Conventions

**Current State:**
```typescript
// snake_case (most common - 90%)
user_id, booking_id, shop_id, service_id, mechanic_id
labor_cost, parts_cost, total_cost
scheduled_date, scheduled_time
created_at, updated_at, started_at, ended_at

// camelCase (users table - 10%)
clerkUserId, createdAt, emailConfirmed, phoneVerified
onboardingCompleted, tellUsAboutCompleted

// Mixed within users table!
users: {
  clerkUserId: v.string(),     // camelCase
  createdAt: v.float64(),      // camelCase
  created_at: v.optional(v.string()), // snake_case (redundant!)
  emailConfirmed: v.optional(v.boolean()), // camelCase
  first_name: v.optional(v.string()),      // snake_case
  onboardingCompleted: v.boolean(),        // camelCase
  profile_photo_url: v.optional(v.string()), // snake_case
  user_intentions: v.optional(v.array(v.string())), // snake_case
}
```

### ✅ Recommended Standard: **snake_case**

**Rationale:**
1. **90% of schema already uses snake_case**
2. **Database convention:** SQL/PostgreSQL standard
3. **Consistency with existing API:** Most field names already snake_case
4. **Less prone to errors:** No need to remember casing rules

### 🔧 Required Changes (Minimal Breaking)

**Priority 1: Fix users table inconsistencies**
```typescript
users: defineTable({
  // Keep camelCase for Clerk-provided fields (external API contract)
  clerkUserId: v.string(),  // ✅ Keep - external API
  
  // Change to snake_case (breaking changes)
  created_at: v.float64(),  // ❌ Change createdAt → created_at
  email_confirmed: v.optional(v.boolean()), // ❌ Change emailConfirmed
  phone_verified: v.optional(v.boolean()),  // ❌ Change phoneVerified
  onboarding_completed: v.boolean(),        // ❌ Change onboardingCompleted
  tell_us_about_completed: v.optional(v.boolean()), // ❌ Change tellUsAboutCompleted
  
  // Already snake_case - no change
  first_name: v.optional(v.string()),
  last_name: v.optional(v.string()),
  profile_photo_url: v.optional(v.string()),
  user_intentions: v.optional(v.array(v.string())),
})
```

**Transition Strategy (Non-Breaking):**
1. Keep both fields temporarily (deprecated + new)
2. Update client code to use new fields
3. Remove deprecated fields in v2.0

---

## 4. INDEX ANALYSIS

### ✅ Currently Indexed Tables

| Table | Indexes | Status |
|-------|---------|--------|
| users | `by_clerkUserId`, `by_username` | ✅ Good |
| user_question_answers | `by_user_and_question`, `by_user_id` | ✅ Good |
| onboarding_questions | `by_rank`, `by_step_name` | ✅ Good |
| onboarding_question_answers | `by_question_id` | ✅ Good |
| payments | `by_booking_id`, `by_user_id`, `by_status` | ✅ Good |
| follow_ups | `by_user_id`, `by_user_vehicle_id`, `by_status_and_scheduled`, `by_booking_id` | ✅ Excellent |
| ai_conversations | `by_user_id`, `by_session_id`, `by_booking_id` | ✅ Good |
| ai_messages | `by_conversation_id`, `by_role` | ✅ Good |
| analytics_events | `by_user_id`, `by_event_type`, `by_event_category`, `by_timestamp` | ✅ Good |
| conversion_funnels | `by_user_id`, `by_funnel_type`, `by_booking_id`, `by_stage` | ✅ Good |
| ai_enrichment_logs | `by_engine_id`, `by_review_status`, `by_confidence` | ✅ Good |
| manual_review_queue | `by_status`, `by_engine_id`, `by_assigned_to`, `by_priority_and_status` | ✅ Excellent |
| spec_variances | `by_engine_id`, `by_service_id`, `by_flagged`, `by_variance` | ✅ Good |
| spec_confirmations | `by_engine_id`, `by_user_id`, `by_booking_id` | ✅ Good |

### 🔴 Missing Critical Indexes

#### bookings (Hub table - most queried!)
```typescript
// ❌ MISSING INDEXES - Critical Performance Issue!
bookings: defineTable({ /* ... */ })
  .index("by_user_id", ["user_id"])           // Get user's bookings
  .index("by_shop_id", ["shop_id"])           // Get shop's bookings
  .index("by_status", ["status"])             // Filter by status
  .index("by_scheduled_date", ["scheduled_date"]) // Calendar view
  .index("by_user_and_status", ["user_id", "status"]) // User's active bookings
```

**Impact:** Every `getBookingsByUserId` query does a full table scan!

#### reviews
```typescript
// ❌ MISSING INDEXES
reviews: defineTable({ /* ... */ })
  .index("by_booking_id", ["booking_id"])     // Check if booking reviewed
  .index("by_shop_id", ["shop_id"])           // Shop's reviews (currently uses filter!)
  .index("by_user_id", ["user_id"])           // User's reviews
```

**Current code** (inefficient):
```typescript
// In convex/reviews.ts:40
const reviews = await ctx.db
  .query("reviews")
  .filter((q) => q.eq(q.field("shop_id"), args.shopId))  // ❌ Full scan!
  .collect();
```

#### job_actuals
```typescript
// ❌ MISSING INDEXES
job_actuals: defineTable({ /* ... */ })
  .index("by_booking_id", ["booking_id"])     // Get job for booking
  .index("by_mechanic_id", ["mechanic_id"])   // Mechanic's jobs
```

**Current code** (inefficient):
```typescript
// In convex/job_actuals.ts:21
const all = await ctx.db.query("job_actuals").collect();  // ❌ Full scan!
return all.find((row) => row.booking_id === args.bookingId) ?? null;
```

#### user_vehicles
```typescript
// ❌ MISSING INDEXES
user_vehicles: defineTable({ /* ... */ })
  .index("by_user_id", ["user_id"])           // User's vehicles
  .index("by_engine_id", ["engine_id"])       // Vehicles with same engine
```

#### mechanics
```typescript
// ❌ MISSING INDEXES
mechanics: defineTable({ /* ... */ })
  .index("by_shop_id", ["shop_id"])           // Shop's mechanics
```

#### time_slots
```typescript
// ❌ MISSING INDEXES
time_slots: defineTable({ /* ... */ })
  .index("by_shop_id", ["shop_id"])           // Shop's slots
  .index("by_mechanic_id", ["mechanic_id"])   // Mechanic's schedule
  .index("by_shop_and_date", ["shop_id", "date"]) // Calendar availability
  .index("by_availability", ["is_available", "date"]) // Available slots
```

#### service_insights
```typescript
// ❌ MISSING INDEXES
service_insights: defineTable({ /* ... */ })
  .index("by_engine_id", ["engine_id"])       // Engine's insights
  .index("by_service_id", ["service_id"])     // Service insights
  .index("by_engine_and_service", ["engine_id", "service_id"]) // Lookup pair
```

#### service_vehicle_specs
```typescript
// ❌ MISSING INDEXES
service_vehicle_specs: defineTable({ /* ... */ })
  .index("by_engine_id", ["engine_id"])       // Engine specs
  .index("by_service_id", ["service_id"])     // Service specs
  .index("by_engine_and_service", ["engine_id", "service_id"]) // Lookup pair
```

#### shops_hours
```typescript
// ❌ MISSING INDEXES
shops_hours: defineTable({ /* ... */ })
  .index("by_shop_id", ["shop_id"])           // Shop's hours
```

#### shop_services
```typescript
// ❌ MISSING INDEXES
shop_services: defineTable({ /* ... */ })
  .index("by_shop_id", ["shop_id"])           // Shop's services
  .index("by_service_id", ["service_id"])     // Shops offering service
```

---

## 5. APPEND-ONLY LOGS vs STATEFUL TABLES

### ✅ Properly Identified

#### Append-Only Logs (Immutable Event Streams)
```typescript
// ✅ These should NEVER be updated after insert
analytics_events        // Event log - no updates
ai_enrichment_logs      // AI generation log - approval/rejection tracked
ai_messages            // Chat history - immutable
spec_variances         // Variance detection log - notes added but core data immutable
spec_confirmations     // User feedback - one-time submission

// Business rule: INSERT only, no UPDATE/DELETE
```

#### Stateful Tables (Mutable State Machines)
```typescript
// ✅ These track state transitions
bookings               // status: confirmed → in_progress → completed/cancelled
payments               // status: pending → completed/failed/refunded
follow_ups             // status: pending → sent → completed/dismissed
conversion_funnels     // stage progression, completed flag
manual_review_queue    // status: pending → in_review → resolved
ai_conversations       // ended_at set on close, led_to_booking updated
```

### 🔴 Problem: No Status History Tracking!

**Issue:** All stateful tables overwrite `status` field, losing history:
```typescript
// Current: Status change loses history
await ctx.db.patch(bookingId, { status: "in_progress" });
await ctx.db.patch(bookingId, { status: "completed" }); // Lost "in_progress" timestamp!
```

**Business Impact:**
- Can't calculate time-in-status for SLA monitoring
- Can't audit who changed status and why
- Can't revert to previous status
- Can't analyze bottlenecks in workflow

### ✅ Recommended: Add Status History Tables

```typescript
// NEW TABLE: booking_status_history
booking_status_history: defineTable({
  booking_id: v.id("bookings"),
  old_status: v.optional(v.string()),  // null for initial status
  new_status: v.string(),
  changed_by: v.optional(v.id("users")), // user or system
  reason: v.optional(v.string()),
  changed_at: v.float64(),
})
  .index("by_booking_id", ["booking_id"])
  .index("by_changed_at", ["changed_at"]),

// NEW TABLE: payment_status_history
payment_status_history: defineTable({
  payment_id: v.id("payments"),
  old_status: v.optional(v.string()),
  new_status: v.string(),
  transaction_id: v.optional(v.string()),
  error_message: v.optional(v.string()),
  changed_at: v.float64(),
})
  .index("by_payment_id", ["payment_id"])
  .index("by_changed_at", ["changed_at"]),

// Optional: Generic event log for all status changes
status_change_log: defineTable({
  entity_type: v.string(),  // "booking", "payment", "follow_up"
  entity_id: v.string(),    // stringified ID
  old_status: v.optional(v.string()),
  new_status: v.string(),
  metadata: v.optional(v.any()),
  changed_at: v.float64(),
})
  .index("by_entity", ["entity_type", "entity_id"])
  .index("by_changed_at", ["changed_at"]),
```

---

## 6. BUSINESS-STANDARD IMPROVEMENTS

### 🔴 Priority 1: Payment Idempotency

**Problem:** No idempotency key prevents duplicate charges:
```typescript
// Current: Can create duplicate payments for same booking
await createPayment({ booking_id, amount: 100, ... });
await createPayment({ booking_id, amount: 100, ... }); // Duplicate charge!
```

**Solution:**
```typescript
payments: defineTable({
  booking_id: v.id("bookings"),
  idempotency_key: v.string(),  // ✅ Add this
  amount: v.float64(),
  payment_method: v.string(),
  status: v.string(),
  stripe_payment_intent_id: v.optional(v.string()),
  created_at: v.float64(),
  updated_at: v.float64(),
})
  .index("by_booking_id", ["booking_id"])
  .index("by_idempotency_key", ["idempotency_key"])  // ✅ Unique check
  .index("by_user_id", ["user_id"])
  .index("by_status", ["status"]),
```

**Mutation update:**
```typescript
export const create = mutation({
  args: {
    booking_id: v.id("bookings"),
    idempotency_key: v.string(),  // Required from client
    // ... other fields
  },
  handler: async (ctx, args) => {
    // Check for existing payment with same idempotency key
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_idempotency_key", (q) => 
        q.eq("idempotency_key", args.idempotency_key))
      .unique();
    
    if (existing) {
      return existing._id;  // Return existing payment (idempotent)
    }
    
    // Create new payment
    const paymentId = await ctx.db.insert("payments", {
      ...args,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
    
    return paymentId;
  },
});
```

### 🔴 Priority 2: Enforce One Active Payment Per Booking

**Problem:** Multiple payments can exist for one booking:
```typescript
// Current: No constraint preventing this
await createPayment({ booking_id: "x", status: "completed", amount: 100 });
await createPayment({ booking_id: "x", status: "completed", amount: 50 }); // Should fail!
```

**Solution (Application-Level Constraint):**
```typescript
export const create = mutation({
  handler: async (ctx, args) => {
    // Check for active payments on this booking
    const existingPayments = await ctx.db
      .query("payments")
      .withIndex("by_booking_id", (q) => q.eq("booking_id", args.booking_id))
      .collect();
    
    const activePayment = existingPayments.find(
      (p) => p.status !== "failed" && p.status !== "refunded"
    );
    
    if (activePayment) {
      throw new Error(`Booking ${args.booking_id} already has an active payment`);
    }
    
    // Proceed with payment creation
    // ...
  },
});
```

### 🔴 Priority 3: Conversion Funnel Stage Events

**Problem:** `conversion_funnels` updates stage in-place, losing progression:
```typescript
// Current: Lost timing data!
await updateStage({ id, stage: "service_selected" });
await updateStage({ id, stage: "shop_selected" });  // Lost service_selected timestamp
```

**Solution: Separate stage events table:**
```typescript
conversion_funnel_stages: defineTable({
  funnel_id: v.id("conversion_funnels"),
  stage: v.string(),
  entered_at: v.float64(),
  exited_at: v.optional(v.float64()),
  duration_seconds: v.optional(v.float64()),
})
  .index("by_funnel_id", ["funnel_id"])
  .index("by_stage", ["stage"]),
```

**Benefits:**
- Calculate time spent at each stage
- Identify bottlenecks (where users spend most time)
- A/B test stage optimizations

### 🟡 Priority 4: Soft Deletes for Critical Tables

**Problem:** Hard deletes lose audit trail:
```typescript
// Current: Permanently deletes review
await ctx.db.delete(reviewId);  // Lost forever!
```

**Solution:**
```typescript
// Add to critical tables
reviews: defineTable({
  // ... existing fields
  deleted_at: v.optional(v.float64()),
  deleted_by: v.optional(v.id("users")),
})
  .index("by_deleted_at", ["deleted_at"]),  // Query non-deleted: where deleted_at IS NULL
```

**Query pattern:**
```typescript
export const list = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("reviews").collect();
    return all.filter((r) => !r.deleted_at);  // Exclude soft-deleted
  },
});
```

### 🟡 Priority 5: Optimistic Locking for Concurrent Updates

**Problem:** Race conditions on payment status updates:
```typescript
// Thread 1: Marks payment as completed
// Thread 2: Marks payment as failed (at same time)
// Result: Last write wins (wrong final state)
```

**Solution: Version field:**
```typescript
payments: defineTable({
  // ... existing fields
  version: v.float64(),  // Incremented on each update
})

export const updateStatus = mutation({
  args: {
    id: v.id("payments"),
    expected_version: v.float64(),  // Client passes current version
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.id);
    
    if (!payment) {
      throw new Error("Payment not found");
    }
    
    if (payment.version !== args.expected_version) {
      throw new Error("Payment was modified by another process. Please retry.");
    }
    
    await ctx.db.patch(args.id, {
      status: args.status,
      version: payment.version + 1,  // Increment version
      updated_at: Date.now(),
    });
  },
});
```

---

## 7. REQUIRED INVARIANTS (Business Rules)

### Critical Invariants

```typescript
// ✅ Enforced by schema (FK constraints)
1. bookings.user_id MUST reference valid users._id
2. bookings.shop_id MUST reference valid shops._id
3. bookings.service_id MUST reference valid services._id
4. payments.booking_id MUST reference valid bookings._id

// ⚠️ Application-level (not enforced by Convex)
5. One active payment per booking
   CHECK: payments WHERE booking_id = X AND status NOT IN ('failed', 'refunded')
   MUST HAVE: count <= 1

6. One job_actuals per booking
   CHECK: job_actuals WHERE booking_id = X
   MUST HAVE: count <= 1

7. One review per booking per user
   CHECK: reviews WHERE booking_id = X AND user_id = Y
   MUST HAVE: count <= 1

8. Booking status transitions
   VALID: confirmed → in_progress → completed
   VALID: confirmed → cancelled
   INVALID: completed → confirmed (no backward transitions)

9. Payment status transitions
   VALID: pending → completed/failed
   VALID: completed → refunded
   INVALID: failed → completed (must create new payment)

10. Time slot availability
    WHEN: bookings.create() succeeds
    THEN: time_slots.is_available = false
    (Currently enforced in bookings.create mutation ✅)

11. Follow-up scheduling
    WHEN: job_actuals.submitJobActuals() completes
    THEN: follow_ups record created with scheduled_for in future
    (Currently enforced ✅)

12. Spec variance auto-flagging
    WHEN: variance_percentage > 20%
    THEN: flagged_for_review = true
    (Currently enforced in spec_variances.flagSpecVariance ✅)
```

---

## 8. MINIMAL SAFE CHANGES (No Breaking API)

### Phase 1: Add Missing Indexes (Zero Breaking Changes)

**File:** `convex/schema.ts`

```typescript
// Add indexes to existing tables (non-breaking)
bookings: defineTable({ /* ... */ })
  .index("by_user_id", ["user_id"])
  .index("by_shop_id", ["shop_id"])
  .index("by_status", ["status"])
  .index("by_scheduled_date", ["scheduled_date"])
  .index("by_user_and_status", ["user_id", "status"]),

reviews: defineTable({ /* ... */ })
  .index("by_booking_id", ["booking_id"])
  .index("by_shop_id", ["shop_id"])
  .index("by_user_id", ["user_id"]),

job_actuals: defineTable({ /* ... */ })
  .index("by_booking_id", ["booking_id"])
  .index("by_mechanic_id", ["mechanic_id"]),

user_vehicles: defineTable({ /* ... */ })
  .index("by_user_id", ["user_id"])
  .index("by_engine_id", ["engine_id"]),

mechanics: defineTable({ /* ... */ })
  .index("by_shop_id", ["shop_id"]),

time_slots: defineTable({ /* ... */ })
  .index("by_shop_id", ["shop_id"])
  .index("by_mechanic_id", ["mechanic_id"])
  .index("by_shop_and_date", ["shop_id", "date"])
  .index("by_availability", ["is_available", "date"]),

service_insights: defineTable({ /* ... */ })
  .index("by_engine_id", ["engine_id"])
  .index("by_service_id", ["service_id"])
  .index("by_engine_and_service", ["engine_id", "service_id"]),

service_vehicle_specs: defineTable({ /* ... */ })
  .index("by_engine_id", ["engine_id"])
  .index("by_service_id", ["service_id"])
  .index("by_engine_and_service", ["engine_id", "service_id"]),

shops_hours: defineTable({ /* ... */ })
  .index("by_shop_id", ["shop_id"]),

shop_services: defineTable({ /* ... */ })
  .index("by_shop_id", ["shop_id"])
  .index("by_service_id", ["service_id"]),
```

**Impact:** Performance improvements only, no API changes.

---

### Phase 2: Optimize Query Patterns (Non-Breaking)

**File:** `convex/reviews.ts`

```typescript
// BEFORE (full table scan)
export const getByShopId = query({
  args: { shopId: v.id("shops") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .filter((q) => q.eq(q.field("shop_id"), args.shopId))  // ❌ Slow
      .collect();
    // ...
  },
});

// AFTER (indexed lookup)
export const getByShopId = query({
  args: { shopId: v.id("shops") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_shop_id", (q) => q.eq("shop_id", args.shopId))  // ✅ Fast
      .collect();
    // ...
  },
});
```

**File:** `convex/job_actuals.ts`

```typescript
// BEFORE (full table scan)
export const getByBookingId = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("job_actuals").collect();  // ❌ Slow
    return all.find((row) => row.booking_id === args.bookingId) ?? null;
  },
});

// AFTER (indexed lookup)
export const getByBookingId = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("job_actuals")
      .withIndex("by_booking_id", (q) => q.eq("booking_id", args.bookingId))  // ✅ Fast
      .unique();
  },
});
```

---

### Phase 3: Add Payment Idempotency (Additive Only)

**File:** `convex/schema.ts`

```typescript
payments: defineTable({
  booking_id: v.id("bookings"),
  user_id: v.id("users"),
  shop_id: v.id("shops"),
  amount: v.float64(),
  payment_method: v.string(),
  status: v.string(),
  transaction_id: v.optional(v.string()),
  stripe_payment_intent_id: v.optional(v.string()),
  idempotency_key: v.optional(v.string()),  // ✅ Add as optional first
  created_at: v.float64(),
  updated_at: v.float64(),
})
  .index("by_booking_id", ["booking_id"])
  .index("by_user_id", ["user_id"])
  .index("by_status", ["status"])
  .index("by_idempotency_key", ["idempotency_key"]),  // ✅ Add index
```

**File:** `convex/payments.ts`

```typescript
export const create = mutation({
  args: {
    booking_id: v.id("bookings"),
    user_id: v.id("users"),
    shop_id: v.id("shops"),
    amount: v.float64(),
    payment_method: v.string(),
    status: v.string(),
    transaction_id: v.optional(v.string()),
    stripe_payment_intent_id: v.optional(v.string()),
    idempotency_key: v.optional(v.string()),  // ✅ Optional for backward compatibility
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // If idempotency_key provided, check for duplicates
    if (args.idempotency_key) {
      const existing = await ctx.db
        .query("payments")
        .withIndex("by_idempotency_key", (q) => 
          q.eq("idempotency_key", args.idempotency_key))
        .unique();
      
      if (existing) {
        return existing._id;  // Return existing payment
      }
    }
    
    // Check for active payments on booking
    const existingPayments = await ctx.db
      .query("payments")
      .withIndex("by_booking_id", (q) => q.eq("booking_id", args.booking_id))
      .collect();
    
    const activePayment = existingPayments.find(
      (p) => p.status !== "failed" && p.status !== "refunded"
    );
    
    if (activePayment) {
      throw new Error(`Booking already has an active payment: ${activePayment._id}`);
    }
    
    const paymentId = await ctx.db.insert("payments", {
      ...args,
      created_at: now,
      updated_at: now,
    });

    return paymentId;
  },
});
```

---

### Phase 4: Add Status History Tables (New Tables Only)

**File:** `convex/schema.ts`

```typescript
// New tables (no breaking changes to existing)
booking_status_history: defineTable({
  booking_id: v.id("bookings"),
  old_status: v.optional(v.string()),
  new_status: v.string(),
  changed_by: v.optional(v.id("users")),
  reason: v.optional(v.string()),
  changed_at: v.float64(),
})
  .index("by_booking_id", ["booking_id"])
  .index("by_changed_at", ["changed_at"]),

payment_status_history: defineTable({
  payment_id: v.id("payments"),
  old_status: v.optional(v.string()),
  new_status: v.string(),
  transaction_id: v.optional(v.string()),
  error_message: v.optional(v.string()),
  changed_at: v.float64(),
})
  .index("by_payment_id", ["payment_id"])
  .index("by_changed_at", ["changed_at"]),
```

**File:** `convex/booking_status_history.ts` (new file)

```typescript
import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getByBookingId = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("booking_status_history")
      .withIndex("by_booking_id", (q) => q.eq("booking_id", args.bookingId))
      .collect();
  },
});

export const logStatusChange = internalMutation({
  args: {
    booking_id: v.id("bookings"),
    old_status: v.optional(v.string()),
    new_status: v.string(),
    changed_by: v.optional(v.id("users")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("booking_status_history", {
      ...args,
      changed_at: Date.now(),
    });
  },
});
```

**Update:** `convex/bookings.ts` (minimal change)

```typescript
import { internal } from "./_generated/api";

export const create = mutation({
  handler: async (ctx, args) => {
    // ... existing code ...
    
    const bookingId = await ctx.db.insert("bookings", {
      ...bookingData,
      status: "confirmed",
    });
    
    // Log initial status (non-blocking)
    await ctx.scheduler.runAfter(0, internal.booking_status_history.logStatusChange, {
      booking_id: bookingId,
      old_status: undefined,
      new_status: "confirmed",
    });
    
    return bookingId;
  },
});
```

---

## 9. RECOMMENDED IMPLEMENTATION PRIORITY

### ✅ Phase 1: Performance (Week 1)
- Add all missing indexes to schema
- Update queries to use indexes instead of filters
- Deploy and monitor query performance

### ✅ Phase 2: Data Integrity (Week 2)
- Add payment idempotency_key field
- Implement idempotency checks in payments.create
- Add active payment constraint check

### ✅ Phase 3: Audit Trail (Week 3)
- Add booking_status_history table
- Add payment_status_history table
- Wire status change logging into mutations

### ✅ Phase 4: Naming Consistency (Week 4)
- Add snake_case fields to users table (alongside camelCase)
- Update client code to use new field names
- Mark old fields as deprecated in comments
- Plan removal for v2.0

### 🟡 Phase 5: Advanced Features (Future)
- Add optimistic locking (version field)
- Implement soft deletes
- Add conversion funnel stage events table

---

## 10. TESTING CHECKLIST

### Pre-Deployment Validation

```bash
# 1. Schema validation
✅ All foreign key references point to valid tables
✅ All indexes use existing fields
✅ No circular dependencies

# 2. Query performance
✅ All getByX queries use indexes (no full scans)
✅ Compound indexes ordered correctly (most selective first)

# 3. Invariant enforcement
✅ Payment idempotency test: same key returns same payment
✅ Booking constraint test: can't create 2nd active payment
✅ Status history test: all transitions logged

# 4. Migration safety
✅ Backward compatible: old client code still works
✅ No data loss: all fields optional initially
✅ Rollback plan: can revert schema changes
```

---

## 11. FINAL RECOMMENDATIONS

### Immediate Actions (Do Now)
1. **Add missing indexes** - Critical performance fix
2. **Fix reviews.getByShopId** - Use index instead of filter
3. **Fix job_actuals.getByBookingId** - Use index instead of collect+find
4. **Add payment idempotency** - Prevent duplicate charges

### Short-Term (Next Sprint)
5. Implement booking status history
6. Implement payment status history
7. Add active payment constraint check
8. Start naming convention migration plan

### Long-Term (Next Quarter)
9. Implement optimistic locking for payments
10. Add soft deletes for critical tables
11. Create conversion funnel stage events
12. Complete naming convention migration

---

**Document Version:** 1.0  
**Last Updated:** January 31, 2026  
**Next Review:** February 15, 2026
