# Zustand Stores

## What This Space Is For
Client-side UI state management. 12 stores. Zustand — not Redux.

## Key Rule
Stores hold **UI state only**. Convex is the source of truth for persistent data. Never duplicate Convex data in stores long-term.

## Stores
| Store | Lines | Purpose |
|---|---|---|
| useBookingStore | 500+ | Full booking flow (location, services, mechanic, slot, map, filters) |
| useVehicleStore | — | Vehicle list, selected vehicle, onboarding state |
| useMechanicStore | — | Mechanic list, carousel, selected mechanic |
| useShopStore | — | Shop list, carousel, details, portfolio |
| useSearchStore | — | Search query, active filters, results |
| useScheduleStore | — | Time slots, calendar state |
| usePaymentStore | — | Payment method, card state |
| useOnboardingStore | — | Onboarding progress, form data, steps completed |
| useAuthStore | — | Auth status, new user flag |
| usePendingNavigationStore | — | Cross-screen navigation state |
| useAIChatStore | — | AI conversation history, state, welcome flag |
| useUserStore | — | Empty (legacy — can be removed) |

## Pattern
```typescript
import { create } from 'zustand';

interface FeatureState {
  items: Item[];
  selected: Item | null;
  setSelected: (item: Item) => void;
  reset: () => void;
}

export const useFeatureStore = create<FeatureState>((set) => ({
  items: [],
  selected: null,
  setSelected: (item) => set({ selected: item }),
  reset: () => set({ items: [], selected: null }),
}));
```
