# Quick Reference: Production Database with Full Documentation

**Last Updated:** February 1, 2026  
**Status:** ✅ Complete with comprehensive code documentation

## 🔥 Quick Start

All tables follow the existing Convex pattern with comprehensive TypeScript documentation. Import and use like existing tables:

```typescript
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";

// Query example
const payments = useQuery(api.payments.getByUserId, { userId: user._id });

// Mutation example
const createPayment = useMutation(api.payments.create);
await createPayment({ booking_id, user_id, shop_id, amount, payment_method, status });
```

---

## 📚 Documentation Reference

### How to Find Code Documentation

All convex files now include comprehensive TypeScript comments at:
- **File Level:** Purpose, description, table info, relationships, use cases
- **Query/Mutation Level:** Parameters, return types, error handling, examples

**Location:** See file headers in `/workspaces/otopair/convex/[filename].ts`

### Files with Full Documentation ✅

| File | Tables | Queries | Mutations | Status |
|------|--------|---------|-----------|--------|
| schema.ts | 40+ | - | - | ✅ Fully documented |
| bookings.ts | bookings | 4 | 2 | ✅ Fully documented |
| users.ts | users | 2 | 1 | ✅ Fully documented |
| shops.ts | shops | 2 | - | ✅ Fully documented |
| services.ts | services | 2 | - | ✅ Fully documented |
| mechanics.ts | mechanics | 3 | - | ✅ Fully documented |
| engines.ts | engines | 3 | - | ✅ Fully documented |
| makes.ts | makes | 2 | - | ✅ Fully documented |
| models.ts | models | 3 | - | ✅ Fully documented |
| trims.ts | trims | 3 | - | ✅ Fully documented |

---

## 📊 Table Reference

### Payments
**File:** `convex/payments.ts` (✅ Fully documented)

```typescript
// Get payment for a booking
const payment = await ctx.runQuery(api.payments.getByBookingId, { bookingId });

// Create payment
const paymentId = await ctx.runMutation(api.payments.create, {
  booking_id,
  user_id,
  shop_id,
  amount: 125.50,
  payment_method: "card",
  status: "completed",
  stripe_payment_intent_id: "pi_xxx",
});

// Update payment status
await ctx.runMutation(api.payments.updateStatus, {
  id: paymentId,
  status: "completed",
  transaction_id: "txn_123",
});
```

---

### Follow-ups
**File:** `convex/follow_ups.ts`

```typescript
// Get user's pending reminders
const reminders = await ctx.runQuery(api.follow_ups.getByUserId, { userId });

// Get reminders due now
const dueNow = await ctx.runQuery(api.follow_ups.getPendingReminders, {
  beforeTimestamp: Date.now(),
});

// Create follow-up (auto-created on job completion)
const followUpId = await ctx.runMutation(api.follow_ups.create, {
  user_id,
  user_vehicle_id,
  booking_id,
  service_id,
  follow_up_type: "maintenance_due",
  scheduled_for: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days
  message: "Time to schedule your next oil change",
});

// Mark as sent
await ctx.runMutation(api.follow_ups.updateStatus, {
  id: followUpId,
  status: "sent",
});
```

---

### AI Conversations & Messages
**Files:** `convex/ai_conversations.ts`, `convex/ai_messages.ts`

```typescript
// Start conversation
const conversationId = await ctx.runMutation(api.ai_conversations.create, {
  user_id,
  session_id: "uuid-from-client",
  scenario_detected: "price_check",
});

// Add message
await ctx.runMutation(api.ai_messages.create, {
  conversation_id: conversationId,
  role: "user",
  content: "How much for an oil change?",
});

// Get conversation history
const messages = await ctx.runQuery(api.ai_messages.getByConversationId, {
  conversationId,
});

// Link to booking when conversion happens
await ctx.runMutation(api.ai_conversations.linkBooking, {
  id: conversationId,
  booking_id,
});

// End conversation
await ctx.runMutation(api.ai_conversations.end, { id: conversationId });
```

---

### Analytics Events
**File:** `convex/analytics_events.ts`

```typescript
// Track event (auto-tracked in bookings flow)
await ctx.runMutation(api.analytics_events.track, {
  user_id,
  event_type: "service_selected",
  event_category: "booking",
  event_data: {
    service_id,
    shop_id,
    screen_name: "ServiceSelectionScreen",
  },
  session_id: "session-uuid",
});

// Query events
const userEvents = await ctx.runQuery(api.analytics_events.getByUserId, { userId });
const bookingEvents = await ctx.runQuery(api.analytics_events.getByEventType, {
  eventType: "booking_created",
});
```

---

### Conversion Funnels
**File:** `convex/conversion_funnels.ts`

```typescript
// Start funnel
const funnelId = await ctx.runMutation(api.conversion_funnels.startFunnel, {
  user_id,
  funnel_type: "booking_flow",
  stage: "service_selected",
});

// Update stage as user progresses
await ctx.runMutation(api.conversion_funnels.updateStage, {
  id: funnelId,
  stage: "shop_selected",
});

// Complete funnel (auto-completed in bookings.create)
await ctx.runMutation(api.conversion_funnels.completeFunnel, {
  id: funnelId,
  booking_id,
});

// Track abandonment
await ctx.runMutation(api.conversion_funnels.abandonFunnel, {
  id: funnelId,
  drop_off_reason: "high_price",
});
```

---

### Vehicle Spec Pipeline

#### AI Enrichment Logs
**File:** `convex/ai_enrichment_logs.ts`

```typescript
// Create enrichment log
const logId = await ctx.runMutation(api.ai_enrichment_logs.create, {
  engine_id,
  service_id,
  source: "openai",
  confidence_score: 0.85,
  enriched_data: {
    labor_hours: 1.5,
    parts_cost_low: 40,
    parts_cost_high: 60,
    tech_notes: "Standard synthetic oil change",
  },
});

// Get low-confidence items
const lowConfidence = await ctx.runQuery(api.ai_enrichment_logs.getLowConfidence, {
  threshold: 0.7,
});

// Approve/reject
await ctx.runMutation(api.ai_enrichment_logs.approve, {
  id: logId,
  reviewed_by: adminUserId,
});
```

#### Manual Review Queue
**File:** `convex/manual_review_queue.ts`

```typescript
// Queue for review (internal - called by pipeline)
// This is called automatically when confidence < 0.7
await ctx.runMutation(internal.manual_review_queue.queueForManualReview, {
  engine_id,
  service_id,
  enrichment_log_id: logId,
  priority: "high",
  reason: "low_confidence",
});

// Admin queries
const pending = await ctx.runQuery(api.manual_review_queue.getPending);
const highPriority = await ctx.runQuery(api.manual_review_queue.getByPriorityAndStatus, {
  priority: "high",
  status: "pending",
});

// Assign to reviewer
await ctx.runMutation(api.manual_review_queue.assign, {
  id: queueItemId,
  assigned_to: reviewerUserId,
});

// Resolve
await ctx.runMutation(api.manual_review_queue.resolve, { id: queueItemId });
```

#### Spec Variances
**File:** `convex/spec_variances.ts`

```typescript
// Flag variance (internal - auto-called on job completion)
await ctx.runMutation(internal.spec_variances.flagSpecVariance, {
  engine_id,
  service_id,
  job_actual_id,
  predicted_labor_hours: 1.5,
  actual_labor_hours: 2.0,
  predicted_parts_cost: 50,
  actual_parts_cost: 65,
});

// Admin queries
const flagged = await ctx.runQuery(api.spec_variances.getFlagged);
const highVariance = await ctx.runQuery(api.spec_variances.getHighVariance, {
  threshold: 30, // 30% variance
});

// Add admin notes
await ctx.runMutation(api.spec_variances.addNotes, {
  id: varianceId,
  notes: "Complexity increased due to corroded drain plug",
});
```

#### Spec Confirmations
**File:** `convex/spec_confirmations.ts`

```typescript
// User confirms accuracy after service
await ctx.runMutation(api.spec_confirmations.create, {
  user_id,
  engine_id,
  service_id,
  booking_id,
  confirmed_accurate: true,
  feedback: "Price was exactly as quoted!",
});

// Query confirmations
const confirmations = await ctx.runQuery(api.spec_confirmations.getByEngineId, {
  engineId,
});
```

---

## 🔗 Integration Points

### Booking Creation Flow
**Automatically tracks:**
- ✅ Analytics event: `booking_created`
- ✅ Completes conversion funnel if `funnel_id` provided

```typescript
// In your booking UI
const createBooking = useMutation(api.bookings.create);

await createBooking({
  user_id,
  user_vehicle_id,
  shop_id,
  service_id,
  time_slot_id,
  scheduled_date,
  scheduled_time,
  labor_cost,
  parts_cost,
  total_cost,
  session_id: sessionId, // Optional for analytics correlation
  funnel_id: funnelId,   // Optional for funnel tracking
});
```

### Job Completion Flow
**Automatically creates:**
- ✅ Analytics event: `job_completed`
- ✅ Follow-up reminder (90 days for oil change, 180 for others)
- ✅ Spec variance record (if significant difference detected)

```typescript
// In mechanic job completion UI
const submitActuals = useMutation(api.job_actuals.submitJobActuals);

await submitActuals({
  bookingId,
  parts_used: [
    { part_name: "Oil Filter", oem_number: "15400-PLM-A02", cost: 12 },
    { part_name: "Synthetic Oil 5qt", oem_number: "0W-20", cost: 35 },
  ],
  actual_parts_cost: 47,
  difficulty_rating: 3,
  technician_notes: "Standard service, no issues",
});
```

---

## 🎯 Common Use Cases

### Track User Journey
```typescript
// 1. User opens booking screen
await track({
  user_id,
  event_type: "booking_started",
  event_category: "booking",
  session_id,
});

// 2. Start funnel
const funnelId = await startFunnel({
  user_id,
  funnel_type: "booking_flow",
  stage: "started",
});

// 3. Track progress
await updateStage({ id: funnelId, stage: "service_selected" });
await updateStage({ id: funnelId, stage: "shop_selected" });
await updateStage({ id: funnelId, stage: "time_selected" });

// 4. Complete booking (auto-completes funnel)
await createBooking({ ...bookingData, funnel_id: funnelId });
```

### Build Admin Dashboard
```typescript
// Pending reviews
const pendingReviews = await ctx.runQuery(api.manual_review_queue.getPending);
const flaggedVariances = await ctx.runQuery(api.spec_variances.getFlagged);
const lowConfidence = await ctx.runQuery(api.ai_enrichment_logs.getLowConfidence, {
  threshold: 0.7,
});

// Analytics overview
const bookingEvents = await ctx.runQuery(api.analytics_events.getByEventType, {
  eventType: "booking_created",
});
const completionEvents = await ctx.runQuery(api.analytics_events.getByEventType, {
  eventType: "job_completed",
});
```

### Send Reminders (Scheduled Job)
```typescript
// In a scheduled Convex function
export const sendReminders = internalMutation({
  handler: async (ctx) => {
    const due = await ctx.runQuery(internal.follow_ups.getPendingReminders, {
      beforeTimestamp: Date.now(),
    });

    for (const reminder of due) {
      // Send push notification
      await sendPushNotification(reminder.user_id, reminder.message);
      
      // Mark as sent
      await ctx.runMutation(internal.follow_ups.updateStatus, {
        id: reminder._id,
        status: "sent",
      });
    }
  },
});
```

---

## 📝 Index Reference

All tables have optimized indexes for common queries:

| Table | Indexes |
|-------|---------|
| payments | by_booking_id, by_user_id, by_status |
| follow_ups | by_user_id, by_user_vehicle_id, by_status_and_scheduled, by_booking_id |
| ai_conversations | by_user_id, by_session_id, by_booking_id |
| ai_messages | by_conversation_id, by_role |
| analytics_events | by_user_id, by_event_type, by_event_category, by_timestamp |
| conversion_funnels | by_user_id, by_funnel_type, by_booking_id, by_stage |
| ai_enrichment_logs | by_engine_id, by_review_status, by_confidence |
| manual_review_queue | by_status, by_engine_id, by_assigned_to, by_priority_and_status |
| spec_variances | by_engine_id, by_service_id, by_flagged, by_variance |
| spec_confirmations | by_engine_id, by_user_id, by_booking_id |

---

**Updated:** January 31, 2026
