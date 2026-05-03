/**
 * useNextAvailabilityPerMechanicForShop
 *
 * Fetches next N available Convex time slots **per mechanic** for a shop.
 * Used by ShopDetails "Available Mechanics & Bays" so each mechanic card
 * shows that mechanic's own time slots (Mike, Sarah, etc.).
 *
 * USED IN: components/booking/ShopDetails.tsx
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MechanicAvailabilitySlot } from "@/stores/types/store.types";
import { dateToDayDisplay, hhmmToDisplayTime } from "@/utils/timeSlotUtils";

const DEFAULT_LIMIT_PER_MECHANIC = 12;

export function useNextAvailabilityPerMechanicForShop(
  shopId: string | null,
  limitPerMechanic: number = DEFAULT_LIMIT_PER_MECHANIC,
) {
  const isRealShopId = shopId != null && shopId.length > 10;
  const convexResult = useQuery(
    api.time_slots.getNextAvailableByShopPerMechanic,
    isRealShopId
      ? {
          shopId: shopId as Id<"shops">,
          limitPerMechanic,
        }
      : "skip",
  );

  const slotsByMechanicId = useMemo((): Record<string, MechanicAvailabilitySlot[]> => {
    if (!convexResult || !Array.isArray(convexResult)) return {};
    const map: Record<string, MechanicAvailabilitySlot[]> = {};
    for (const { mechanicId, slots } of convexResult) {
      const key = mechanicId as string;
      map[key] = slots.map((s) => {
        const { dayOfWeek, day } = dateToDayDisplay(s.date);
        return {
          dayOfWeek,
          day,
          time: hhmmToDisplayTime(s.start_time),
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
