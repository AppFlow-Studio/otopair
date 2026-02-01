# OtoPair Implementation Checklist

**Purpose:** Track what’s done, half-implemented, and not yet implemented across the app and Convex backend.  
**See also:** [REFERENCE.md](./REFERENCE.md) (schema & API), [diagrams.md](./diagrams.md) (database diagrams).

---

## 1. Backend (Convex)

### Done
- [x] Schema: 44 tables; VIN-based vehicles + vehicle_owners; normalized vehicle intelligence
- [x] Core: vehicles.ts, vehicle_owners.ts, bookings.ts, payments.ts, job_actuals.ts, reviews.ts, follow_ups.ts
- [x] Status history: booking_status_history.ts, payment_status_history.ts (FSM + audit log)
- [x] Vehicle intelligence: oemParts.ts, specs.ts (getFullVehicleSpecPack), fitments.ts, transmissions.ts, chassis_variants.ts
- [x] AI & analytics: ai_conversations.ts, ai_messages.ts, analytics_events.ts, conversion_funnels.ts
- [x] Spec pipeline: ai_enrichment_logs.ts, manual_review_queue.ts, spec_variances.ts, spec_confirmations.ts
- [x] Services/shops: services.ts, service_categories.ts, service_options.ts, shop_services.ts, shops.ts, mechanics.ts, shops_hours.ts, time_slots.ts, service_vehicle_specs.ts, service_insights.ts
- [x] User/infra: users.ts (getOrCreateMe), onboarding_questions, onboarding_question_answers, user_question_answers
- [x] Catalog: makes.ts, models.ts, trims.ts, engines.ts (list/getById/getBy*)

### Half-implemented
- [ ] **Seed/demo data** – Vehicle intelligence + catalog tables exist; seed data to unblock UI and getFullVehicleSpecPack testing is partial or missing
- [ ] **Legacy files** – user_vehicles.ts, vehicle_specs.ts exist but are deprecated (use vehicles + vehicle_owners and specs/fitments)

### Not implemented
- [ ] Migration from deprecated vehicle_specs if legacy data exists
- [ ] FSM and invariant tests (booking/payment transitions, unique job_actuals per booking)

---

## 2. Frontend – Add vehicle flow

### Done
- [x] add-car-info UI and flow (VIN, trim, engine, etc.)

### Half-implemented
- [ ] **Convex wiring** – add-car-info does not call Convex (no useQuery/useMutation for api.vehicles.*, api.specs.*); needs vehicles.upsertVehicle, vehicles.addOwner, specs.getFullVehicleSpecPack, transmissions.listByTrimId, chassis_variants.listByTrimId

### Not implemented
- [ ] Wire add-car flow to Convex (vehicles, vehicle_owners, specs, transmissions, chassis_variants)
- [ ] Show getFullVehicleSpecPack(vin) and confidence in UI where relevant

---

## 3. Frontend – Booking flow (components/booking)

**Scope:** `components/booking/` and app routes: home map, shop/[id], mechanic/[id], booking-details, payment, confirmation.

### Done (UI and flow)
- [x] Discovery (map/home, search, shop carousel)
- [x] Service selection (ServiceSelectionContent, ServiceBottomSheet, categories, services)
- [x] Mechanic selection (MechanicSelectionContent, shop/mechanic cards)
- [x] Booking details (BookingDetailsContent: mechanic, services, add/remove, date/time, availability slots)
- [x] Payment / Review & Pay (ReviewPayContent: mechanic, vehicle, services breakdown, payment options)
- [x] Confirmation screen (success, date/time/vehicle/mechanic, Directions/Contact, Add to Calendar, Back to Home)
- [x] FullScreenBookingView, ServiceBottomSheet, ShopBookingModal, footers, modals, shared components
- [x] useBookingStore with createBooking (local only; writes to store, no Convex)

### Half-implemented
- [ ] **Create booking** – Payment screen calls useBookingStore.createBooking() (local only). Needs api.bookings.create with user_id, vin, shop_id, service_id, time_slot_id, scheduled_date, scheduled_time, labor_cost, parts_cost, total_cost
- [ ] **User/vehicle** – Store uses "current_user_id" and "default_vehicle_id". Needs real Clerk user id and selected vehicle VIN for Convex
- [ ] **Services** – availableServices is MOCK_SERVICES. Needs Convex services (api.services.*) and map to Convex service_id
- [ ] **Shops/mechanics** – useShopStore, useMechanicStore are mock. Need Convex shops, mechanics for map and booking
- [ ] **Time slots** – Mock slots in ShopBookingModal/BookingDetailsContent. Need Convex time_slots and time_slot_id for bookings.create
- [ ] **Vehicle** – getSelectedVehicle() is mock. Need real vehicle with VIN for api.bookings.create
- [ ] **Payment** – PaymentMethodModal/usePaymentStore mock. Need api.payments.create (and Stripe if required) after booking
- [ ] **Funnel/analytics** – No api.conversion_funnels.* or api.analytics_events.track in booking flow
- [ ] **Confirmation** – No Convex booking id; Directions/Contact are placeholders; no api.follow_ups.create

### Not implemented
- [ ] Call api.bookings.create from payment/confirm with user_id, vin, shop_id, service_id, time_slot_id, dates, costs; handle loading/errors
- [ ] Call api.payments.create after booking; api.payments.updateStatus when payment completes/fails
- [ ] Load services from Convex; replace MOCK_SERVICES; use Convex service ids in booking
- [ ] Load shops and mechanics from Convex for map and detail; use Convex ids in navigation and create
- [ ] Load time_slots from Convex; resolve selected date/time to time_slot_id for create
- [ ] Resolve current user (e.g. users.getOrCreateMe) and selected vehicle VIN; pass to create
- [ ] conversion_funnels: startFunnel (flow start), updateStage (stage changes), completeFunnel (success), abandonFunnel (back/close)
- [ ] analytics_events.track for booking_started, booking_completed, payment_completed
- [ ] Confirmation: pass booking id from server; wire Directions (shop address), Contact (shop/mechanic); implement Add to Calendar
- [ ] Optional: api.follow_ups.create after confirmation (vin, service_id, scheduled_for)
- [ ] Error handling: no mechanic/vehicle/payment method; Convex/network errors with retry or cancel

---

## 4. Summary table

| Area | Done | Half-implemented | Not implemented |
|------|------|------------------|------------------|
| **Convex schema & APIs** | Full (44 tables, vehicle intelligence, core, funnel) | Seed data; legacy files | Migration; tests |
| **Add vehicle** | UI | — | Wire to Convex; spec pack in UI |
| **Booking flow UI** | Full (discovery → confirmation) | — | — |
| **Booking → Convex** | — | Local createBooking only | bookings.create, payments.create, services/shops/mechanics/time_slots, funnel, analytics |
| **Confirmation** | Success UI | — | Server booking id, Directions, Contact, Calendar, follow_ups |

---

**Last updated:** February 2026. Update this file when completing items or adding new work.
