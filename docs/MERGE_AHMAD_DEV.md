# Merge Plan: Ahmad-dev UI/Flow with waleedcodespace Convex

**Goal:** Use Ahmad-dev's UI, flow, and routing for Home, My Bookings, My Cars, Add Car flow, and Membership, while keeping Convex data layer from this branch.

## Scope

| Area             | Action                                                                                                         | Convex to preserve                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Home**         | Take Ahmad-dev's home index (welcome screen, card order, gradient). Keep our home \_layout (Convex hydration). | `HydrateConvexData` in \_layout; `FinishAccountSetupCard` uses Convex in components.                     |
| **My Bookings**  | Keep current (waleedcodespace) – already uses Convex.                                                          | `useMyBookingsWithDetails`                                                                               |
| **My Cars**      | Take Ahmad-dev's cars index UI (animations, layout). Wire Convex for vehicle list.                             | `useVehicleOwnershipFromConvex`; map to `Vehicle[]` for carousel. Mock maintenance/history until Convex. |
| **Add Car flow** | Take Ahmad-dev's add-vehicle, add-car-info, vehicle-added (UI/routing). Call Convex after VIN submit.          | `api.vehicles.addOwner` (and `useUserFromConvex`) in add-vehicle or add-car-info.                        |
| **Membership**   | Take Ahmad-dev's membership page (UI).                                                                         | Optional later: convex/payments if we wire rewards.                                                      |

## Files

- **From Ahmad-dev (UI/flow):**  
  `app/(main-tabs)/home/index.tsx`,  
  `app/(main-tabs)/cars/index.tsx`,  
  `app/add-vehicle.tsx`, `app/add-car-info.tsx`, `app/vehicle-added.tsx`,  
  `app/membership.tsx`
- **Keep ours:**  
  `app/(main-tabs)/home/_layout.tsx` (Convex hydration),  
  `app/(main-tabs)/bookings/index.tsx` (Convex),  
  all `convex/`, `hooks/use*Convex*`, components that use Convex.

## Post-merge edits (planned)

1. **Cars:** In `app/(main-tabs)/cars/index.tsx`, replace local `vehicles` state with `useVehicleOwnershipFromConvex()`, map `{ vin, vehicle, ownership }` to `Vehicle[]` (id, year, make, model, vin, mileage, isDefault, placeholder images/gradients). Keep mock maintenance/service history or empty for now.
2. **Add car:** After user submits in add-car-info, call `useMutation(api.vehicles.addOwner)` with `userId` from `useUserFromConvex()` and `vin` (from params); then navigate to vehicle-added. **Note:** Convex addOwner is only called when a VIN is present (VIN flow from add-vehicle). Manual entry (no VIN) still navigates to vehicle-added but does not persist to Convex yet.

---

## Changes done

### 1. Git

- **Backup branch:** `waleedcodespace-backup-2026-02-05` created from current branch before merge.
- **Checkout from `origin/Ahmad-dev`:**  
  `app/(main-tabs)/home/index.tsx`, `app/(main-tabs)/cars/index.tsx`, `app/add-vehicle.tsx`, `app/add-car-info.tsx`, `app/vehicle-added.tsx`, `app/membership.tsx`.

### 2. Home

- **Kept:** `app/(main-tabs)/home/_layout.tsx` (unchanged) – Convex hydration (`HydrateConvexData`, services/categories/shops/mechanics).
- **Replaced:** `app/(main-tabs)/home/index.tsx` with Ahmad-dev version (welcome screen, card order, gradient, UI).

### 3. My Bookings

- **No change.** Still uses `useMyBookingsWithDetails` (Convex) in `app/(main-tabs)/bookings/index.tsx`.

### 4. My Cars

- **File:** `app/(main-tabs)/cars/index.tsx`.
- **Convex:** `useVehicleOwnershipFromConvex()`, `useUserFromConvex()`, `useMutation(api.vehicles.updateOwnershipPrimary)`.
- **Data:** Vehicle list comes from Convex; mapped to `Vehicle[]` for `CarCarousel` (id = vin, year/make/model from vehicle/metadata, mileage/is_primary from ownership, default gradients by index).
- **Empty state:** When no vehicles, shows “My Cars” + “Add your first vehicle…” + “Add vehicle” button → `/add-vehicle`.
- **Primary toggle:** `handleToggleDefault` calls `updateOwnershipPrimary({ vin, userId, is_primary })`.
- **Maintenance/service history:** Left as empty objects (keyed by VIN) for future Convex or API.

### 5. Add car flow

- **Files from Ahmad-dev:** `app/add-vehicle.tsx`, `app/add-car-info.tsx`, `app/vehicle-added.tsx` (UI/routing).
- **Convex in add-car-info:** `useUserFromConvex()`, `useMutation(api.vehicles.addOwner)`.
- **On “Confirm & Add Vehicle”:** If `userId` and VIN from params exist, calls `addOwner({ vin, userId, is_primary: true, mileage })`, then `router.push('/vehicle-added')`. Manual entry (no VIN) still navigates to vehicle-added but does not persist to Convex.

### 6. Membership

- **Replaced:** `app/membership.tsx` with Ahmad-dev version (UI only). Convex payments/rewards can be wired later.
