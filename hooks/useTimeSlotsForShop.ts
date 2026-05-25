/**
 * useTimeSlotsForShop
 *
 * Fetches available Convex time slots for a shop and date.
 * Used in availability/booking modals to show real slots and resolve timeSlotId.
 *
 * USED IN: ShopBookingModal, AvailabilityModal
 */

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
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
  const refreshShopAvailability = useMutation(api.time_slots.refreshShopAvailability);

  useEffect(() => {
    if (!isRealShopId || !date) return;
    void refreshShopAvailability({
      shopId: shopId as Id<"shops">,
      date,
      mechanicId: isRealMechanicId ? (mechanicId as Id<"mechanics">) : undefined,
    }).catch((error) => {
      console.warn("[availability] failed to refresh shop slots", error);
    });
  }, [date, isRealMechanicId, isRealShopId, mechanicId, refreshShopAvailability, shopId]);

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
