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
import { dateToDayDisplay, hhmmToDisplayTime, minBookableHHMM, todayLocalISO } from "@/utils/timeSlotUtils";

export interface NextAvailabilitySlot extends MechanicAvailabilitySlot {
  /** Real time_slots id for legacy slots, or a computed availability window id. */
  timeSlotId: string;
  /** Date YYYY-MM-DD for booking */
  scheduledDate: string;
  /** Time HH:MM for Convex */
  scheduledTime: string;
  /** Mechanic id if slot is mechanic-specific */
  mechanicId?: string;
}

const DEFAULT_LIMIT = 12;

type AvailabilityRow = {
  _id: string;
  date: string;
  start_time: string;
  mechanic_id?: string | null;
};

export function useNextAvailabilityForShop(
  shopId: string | null,
  mechanicId: string | null | undefined,
  limit: number = DEFAULT_LIMIT,
  durationMinutes?: number,
) {
  // Skip query for mock shop IDs (e.g. "1", "2") — only call Convex with real IDs
  const isConvexId = shopId != null && shopId.length > 10;

  // Compute the user's local "now" cutoff here so it's shared between
  // the server query (which slices to `limit` *after* filtering past
  // slots) and the client safety-net filter below. The server runs in
  // UTC and would otherwise mis-classify "today" near midnight.
  const cutoffDate = todayLocalISO();
  const cutoffTime = minBookableHHMM();
  const convexSlots = useQuery(
    api.time_slots.getNextAvailableByShop,
    isConvexId
      ? {
          shopId: shopId as Id<"shops">,
          limit,
          mechanicId: mechanicId === undefined || mechanicId === null ? undefined : (mechanicId as Id<"mechanics">),
          durationMinutes,
          cutoffDate,
          cutoffTime,
        }
      : "skip",
  );

  const slots = useMemo((): NextAvailabilitySlot[] => {
    if (!convexSlots) return [];
    // Belt-and-braces: the server now applies the same filter, but we
    // re-check here in case the client is talking to an older deploy
    // that hasn't picked up the cutoff args yet.
    const today = todayLocalISO();
    const minTime = minBookableHHMM();
    return convexSlots
      .filter((s: AvailabilityRow) => s.date !== today || s.start_time >= minTime)
      .map((s: AvailabilityRow) => {
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
