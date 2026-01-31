# Gap Report: Database & API Coverage

**Date:** January 31, 2026  
**Scope:** OtoPair backend database and Convex API surface  
**Methodology:** Compare schema.ts tables against implemented access layers (convex/*.ts)

---

## Summary by Status

| Status | Count | Examples |
|--------|-------|----------|
| ✅ **Implemented** | 12 | bookings, payments, job_actuals, reviews, follow_ups, AI chat, analytics |
| 🟡 **Schema-Only** | 14 | engines, makes, models, trims, services, specs, enrichment logs, variances |
| ❌ **Missing** | 2 | vehicles, vehicle_owners (critical for new vehicle model) |
| ⚠️ **Deprecated** | 1 | user_vehicles.ts (old schema) |

**Coverage:** 12/28 tables have full access layers = **43% implemented**

---

## Detailed Gap Analysis

### ✅ IMPLEMENTED (Ready for Production)

#### Transaction & Job Management (5 modules)
- **bookings.ts** — ✅ Full CRUD + FSM status validation
  - Queries: list, getById, getByUserId, getByShopId
  - Mutations: create (with time slot reservation), updateStatus
  - Status: Production-ready
  
- **payments.ts** — ✅ Full CRUD + idempotency + FSM
  - Queries: list, getById, getByBookingId (unique), getByUserId
  - Mutations: create (with idempotency_key), updateStatus
  - Status: Production-ready
  
- **job_actuals.ts** — ✅ Full lifecycle + variance tracking
  - Queries: list, getById, getByBookingId (unique), getPrefillData
  - Mutations: startJob, completeJob, submitJobActuals
  - Status: Production-ready
  
- **reviews.ts** — ✅ Review submission + invariant checks
  - Queries: list, getById, getByShopId (indexed), getByUserId (indexed)
  - Mutations: submit (with invariant: unique per booking)
  - Status: Production-ready
  
- **follow_ups.ts** — ✅ Maintenance reminders (NEW: uses VIN)
  - Queries: list, getById, getByUserId, getByVin (indexed), getPendingReminders
  - Mutations: create, updateStatus, dismiss
  - Status: Production-ready

#### Audit Logs (2 modules)
- **booking_status_history.ts** — ✅ Append-only FSM audit log
  - Queries: getByBookingId, getHistory (time-ordered), getLatestStatus, validation helpers
  - Mutations: log (internal)
  - Status: Production-ready, immutable
  
- **payment_status_history.ts** — ✅ Append-only FSM audit log
  - Queries: Same as booking_status_history
  - Mutations: log (internal)
  - Status: Production-ready, immutable

#### AI & Analytics (4 modules)
- **ai_conversations.ts** — ✅ Chat session management
  - Queries: list, getById, getByUserId, getBySessionId
  - Mutations: create, end, markLedToBooking
  - Status: Production-ready
  
- **ai_messages.ts** — ✅ Message history
  - Queries: list, getById, getByConversationId (indexed)
  - Mutations: create
  - Status: Production-ready
  
- **analytics_events.ts** — ✅ Event tracking
  - Mutations: track (event_type, event_category, event_data)
  - Queries: list, getByEventType, getByUserId, getConversionFunnelStats
  - Status: Production-ready
  
- **conversion_funnels.ts** — ✅ Funnel tracking
  - Queries: list, getById, getByUserId
  - Mutations: enterStage, exitStage, markCompleted
  - Status: Production-ready

---

### 🟡 SCHEMA-ONLY (Table Exists, No Access Layer)

#### Vehicle Catalog (5 tables — Read-Only, Seeded)
These tables are populated during seed and rarely change. Considered safe to query directly:

1. **engines.ts** — Engine master data
   - Status: Seeded only, no mutations needed
   - Fields: cylinders, displacement_liters, engine_code, fuel_type, trim_id
   - Action: Add `getByTrimId` query for prefilling vehicle specs

2. **makes.ts** — Car manufacturers
   - Status: Seeded only
   - Fields: name, logo_url
   - Action: Add `list` query for vehicle brand selection

3. **models.ts** — Car models per make
   - Status: Seeded only
   - Fields: name, make_id
   - Action: Add `getByMakeId` query for brand → model navigation

4. **trims.ts** — Trim variants per model
   - Status: Seeded only
   - Fields: name, year_start, year_end, model_id
   - Action: Add `getByModelAndYear` query for year filtering

5. **vehicle_specs.ts** — OEM parts & fluid specs
   - Status: Seeded only
   - Fields: battery_cca, battery_group, oil_capacity_qts, oil_filter_oem, brake_pad_oem, etc.
   - Action: Add `getByEngineId` query for prefilling job_actuals with part numbers

#### Service Catalog (5 tables — Read-Only, Seeded)
Similar to vehicle catalog: seeded data, no mutations:

6. **services.ts** — Available service types
   - Fields: name, slug, description, default_labor_hours, has_options
   - Action: Add `list` and `getByCategory` queries

7. **service_categories.ts** — Service grouping
   - Fields: name, icon_name, display_order
   - Action: Add `list` query

8. **service_options.ts** — Labor/parts cost variants
   - Fields: service_id, option_label, option_type, labor_hours, parts_cost_low/high
   - Action: Add `getByServiceId` query

9. **service_vehicle_specs.ts** — Service specs per engine
   - Fields: engine_id, service_id, labor_hours, parts_cost_low/high, confidence_score, tech_notes
   - Action: Add `getByEngineAndService` query for pricing lookups

10. **shop_services.ts** — Which services each shop offers
    - Fields: shop_id, service_id, is_offered
    - Action: Add `getByShopId` query for filtering available services

#### Spec Intelligence (4 tables — Append-Only, AI-Generated)
These track AI enrichments and user confirmations:

11. **ai_enrichment_logs.ts** — AI spec enrichment records
    - Fields: engine_id, service_id, source (openai/claude), confidence_score, enriched_data, review_status
    - Action: Add `getByEngineAndService` and `getByReviewStatus` queries for manual review workflows

12. **manual_review_queue.ts** — Low-confidence enrichments awaiting human review
    - Fields: engine_id, service_id, enrichment_log_id, priority, reason, status, assigned_to
    - Action: Add `getByStatus` and `getByAssignedTo` queries for assignment workflows

13. **spec_variances.ts** — Predicted vs actual labor/costs (ML training data)
    - Fields: engine_id, service_id, job_actual_id, predicted_labor_hours, actual_labor_hours, variance_percentage, flagged_for_review
    - Action: Add `getByEngineAndService` and `getFlaggedForReview` queries for variance analysis

14. **spec_confirmations.ts** — User confirmations of spec accuracy
    - Fields: user_id, engine_id, service_id, booking_id, confirmed_accurate, feedback
    - Action: Add `getByEngineAndService` query to track which specs are user-validated

---

### ❌ MISSING (Critical for New Vehicle Model)

#### 1. **vehicles.ts** — CRITICAL
**Status:** Table exists in schema.ts, no access layer created yet
**Replaces:** user_vehicles.ts (old model)

**Business Purpose:**
- Canonical vehicle catalog: one row per VIN (unique constraint)
- Links to trim → model → make and engine → vehicle_specs
- Immutable reference for all multi-owner vehicles

**Required Mutations:**
```typescript
export const upsertVehicle = mutation({
  args: {
    vin: v.string(),  // uppercase, trimmed
    trim_id?: v.id("trims"),
    engine_id?: v.id("engines"),
    year?: v.float64(),
    metadata?: v.any(),
  },
  handler: async (ctx, args) => {
    // 1. Normalize VIN (uppercase, trim whitespace)
    const normalizedVin = args.vin.toUpperCase().trim();
    
    // 2. Find existing vehicle by VIN
    const existing = await ctx.db
      .query("vehicles")
      .withIndex("by_vin", (q) => q.eq("vin", normalizedVin))
      .unique();
    
    if (existing) {
      // 3. Patch with new fields (preserve existing if undefined)
      const updates: any = { updated_at: Date.now() };
      if (args.trim_id) updates.trim_id = args.trim_id;
      if (args.engine_id) updates.engine_id = args.engine_id;
      if (args.year) updates.year = args.year;
      if (args.metadata) updates.metadata = args.metadata;
      
      await ctx.db.patch(existing._id, updates);
      return await ctx.db.get(existing._id);
    } else {
      // 4. Insert new vehicle
      const vehicleId = await ctx.db.insert("vehicles", {
        vin: normalizedVin,
        trim_id: args.trim_id,
        engine_id: args.engine_id,
        year: args.year,
        metadata: args.metadata,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
      return await ctx.db.get(vehicleId);
    }
  },
});
```

**Required Queries:**
```typescript
export const listVehiclesByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // 1. Get active ownerships for user
    const ownerships = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_user_status", (q) =>
        q.eq("user_id", args.userId).eq("status", "active")
      )
      .collect();
    
    // 2. Fetch vehicle for each ownership
    const results = await Promise.all(
      ownerships.map(async (ownership) => {
        const vehicle = await ctx.db.get(ownership.vin); // via by_vin index
        return { vin: ownership.vin, vehicle, ownership };
      })
    );
    
    return results;
  },
});
```

**Implementation Priority:** ⚠️ CRITICAL — blocks bookings refactor
**Effort Estimate:** 2-3 hours
**Tests Needed:** 
- upsert creates new vehicle for unique VIN
- upsert patches existing vehicle with new fields
- listVehiclesByUser returns only active ownerships
- Vehicle does not delete when user removes it

#### 2. **vehicle_owners.ts** — CRITICAL
**Status:** Table exists in schema.ts, no access layer created yet
**Replaces:** Ownership logic from user_vehicles.ts

**Business Purpose:**
- Join table: users → vehicles (N:N with soft-delete)
- Tracks ownership status ("active", "removed")
- Per-user fields: nickname, is_primary, mileage

**Required Mutations:**
```typescript
export const addOwner = mutation({
  args: {
    vin: v.string(),
    userId: v.id("users"),
    nickname?: v.string(),
    is_primary?: v.boolean(),
    mileage?: v.float64(),
  },
  handler: async (ctx, args) => {
    // 1. Ensure vehicle exists (create if needed)
    const vehicle = await vehicles.upsertVehicle({
      vin: args.vin,
    });
    
    // 2. Find existing ownership
    const existing = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_vin_user", (q) =>
        q.eq("vin", args.vin).eq("user_id", args.userId)
      )
      .unique();
    
    if (existing) {
      if (existing.status === "removed") {
        // 3a. Reactivate removed ownership
        await ctx.db.patch(existing._id, {
          status: "active",
          removed_at: null,
          added_at: Date.now(),
          nickname: args.nickname ?? existing.nickname,
          is_primary: args.is_primary ?? existing.is_primary,
          mileage: args.mileage ?? existing.mileage,
        });
      } else if (existing.status === "active") {
        // 3b. Idempotent: update fields
        await ctx.db.patch(existing._id, {
          nickname: args.nickname ?? existing.nickname,
          is_primary: args.is_primary ?? existing.is_primary,
          mileage: args.mileage ?? existing.mileage,
        });
      }
    } else {
      // 4. Create new ownership row
      await ctx.db.insert("vehicle_owners", {
        vin: args.vin,
        user_id: args.userId,
        status: "active",
        nickname: args.nickname,
        is_primary: args.is_primary ?? false,
        mileage: args.mileage,
        added_at: Date.now(),
      });
    }
    
    // 5. Enforce single primary per user
    if (args.is_primary) {
      const allActive = await ctx.db
        .query("vehicle_owners")
        .withIndex("by_user_status", (q) =>
          q.eq("user_id", args.userId).eq("status", "active")
        )
        .collect();
      
      for (const other of allActive) {
        if (other.vin !== args.vin && other.is_primary) {
          await ctx.db.patch(other._id, { is_primary: false });
        }
      }
    }
  },
});

export const removeOwner = mutation({
  args: {
    vin: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // 1. Find ownership
    const ownership = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_vin_user", (q) =>
        q.eq("vin", args.vin).eq("user_id", args.userId)
      )
      .unique();
    
    if (ownership) {
      // 2. Soft delete: mark removed
      await ctx.db.patch(ownership._id, {
        status: "removed",
        removed_at: Date.now(),
        is_primary: false,
      });
    }
  },
});
```

**Required Queries:**
```typescript
export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vehicle_owners")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.userId))
      .collect();
  },
});

export const getActiveByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vehicle_owners")
      .withIndex("by_user_status", (q) =>
        q.eq("user_id", args.userId).eq("status", "active")
      )
      .collect();
  },
});
```

**Implementation Priority:** ⚠️ CRITICAL — blocks bookings refactor
**Effort Estimate:** 2-3 hours
**Tests Needed:**
- addOwner creates new ownership for new (vin, user) pair
- addOwner reactivates removed ownership
- addOwner is idempotent (updates existing active ownership)
- removeOwner soft-deletes (status="removed", removed_at set)
- Vehicle is not deleted when ownership is removed
- Only one is_primary per user (others forced to false)

---

### ⚠️ DEPRECATED (Old Schema)

#### **user_vehicles.ts** — OBSOLETE
**Status:** Still in codebase, but references deleted from schema
**Issue:** bookings.ts still tries to reference user_vehicle_id (line 26)
**Action:**
1. Delete user_vehicles.ts entirely
2. Fix bookings.create to accept vin instead of user_vehicle_id
3. Fix job_actuals.getPrefillData to look up vehicle via vin instead of user_vehicle_id

**Effort:** 1 hour

---

## Priority-Ordered Implementation Roadmap

### Phase 1: Critical Path (Week 1)
**Goal:** Enable new vehicle model for development

1. **Create vehicles.ts** (2-3 hrs)
   - upsertVehicle(vin, trim_id?, engine_id?, year?, metadata?)
   - Implement by_vin uniqueness check
   - Add getByVin query for testing

2. **Create vehicle_owners.ts** (2-3 hrs)
   - addOwner(vin, userId, nickname?, is_primary?, mileage?)
   - removeOwner(vin, userId) — soft delete
   - Implement single primary per user constraint
   - Add listVehiclesByUser query

3. **Fix bookings.ts** (1 hr)
   - Change create mutation: replace user_vehicle_id with vin
   - Update job_actuals.getPrefillData to resolve vehicle via vin

4. **Delete user_vehicles.ts** (0.5 hrs)
   - Remove deprecated access layer
   - Verify no remaining references

5. **Smoke Tests** (1 hr)
   - User A adds VIN → no duplicate vehicles row, ownership created
   - User B adds same VIN → reuses vehicle, new ownership row
   - User A removes → ownership.status="removed", vehicle untouched
   - listVehiclesByUser(A) excludes removed; listVehiclesByUser(B) includes active

**Total Effort:** ~9-10 hours
**Deliverable:** Full vehicle lifecycle working in dev

---

### Phase 2: Catalog Queries (Week 2)
**Goal:** Enable vehicle navigation in UI

1. **Add catalog queries** (3 hrs)
   - engines: getByTrimId
   - makes: list
   - models: getByMakeId
   - trims: getByModelAndYear
   - services: list, getByCategory
   - service_categories: list

**Total Effort:** ~3 hours

---

### Phase 3: Spec Intelligence (Week 3-4)
**Goal:** Support manual review workflows and ML training

1. **Add enrichment queries** (2 hrs)
   - ai_enrichment_logs: getByEngineAndService, getByReviewStatus
   - manual_review_queue: getByStatus, getByAssignedTo
   - spec_variances: getByEngineAndService, getFlaggedForReview
   - spec_confirmations: getByEngineAndService

**Total Effort:** ~2 hours

---

### Phase 4: Infrastructure (Week 4+)
**Goal:** Production hardening

1. Performance profiling on all 74 indexes
2. Backfill old user_vehicles records to vehicles + vehicle_owners
3. Add query rate limiting and caching
4. Implement admin dashboard for spec reviews

---

## Risk Assessment

### Critical Risks
- 🔴 **vehicles.ts not created** — Blocks entire booking flow for new model
  - Mitigation: Create this week (Phase 1)
  
- 🔴 **bookings.create still references user_vehicle_id** — Deployment will fail
  - Mitigation: Fix together with vehicles.ts
  
- 🟡 **Single primary constraint not enforced** — Multiple is_primary=true possible
  - Mitigation: Test in smoke tests

### Medium Risks
- 🟡 **Schema-only tables not queried** — Frontend will break if trying to read catalogs
  - Mitigation: Add Phase 2 queries before frontend integration
  
- 🟡 **Spec intelligence tables unused** — ML training pipeline blocked
  - Mitigation: Low priority; can defer to Phase 3

---

## Recommendations

### Immediate (Today)
✅ Implement vehicles.ts + vehicle_owners.ts (Phase 1)
✅ Fix bookings.ts references
✅ Run smoke tests

### This Week
✅ Deploy to Convex staging
✅ Test with actual mobile app
✅ Monitor for errors

### Next Week
✅ Add Phase 2 catalog queries
✅ Backfill old user_vehicles data (if prod has data)
✅ Update frontend to use new API

### Month 2+
✅ Implement Phase 3 spec intelligence
✅ Monitor analytics and conversion funnels
✅ Plan Phase 4 production hardening

---

## Summary Table

| Module | Tables | Status | Effort | Priority |
|--------|--------|--------|--------|----------|
| bookings | 1 | ✅ Impl | 1h | ⚠️ Fix ref |
| payments | 1 | ✅ Impl | — | — |
| job_actuals | 1 | ✅ Impl | 1h | ⚠️ Fix ref |
| reviews | 1 | ✅ Impl | — | — |
| follow_ups | 1 | ✅ Impl | — | — |
| **vehicles** | **2** | **❌ Miss** | **5h** | **🔴 CRITICAL** |
| catalogs | 10 | 🟡 Schema | 3h | 🟠 Phase 2 |
| spec_intel | 4 | 🟡 Schema | 2h | 🟢 Phase 3 |
| audit | 2 | ✅ Impl | — | — |
| ai_chat | 2 | ✅ Impl | — | — |
| analytics | 2 | ✅ Impl | — | — |

---

**Last Updated:** January 31, 2026  
**Next Review:** After Phase 1 completion (target: by end of week)
