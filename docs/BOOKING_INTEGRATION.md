# Booking Flow – Convex Integration

**Purpose:** Documents the Convex + store integration for the booking flow, search, shop details, and full end-to-end path.

**See also:** [CHECKLIST.md](./CHECKLIST.md), [REFERENCE.md](./REFERENCE.md), [diagrams.md](./diagrams.md).

---

## 1. Integration Summary (Phase 1 – Completed)

### Convex Backend Additions

| Component                                         | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **users.getMe**                                   | Returns current authenticated user (Clerk identity). Used for `userId` in booking mutations.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **bookings.createBatch**                          | Creates **one** booking per appointment (one time slot). Accepts `services` (per-service `labor_cost`, `parts_cost`, `labor_hours`); optional `taxes_and_fees`, `platform_fee`. Labor/parts come from **shop labor rate only** (no default): `labor_cost = shop.labor_rate × default_labor_hours`, `parts_cost = default_parts_estimate` per service. Stores `service_ids`; `total_cost` = labor + parts + taxes + platform fee (full amount customer pays). Initial `status: "pending"`. Marks slot unavailable once; returns single booking ID. |
| **bookings.getRecentlyBookedShopIdsByUserId**     | Returns unique shop IDs the user has booked at, ordered by most recent booking first (for "Recently booked" in booking flow search). Args: `userId`, optional `limit` (default 5).                                                                                                                                                                                                                                                                                                                                                                |
| **bookings.getRecentlyBookedMechanicIdsByUserId** | Returns unique mechanic IDs the user has booked with, ordered by most recent booking first (only bookings with `mechanic_id` set). Args: `userId`, optional `limit` (default 5).                                                                                                                                                                                                                                                                                                                                                                  |

### Hooks & Store Caching

| Hook                                       | Purpose                                                                                    | Store Hydration                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **useUserFromConvex**                      | Loads current Convex user; exposes `userId` for mutations                                  | —                                                                                            |
| **useVehicleOwnershipFromConvex**          | Loads user's vehicles from `vehicle_owners` (includes engine_id for car-specific pricing)  | `useVehicleStore`                                                                            |
| **useBookingsFromConvex**                  | Loads user's bookings                                                                      | `useBookingStore`                                                                            |
| **useServicesFromConvex**                  | Loads services catalog (default_labor_hours, default_parts_estimate)                       | `useBookingStore.availableServices`                                                          |
| **useServiceVehicleSpecsForEngine**        | Loads car-specific labor/parts from `service_vehicle_specs`                                | MechanicSelectionContent, ServiceBottomSheet footer                                          |
| **useCreateBookingConvex**                 | Calls `api.bookings.createBatch`, reads from stores, resolves time slots                   | Uses Convex reactivity for cache refresh                                                     |
| **useRecentlyBookedShopIdsFromConvex**     | Loads user's recently booked shop IDs (from Convex booking history, most recent first)     | Used by FullSearchModal, SearchSuggestions, ServiceBottomSheet for "Recently booked" section |
| **useRecentlyBookedMechanicIdsFromConvex** | Loads user's recently booked mechanic IDs (from Convex booking history, most recent first) | Same components for "Recently booked" (shops + mechanics)                                    |

### Store Updates

| Store               | New/Updated Actions                                                         |
| ------------------- | --------------------------------------------------------------------------- |
| **useVehicleStore** | `setVehiclesFromConvex` – hydrate from Convex `vehicle_owners` + `vehicles` |
| **useBookingStore** | `setBookingsFromConvex` – cache user's bookings from Convex                 |

### Flow Wiring

| Location               | Change                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------- |
| **Payment screen**     | Uses `useCreateBookingConvex` with loading state and error handling                 |
| **HydrateServices**    | Runs in home layout; ensures Convex services hydrate booking store                  |
| **HydrateBookingData** | Runs in main tabs; runs `useVehicleOwnershipFromConvex` and `useBookingsFromConvex` |

### Time Slot Resolution

| File                       | Purpose                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **utils/timeSlotUtils.ts** | Converts display times (e.g. `"9:00 AM"`) to `"HH:MM"` for Convex                                                    |
| **useCreateBookingConvex** | Resolves time slots via `time_slots.getAvailableByShopAndDateTime` when `selectedMechanicSlot.timeSlotId` is missing |

### Behaviour

1. **Convex create path** – When `userId`, `vin`, `shopId`, and `timeSlotId` (or resolvable slot) are present, the app uses `createBatch` to create **one** booking in Convex (one row per appointment, with `service_ids` and aggregated costs/time).
2. **Local fallback** – Otherwise uses existing local `createBooking` so the flow still works without Convex data.
3. **Stores as cache** – Convex data is written into stores; Convex queries keep the UI in sync.

---

## 2. Shop Detail & Choose Mechanic – Convex Integration (Completed)

### Shop Detail Screen (shop/[id])

| Component                | Data Source                                                                                 | Notes                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ShopDetails**          | useShopStore (getShopById), useBookingStore (availableServices), useNextAvailabilityForShop | Shop-specific pricing: labor_rate × default_labor_hours + default_parts_estimate; Convex time slots grouped by mechanic_id for inline "Available Mechanics & Bays" schedule |
| **ShopReviewsSection**   | api.reviews.getByShopId(shopId)                                                             | Reviews tab; rating summary + list from Convex; user name from user.first_name/last_name                                                                                    |
| **ShopPortfolioSection** | useShopPortfolioFromConvex → api.shop_portfolio.listByShopId                                | Portfolio tab; owner-uploaded photos (Convex storage) + legacy cdn_assets rows, captions, full-screen swipe viewer; empty state when shop has none (Unsplash fallback removed 2026-07-23) |
| **ShopStaffSection**     | useMechanicStore (getMechanicsByShopId), useBookingStore (availableServices)                | Staff tab; mechanics and specialties from Convex                                                                                                                            |

### Mechanic Detail Screen (mechanic/[id])

| Component                  | Data Source                             | Notes                                         |
| -------------------------- | --------------------------------------- | --------------------------------------------- |
| **MechanicReviewsSection** | api.reviews.getByMechanicId(mechanicId) | Reviews tab; Convex reviews for that mechanic |

### Service Categories & Distance

| Hook / Store                       | Purpose                                                                                                                                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **useServiceCategoriesFromConvex** | Loads api.service_categories.list; maps to ServiceCategoryItem (key + label); hydrates useBookingStore.serviceCategories                                                                                                |
| **getServiceCategories()**         | Returns Convex categories when loaded, else SERVICE_CATEGORIES constant; used by Select Services tabs, DiscoveryTabs, TopBar                                                                                            |
| **Distance**                       | User location from useBookingStore.userLocation; shop coords from useShopStore (Convex lat/lng); calculateDistanceMiles in MechanicSelectionContent and shop detail header; display via formatDistanceMiles (1 decimal) |
| **Ratings**                        | From Convex: shops.rating, mechanics.rating; displayed in ShopCard, MechanicCard, headers                                                                                                                               |

---

## 3. Remaining Integration – Search, Modals

### Target Components

| Component                                | Data Source (Current)                                                                                                                                 | Target (Convex)                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Search bar / FullSearchModal**         | useShopStore, useMechanicStore; **recently booked:** useRecentlyBookedShopIdsFromConvex + useSearchStore (merge: Convex first, then in-memory recent) | Convex (hydrated via useShopsFromConvex, useMechanicsFromConvex) |
| **SearchSuggestions**                    | Same                                                                                                                                                  | Same                                                             |
| **ServiceBottomSheet**                   | Same                                                                                                                                                  | Same                                                             |
| **ShopBookingModal / AvailabilityModal** | useTimeSlotsForShop, useNextAvailabilityForShop                                                                                                       | Convex time_slots (implemented)                                  |
| **MechanicSelectionContent**             | useShopStore, useMechanicStore, userLocation for distance                                                                                             | Convex + computed distance                                       |

### Convex Hooks (Implemented)

| Hook                                       | Convex API                                                                                          | Store / Usage                                                                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **useShopsFromConvex**                     | `shops.list`, `shop_services.list`                                                                  | useShopStore                                                                                                                         |
| **useMechanicsFromConvex**                 | `mechanics.list`                                                                                    | useMechanicStore                                                                                                                     |
| **useServiceCategoriesFromConvex**         | `service_categories.list`                                                                           | useBookingStore.serviceCategories; getServiceCategories() for tabs                                                                   |
| **useTimeSlotsForShop**                    | `time_slots.getByShopAndDate` (when shop + date selected)                                           | ShopBookingModal; sets selectedMechanicSlot.timeSlotId                                                                               |
| **useNextAvailabilityForShop**             | `time_slots.getNextAvailableByShop` (shop + optional mechanic)                                      | ShopCard "Next Availability"; ShopDetails inline schedule (slots grouped by mechanic_id)                                             |
| **useShopPortfolioFromConvex**             | `shop_portfolio.listByShopId` (pre-sorted items; storage or cdn_assets URLs + captions)             | ShopPortfolioSection                                                                                                                 |
| **useRecentlyBookedShopIdsFromConvex**     | `bookings.getRecentlyBookedShopIdsByUserId` (user's unique shop IDs by most recent booking)         | FullSearchModal, SearchSuggestions, ServiceBottomSheet — "Recently booked" section (shops; Convex first, then useSearchStore recent) |
| **useRecentlyBookedMechanicIdsFromConvex** | `bookings.getRecentlyBookedMechanicIdsByUserId` (user's unique mechanic IDs by most recent booking) | Same — "Recently booked" section (mechanics; shown even while searching)                                                             |

**Recently booked (booking flow search):** The "Recently booked" section shows **even while searching** (not only when the query is empty). It includes **shops and mechanics**: (1) Shops from Convex (`getRecentlyBookedShopIdsByUserId`) first, then in-memory recent shops from `useSearchStore`; (2) Mechanics from Convex (`getRecentlyBookedMechanicIdsByUserId`). Up to 3 shops and 3 mechanics are shown. Shops use MapPin icon and optional remove (X); mechanics use User icon and "Available" badge when applicable.

**Next Availability & mechanic schedules (Choose Mechanic):** ShopCard uses `useNextAvailabilityForShop(shopId, mechanicId)` so "Next Availability" shows real Convex time slots. When "Any" is selected, slots are shop-level; when a mechanic is selected, slots are filtered to that mechanic. Selecting a slot sets `selectedMechanicSlot.timeSlotId`, `scheduledDate`, and `scheduledTime` for Convex booking.

### Service Pricing (Choose Mechanic & Footer)

| Hook / Source                       | Purpose                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **useServiceVehicleSpecsForEngine** | Fetches car-specific (engine-specific) labor/parts from `service_vehicle_specs` for selected vehicle + services |
| **useShopsFromConvex**              | Provides `labor_rate` per shop for per-shop pricing                                                             |
| **useServicesFromConvex**           | Provides `default_labor_hours`, `default_parts_estimate` (from first `service_options`) as fallback             |

**Price formula:** `(shop.labor_rate × labor_hours) + parts` per service, summed. **Only the shop’s declared labor rate is used; there is no default labor rate.** In the UI, `laborRate = shop?.labor_rate` (no fallback in the declaration); a fallback is applied only at calculation sites where a number is required for arithmetic.

- **Car-specific:** When selected vehicle has `engine_id` (from Convex), `service_vehicle_specs.getSpecsForEngineAndServices` returns `labor_hours` and `parts_cost_avg` per service.
- **Fallback:** When no engine-specific spec exists, uses `services.default_labor_hours` and `service_options.parts_cost` (average of first option).
- **Display format:** `Oil change + x more... $80` (service names first, price last) in ShopCard and footer "Book $X".

**Vehicle → engine_id:** `useVehicleOwnershipFromConvex` hydrates `useVehicleStore` with `engineId` from Convex `vehicles.engine_id` when present.

### Data Mapping

**Convex Shop → Store Shop**

- `_id` → `id` (as string)
- `address` + `city` + `state` + `zip` → `address`
- `phone` → `phone` (for Contact / tel: link; used on confirmation and shop carousel cards)
- `lat`, `lng` → `latitude`, `longitude`
- `rating`, `review_count` → `rating`
- `serviceIds` from `shop_services.getByShopId`
- `hasAvailableSlots`, `nextAvailableSlot` from `time_slots` (optional)

**Convex Mechanic → Store Mechanic**

- `_id` → `id` (as string)
- `shop_id` → `shopId`
- `first_name` + `last_name` → `name`
- Shop name from shops lookup → `shopName`
- **`photoUrl`** – resolved from `mechanic.photo` → cdn_assets.url (list/getById/getByShopId); used for Live Tracker and booking cards

**Convex Shop → Store Shop (pricing)**

- `labor_rate` → `labor_rate` (for price formula: labor_rate × time + parts)

**Convex Vehicle → Store Vehicle (pricing)**

- `vehicle.engine_id` → `engineId` (for car-specific `service_vehicle_specs` lookup)

### Integration Points

1. **Home layout / main tabs** – Run `useServicesFromConvex`, `useServiceCategoriesFromConvex`, `useShopsFromConvex`, and `useMechanicsFromConvex` when home tab is active (app/(main-tabs)/home/\_layout.tsx).
2. **Availability flow** – When user selects shop + date + time, fetch `time_slots.getByShopAndDate`, resolve `timeSlotId`, and set `selectedMechanicSlot.timeSlotId` before payment.
3. **Search** – FullSearchModal, SearchSuggestions, ServiceBottomSheet use `useShopStore` and `useMechanicStore`; hydrating these stores from Convex automatically feeds the search. "Recently booked" (shops + mechanics) is shown **even while searching**, backed by `useRecentlyBookedShopIdsFromConvex` and `useRecentlyBookedMechanicIdsFromConvex` (Convex booking history) plus `useSearchStore` (in-memory recent shops); Convex list is shown first, then in-memory recent.
4. **Shop detail** – Shop details pricing uses `getShopById(shopId).labor_rate`; schedule uses `useNextAvailabilityForShop(shopId)` grouped by mechanic; reviews use `api.reviews.getByShopId`; portfolio uses `api.shop_portfolio.listByShopId` (cdn_assets).

---

## 4. My Bookings & Live Tracker

### Data source

| Screen / Tab     | Hook / API                   | Data                                                                                                                               |
| ---------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **My Bookings**  | **useMyBookingsWithDetails** | Splits `api.bookings.getByUserIdWithDetails(userId)` into `liveTracking`, `upcomingBookings`, `historyBookings` by status and date |
| **Live Tracker** | Same                         | First in_progress booking → LiveTrackerCard; uses **live_stage**, progressPercent, currentStage, stages                            |
| **Upcoming**     | Same                         | Bookings that are not completed/cancelled and not in_progress, with scheduled_date ≥ today                                         |
| **History**      | Same                         | Bookings with status completed/cancelled or scheduled_date &lt; today; search/filter by query                                      |

### Stored Live Tracker stage

- **`bookings.live_stage`** (optional): When `status === "in_progress"`, one of `"booking_confirmed"` | `"service_in_progress"` | `"vehicle_ready"`. Set by `updateStatus(..., "in_progress")` to `"service_in_progress"`; cleared when status becomes completed/cancelled/no_show.
- **`bookings.updateLiveStage(bookingId, liveStage)`** – mechanic/shop can advance the stage (e.g. to `"vehicle_ready"`). Only allowed when booking is in_progress.

### Query and adapter

- **getByUserIdWithDetails** returns per booking: shopName, shopPhone, mechanicName, **mechanicImageUrl** (mechanic.photo → cdn_assets), vehicleDisplay, licensePlate, makeLogoUrl, serviceNames; for in_progress: **liveStage**, **currentStage** (display title), **progressPercent** (from job_actuals elapsed time or stage-based fallback), delayMinutes.
- **utils/bookingAdapter.ts**: **stagesFromLiveStage(liveStage, progressPercent)** builds the four UI stages (Booking Confirmed → Service in Progress → Your vehicle is ready → Service Completed) with completed/current/pending from stored `live_stage`; fallback to progress-based heuristic when liveStage is missing. **adaptConvexBookingWithDetailsToLiveTracking(row)** uses row.liveStage and row.progressPercent for LiveTrackerCard.

### Seed (demo data)

- **seed:seedPastBookingsForJohnDoe** – creates 4 completed (past) bookings for user with clerkUserId `user_38uSI8ArZJ0HMY9AwvQLOZiIo53` so the History tab shows data. Run: `npx convex run seed:seedPastBookingsForJohnDoe`.
- **seed:seedLiveBookingForJohnDoe** – creates one in_progress booking with `live_stage: "service_in_progress"` and job_actuals so the Live Tracker tab shows data. Run: `npx convex run seed:seedLiveBookingForJohnDoe`.

### Booking completion → OTOPAIR Rewards

When a booking reaches `status: "completed"` (via `bookings.updateStatus` or `job_actuals.submitJobActuals`), the scheduler runs `internal.rewards.addCreditForCompletedBooking(bookingId)`. This awards Ownership Credit to the user's wallet (1% / 1.5% / 2% by vehicle tier), updates `vehicle_tiers` with 12‑month spend and new tier if thresholds ($750 Preferred, $1,500 Elite) are crossed. See [REWARDS.md](./REWARDS.md).

---

## 5. Full Booking Flow (End-to-End)

```
Discovery (map/home)
  → Search / Service selection (SearchBar, FullSearchModal, ServiceBottomSheet)
  → Shop selection (carousel, search results)
  → Shop detail (shop/[id])
  → Mechanic selection (MechanicSelectionContent, ShopCard)
  → Availability (ShopBookingModal, AvailabilityModal) ← time_slots needed here
  → Booking details
  → Payment (createBookingConvex)
  → Confirmation
```

### Convex Data Dependencies

| Stage        | Required Convex Data                                         |
| ------------ | ------------------------------------------------------------ |
| Discovery    | shops, mechanics (for carousel, search)                      |
| Shop detail  | shop by id, mechanics by shop_id                             |
| Availability | time_slots by shop_id + date (and optional mechanic_id)      |
| Payment      | user (getMe), vehicle (vin), shop_id, time_slot_id, services |

### Time slots: per-mechanic (per-bay) in Convex

The `time_slots` table supports **one slot per mechanic per (shop, date, time)**. Each mechanic is treated as an individual bay with their own calendar:

- **Schema:** `time_slots.mechanic_id` (optional) ties a row to a mechanic. Same (shop, date, start_time) can appear multiple times with different `mechanic_id` (e.g. Mike 8:00 AM and Sarah 8:00 AM).
- **Index:** `by_mechanic_id` supports queries like “next N slots for this mechanic.”
- **Seed:** `seed` and `seedTimeSlots` create slots with `mechanic_id` set so every slot is assigned to a mechanic (per-bay). Run `seedTimeSlots` after adding mechanics to regenerate slots for all active mechanics.

---

## 5. Confirm Appointment – Convex Insert & Tables

When the user taps **"Confirm Appointment"** on the payment screen, the app inserts a real appointment into Convex and updates related tables.

### Trigger

| Location                                                              | Action                                                                                                                        |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Payment screen** (`app/(main-tabs)/home/mechanic/[id]/payment.tsx`) | User taps "Confirm Appointment" → calls `createBookingConvex(selectedMechanicId, bookingType)` from `useCreateBookingConvex`. |

### Resolving shopId and timeSlotId

| Source         | How it's resolved                                                                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **shopId**     | `selectedMechanicSlot?.shopId` **or** `getMechanicById(selectedMechanicId)?.shopId`. Works when coming from the Book Appointment modal (slot set there) or from Shop Details inline "Book Now" (slot set in ShopDetails).            |
| **timeSlotId** | `selectedMechanicSlot?.timeSlotId` **or** Convex `time_slots.getAvailableByShopAndDateTime(shopId, date, startTime)`; when a mechanic is selected, the hook picks the slot whose `mechanic_id` matches so the correct bay is booked. |

### When Convex insert runs

- **Required:** `userId` (Convex user), `vin` (owned vehicle), `shopId`, `timeSlotId`, at least one selected service.
- **Missing any of the above:** Fallback to local-only `createBooking` (no Convex insert).

### Convex mutation: `bookings.createBatch`

| Step              | Effect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Validate       | Vehicle exists; user has active ownership in `vehicle_owners`; time slot exists and `is_available === true`.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2. Reserve slot   | Patch `time_slots` for the chosen `time_slot_id`: `is_available: false` (once per appointment).                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 3. Insert booking | **One** row in **bookings** (one appointment = one row): `user_id`, `vin`, `shop_id`, `mechanic_id`, `time_slot_id`, `scheduled_date`, `scheduled_time`, `service_ids` (array of service IDs), aggregated `labor_cost`, `parts_cost`, `total_cost` (= labor + parts + taxes_and_fees + platform_fee; full amount customer pays), `estimated_labor_minutes`, `status: "pending"`. Labor/parts are from **shop labor rate only** (hook sends per-service `labor_cost` = shop.labor_rate × default_labor_hours, `parts_cost` = default_parts_estimate; no default rate). |
| 4. Status history | One row in **booking_status_history**: `booking_id`, `new_status: "pending"`, `changed_at`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 5. Analytics      | One row in **analytics_events**: `event_type: "booking_created"`, `event_category: "booking"`, `booking_id`, `shop_id`, `service_id` (first service from `service_ids`, for event payload).                                                                                                                                                                                                                                                                                                                                                                           |
| 6. Optional       | If `funnel_id` is passed, complete the conversion funnel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### Tables populated on Confirm Appointment

| Table                      | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **bookings**               | **One** record per appointment: `user_id`, `vin`, `shop_id`, `mechanic_id`, `time_slot_id`, `scheduled_date`, `scheduled_time`, `service_ids` (array of service IDs), `labor_cost` (total), `parts_cost` (total), `total_cost` (labor + parts + taxes & fees + platform fee; matches Review & Pay Total), `estimated_labor_minutes`, `status: "pending"`. Labor/parts derived only from shop’s labor rate and service defaults (no default labor rate). |
| **time_slots**             | The chosen slot's row is patched: `is_available: false`.                                                                                                                                                                                                                                                                                                                                                                                                |
| **booking_status_history** | One row: `booking_id`, `new_status: "pending"`, `changed_at`.                                                                                                                                                                                                                                                                                                                                                                                           |
| **analytics_events**       | One row: `booking_created` with `booking_id`, `shop_id`, `service_id` (first service from booking’s `service_ids`).                                                                                                                                                                                                                                                                                                                                     |

### Flow coverage

- **From Book Appointment modal:** Modal sets `selectedMechanicSlot` (shopId, timeSlotId, scheduledDate, scheduledTime) on "Continue" → payment has everything for Convex insert.
- **From Shop Details inline "Book Now":** ShopDetails sets `selectedMechanicSlot` (shopId, shopName, mechanicId, slot, scheduledDate, scheduledTime) and `scheduledAppointment` when user taps "Book Now" on an inline slot → payment resolves `timeSlotId` via `getAvailableByShopAndDateTime` filtered by mechanic.

---

## 5.5. Confirmation screen – Directions, Contact, Add to Calendar

After a successful booking, the confirmation screen (`app/(main-tabs)/home/mechanic/[id]/confirmation.tsx`) uses **shop data from the DB** for post-booking actions.

### Data source

| Data             | Source                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Shop**         | `useQuery(api.shops.getById, { id: shopId })` where `shopId` = `selectedMechanicSlot?.shopId` or `mechanic?.shopId` |
| **Full address** | `[shop.address, shop.city, shop.state, shop.zip].join(", ")` for display and maps                                   |
| **LOCATION**     | Full address when shop is loaded; fallback to mechanic name or "Shop Location"                                      |

### Directions

- **Implementation:** `utils/linking.openMapsForAddress(fullAddress)`.
- **Behaviour:** Opens Google Maps (or default maps app) with destination = shop address. Uses `expo-linking`; URL: `https://www.google.com/maps/dir/?api=1&destination=...`.
- **UI:** "Directions" button disabled when no address.

### Contact

- **Implementation:** `utils/linking.openPhone(shop.phone)`.
- **Behaviour:** Opens native dialer with shop phone (`tel:` URL). User can then place the call.
- **UI:** "Contact" button disabled when no shop phone.

### Add to Calendar

- **Implementation:** `expo-calendar` – request permission, get writable calendar, `Calendar.createEventAsync(calendarId, { title, startDate, endDate, location })`.
- **Title:** `Service at {shop.name ?? mechanic.shopName}`.
- **Start/end:** Parsed from `scheduledAppointment.date` (YYYY-MM-DD) and `scheduledAppointment.time` (e.g. "2:00 PM"); end = start + 1 hour.
- **Location:** Full shop address when available.
- **Platform:** Not supported on web (alert shown); iOS/Android use native calendar.

### Carousel components (Directions / Contact)

- **MechanicCarouselSheet** and **ShopPreviewContent** use the same behaviour for each shop card: `onDirections` → `openMapsForAddress(shop.address)`, `onCall` → `openPhone(shop.phone)` when `shop.phone` is set. Store `Shop` type includes `phone`; `useShopsFromConvex` maps Convex `shop.phone` into the store.

---

## 6. Clerk guest account (.env.local) ↔ seed data

The app uses the **Clerk account defined in `.env.local`** (e.g. `EXPO_PUBLIC_GUEST_EMAIL` / `EXPO_PUBLIC_GUEST_PASSWORD`) as the test account. To have that account see vehicles, bookings, and other seed data:

1. **Run the seed** so a demo user and data exist:
   - Full: `npx convex run seed:seed` then `npx convex run seed:seedAll` (or your usual seed flow).
   - User+vehicle only: `npx convex run seed:seedUserAndVehicle`.
2. **Sign in** with the guest account (e.g. use the “Sign in” flow with the email/password from `.env.local`).

On sign-in, `claimSeedDataForCurrentUser` runs automatically: it reassigns the seed demo user’s data (vehicles, bookings, reviews, etc.) to your signed-in user and removes the placeholder seed user. The guest account then sees all seed data. The mutation is idempotent (safe to run again; if you already have data, it no-ops).

---

**Last updated:** February 2026.

---

### Doc history

- **Recently booked (shops + mechanics, while searching):** February 2026 – "Recently booked" shows shops and mechanics from Convex (`getRecentlyBookedShopIdsByUserId`, `getRecentlyBookedMechanicIdsByUserId`) plus in-memory recent shops; section is visible **even while searching**. FullSearchModal, SearchSuggestions, ServiceBottomSheet updated.
- **Recently booked shops:** February 2026 – Booking flow search shows "Recently booked" from Convex via `bookings.getRecentlyBookedShopIdsByUserId` and `useRecentlyBookedShopIdsFromConvex`; merged with in-memory recent from useSearchStore (Convex first, then in-memory).
- **Labor rate:** Only the shop’s declared `labor_rate` is used for pricing and for createBatch; no default labor rate. In the UI, `laborRate = shop?.labor_rate` (fallback only at calculation sites where a number is required). useCreateBookingConvex throws if shop or labor_rate is missing when creating a booking. Per-service costs sent to createBatch: `labor_cost = shop.labor_rate × default_labor_hours`, `parts_cost = default_parts_estimate` (no ratio).
- **total_cost includes taxes & service fee:** `total_cost` in DB = labor + parts + taxes_and_fees + platform_fee (full amount customer pays). Review & Pay screen Total = subtotal + Taxes & Fees + Otopair Service Fee to match. createBatch accepts optional `taxes_and_fees`, `platform_fee`; hook computes service fee as 7% of service subtotal (min $4.99, no cap). Waived for Preferred/Elite subscribers (not yet implemented).
- **One booking per appointment:** February 2026 – `createBatch` now creates **one** booking row per appointment (not N rows per N services). Bookings table has `service_ids` array, `estimated_labor_minutes`, and aggregated `labor_cost`/`parts_cost`/`total_cost`. One time slot per appointment; no double-booking conflict. `service_id` column removed; use `service_ids` only. Initial booking status is **pending** (shop can accept); booking_status_history logs `new_status: "pending"`.
- **Section 5 (Confirm Appointment):** Added February 2026 – documents Convex insert on "Confirm Appointment", shopId/timeSlotId resolution, `createBatch` side effects, and tables populated (bookings, time_slots, booking_status_history, analytics_events).
- **Section 5.5 (Confirmation – Directions, Contact, Add to Calendar):** February 2026 – confirmation screen fetches shop via `api.shops.getById`; Directions (openMapsForAddress), Contact (openPhone), Add to Calendar (expo-calendar) use shop address/phone/name and scheduledAppointment from DB. Store Shop type and useShopsFromConvex include `phone` for carousel Contact.
