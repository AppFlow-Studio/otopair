/**
 * useCalendarAvailabilityForShop
 *
 * Fetches Convex calendar availability for a shop (and optional mechanic) for a given month.
 * Returns day numbers that have available slots vs booked (no available slots).
 * Used by AvailabilityModal "All Availability" calendar to highlight Available / Booked.
 *
 * USED IN: components/booking/modals/AvailabilityModal.tsx
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function useCalendarAvailabilityForShop(
  shopId: string | null,
  year: number,
  month: number,
  mechanicId: string | null | undefined,
) {
  const result = useQuery(
    api.time_slots.getAvailabilityByShopAndMonth,
    shopId
      ? {
          shopId: shopId as Id<"shops">,
          year,
          month,
          mechanicId: mechanicId === undefined || mechanicId === null ? undefined : (mechanicId as Id<"mechanics">),
        }
      : "skip",
  );

  return useMemo(() => {
    if (!result) {
      return { availableDayNumbers: [], bookedDayNumbers: [], isLoading: true };
    }
    const availableDayNumbers = result.availableDates.map((d) => parseInt(d.split("-")[2], 10));
    const bookedDayNumbers = result.bookedDates.map((d) => parseInt(d.split("-")[2], 10));
    return {
      availableDayNumbers,
      bookedDayNumbers,
      isLoading: false,
    };
  }, [result]);
}
