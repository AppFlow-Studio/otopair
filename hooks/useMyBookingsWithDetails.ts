/**
 * useMyBookingsWithDetails
 *
 * Fetches the current user's bookings from Convex with shop, mechanic, vehicle,
 * and service names resolved. Splits into live (in_progress), upcoming, and history
 * for the My Bookings screen.
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Booking as BookingCardBooking } from "@/components/bookings/BookingCard";
import type { LiveTracking } from "@/components/bookings/LiveTrackerCard";
import {
  adaptConvexBookingWithDetailsToCard,
  adaptConvexBookingWithDetailsToLiveTracking,
  type ConvexBookingWithDetails,
} from "@/utils/bookingAdapter";
import { useUserFromConvex } from "./useUserFromConvex";

function isUpcoming(row: ConvexBookingWithDetails): boolean {
  if (row.status === "completed" || row.status === "cancelled") return false;
  if (row.status === "in_progress") return false;
  const today = new Date().toISOString().slice(0, 10);
  return row.scheduled_date >= today;
}

function isLive(row: ConvexBookingWithDetails): boolean {
  return row.status === "in_progress";
}

function isHistory(row: ConvexBookingWithDetails): boolean {
  if (row.status === "completed" || row.status === "cancelled") return true;
  const today = new Date().toISOString().slice(0, 10);
  return row.scheduled_date < today;
}

export function useMyBookingsWithDetails() {
  const { userId } = useUserFromConvex();
  const rows = useQuery(api.bookings.getByUserIdWithDetails, userId ? { userId } : "skip");

  return useMemo(() => {
    const list = rows ?? [];
    const liveRows = list.filter(isLive);
    const upcomingRows = list.filter(isUpcoming);
    const historyRows = list.filter(isHistory);

    const liveTracking: LiveTracking | null =
      liveRows.length > 0 ? adaptConvexBookingWithDetailsToLiveTracking(liveRows[0]) : null;

    const upcomingBookings: BookingCardBooking[] = upcomingRows
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
      .map(adaptConvexBookingWithDetailsToCard);

    const historyBookings: BookingCardBooking[] = historyRows
      .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime())
      .map(adaptConvexBookingWithDetailsToCard);

    return {
      liveTracking,
      upcomingBookings,
      historyBookings,
      isLoading: rows === undefined,
    };
  }, [rows]);
}
