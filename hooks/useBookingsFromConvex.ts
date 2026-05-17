/**
 * useBookingsFromConvex
 *
 * Fetches the current user's bookings from Convex and hydrates useBookingStore
 * for caching. Used for bookings list and upcoming bookings display.
 *
 * USED IN: Bookings tab, home screen
 */

import { useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { Booking } from "@/stores/types/store.types";
import { useUserFromConvex } from "./useUserFromConvex";
import { useBookingStore } from "@/stores/useBookingStore";

function convexBookingToStore(doc: Doc<"bookings">): Booking {
  const serviceIds = doc.service_ids ?? [];
  return {
    id: doc._id,
    userId: doc.user_id,
    shopId: doc.shop_id ?? "",
    vehicleId: doc.vin ?? "",
    serviceIds,
    status: doc.status as Booking["status"],
    scheduledDate: doc.scheduled_date ?? "",
    scheduledTime: doc.scheduled_time ?? "",
    estimatedDuration: doc.estimated_labor_minutes ?? 60,
    totalPrice: doc.total_cost ?? 0,
    createdAt: new Date(doc.created_at ?? Date.now()).toISOString(),
    updatedAt: new Date(doc.updated_at ?? doc.created_at ?? Date.now()).toISOString(),
  };
}

export function useBookingsFromConvex() {
  const { userId, isLoading: isUserLoading } = useUserFromConvex();
  const convexBookings = useQuery(api.bookings.getByUserId, userId ? { userId } : "skip");
  const setBookingsFromConvex = useBookingStore((s) => s.setBookingsFromConvex);
  const clearBookingState = useBookingStore((s) => s.clearBookingState);

  useEffect(() => {
    if (!userId) {
      if (!isUserLoading) {
        clearBookingState();
      }
      return;
    }
    if (!convexBookings || convexBookings.length === 0) {
      if (convexBookings?.length === 0) {
        setBookingsFromConvex([]);
      }
      return;
    }
    const storeBookings = convexBookings.map(convexBookingToStore);
    setBookingsFromConvex(storeBookings);
  }, [clearBookingState, convexBookings, isUserLoading, setBookingsFromConvex, userId]);

  return {
    bookings: convexBookings ?? [],
    isLoading: isUserLoading || (userId ? convexBookings === undefined : false),
  };
}
