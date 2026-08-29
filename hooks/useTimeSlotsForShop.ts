/**
 * useTimeSlotsForShop
 *
 * Fetches available Convex time slots for a shop and date.
 * Used in availability/booking modals to show real slots and resolve timeSlotId.
 *
 * USED IN: ShopBookingModal, AvailabilityModal
 */

import { useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { displayTimeToHHMM, minBookableHHMM, todayLocalISO } from "@/utils/timeSlotUtils";

/** Converts 24h "09:00" to display "9:00 AM" */
function hhmmToDisplayTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === 0) return `12:${String(m).padStart(2, "0")} AM`;
  if (h < 12) return `${h}:${String(m).padStart(2, "0")} AM`;
  if (h === 12) return `12:${String(m).padStart(2, "0")} PM`;
  return `${h - 12}:${String(m).padStart(2, "0")} PM`;
}

export interface TimeSlotOption {
  id: string;
  startTime: string;
  endTime: string;
  displayTime: string;
}

type TimeSlotRow = {
  _id: string;
  is_available: boolean;
  start_time: string;
  end_time: string;
};

export type QuoteHoldContext =
  | { quote_type: "tire"; response_id: Id<"tire_quote_responses">; revision: number }
  | { quote_type: "rotor"; response_id: Id<"rotor_quote_responses">; revision: number };

type QuoteAwareTimeSlotArgs = {
  shopId: Id<"shops">;
  date: string;
  mechanicId?: Id<"mechanics">;
  durationMinutes?: number;
  quote_context?: QuoteHoldContext;
};

const getQuoteAwareTimeSlots = api.time_slots.getByShopAndDate as FunctionReference<
  "query",
  "public",
  QuoteAwareTimeSlotArgs,
  TimeSlotRow[]
>;

export function useTimeSlotsForShop(
  shopId: string | null,
  date: string | null,
  mechanicId?: string | null,
  durationMinutes?: number,
  quoteContext?: QuoteHoldContext,
) {
  // Skip query for mock IDs (e.g. "1", "2") — only call Convex with real IDs
  const isRealShopId = shopId != null && shopId.length > 10;
  const isRealMechanicId = mechanicId != null && mechanicId.length > 10;

  const slots = useQuery(
    getQuoteAwareTimeSlots,
    isRealShopId && date
      ? {
          shopId: shopId as Id<"shops">,
          date,
          mechanicId: isRealMechanicId ? (mechanicId as Id<"mechanics">) : undefined,
          durationMinutes,
          quote_context: quoteContext,
        }
      : "skip",
  );

  const availableSlots = useMemo((): TimeSlotOption[] => {
    if (!slots) return [];
    // Enforce the booking lead time at the single choke point every
    // time-picker surface reads through: on today, drop any slot starting
    // before the minimum bookable time (now + advance notice). "HH:MM" is
    // lexically chronological, so a string compare is correct. Later days
    // are unaffected. Keeping the rule here means no picker has to
    // re-implement it.
    const isToday = date === todayLocalISO();
    const minTime = minBookableHHMM();
    return (slots as TimeSlotRow[])
      .filter((s) => s.is_available)
      .filter((s) => !isToday || s.start_time >= minTime)
      .map((s) => ({
        id: s._id,
        startTime: s.start_time,
        endTime: s.end_time,
        displayTime: hhmmToDisplayTime(s.start_time),
      }));
  }, [slots, date]);

  // Sort by 24-hour `startTime` (HH:MM is lexically chronological) so the
  // list reads store-open → close. A naive sort on `displayTime` puts
  // "10:00 PM" before "10:15 AM" because it's a string compare.
  const timeOptions = useMemo(() => {
    const byDisplay = new Map<string, string>();
    for (const s of availableSlots) {
      if (!byDisplay.has(s.displayTime)) byDisplay.set(s.displayTime, s.startTime);
    }
    return Array.from(byDisplay.entries())
      .sort(([, a], [, b]) => a.localeCompare(b))
      .map(([displayTime]) => displayTime);
  }, [availableSlots]);

  const getSlotIdByDisplayTime = useMemo(
    () => (displayTime: string) => {
      const hhmm = displayTimeToHHMM(displayTime);
      const slot = availableSlots.find((s) => s.startTime === hhmm);
      return slot?.id ?? null;
    },
    [availableSlots],
  );

  return {
    slots: availableSlots,
    timeOptions,
    getSlotIdByDisplayTime,
    isLoading: slots === undefined,
    hasSlots: availableSlots.length > 0,
  };
}
