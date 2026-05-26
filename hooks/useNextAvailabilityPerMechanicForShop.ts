/**
 * useNextAvailabilityPerMechanicForShop
 *
 * Fetches next N available Convex time slots **per mechanic** for a shop.
 * Used by ShopDetails "Available Mechanics & Bays" so each mechanic card
 * shows that mechanic's own time slots (Mike, Sarah, etc.).
 *
 * USED IN: components/booking/ShopDetails.tsx
 */

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MechanicAvailabilitySlot } from "@/stores/types/store.types";
import { dateToDayDisplay, hhmmToDisplayTime, minBookableHHMM, todayLocalISO } from "@/utils/timeSlotUtils";

const DEFAULT_LIMIT_PER_MECHANIC = 12;

export function useNextAvailabilityPerMechanicForShop(
  shopId: string | null,
  limitPerMechanic: number = DEFAULT_LIMIT_PER_MECHANIC,
) {
  const isRealShopId = shopId != null && shopId.length > 10;
  // See useNextAvailabilityForShop: pass the user's local cutoff so the
  // server can drop past slots before slicing to `limitPerMechanic`.
  const cutoffDate = todayLocalISO();
  const cutoffTime = minBookableHHMM();
  const refreshShopAvailability = useMutation(api.time_slots.refreshShopAvailability);

  useEffect(() => {
    if (!isRealShopId) return;
    void refreshShopAvailability({
      shopId: shopId as Id<"shops">,
      startDate: cutoffDate,
    }).catch((error) => {
      console.warn("[availability] failed to refresh shop slots", error);
    });
  }, [cutoffDate, isRealShopId, refreshShopAvailability, shopId]);

  const convexResult = useQuery(
    api.time_slots.getNextAvailableByShopPerMechanic,
    isRealShopId
      ? {
          shopId: shopId as Id<"shops">,
          limitPerMechanic,
          cutoffDate,
          cutoffTime,
        }
      : "skip",
  );

  const slotsByMechanicId = useMemo((): Record<string, MechanicAvailabilitySlot[]> => {
    if (!convexResult || !Array.isArray(convexResult)) return {};
    // Belt-and-braces — server applies the same filter, but re-check
    // here for older convex deploys.
    const today = todayLocalISO();
    const minTime = minBookableHHMM();
    const map: Record<string, MechanicAvailabilitySlot[]> = {};
    for (const { mechanicId, slots } of convexResult) {
      const key = mechanicId as string;
      map[key] = slots
        .filter((s) => s.date !== today || s.start_time >= minTime)
        .map((s) => {
          const { dayOfWeek, day } = dateToDayDisplay(s.date);
          return {
            dayOfWeek,
            day,
            time: hhmmToDisplayTime(s.start_time),
            timeSlotId: s._id as string,
            scheduledDate: s.date,
            scheduledTime: s.start_time,
            mechanicId: key,
          };
        });
    }
    return map;
  }, [convexResult]);

  return {
    slotsByMechanicId,
    isLoading: convexResult === undefined,
    hasSlots: Object.keys(slotsByMechanicId).some((id) => slotsByMechanicId[id].length > 0),
  };
}
