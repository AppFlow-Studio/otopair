# OtoPair Implementation Checklist

**Purpose:** Track what’s done, half-implemented, and not yet implemented across the app and Convex backend.  
**See also:** [REFERENCE.md](./REFERENCE.md) (schema & API), [BOOKING_INTEGRATION.md](./BOOKING_INTEGRATION.md) (booking flow integration), [diagrams.md](./diagrams.md) (database diagrams).

---

## 1. Backend (Convex)

### Done

- [x] Schema: 46 tables; VIN-based vehicles + vehicle_owners; normalized vehicle intelligence; cdn_assets + shop_portfolio
- [x] Core: vehicles.ts, vehicle_owners.ts, bookings.ts, payments.ts, job_actuals.ts, reviews.ts, follow_ups.ts
- [x] Status history: booking_status_history.ts, payment_status_history.ts (FSM + audit log)
- [x] Vehicle intelligence: oemParts.ts, specs.ts (getFullVehicleSpecPack), fitments.ts, transmissions.ts, chassis_variants.ts
- [x] AI & analytics: ai_conversations.ts, ai_messages.ts, analytics_events.ts, conversion_funnels.ts
- [x] Spec pipeline: ai_enrichment_logs.ts, manual_review_queue.ts, spec_variances.ts, spec_confirmations.ts
- [x] Services/shops: services.ts, service_categories.ts, service_options.ts, shop_services.ts, shops.ts, mechanics.ts, shops_hours.ts, time_slots.ts, service_vehicle_specs.ts, service_insights.ts, cdn_assets.ts, shop_portfolio.ts
- [x] User/infra: users.ts (getOrCreateMe), onboarding_questions_answers only (Q&A in app; see [ONBOARDING_QA.md](./ONBOARDING_QA.md))
- [x] Catalog: makes.ts, models.ts, trims.ts, engines.ts (list/getById/getBy\*)

### Half-implemented

- [ ] **Seed/demo data** – Vehicle intelligence + catalog tables exist; seed data to unblock UI and getFullVehicleSpecPack testing is partial or missing

### Not implemented

- [ ] FSM and invariant tests (booking/payment transitions, unique job_actuals per booking)

---

## 2. Home – Finish setup card

### Done

- [x] **Step completion from Convex** – Create Account (users.onboardingCompleted), About You (users.tellUsAboutCompleted), Add Car (vehicle_owners.getActiveByUser); FinishAccountSetupCard uses api.users.getMe and api.vehicle_owners.getActiveByUser; steps grey out and persist across reloads. See REFERENCE.md § Finish setup card (home).

---

## 3. Frontend – Add vehicle flow

### Done

- [x] **VIN path** – add-vehicle.tsx → decodeVin (NHTSA) → add-vehicle-review.tsx → confirmVehicleForUser; creates vehicles, vehicle_owners; schedules AI enrichment (engine_specs, vehicle_specs, trim_specs, service_vehicle_specs). See [ADD_VEHICLE_PIPELINE.md](./ADD_VEHICLE_PIPELINE.md).
- [x] **Smartcar path** – add-vehicle-review.tsx "Connect My Car" → useSmartcar.connect → exchangeCodeAndConnect; same NHTSA + AI pipeline; stores smartcar_connections, vehicle_health_snapshots.
- [x] add-car-info UI and flow (manual VIN, trim, engine, etc.)

### Half-implemented

- [ ] **Manual add-car-info Convex wiring** – add-car-info does not call Convex (no useQuery/useMutation for api.vehicles._, api.specs._); needs vehicles.upsertVehicle, vehicles.addOwner, specs.getFullVehicleSpecPack, transmissions.listByTrimId, chassis_variants.listByTrimId

### Not implemented

- [ ] Show getFullVehicleSpecPack(vin) and confidence in UI where relevant

---

## 4. Frontend – Booking flow (components/booking)

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

### Done (Convex integration)

- [x] **Create booking** – Payment screen uses useCreateBookingConvex; calls api.bookings.createBatch when user, vin, shop, timeSlotId available (one booking per appointment with `service_ids` and aggregated cost/time); falls back to local create otherwise
- [x] **User** – useUserFromConvex (users.getMe) provides Convex userId for mutations
- [x] **Services** – useServicesFromConvex loads Convex services; useBookingStore.availableServices hydrated
- [x] **Service categories** – useServiceCategoriesFromConvex loads Convex service_categories; useBookingStore.serviceCategories / getServiceCategories(); Select Services tabs use Convex categories
- [x] **Shops/mechanics** – useShopsFromConvex, useMechanicsFromConvex hydrate useShopStore and useMechanicStore from Convex
- [x] **Time slots** – useTimeSlotsForShop in ShopBookingModal; useNextAvailabilityForShop in ShopCard and ShopDetails; Convex time_slots shown; timeSlotId set on confirm for createBatch
- [x] **Vehicle** – useVehicleOwnershipFromConvex hydrates useVehicleStore from vehicle_owners; primaryVin used for createBatch; engineId passed for car-specific pricing
- [x] **Service pricing** – (labor_rate × labor_hours) + parts; **only shop’s declared labor rate** (no default); car-specific from service_vehicle_specs when vehicle has engine_id; shop detail uses shop.labor_rate for per-service and total; display format "Oil change + x more... $80" in ShopCard and footer; prices formatted to 2 decimals
- [x] **Distance & ratings** – Distance computed from userLocation to shop (utils/geo); ratings from Convex (shops.rating, mechanics.rating); distance displayed with formatDistanceMiles (1 decimal)
- [x] **Shop detail** – ShopDetails: Convex pricing (shop.labor_rate + service defaults), Convex schedule (useNextAvailabilityForShop, slots grouped by mechanic); ShopReviewsSection uses api.reviews.getByShopId; ShopPortfolioSection uses useShopPortfolioFromConvex (cdn_assets + shop_portfolio); MechanicReviewsSection uses api.reviews.getByMechanicId

### Half-implemented

- [ ] **Payment** – PaymentMethodModal/usePaymentStore mock. Need api.payments.create (and Stripe if required) after booking
- [ ] **Funnel/analytics** – No api.conversion_funnels.\* or api.analytics_events.track in booking flow
- [ ] **Confirmation** – No Convex booking id on screen; no api.follow_ups.create after confirmation

### Not implemented

- [ ] conversion_funnels: startFunnel (flow start), updateStage (stage changes), completeFunnel (success), abandonFunnel (back/close)
- [ ] analytics_events.track for booking_started, booking_completed, payment_completed
- [ ] Confirmation: pass booking id from server to confirmation screen; optional api.follow_ups.create after confirmation (vin, service_id, scheduled_for)
- [ ] Error handling: no mechanic/vehicle/payment method; Convex/network errors with retry or cancel

---

## 5. Summary table

| Area                     | Done                                                                             | Half-implemented                  | Not implemented               |
| ------------------------ | -------------------------------------------------------------------------------- | --------------------------------- | ----------------------------- |
| **Convex schema & APIs** | Full (46 tables, vehicle intelligence, core, funnel, cdn_assets, shop_portfolio) | Seed data                         | Tests                         |
| **Add vehicle**          | VIN + Smartcar paths wired to Convex (NHTSA + AI pipeline)                       | add-car-info manual flow          | Spec pack in UI               |
| **Booking flow UI**      | Full (discovery → confirmation)                                                  | —                                 | —                             |
| **Booking → Convex**     | createBatch, services, shops, mechanics, time_slots, user, vehicle               | payments.create; funnel/analytics | —                             |
| **Confirmation**         | Success UI; Directions, Contact, Add to Calendar (shop from DB)                  | —                                 | Server booking id, follow_ups |

---

**Last updated:** February 2026. Update this file when completing items or adding new work.

- **Booking model:** One booking row per appointment (`service_ids` array, estimated_labor_minutes, aggregated costs); createBatch returns single ID. Labor/parts from shop labor rate only (no default); initial status `pending`.
- **Confirmation (Directions, Contact, Add to Calendar):** Confirmation screen fetches shop via `api.shops.getById(shopId)` (shopId from selectedMechanicSlot or mechanic). **Directions** uses `utils/linking.openMapsForAddress(fullAddress)` (Google Maps). **Contact** uses `utils/linking.openPhone(shop.phone)` (native dialer). **Add to Calendar** uses expo-calendar (permission, createEventAsync with title "Service at {shopName}", start/end from scheduledAppointment, location). Same Directions/Contact wiring in MechanicCarouselSheet and ShopPreviewContent using store shop address/phone (useShopsFromConvex maps `phone` to store Shop).
