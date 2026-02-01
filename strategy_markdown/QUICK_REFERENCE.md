# Quick Reference: Vehicle Intelligence Backend

**Last Updated:** February 1, 2026  
**Status:** Core APIs implemented; intelligence access layers pending

## Quick Start

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

## Normalized Vehicle Model (authoritative)
```
make -> model -> trim
trim -> engines | transmissions | chassis_variants
vehicle (VIN) -> trim | engine | transmission | chassis_variant
```

## Confidence Score Policy
- confidence_score (0.0-1.0) is required on every AI-populated intelligence table.
- Applies to: transmissions, chassis_variants, engine_specs, transmission_specs, trim_specs,
  engine_part_fitments, transmission_part_fitments, trim_part_fitments,
  service_vehicle_specs, ai_enrichment_logs.
- oem_parts does not use confidence_score.

---

## Implemented APIs (High-Level)
- vehicles.ts, vehicle_owners.ts
- bookings.ts, payments.ts, job_actuals.ts, reviews.ts, follow_ups.ts
- booking_status_history.ts, payment_status_history.ts
- ai_conversations.ts, ai_messages.ts
- analytics_events.ts, conversion_funnels.ts

---

## Example: Add Vehicle + Owner
```typescript
const upsertVehicle = useMutation(api.vehicles.upsertVehicle);
const addOwner = useMutation(api.vehicles.addOwner);

await upsertVehicle({ vin, trim_id, engine_id, year });
await addOwner({ vin, userId, nickname: "My Car", is_primary: true, mileage: 42000 });
```

---

## Example: Create Booking (VIN-based)
```typescript
const createBooking = useMutation(api.bookings.create);

await createBooking({
  user_id,
  vin,
  shop_id,
  service_id,
  time_slot_id,
  scheduled_date,
  scheduled_time,
  labor_cost,
  parts_cost,
  total_cost,
  session_id: sessionId,
  funnel_id: funnelId,
});
```

---

## Example: Follow-up (VIN-based)
```typescript
const followUpId = await ctx.runMutation(api.follow_ups.create, {
  user_id,
  vin,
  service_id,
  follow_up_type: "maintenance_due",
  scheduled_for: Date.now() + 90 * 24 * 60 * 60 * 1000,
  message: "Time to schedule your next oil change",
});

await ctx.runMutation(api.follow_ups.updateStatus, {
  id: followUpId,
  status: "sent",
});
```

---

## Example: Conversion Funnel Tracking
```typescript
const enterStage = useMutation(api.conversion_funnels.enterStage);
const exitStage = useMutation(api.conversion_funnels.exitStage);
const markCompleted = useMutation(api.conversion_funnels.markCompleted);

const funnelId = await enterStage({
  user_id,
  funnel_type: "booking_flow",
  stage: "service_selected",
});

await exitStage({ id: funnelId, drop_off_reason: "completed" });
await markCompleted({ id: funnelId });
```

---

## Planned Vehicle Intelligence APIs (Access Layers to Implement)
- oemParts.ts (oem_parts)
- fitments.ts (engine_part_fitments, transmission_part_fitments, trim_part_fitments)
- specs.ts (engine_specs, transmission_specs, trim_specs, plus getFullVehicleSpecPack)
- transmissions.ts (read helpers by trim)
- chassis_variants.ts (read helpers by trim)

### Intended Spec Pack Fetch (planned)
```typescript
const pack = await ctx.runQuery(api.specs.getFullVehicleSpecPack, { vin });
```

---

## Schema-Only Tables (No Access Layer Yet)
- makes, models, trims, engines
- services, service_categories, service_options, service_vehicle_specs, shop_services
- oem_parts, engine_specs, transmission_specs, trim_specs
- engine_part_fitments, transmission_part_fitments, trim_part_fitments
- transmissions, chassis_variants
- ai_enrichment_logs, manual_review_queue, spec_variances, spec_confirmations

---

**Updated:** February 1, 2026
