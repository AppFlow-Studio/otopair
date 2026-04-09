# Hooks

## What This Space Is For
Custom React hooks. 37+ hooks for data fetching, local persistence, utilities, and business logic.

## Patterns
- **`use[Feature]FromConvex`** — Wraps Convex `useQuery()`. Returns `{ data, isLoading }`.
- **`use[Feature]Persistence`** — AsyncStorage-backed local state.
- **`useCreate[Feature]Convex`** — Wraps Convex mutations for write operations.

## Key Hooks
| Hook | Purpose |
|---|---|
| useEnsureConvexUser | Syncs Clerk auth → Convex users table (called in root _layout) |
| useBookingsFromConvex | Fetch user's bookings |
| useVehicleOwnershipFromConvex | Fetch user's vehicles + primary vehicle |
| useCreateBookingConvex | Create booking (orchestrates stores + Convex mutation) |
| useFilteredShops | Apply distance/price/rating filters to shops |
| useMaintenanceData | Calculate vehicle maintenance status |
| useSmartCar | Smartcar OAuth + vehicle data |
| useVoiceRecording | Audio recording for AI chat voice input |

## Conventions
- One hook per file
- Prefix with `use`
- Return typed objects, not tuples
- Handle loading + error states inside the hook
