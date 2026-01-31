# Database Review Summary - Critical Findings

**Date:** January 31, 2026  
**Repository:** AppFlow-Studio/otopair (branch: waleeddev2)  
**Reviewer:** GitHub Copilot

---

## ✅ Validation Results

### 1. Schema Diffs Verification

**Status: ✅ VALID with 2 Critical Issues**

#### ✅ Correct:
- All proposed indexes reference valid fields
- Index syntax is correct for Convex
- No circular dependencies
- Indexes added BEFORE .withIndex() usage in queries

#### 🔴 Critical Issues Found:

**Issue 1: Timestamp Type Inconsistency**
```typescript
// CURRENT (Mixed types)
job_actuals: {
  completed_at: v.string(),           // ❌ ISO string
  job_started_at: v.string(),         // ❌ ISO string
}

payments: {
  created_at: v.float64(),            // ✅ Unix ms
  updated_at: v.float64(),            // ✅ Unix ms
}

// REQUIRED (Standardize)
job_actuals: {
  completed_at: v.optional(v.float64()), // ✅ Unix ms
  started_at: v.float64(),               // ✅ Unix ms
  created_at: v.float64(),               // ✅ Add
  updated_at: v.float64(),               // ✅ Add
}
```

**Issue 2: Missing Timestamps in bookings**
```typescript
// CURRENT
bookings: { /* no created_at/updated_at */ }

// REQUIRED
bookings: {
  created_at: v.float64(),
  updated_at: v.float64(),
}
```

---

### 2. Business-Standard Relations Validation

#### ✅ Bookings as Hub: CORRECT

```
bookings (hub)
  ├─> payments (1:1) ✅
  ├─> reviews (1:1) ✅
  ├─> job_actuals (1:1) ✅
  ├─> follow_ups (1:N) ✅
  └─> status_history (1:N) ✅
```

**Verified:**
- All foreign keys point to correct tables
- Hub relationships properly modeled
- Derived tables correctly link to bookings

#### ⚠️ Payment Idempotency: PARTIAL

**Current State:**
- ✅ `idempotency_key` field exists
- ✅ Index on `idempotency_key` exists
- ❌ Field is **optional** (should be required)
- ❌ No enforcement in mutation (allows duplicates)

**Required Fix:**
```typescript
// Schema
payments: defineTable({
  idempotency_key: v.string(),  // Make required
  // ...
})

// Mutation
export const create = mutation({
  handler: async (ctx, args) => {
    // Check for duplicate
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_idempotency_key", q => 
        q.eq("idempotency_key", args.idempotency_key))
      .unique();
    
    if (existing) return existing._id;  // Idempotent
    
    // Check for active payment on booking
    const activePayment = await checkActivePayment(ctx, args.booking_id);
    if (activePayment) {
      throw new Error("Booking already has active payment");
    }
    
    return await ctx.db.insert("payments", args);
  },
});
```

#### ✅ Job Actuals 1:1 with Booking: CORRECT

**Recommendation:** Keep 1:1 relationship (current design is optimal)

**Rationale:**
- Single source of truth for job completion data
- Simplifies queries (no array handling)
- Enforces one completion record per booking
- Parts are nested array (sufficient for this domain)

**Alternative (NOT recommended):** Separate `job_parts` table would:
- Add complexity without benefit
- Require joins for every query
- Not aligned with Convex document model

**Current Design (Keep):**
```typescript
job_actuals: {
  booking_id: v.id("bookings"),  // 1:1 FK
  parts_used: v.array(v.object({  // Nested parts
    part_name: v.string(),
    oem_number: v.string(),
    cost: v.float64(),
  })),
}
```

**Enforcement:**
```typescript
// In job_actuals.create mutation
const existing = await ctx.db
  .query("job_actuals")
  .withIndex("by_booking_id", q => q.eq("booking_id", bookingId))
  .unique();

if (existing) {
  throw new Error("Job actuals already exist for this booking");
}
```

#### ✅ Status History: CORRECT (Append-Only)

**Verified:**
- Designed as append-only log
- No update/delete operations
- Queryable in time order via `changed_at` index
- Proper foreign key to parent entity

```typescript
booking_status_history: defineTable({
  booking_id: v.id("bookings"),
  old_status: v.optional(v.string()),
  new_status: v.string(),
  changed_at: v.float64(),  // Time-ordered
})
  .index("by_booking_id", ["booking_id"])
  .index("by_changed_at", ["changed_at"])
```

---

### 3. Inconsistencies Found

#### 🔴 Critical: Payment Status Enum Naming

**Issue:** No standardized enum values in code

**Recommended Standard:**
```typescript
type PaymentStatus =
  | 'pending'      // Intent created
  | 'processing'   // Submitted to processor
  | 'completed'    // Success
  | 'failed'       // Declined/error
  | 'refunded'     // Reversed
  | 'cancelled';   // Intent cancelled

// Terminal states (no further transitions)
const TERMINAL_STATES = ['failed', 'refunded', 'cancelled'];

// Active states (block duplicate payments)
const ACTIVE_STATES = ['pending', 'processing', 'completed'];
```

**Current Code:** Uses string literals inconsistently
```typescript
// In payments.ts
if (p.status !== "failed" && p.status !== "refunded")  // ❌ Hardcoded

// Should be:
if (!TERMINAL_STATES.includes(p.status))  // ✅ Constant
```

#### 🟡 Moderate: Booking Status Enum

**Current:** String field with no validation

**Recommended:**
```typescript
type BookingStatus =
  | 'pending'      // Pre-confirmation
  | 'confirmed'    // User confirmed
  | 'in_progress'  // Work started
  | 'completed'    // Work finished
  | 'cancelled'    // Cancelled by user
  | 'no_show';     // User didn't show

// Valid transitions FSM
const VALID_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed'],
  completed: [],    // Terminal
  cancelled: [],    // Terminal
  no_show: [],      // Terminal
};
```

#### 🟡 Moderate: Timestamp Format Mix

| Table | Field | Current Type | Should Be |
|-------|-------|-------------|-----------|
| job_actuals | completed_at | v.string() | v.float64() |
| job_actuals | job_started_at | v.string() | v.float64() |
| job_actuals | logged_at | v.string() | v.float64() |
| bookings | (missing) | N/A | v.float64() |
| reviews | (missing) | N/A | v.float64() |

**Impact:**
- Cannot sort by timestamp efficiently
- Cannot calculate durations easily
- Timezone confusion (ISO strings may have offset)

---

## 4. Best-Practice Relations List

### Primary Keys & Foreign Keys

```
TABLE: bookings (Hub)
  PK: _id (Convex ID)
  FK: user_id → users._id
  FK: user_vehicle_id → user_vehicles._id
  FK: shop_id → shops._id
  FK: service_id → services._id
  FK: mechanic_id → mechanics._id (optional)
  FK: time_slot_id → time_slots._id

TABLE: payments
  PK: _id
  FK: booking_id → bookings._id (1:1)
  FK: user_id → users._id (denormalized)
  FK: shop_id → shops._id (denormalized)
  UK: idempotency_key (unique - enforced in code)

TABLE: job_actuals
  PK: _id
  FK: booking_id → bookings._id (1:1 - enforced in code)
  FK: mechanic_id → mechanics._id

TABLE: reviews
  PK: _id
  FK: booking_id → bookings._id (1:1 - enforced in code)
  FK: user_id → users._id
  FK: shop_id → shops._id (denormalized)
  FK: mechanic_id → mechanics._id (optional)

TABLE: follow_ups
  PK: _id
  FK: user_id → users._id
  FK: user_vehicle_id → user_vehicles._id
  FK: booking_id → bookings._id (optional)
  FK: service_id → services._id

TABLE: booking_status_history (Audit)
  PK: _id
  FK: booking_id → bookings._id
  FK: changed_by → users._id (optional)

TABLE: payment_status_history (Audit)
  PK: _id
  FK: payment_id → payments._id
```

### Required Indexes Checklist

#### 🔴 Critical (Performance)
- [ ] bookings.by_user_id
- [ ] bookings.by_shop_id
- [ ] bookings.by_status
- [ ] bookings.by_user_and_status
- [ ] payments.by_booking_id
- [ ] payments.by_idempotency_key
- [ ] job_actuals.by_booking_id
- [ ] reviews.by_booking_id
- [ ] reviews.by_shop_id

#### 🟡 Important (Functionality)
- [ ] bookings.by_scheduled_date
- [ ] bookings.by_shop_and_date
- [ ] bookings.by_created_at
- [ ] payments.by_user_id
- [ ] payments.by_created_at
- [ ] job_actuals.by_mechanic_id
- [ ] reviews.by_user_id
- [ ] user_vehicles.by_user_id
- [ ] mechanics.by_shop_id
- [ ] time_slots.by_shop_and_date

#### 🟢 Nice-to-Have (Analytics)
- [ ] reviews.by_rating
- [ ] bookings.by_service_id
- [ ] time_slots.by_availability
- [ ] booking_status_history.by_changed_at
- [ ] payment_status_history.by_error_code

---

## 5. Invariants Enforcement

### Invariant 1: Payment Idempotency
**Status:** ⚠️ Partial (field exists, not enforced)

```typescript
// Required enforcement
if (existing payment with same idempotency_key) {
  return existing._id;  // Idempotent return
}
```

### Invariant 2: One Active Payment Per Booking
**Status:** ❌ Not enforced

```typescript
// Required enforcement
const activePayment = payments.find(p => 
  !['failed', 'refunded', 'cancelled'].includes(p.status)
);
if (activePayment) throw new Error("Active payment exists");
```

### Invariant 3: One Job Actual Per Booking
**Status:** ⚠️ Partial (1:1 design, not enforced in code)

```typescript
// Required enforcement
const existing = await ctx.db
  .query("job_actuals")
  .withIndex("by_booking_id", q => q.eq("booking_id", bookingId))
  .unique();
if (existing) throw new Error("Job actuals already exist");
```

### Invariant 4: One Review Per Booking
**Status:** ❌ Not enforced

```typescript
// Required enforcement
const existing = await ctx.db
  .query("reviews")
  .withIndex("by_booking_id", q => q.eq("booking_id", bookingId))
  .unique();
if (existing) throw new Error("Booking already reviewed");
```

### Invariant 5: Booking Status Transitions
**Status:** ❌ Not enforced

```typescript
// Required enforcement
const allowed = VALID_TRANSITIONS[currentStatus];
if (!allowed.includes(newStatus)) {
  throw new Error(`Invalid transition: ${currentStatus} → ${newStatus}`);
}
```

### Invariant 6: Time Slot Atomicity
**Status:** ✅ Enforced (in bookings.create)

```typescript
// Current implementation (correct)
const slot = await ctx.db.get(time_slot_id);
if (!slot.is_available) throw new Error("Slot unavailable");
await ctx.db.patch(time_slot_id, { is_available: false });
const bookingId = await ctx.db.insert("bookings", {...});
```

---

## 6. Minimal Production Diffs

### Priority 1: Critical Fixes (Week 1)

**1.1 Standardize Timestamps**
```diff
job_actuals: defineTable({
- completed_at: v.string(),
+ completed_at: v.optional(v.float64()),
- job_started_at: v.string(),
+ started_at: v.float64(),
- logged_at: v.optional(v.string()),
+ logged_at: v.optional(v.float64()),
+ created_at: v.float64(),
+ updated_at: v.float64(),
})
```

**1.2 Add Timestamps to bookings**
```diff
bookings: defineTable({
  // ... existing fields
+ created_at: v.float64(),
+ updated_at: v.float64(),
})
```

**1.3 Add Timestamps to reviews**
```diff
reviews: defineTable({
  // ... existing fields
+ created_at: v.float64(),
})
```

**1.4 Make Idempotency Key Required**
```diff
payments: defineTable({
- idempotency_key: v.optional(v.string()),
+ idempotency_key: v.string(),
})
```

### Priority 2: Add All Missing Indexes (Week 1)

See `DB_SCHEMA_DIFFS.md` Phase 1 for complete list.

**Critical indexes:**
- bookings: 9 indexes
- payments: already complete
- job_actuals: 2 indexes
- reviews: 3 indexes
- user_vehicles: 2 indexes
- mechanics: 1 index
- time_slots: 4 indexes

### Priority 3: Enforce Invariants (Week 2)

**3.1 Payment Idempotency**
```typescript
// In payments.create
const existing = await checkIdempotencyKey(idempotency_key);
if (existing) return existing._id;
```

**3.2 Active Payment Check**
```typescript
// In payments.create
const activePayment = await checkActivePayment(booking_id);
if (activePayment) throw new Error("Active payment exists");
```

**3.3 Job Actuals Uniqueness**
```typescript
// In job_actuals.create
const existing = await checkExistingJobActuals(booking_id);
if (existing) throw new Error("Job actuals exist");
```

**3.4 Review Uniqueness**
```typescript
// In reviews.create
const existing = await checkExistingReview(booking_id);
if (existing) throw new Error("Already reviewed");
```

### Priority 4: Status History (Week 2)

**4.1 Add Tables** (see DB_SCHEMA_DIFFS.md Phase 4)

**4.2 Wire Logging**
```typescript
// In bookings.updateStatus
await ctx.scheduler.runAfter(0, internal.booking_status_history.log, {
  booking_id,
  old_status,
  new_status,
});
```

---

## 7. Deployment Risk Assessment

| Change | Risk | Rollback | Downtime |
|--------|------|----------|----------|
| Add indexes | Low | Easy | None |
| Add timestamp fields | Medium | Hard | None |
| Make idempotency_key required | Medium | Easy | None |
| Enforce invariants | Medium | Easy | None |
| Add status history | Low | Easy | None |

**Total Risk:** Medium  
**Total Timeline:** 2-3 weeks  
**Production Impact:** Minimal (no breaking API changes)

---

## 8. Next Steps

### Immediate (This Week)
1. ✅ Review this document with team
2. ⏳ Approve schema changes
3. ⏳ Implement Priority 1 fixes
4. ⏳ Add all missing indexes
5. ⏳ Deploy to staging

### Week 2
6. ⏳ Test performance improvements
7. ⏳ Enforce invariants in mutations
8. ⏳ Add status history logging
9. ⏳ Deploy to production

### Week 3
10. ⏳ Monitor production metrics
11. ⏳ Build admin dashboards for status history
12. ⏳ Document deployment retrospective

---

## 9. Key Takeaways

### ✅ What's Good
- Hub-spoke model is correct
- Relationships are properly modeled
- Most indexes are in place (new tables)
- Append-only logs are well designed

### ⚠️ What Needs Fixing
- 26 missing indexes on core tables
- Timestamp type inconsistency
- Payment idempotency not enforced
- Invariants not validated in code
- Status enums not standardized

### 🎯 Bottom Line
**The database design is fundamentally sound, but needs 2-3 weeks of refinement to reach production-ready standard. All fixes are non-breaking and can be deployed incrementally.**

---

**Document Version:** 1.0  
**Last Updated:** January 31, 2026  
**Status:** Ready for Team Review
