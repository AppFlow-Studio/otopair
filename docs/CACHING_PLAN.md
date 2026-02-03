# Caching Plan: Instant App Start with Zustand Persist

**Status:** For future implementation, after Convex-only stores and mock removal are complete.

---

## Problem

With Convex-only stores:

- On app launch, stores start **empty**.
- Convex fetches data over the network (~200–500ms+).
- Until data arrives, the UI shows loading/skeletons.

So every cold start depends on the network before the user sees real data.

---

## Solution: Persist Store State to Disk

Use **Zustand’s `persist` middleware** with **AsyncStorage** so that:

1. When Convex hydrates the stores, the persisted slice of state is also written to AsyncStorage.
2. On the next app launch, Zustand **rehydrates** from AsyncStorage first (~10–50ms).
3. The UI can render **last-known data** immediately (stale but instant).
4. Convex then syncs in the background and updates the stores; persist writes the new state back to disk.

So: **disk is faster than network**. You trade a short period of possibly stale data for a much faster perceived launch.

---

## How the Layers Work Together

| Layer        | Role                         | Typical speed   |
|-------------|------------------------------|-----------------|
| AsyncStorage | Persists state on device disk| ~10–50ms read   |
| Zustand      | Holds state in RAM           | Instant         |
| Convex       | Source of truth from server  | ~200–500ms+     |

```
App launch
  1. Zustand persist reads from AsyncStorage (disk → RAM)   ~10–50ms
  2. Data is in Zustand (RAM) — UI can render immediately
  3. Convex syncs fresh data in background (network)         ~200–500ms+
  4. Stores update → persist writes to AsyncStorage again
```

---

## When to Implement

- **After** all mocks are removed and stores are Convex-only.
- **After** loading and empty states are in place (so “no cache” and “stale cache” both have sensible UX).

Then add persist only to the stores that benefit from instant display (e.g. mechanics, shops, services, service categories, maybe vehicles). Avoid persisting highly sensitive or short-lived data unless you have a clear reason.

---

## Implementation Outline

### 1. Dependencies

- `@react-native-async-storage/async-storage` (if not already present).
- Zustand’s `persist` and `createJSONStorage` from `zustand/middleware`.

### 2. Which Stores to Persist (candidates)

| Store            | Persist? | Notes                                      |
|-----------------|----------|--------------------------------------------|
| useMechanicStore| Yes      | Mechanics list; safe to show stale.        |
| useShopStore    | Yes      | Shops list; safe to show stale.            |
| useBookingStore | Partial  | Only `availableServices`, `serviceCategories`; not draft/booking flow. |
| useVehicleStore | Yes      | User’s vehicles; good for instant list.    |
| useScheduleStore| No       | UI selection state; short-lived.          |
| usePaymentStore| Optional | Payment methods; consider security.        |
| useAuthStore    | No       | Auth usually has its own persistence.      |

### 3. Persist Middleware Example

```ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const useMechanicStore = create<MechanicState>()(
  persist(
    (set, get) => ({
      mechanics: {},
      mechanicIds: [],
      // ... rest of state and actions
    }),
    {
      name: "mechanic-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Optional: only persist specific keys so selection/filters stay session-only
      partialize: (state) => ({
        mechanics: state.mechanics,
        mechanicIds: state.mechanicIds,
      }),
    }
  )
);
```

- **`partialize`**: Persist only the keys that are safe and useful to restore (e.g. data slices), not selection/filters if you want those to reset each session.

### 4. Stale Data Handling

- On first paint after rehydration, data may be **stale**.
- Options:
  - Show a small “Updating…” or refresh indicator when Convex is loading, and clear it when Convex data arrives.
  - Or show last-known data with no indicator and let Convex update in place (simplest).
- Decide whether to show a timestamp (“Updated just now” / “Updated 2 min ago”) for transparency.

### 5. Versioning and Migrations (optional)

If the shape of persisted state changes over time:

- Use `version` in the persist config. On version mismatch, you can run a `migrate` function to transform old state or clear it.
- See [Zustand persist docs](https://docs.pmnd.rs/zustand/integrations/persisting-store-data) for `version` and `migrate`.

### 6. Storage Size and Eviction

- AsyncStorage has limits; avoid persisting large or unbounded data.
- If you add more stores or larger payloads, consider:
  - Keeping `partialize` minimal.
  - Evicting or not persisting very old entries (e.g. old transactions).

---

## Tradeoffs

| Benefit              | Cost / consideration                          |
|----------------------|------------------------------------------------|
| Faster perceived launch | Stale data until Convex syncs                 |
| Works offline (last view) | Need UX for “data may be old” / refresh       |
| Simple to add         | Persist key/version/migrate if schema changes |
|                      | Slightly more code and testing surface        |

---

## Summary

- **Do not** implement this until Convex-only stores and loading/empty states are in place.
- **Do** use Zustand `persist` + AsyncStorage for selected stores (mechanics, shops, services, vehicles) when you want instant app start.
- **Do** use `partialize` to persist only data slices, not ephemeral UI state.
- **Consider** a small “Updating…” or “Last updated” UX so users understand when data is fresh.

This doc can be updated as you decide exactly which stores to persist and how to handle staleness in the UI.
