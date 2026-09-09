/**
 * useUnseenBookingsCount
 *
 * Returns the number of bookings (regular service bookings + tire-quote
 * requests, since both live in `useBookingStore` once hydrated from Convex)
 * created after the last time the user opened the Bookings tab.
 *
 * Drives the red badge on the Bookings bottom-nav tab.
 *
 * USED IN: components/navigation/TabBarButton.tsx, app/(main-tabs)/_layout.tsx
 */

import { useEffect, useMemo } from "react";

import { useBookingsBadgeStore } from "@/stores/useBookingsBadgeStore";
import { useBookingStore } from "@/stores/useBookingStore";

export function useUnseenBookingsCount(): number {
  const lastSeenAt = useBookingsBadgeStore((s) => s.lastSeenAt);
  const isHydrated = useBookingsBadgeStore((s) => s.isHydrated);
  const hydrate = useBookingsBadgeStore((s) => s.hydrate);
  const bookings = useBookingStore((s) => s.bookings);

  useEffect(() => {
    if (!isHydrated) {
      hydrate();
    }
  }, [isHydrated, hydrate]);

  return useMemo(() => {
    if (!isHydrated) return 0;
    let count = 0;
    for (const id in bookings) {
      const b = bookings[id];
      const ts = b?.createdAt ? new Date(b.createdAt).getTime() : NaN;
      if (Number.isFinite(ts) && ts > lastSeenAt) {
        count += 1;
      }
    }
    return count;
  }, [bookings, lastSeenAt, isHydrated]);
}
