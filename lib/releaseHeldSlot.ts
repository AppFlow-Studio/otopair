/**
 * Free the checkout's slot hold before the booking store forgets it (bug #393).
 *
 * `resetBookingFlow()` clears `holdId` / `holdSessionId`, and payment.tsx's
 * Back was the only place that ever released a hold — so every other exit
 * (sign-out, a reset from a shop/mechanic page, the flow's own reset) left the
 * shop's grid blocked by a "held" slot for the full TTL. Call this right
 * before any reset that can happen while a hold is in the store.
 *
 * Best effort by design: fire-and-forget, errors swallowed, never awaited by
 * navigation. A consumed hold is already deleted server-side (release returns
 * `{ released: false }`), and a leased hold that we fail to release still
 * lapses within one lease. It goes through the shared Convex client because
 * the sign-out path (lib/session-state.ts) isn't a component. Passing the
 * stored session id means it works even after Clerk has signed out; the
 * server also lets the signed-in owner release without it.
 */

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from "@/lib/convexClient";
import { useBookingStore } from "@/stores/useBookingStore";

export function releaseHeldSlot(): void {
  const { holdId, holdSessionId } = useBookingStore.getState();
  if (!holdId) return;
  try {
    void getConvexClient()
      .mutation(api.slotHolds.releaseSlotHold, {
        holdId: holdId as Id<"slot_holds">,
        // Owner-release path when the session id is gone: any string works
        // for the signed-in customer who owns the hold.
        session_id: holdSessionId ?? "released-on-reset",
      })
      .catch(() => {});
  } catch {
    // Client construction can throw where there's no deployment URL (tests).
  }
}
