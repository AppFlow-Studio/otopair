# Slot Holds — Mobile App Spec (otopair)

**Status:** backend is **done and live** on the shared Convex deployment. This spec covers only the mobile client wiring. The web/staff side is handled separately.

## Why

Booking availability used to be checked only at the *final* submit. During the multi-step checkout the slot stayed visibly free to everyone, so two customers could each start booking the same time and both succeed (the "me and AB booked the same 1:15 PM" incident). A **slot hold** reserves the specific mechanic+window for one checkout session the moment the customer picks a time, releases it on abandonment/expiry, and the booking mutation consumes it atomically. TTL is a fixed **15 minutes** (director-configurable).

Because both web and mobile hit the same Convex backend, the engine already exists. Mobile only needs to: **acquire** on time-pick, **show a countdown**, **release** on back, **consume** at pay, and — critically — **detect expiry on resume** ("session expired, pick a new time").

---

## Backend API (already deployed — just call it)

```ts
// Acquire / refresh (idempotent per session_id). THROWS if another session holds it.
api.slotHolds.holdSlot({
  shop_id: Id<"shops">,
  mechanic_id?: Id<"mechanics">,   // omit = "Any"; server pins a concrete free mechanic
  date: string,                     // "YYYY-MM-DD"
  start_time: string,               // "HH:mm"
  duration_minutes: number,
  session_id: string,               // stable per-checkout id
  held_by?: Id<"users">,
}) => { holdId, mechanicId, expiresAt }        // or { holdId: null, disabled: true } if feature off

api.slotHolds.releaseSlotHold({ holdId: Id<"slot_holds">, session_id: string })
  => { released: boolean }

api.slotHolds.getSlotHold({ holdId: Id<"slot_holds"> })
  => { status, expiresAt, isExpired, mechanicId, date, startTime, durationMinutes } | null

api.slotHolds.getMyActiveHold({ session_id: string })
  => { holdId, expiresAt, mechanicId, shopId, date, startTime, durationMinutes } | null
```

Consume (already accepts the new args):

```ts
api.bookings.createBatch({ ...existing, hold_id?: Id<"slot_holds">, session_id?: string })
api.bookings.confirmPreauthorizedBatch({ ...existing, hold_id?, session_id? })
```

The server verifies the hold (active, unexpired, session matches, slot matches), reuses its pinned mechanic, and **deletes it in the same mutation** as the booking insert. If the hold is missing/expired it silently falls back to normal resolution (the availability check is the backstop) — so a stale `hold_id` never blocks a legitimate booking.

---

## Client changes

### 1. `stores/useBookingStore.ts` — hold state + a per-checkout session id

Add to `BookingState`:

```ts
  // ═══════════════ SLOT HOLD STATE ═══════════════
  /** Stable id for the current checkout, used to acquire/refresh/consume the
   *  slot hold. Generated lazily; cleared by resetBookingFlow. */
  holdSessionId: string | null;
  /** Active slot hold for the current checkout (null = none / feature off). */
  holdId: string | null;
  /** Absolute ms when the hold expires — powers the countdown. */
  holdExpiresAt: number | null;

  /** Return the session id, generating a fresh one on first call. */
  ensureHoldSessionId: () => string;
  /** Stash the acquired hold (null clears). */
  setSlotHold: (hold: { holdId: string; expiresAt: number } | null) => void;
  /** Clear the hold + session id (call after release/consume). */
  clearSlotHold: () => void;
```

Implementation (uuid: use `expo-crypto`'s `randomUUID()` if available, else the fallback):

```ts
  holdSessionId: null,
  holdId: null,
  holdExpiresAt: null,

  ensureHoldSessionId: () => {
    const existing = get().holdSessionId;
    if (existing) return existing;
    const id =
      // import * as Crypto from "expo-crypto"
      (globalThis as any).crypto?.randomUUID?.() ??
      `hold-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set({ holdSessionId: id });
    return id;
  },
  setSlotHold: (hold) =>
    set({ holdId: hold?.holdId ?? null, holdExpiresAt: hold?.expiresAt ?? null }),
  clearSlotHold: () =>
    set({ holdId: null, holdExpiresAt: null, holdSessionId: null }),
```

Add the three fields to the `resetBookingFlow` reset block (set all to `null`).

> Note: `SelectedMechanicSlot` already carries `scheduledDate`, `scheduledTime`, `mechanicId` — reuse those for the hold args; no change to that type is required.

### 2. `app/(booking-flow)/pick-datetime.tsx` — acquire on confirm

In `onConfirm` (currently ~line 321), after `startHHMM` and `selectedMechanicId` are resolved and **before** `router.push(... payment ...)`, acquire the hold. Add near the other store selectors:

```ts
const holdSlot = useMutation(api.slotHolds.holdSlot);
const ensureHoldSessionId = useBookingStore((s) => s.ensureHoldSessionId);
const setSlotHold = useBookingStore((s) => s.setSlotHold);
```

Inside `onConfirm`, make it async (or fire the mutation then navigate on resolve):

```ts
const sessionId = ensureHoldSessionId();
try {
  const res = await holdSlot({
    shop_id: shopId as Id<"shops">,
    mechanic_id: selectedMechanicId ? (selectedMechanicId as Id<"mechanics">) : undefined,
    date: selectedDateISO,
    start_time: startHHMM,
    duration_minutes: durationMinutes,   // reuse the flow's estimate; fallback 60
    session_id: sessionId,
    // held_by: <current user id if handy>,
  });
  setSlotHold(res?.holdId ? { holdId: res.holdId, expiresAt: res.expiresAt } : null);
} catch (e) {
  // Slot was just taken by someone else — keep the user on this screen and
  // surface a toast: "That time was just taken. Pick another slot."
  showToast("That time was just taken — please pick another slot.");
  return; // do NOT navigate to payment
}
// ...existing setSelectedMechanicSlot / setScheduledAppointment / router.push
```

`durationMinutes`: reuse whatever the flow already computes for the booking estimate (the quote-accept `estimatedDurationMinutes`, or the service-cart estimate). If not readily available at this point, pass `60` — the hold only needs to reserve the window; the booking still stores the real duration.

**Re-pick handling:** because `holdSlot` is idempotent per `session_id`, calling it again when the user changes the time just refreshes/moves the hold server-side (the old one is released). No extra client bookkeeping needed.

### 3. `app/booking/mechanic/[id]/payment.tsx` — countdown, release on back, resume re-check

Add selectors + a `getSlotHold` query:

```ts
const holdId = useBookingStore((s) => s.holdId);
const holdExpiresAt = useBookingStore((s) => s.holdExpiresAt);
const holdSessionId = useBookingStore((s) => s.holdSessionId);
const setSlotHold = useBookingStore((s) => s.setSlotHold);
const releaseSlotHold = useMutation(api.slotHolds.releaseSlotHold);
```

**(a) Countdown badge** — a 1s tick off `holdExpiresAt`:

```ts
const [nowMs, setNowMs] = useState(() => Date.now());
useEffect(() => {
  if (!holdExpiresAt) return;
  const t = setInterval(() => setNowMs(Date.now()), 1000);
  return () => clearInterval(t);
}, [holdExpiresAt]);
const remainingMs = holdExpiresAt ? Math.max(0, holdExpiresAt - nowMs) : 0;
const holdExpired = holdExpiresAt != null && remainingMs <= 0;
const countdown = holdExpiresAt
  ? `${Math.floor(remainingMs / 60000)}:${String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, "0")}`
  : null;
```

Render `Held {countdown}` in the header near "Review & Pay" (turn red / show "Hold expired" when `holdExpired`).

**(b) Release on back** — `handleBack` already exists (~line 568) and is wired to both the header back button and the hardware `BackHandler` in the `useFocusEffect` (~line 622). Release there:

```ts
const handleBack = useCallback(() => {
  if (holdId && holdSessionId) {
    releaseSlotHold({ holdId: holdId as Id<"slot_holds">, session_id: holdSessionId }).catch(() => {});
    setSlotHold(null);
  }
  // ...existing back logic (router.back(), etc.)
}, [holdId, holdSessionId, releaseSlotHold, setSlotHold, /* existing deps */]);
```

**(c) CRITICAL — expiry re-check on resume.** The reported failure mode: user backgrounds the app mid-checkout, the 15-min hold silently expires, the slot may now be taken. On foreground / screen-focus, re-check and bounce them back to slot selection:

```ts
import { AppState } from "react-native";

const recheckHold = useCallback(async () => {
  if (!holdId) return;
  const state = await getSlotHoldClient({ holdId }); // useQuery or a one-shot; see note
  if (!state || state.isExpired) {
    setSlotHold(null);
    showSessionExpiredModal();               // "Your held time expired — please pick a new time."
    router.replace({
      pathname: "/(booking-flow)/pick-datetime",
      params: { shopId: resolvedShopId, mechanicId: selectedMechanicId ?? undefined },
    });
  }
}, [holdId, resolvedShopId, selectedMechanicId]);

useEffect(() => {
  const sub = AppState.addEventListener("change", (s) => {
    if (s === "active") recheckHold();
  });
  return () => sub.remove();
}, [recheckHold]);

// also re-check when the screen regains focus
useFocusEffect(useCallback(() => { recheckHold(); }, [recheckHold]));
```

> `getSlotHold` note: Convex `useQuery(api.slotHolds.getSlotHold, holdId ? { holdId } : "skip")` is reactive — you can read `isExpired` directly from it and drive the "session expired" modal when it flips, instead of an imperative call. Either works; the reactive query is simplest.

### 4. `hooks/useCreateBookingConvex.ts` — consume the hold

In `createBatchPayload` (~line 273), thread the hold + session id:

```ts
const holdId = useBookingStore.getState().holdId;
const holdSessionId = useBookingStore.getState().holdSessionId;

const createBatchPayload = {
  ...existing,
  shop_id: shopId as Id<"shops">,
  // ...
  hold_id: holdId ? (holdId as Id<"slot_holds">) : undefined,
  session_id: holdSessionId ?? undefined,
};
```

After a successful `createBatch` / `confirmPreauthorizedBatch`, clear the hold client-side (the server already deleted it):

```ts
useBookingStore.getState().clearSlotHold();
```

---

## Edge cases / gotchas

- **"Any mechanic":** pass `mechanic_id: undefined` — the server pins a concrete free mechanic and returns it in `res.mechanicId`. Two "any" customers can't land on the same mechanic.
- **Self-block:** the consume path passes `session_id`, so the server excludes the customer's *own* hold from the availability check — the hold never blocks the booking it was reserving. Always send `session_id` alongside `hold_id`.
- **Feature flag off:** `holdSlot` returns `{ disabled: true }` (no throw). Treat `holdId == null` as "no hold" and proceed — the booking still works (server assertion is the backstop). So don't hard-gate navigation on having a hold; only gate on the *throw* (slot actively taken).
- **Expiry is instant server-side:** an expired hold stops blocking the moment it lapses (read-time filter); the 1-min cron just reclaims rows. So a customer whose hold expired can immediately re-hold if the slot is still free.
- **Timezone:** `expires_at` is absolute UTC ms; the countdown is purely `expiresAt - Date.now()`. Never derive it from the `date`/`start_time` strings.
- **Quote-accept flow** (`app/(tire-booking)` / `app/(rotor-booking)` → pick-datetime): same wiring applies; duration comes from `quoteAcceptContext.estimatedDurationMinutes`.

---

## Test checklist (mobile)

1. Pick a time → payment shows `Held 14:59` counting down.
2. Two devices/accounts pick the **same mechanic + slot** → the second gets the "just taken" toast on confirm.
3. Background the app on payment past the TTL (or temporarily set TTL to 1 min via `directorSettings:setSlotHoldConfig`) → foreground → "session expired" modal → routed back to pick-datetime.
4. Back out of payment → the slot frees (verify a second session can now hold it).
5. Complete payment → booking created once, `slot_holds` row gone, `clearSlotHold()` ran.
6. Feature flag off (`setSlotHoldConfig {enabled:false}`) → flow works with no hold/countdown.
