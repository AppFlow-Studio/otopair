# Booking Flow – Convex Integration

**Purpose:** Documents the Convex + store integration for the booking flow, search, shop details, and full end-to-end path.

**See also:** [CHECKLIST.md](./CHECKLIST.md), [REFERENCE.md](./REFERENCE.md), [diagrams.md](./diagrams.md).

---

## 1. Integration Summary (Phase 1 – Completed)

### Convex Backend Additions

| Component | Description |
|-----------|-------------|
| **users.getMe** | Returns current authenticated user (Clerk identity). Used for `userId` in booking mutations. |
| **bookings.createBatch** | Creates multiple service bookings for the same time slot (e.g. Oil Change + Tire Rotation). Marks slot unavailable once, inserts N booking records. |

### Hooks & Store Caching

| Hook | Purpose | Store Hydration |
|------|---------|-----------------|
| **useUserFromConvex** | Loads current Convex user; exposes `userId` for mutations | — |
| **useVehicleOwnershipFromConvex** | Loads user's vehicles from `vehicle_owners` (includes engine_id for car-specific pricing) | `useVehicleStore` |
| **useBookingsFromConvex** | Loads user's bookings | `useBookingStore` |
| **useServicesFromConvex** | Loads services catalog (default_labor_hours, default_parts_estimate) | `useBookingStore.availableServices` |
| **useServiceVehicleSpecsForEngine** | Loads car-specific labor/parts from `service_vehicle_specs` | MechanicSelectionContent, ServiceBottomSheet footer |
| **useCreateBookingConvex** | Calls `api.bookings.createBatch`, reads from stores, resolves time slots | Uses Convex reactivity for cache refresh |

### Store Updates

| Store | New/Updated Actions |
|-------|---------------------|
| **useVehicleStore** | `setVehiclesFromConvex` – hydrate from Convex `vehicle_owners` + `vehicles` |
| **useBookingStore** | `setBookingsFromConvex` – cache user's bookings from Convex |

### Flow Wiring

| Location | Change |
|----------|--------|
| **Payment screen** | Uses `useCreateBookingConvex` with loading state and error handling |
| **HydrateServices** | Runs in home layout; ensures Convex services hydrate booking store |
| **HydrateBookingData** | Runs in main tabs; runs `useVehicleOwnershipFromConvex` and `useBookingsFromConvex` |

### Time Slot Resolution

| File | Purpose |
|------|---------|
| **utils/timeSlotUtils.ts** | Converts display times (e.g. `"9:00 AM"`) to `"HH:MM"` for Convex |
| **useCreateBookingConvex** | Resolves time slots via `time_slots.getAvailableByShopAndDateTime` when `selectedMechanicSlot.timeSlotId` is missing |

### Behaviour

1. **Convex create path** – When `userId`, `vin`, `shopId`, and `timeSlotId` (or resolvable slot) are present, the app uses `createBatch` to create bookings in Convex.
2. **Local fallback** – Otherwise uses existing local `createBooking` so the flow still works without Convex data.
3. **Stores as cache** – Convex data is written into stores; Convex queries keep the UI in sync.

---

## 2. Shop Detail & Choose Mechanic – Convex Integration (Completed)

### Shop Detail Screen (shop/[id])

| Component | Data Source | Notes |
|-----------|-------------|--------|
| **ShopDetails** | useShopStore (getShopById), useBookingStore (availableServices), useNextAvailabilityForShop | Shop-specific pricing: labor_rate × default_labor_hours + default_parts_estimate; Convex time slots grouped by mechanic_id for inline "Available Mechanics & Bays" schedule |
| **ShopReviewsSection** | api.reviews.getByShopId(shopId) | Reviews tab; rating summary + list from Convex; user name from user.first_name/last_name |
| **ShopPortfolioSection** | useShopPortfolioFromConvex → api.shop_portfolio.listByShopId | Portfolio tab; images from cdn_assets via shop_portfolio; fallback default images when empty |
| **ShopStaffSection** | useMechanicStore (getMechanicsByShopId), useBookingStore (availableServices) | Staff tab; mechanics and specialties from Convex |

### Mechanic Detail Screen (mechanic/[id])

| Component | Data Source | Notes |
|-----------|-------------|--------|
| **MechanicReviewsSection** | api.reviews.getByMechanicId(mechanicId) | Reviews tab; Convex reviews for that mechanic |

### Service Categories & Distance

| Hook / Store | Purpose |
|--------------|---------|
| **useServiceCategoriesFromConvex** | Loads api.service_categories.list; maps to ServiceCategoryItem (key + label); hydrates useBookingStore.serviceCategories |
| **getServiceCategories()** | Returns Convex categories when loaded, else SERVICE_CATEGORIES constant; used by Select Services tabs, DiscoveryTabs, TopBar |
| **Distance** | User location from useBookingStore.userLocation; shop coords from useShopStore (Convex lat/lng); calculateDistanceMiles in MechanicSelectionContent and shop detail header; display via formatDistanceMiles (1 decimal) |
| **Ratings** | From Convex: shops.rating, mechanics.rating; displayed in ShopCard, MechanicCard, headers |

---

## 3. Remaining Integration – Search, Modals

### Target Components

| Component | Data Source (Current) | Target (Convex) |
|-----------|------------------------|-----------------|
| **Search bar / FullSearchModal** | useShopStore, useMechanicStore | Convex (hydrated via useShopsFromConvex, useMechanicsFromConvex) |
| **SearchSuggestions** | Same | Same |
| **ServiceBottomSheet** | Same | Same |
| **ShopBookingModal / AvailabilityModal** | useTimeSlotsForShop, useNextAvailabilityForShop | Convex time_slots (implemented) |
| **MechanicSelectionContent** | useShopStore, useMechanicStore, userLocation for distance | Convex + computed distance |

### Convex Hooks (Implemented)

| Hook | Convex API | Store / Usage |
|------|------------|----------------|
| **useShopsFromConvex** | `shops.list`, `shop_services.list` | useShopStore |
| **useMechanicsFromConvex** | `mechanics.list` | useMechanicStore |
| **useServiceCategoriesFromConvex** | `service_categories.list` | useBookingStore.serviceCategories; getServiceCategories() for tabs |
| **useTimeSlotsForShop** | `time_slots.getByShopAndDate` (when shop + date selected) | ShopBookingModal; sets selectedMechanicSlot.timeSlotId |
| **useNextAvailabilityForShop** | `time_slots.getNextAvailableByShop` (shop + optional mechanic) | ShopCard "Next Availability"; ShopDetails inline schedule (slots grouped by mechanic_id) |
| **useShopPortfolioFromConvex** | `shop_portfolio.listByShopId` (returns items with cdn_assets URLs) | ShopPortfolioSection |

**Next Availability & mechanic schedules (Choose Mechanic):** ShopCard uses `useNextAvailabilityForShop(shopId, mechanicId)` so "Next Availability" shows real Convex time slots. When "Any" is selected, slots are shop-level; when a mechanic is selected, slots are filtered to that mechanic. Selecting a slot sets `selectedMechanicSlot.timeSlotId`, `scheduledDate`, and `scheduledTime` for Convex booking.

### Service Pricing (Choose Mechanic & Footer)

| Hook / Source | Purpose |
|---------------|---------|
| **useServiceVehicleSpecsForEngine** | Fetches car-specific (engine-specific) labor/parts from `service_vehicle_specs` for selected vehicle + services |
| **useShopsFromConvex** | Provides `labor_rate` per shop for per-shop pricing |
| **useServicesFromConvex** | Provides `default_labor_hours`, `default_parts_estimate` (from first `service_options`) as fallback |

**Price formula:** `(shop.labor_rate × labor_hours) + parts` per service, summed.

- **Car-specific:** When selected vehicle has `engine_id` (from Convex), `service_vehicle_specs.getSpecsForEngineAndServices` returns `labor_hours` and `parts_cost_avg` per service.
- **Fallback:** When no engine-specific spec exists, uses `services.default_labor_hours` and `service_options.parts_cost` (average of first option).
- **Display format:** `Oil change + x more... $80` (service names first, price last) in ShopCard and footer "Book $X".

**Vehicle → engine_id:** `useVehicleOwnershipFromConvex` hydrates `useVehicleStore` with `engineId` from Convex `vehicles.engine_id` when present.

### Data Mapping

**Convex Shop → Store Shop**

- `_id` → `id` (as string)
- `address` + `city` + `state` + `zip` → `address`
- `lat`, `lng` → `latitude`, `longitude`
- `rating`, `review_count` → `rating`
- `serviceIds` from `shop_services.getByShopId`
- `hasAvailableSlots`, `nextAvailableSlot` from `time_slots` (optional)

**Convex Mechanic → Store Mechanic**

- `_id` → `id` (as string)
- `shop_id` → `shopId`
- `first_name` + `last_name` → `name`
- Shop name from shops lookup → `shopName`

**Convex Shop → Store Shop (pricing)**

- `labor_rate` → `labor_rate` (for price formula: labor_rate × time + parts)

**Convex Vehicle → Store Vehicle (pricing)**

- `vehicle.engine_id` → `engineId` (for car-specific `service_vehicle_specs` lookup)

### Integration Points

1. **Home layout / main tabs** – Run `useServicesFromConvex`, `useServiceCategoriesFromConvex`, `useShopsFromConvex`, and `useMechanicsFromConvex` when home tab is active (app/(main-tabs)/home/_layout.tsx).
2. **Availability flow** – When user selects shop + date + time, fetch `time_slots.getByShopAndDate`, resolve `timeSlotId`, and set `selectedMechanicSlot.timeSlotId` before payment.
3. **Search** – FullSearchModal, SearchSuggestions, ServiceBottomSheet use `useShopStore` and `useMechanicStore`; hydrating these stores from Convex automatically feeds the search.
4. **Shop detail** – Shop details pricing uses `getShopById(shopId).labor_rate`; schedule uses `useNextAvailabilityForShop(shopId)` grouped by mechanic; reviews use `api.reviews.getByShopId`; portfolio uses `api.shop_portfolio.listByShopId` (cdn_assets).

---

## 4. Full Booking Flow (End-to-End)

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

| Stage | Required Convex Data |
|-------|----------------------|
| Discovery | shops, mechanics (for carousel, search) |
| Shop detail | shop by id, mechanics by shop_id |
| Availability | time_slots by shop_id + date (and optional mechanic_id) |
| Payment | user (getMe), vehicle (vin), shop_id, time_slot_id, services |

### Time slots: per-mechanic (per-bay) in Convex

The `time_slots` table supports **one slot per mechanic per (shop, date, time)**. Each mechanic is treated as an individual bay with their own calendar:

- **Schema:** `time_slots.mechanic_id` (optional) ties a row to a mechanic. Same (shop, date, start_time) can appear multiple times with different `mechanic_id` (e.g. Mike 8:00 AM and Sarah 8:00 AM).
- **Index:** `by_mechanic_id` supports queries like “next N slots for this mechanic.”
- **Seed:** `seed` and `seedTimeSlots` create slots with `mechanic_id` set so every slot is assigned to a mechanic (per-bay). Run `seedTimeSlots` after adding mechanics to regenerate slots for all active mechanics.

---

## 5. Clerk guest account (.env.local) ↔ seed data

The app uses the **Clerk account defined in `.env.local`** (e.g. `EXPO_PUBLIC_GUEST_EMAIL` / `EXPO_PUBLIC_GUEST_PASSWORD`) as the test account. To have that account see vehicles, bookings, and other seed data:

1. **Run the seed** so a demo user and data exist:
   - Full: `npx convex run seed:seed` then `npx convex run seed:seedAll` (or your usual seed flow).
   - User+vehicle only: `npx convex run seed:seedUserAndVehicle`.
2. **Sign in** with the guest account (e.g. use the “Sign in” flow with the email/password from `.env.local`).

On sign-in, `claimSeedDataForCurrentUser` runs automatically: it reassigns the seed demo user’s data (vehicles, bookings, reviews, etc.) to your signed-in user and removes the placeholder seed user. The guest account then sees all seed data. The mutation is idempotent (safe to run again; if you already have data, it no-ops).

---

**Last updated:** February 2026.
