/**
 * useMostRecentBooking
 *
 * Returns the user's single most-recently-created booking across
 * every category (live in-progress / upcoming / history / etc.),
 * or null if the user has never booked.
 *
 * Ranks by `createdAt` desc, not by scheduled date — Ahmad's ask
 * on the Screen 1 "Most Recent" hero card is about the last time
 * the user booked ANYTHING, so a booking created 5 mins ago for
 * next week beats a booking for tomorrow that was created a week
 * ago.
 *
 * Wraps `useMyBookingsWithDetails` so shop names / service names
 * are already resolved — no separate shop/service lookup needed.
 *
 * USED IN: components/booking-flow/HeroCardMostBooked.tsx (Screen 1)
 */

import { useMemo } from "react";

import type { Booking } from "@/components/bookings/BookingCard";
import { useMyBookingsWithDetails } from "./useMyBookingsWithDetails";

export function useMostRecentBooking(): {
  booking: Booking | null;
  isLoading: boolean;
} {
  const {
    liveBooking,
    upcomingBookings,
    historyBookings,
    isLoading,
  } = useMyBookingsWithDetails();

  const booking = useMemo(() => {
    const all: Booking[] = [];
    if (liveBooking) all.push(liveBooking);
    all.push(...upcomingBookings);
    all.push(...historyBookings);
    // Newest first. Bookings without a createdAt get pushed to the
    // back so a legacy no-timestamp row doesn't beat a fresh one.
    all.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return all[0] ?? null;
  }, [liveBooking, upcomingBookings, historyBookings]);

  return { booking, isLoading };
}
