/**
 * useNextAvailabilityForShop
 *
 * Fetches next N available Convex time slots for a shop (and optionally a mechanic).
 * Used by ShopCard on the "Choose Mechanic" screen to show "Next Availability"
 * and individual mechanic schedules.
 *
 * USED IN: components/booking/sheets/ShopCard.tsx
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MechanicAvailabilitySlot } from "@/stores/types/store.types";
import { dateToDayDisplay, hhmmToDisplayTime } from "@/utils/timeSlotUtils";

export interface NextAvailabilitySlot extends MechanicAvailabilitySlot {
  /** Convex time_slot id for booking */
  timeSlotId: Id<"time_slots">;
  /** Date YYYY-MM-DD for booking */
  scheduledDate: string;
  /** Time HH:MM for Convex */
  scheduledTime: string;
  /** Mechanic id if slot is mechanic-specific */
  mechanicId?: string;
}

const DEFAULT_LIMIT = 12;

export function useNextAvailabilityForShop(
  shopId: string | null,
  mechanicId: string | null | undefined,
  limit: number = DEFAULT_LIMIT,
) {
  const convexSlots = useQuery(
    api.time_slots.getNextAvailableByShop,
    shopId
      ? {
          shopId: shopId as Id<"shops">,
          limit,
          mechanicId: mechanicId === undefined || mechanicId === null ? undefined : (mechanicId as Id<"mechanics">),
        }
      : "skip",
  );

  const slots = useMemo((): NextAvailabilitySlot[] => {
    if (!convexSlots) return [];
    return convexSlots.map((s) => {
      const { dayOfWeek, day } = dateToDayDisplay(s.date);
      return {
        dayOfWeek,
        day,
        time: hhmmToDisplayTime(s.start_time),
        timeSlotId: s._id,
        scheduledDate: s.date,
        scheduledTime: s.start_time,
        mechanicId: s.mechanic_id as string | undefined,
      };
    });
  }, [convexSlots]);

  return {
    slots,
    isLoading: convexSlots === undefined,
    hasSlots: slots.length > 0,
  };
}
