---
name: OtoPair Integration Session — Apr 15, 2026
description: Full context from the Apr 15 session connecting the OtoPair app end-to-end. Covers all changes made, bugs fixed, architecture decisions, and remaining gaps.
type: project
---

# OtoPair Integration Session — April 15, 2026

## Goal
Connect the OtoPair app as one cohesive experience — everything working smoothly end-to-end with a full user experience and no unnecessary UI.

## Branch
`Ahmad-dev` on `AppFlow-Studio/otopair` — pushed to GitHub.

---

## ALL CHANGES MADE (commit 1ecdda0)

### 1. Vehicle Selection Persistence
**File:** `stores/useVehicleStore.ts`
- `setVehiclesFromConvex` was resetting `selectedVehicleId` to primary vehicle on every Convex reactive query update, overwriting user's selection mid-booking
- **Fix:** Only reset selection if current selection is invalid (not in the new vehicle list)
- Added `image_url` to `ConvexVehicleOwnership` interface, set `imageSource` from it

### 2. Vehicle Images Flowing Everywhere
**Files:** `stores/useVehicleStore.ts`, `hooks/useMyBookingsWithDetails.ts`, `components/booking/ServiceBottomSheet.tsx`, `components/booking/CarSelectionCard.tsx`
- Vehicle store now sets `imageSource: { uri: image_url }` from Convex
- `useMyBookingsWithDetails` → `adaptLocalBookingToCard` now looks up vehicle by `booking.vehicleId` and extracts image URI for `makeLogoUrl`
- ServiceBottomSheet header: replaced generic Car icon with actual vehicle image
- CarSelectionCard: changed `resizeMode="cover"` to `"contain"` (images were zoomed in)

### 3. Booking Flow Fixes
**Files:** `stores/useBookingStore.ts`, `components/bookings/BookingCard.tsx`, `app/(main-tabs)/bookings/index.tsx`
- `createBooking` now uses `useVehicleStore.getState().selectedVehicleId` instead of hardcoded default
- Added `cancelBooking` method: sets status to "cancelled", updates timestamp
- BookingCard: removed year from display (shows only make+model), text wraps instead of truncating, status badge always shows (not just for upcoming)
- Cancel button shows native Alert confirmation before cancelling

### 4. BookingDetailsSheet (NEW)
**File:** `components/bookings/BookingDetailsSheet.tsx`
- 90% floating bottom sheet matching My Cars "Edit Maintenance Info" style
- Uses `Modal` + Reanimated `withTiming` (not `withSpring` — user said "way too bouncy")
- Animation: 450ms slide-up, 250ms slide-down, 400ms backdrop fade
- Ref-based API: `open(booking)` / `close()`
- Shows: status badge, services list, vehicle card with image, mechanic/shop, date/time, total cost

### 5. Booking Details Navigation
**File:** `app/(main-tabs)/bookings/index.tsx`
- "View Details" opens the BookingDetailsSheet instead of navigating to confirmation screen
- Searches both upcoming and history bookings to find the right one

### 6. Confirmation Screen Fallbacks
**File:** `app/(main-tabs)/home/mechanic/[id]/confirmation.tsx`
- Added fallback data from local Zustand bookings when booking store is reset
- Vehicle fallback via `getVehicleById`, mechanic fallback via `getMechanicsByShopId`, shop fallback from `useShopStore`

### 7. Service Scrolling Fix
**File:** `components/booking/ServiceBottomSheet.tsx`
- `enableContentPanningGesture` on `@gorhom/bottom-sheet` intercepted vertical scroll gestures
- Fix: track expanded snap state via `useAnimatedReaction`, disable content panning when at expanded snap
- Added `paddingBottom: 100` to ServiceSelectionContent scroll content for footer clearance

### 8. Resume Booking Card — Vehicle Image
**Files:** `components/home/ResumeBookingCard.tsx`, `components/home/ActionCardsCarousel.tsx`, `app/(main-tabs)/home/index.tsx`
- Added `vehicleName` and `vehicleImage` props to ResumeBookingCard
- Shows car image instead of Clock icon, vehicle name in subtitle
- Home screen reads selected vehicle from `useVehicleStore` and passes through

### 9. Health Sheet → Shop Booking Cards
**File:** `app/(main-tabs)/cars/index.tsx`
- Replaced static benefit bullets ("Health monitoring active", etc.) with real `ShopCard` components from the booking flow
- New `HealthSheetBookingCards` component builds `ShopWithMechanics` from `useMechanicStore`/`useShopStore`
- Maps maintenance items (overdue/needs_attention/due_soon) to service IDs
- Horizontally scrollable with snap-to-card behavior
- Tapping a time slot pre-selects services and navigates to booking map

### 10. Correct Vehicle Selection from All Entry Points
**Files:** `app/(main-tabs)/home/index.tsx`, `app/(main-tabs)/cars/index.tsx`
- Home: "Book Now" on maintenance cards calls `selectVehicle(vehicleId)` before navigating
- My Cars: "Book Service" selects active vehicle's VIN before navigating

### 11. Mock ID Guards
**Files:** `hooks/useNextAvailabilityPerMechanicForShop.ts`, `hooks/useCalendarAvailabilityForShop.ts`, `hooks/useTimeSlotsForShop.ts`
- Added `id.length > 10` guards to skip Convex queries when shop IDs are mock (e.g., "1", "2")
- Prevents crashes: `Failed to insert or update... does not match schema`

### 12. Nav Bar
**File:** `app/(main-tabs)/_layout.tsx`
- "Book" → "Bookings", "Profile" → "Settings", icon: `person` → `gearshape`

---

## KEY TECHNICAL PATTERNS DISCOVERED

### Mock vs Real Convex IDs
Mock IDs from Zustand stores (e.g., "1", "2") crash Convex queries expecting `v.id("shops")`. Guard pattern: `id != null && id.length > 10`.

### Vehicle Store Hydration Race
`setVehiclesFromConvex` fires on every Convex reactive update. Must preserve existing valid selection instead of resetting to primary.

### BottomSheet Gesture Conflicts
`enableContentPanningGesture` on `@gorhom/bottom-sheet` intercepts vertical scroll. Fix: disable when at expanded snap point using `useAnimatedReaction`.

### Animation Preferences
User prefers `withTiming` over `withSpring` for bottom sheets. Spring was "way too bouncy". 450ms slide-up, 250ms slide-down felt right.

### Vehicle Image Pipeline
Convex `vehicles.image_url` → `setVehiclesFromConvex` → `Vehicle.imageSource: { uri: string }` → `extractImageUri()` → `makeLogoUrl` in BookingCard. Vehicle Databases API images have white backgrounds.

---

## AI CHAT → BOOKING FLOW (already connected, no changes needed)
`handleBookNow` in `ai-chat/index.tsx` (lines 543-629):
1. Maps AI service IDs → booking store service IDs via `serviceIdMapping`
2. Calls `clearSelectedServices()` then `toggleServiceSelection()` for each
3. Falls back to default service based on scenario type
4. `selectMechanic(mechanic.id.toString())`
5. `setScheduledAppointment({ date, time, displayDate })`
6. `setBookingStage("payment", "forward")`
7. `router.push(\`/home/mechanic/${mechanic.id}/payment\`)`
Payment screen reads from Zustand stores (not Convex), so mock IDs work fine.

---

## REMAINING GAPS (from roadmap analysis)

### Priority 1 — Core
1. **Payment flow disconnected** — Stripe Connect not set up (needs Temur). Need "Pay at shop" fallback.
2. **Live Tracker tab empty** — Bookings screen has 3 tabs but Live Tracker shows nothing. Hide or add empty state.
3. **Post-car-onboarding suggestions** — Shop cards now show on health sheet, but need to verify they work with real data after car add flow.

### Priority 2 — Integration
4. **Oto AI backend (BLOCKED on Temur)** — API contract due Apr 18. Currently uses local scenario engine.
5. **Notifications** — UI exists in settings, no push backend. Hide if no backend by launch.
6. **time_slots unification** — Web portal vs mobile may use different models.

### Priority 3 — Polish
7. Mechanic detail tabs (Reviews, Portfolio, Staff) — likely empty without real shop data
8. Transactions screen — needs real payment data
9. Saved Mechanics — screen exists but "save" action may not be wired
10. Loyalty/Membership — shows "Gold tier" but points likely mock
11. Refer-a-Friend — sharing/tracking likely mock
12. Quarterly Check-in / Health Estimating — unreachable screens
13. **Coming Soon / Demo screens** — should remove before launch

---

## ROADMAP KEY DATES
- **Apr 18:** Oto AI backend endpoints ready (BLOCKED on Temur API contract)
- **Apr 24:** Full app integration + code freeze (cross-team target)
- **May 4:** Consumer app QA sign-off
- **May 14:** App Store + Play Store submission
- **June 1:** PUBLIC LAUNCH

---

## FILES MODIFIED (19 files)
```
app/(main-tabs)/_layout.tsx
app/(main-tabs)/bookings/index.tsx
app/(main-tabs)/cars/index.tsx
app/(main-tabs)/home/index.tsx
app/(main-tabs)/home/mechanic/[id]/confirmation.tsx
app/vehicle-added.tsx
components/booking/CarSelectionCard.tsx
components/booking/ServiceBottomSheet.tsx
components/booking/sheets/ServiceSelectionContent.tsx
components/bookings/BookingCard.tsx
components/bookings/BookingDetailsSheet.tsx (NEW)
components/home/ActionCardsCarousel.tsx
components/home/ResumeBookingCard.tsx
hooks/useCalendarAvailabilityForShop.ts
hooks/useMyBookingsWithDetails.ts
hooks/useNextAvailabilityPerMechanicForShop.ts
hooks/useTimeSlotsForShop.ts
stores/useBookingStore.ts
stores/useVehicleStore.ts
```
