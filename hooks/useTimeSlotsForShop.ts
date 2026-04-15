/**
 * useTimeSlotsForShop
 *
 * Fetches available Convex time slots for a shop and date.
 * Used in availability/booking modals to show real slots and resolve timeSlotId.
 *
 * USED IN: ShopBookingModal, AvailabilityModal
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { displayTimeToHHMM } from "@/utils/timeSlotUtils";

/** Converts 24h "09:00" to display "9:00 AM" */
function hhmmToDisplayTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === 0) return `12:${String(m).padStart(2, "0")} AM`;
  if (h < 12) return `${h}:${String(m).padStart(2, "0")} AM`;
  if (h === 12) return `12:${String(m).padStart(2, "0")} PM`;
  return `${h - 12}:${String(m).padStart(2, "0")} PM`;
}

export interface TimeSlotOption {
  id: Id<"time_slots">;
  startTime: string;
  endTime: string;
  displayTime: string;
}

export function useTimeSlotsForShop(shopId: string | null, date: string | null, mechanicId?: string | null) {
  // Skip query for mock IDs (e.g. "1", "2") — only call Convex with real IDs
  const isRealShopId = shopId != null && shopId.length > 10;
  const isRealMechanicId = mechanicId != null && mechanicId.length > 10;
  const slots = useQuery(
    api.time_slots.getByShopAndDate,
    isRealShopId && date
      ? {
          shopId: shopId as Id<"shops">,
          date,
          mechanicId: isRealMechanicId ? (mechanicId as Id<"mechanics">) : undefined,
        }
      : "skip",
  );

  const availableSlots = useMemo(() => {
    if (!slots) return [];
    return slots
      .filter((s) => s.is_available)
      .map((s) => ({
        id: s._id,
        startTime: s.start_time,
        endTime: s.end_time,
        displayTime: hhmmToDisplayTime(s.start_time),
      }));
  }, [slots]);

  const timeOptions = useMemo(() => [...new Set(availableSlots.map((s) => s.displayTime))].sort(), [availableSlots]);

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
