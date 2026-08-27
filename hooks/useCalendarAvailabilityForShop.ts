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
import type { FunctionReference } from "convex/server";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { minBookableHHMM, todayLocalISO } from "@/utils/timeSlotUtils";
import type { QuoteHoldContext } from "@/hooks/useTimeSlotsForShop";

type QuoteAwareCalendarArgs = {
  shopId: Id<"shops">;
  year: number;
  month: number;
  mechanicId?: Id<"mechanics">;
  durationMinutes?: number;
  cutoffDate?: string;
  cutoffTime?: string;
  quote_context?: QuoteHoldContext;
};

type CalendarAvailabilityResult = {
  availableDates: string[];
  bookedDates: string[];
};

const getQuoteAwareCalendar = api.time_slots.getAvailabilityByShopAndMonth as FunctionReference<
  "query",
  "public",
  QuoteAwareCalendarArgs,
  CalendarAvailabilityResult
>;

export function useCalendarAvailabilityForShop(
  shopId: string | null,
  year: number,
  month: number,
  mechanicId: string | null | undefined,
  durationMinutes?: number,
  quoteContext?: QuoteHoldContext,
) {
  // Skip query for mock IDs (e.g. "1", "2") — only call Convex with real IDs
  const isRealShopId = shopId != null && shopId.length > 10;
  const isRealMechanicId = mechanicId != null && mechanicId.length > 10;
  const result = useQuery(
    getQuoteAwareCalendar,
    isRealShopId
      ? {
          shopId: shopId as Id<"shops">,
          year,
          month,
          mechanicId: isRealMechanicId ? (mechanicId as Id<"mechanics">) : undefined,
          durationMinutes,
          cutoffDate: todayLocalISO(),
          cutoffTime: minBookableHHMM(),
          quote_context: quoteContext,
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
