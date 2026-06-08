/**
 * useBookingLaborHours
 *
 * Fetches vehicle-specific labor hours for each selected service. Uses
 * `labor_times.book_hours` (manufacturer/manual estimate) for the booking's
 * `vehicle_config_id` when available, otherwise falls back to
 * `services.default_labor_hours`. Mirrors the skip-pattern of
 * useBookingPartsBreakdown so mock `svc_*` slugs and walk-in vehicles
 * don't hit the backend.
 *
 * USED IN: app/booking/mechanic/[id]/payment.tsx
 *          components/booking/sheets/ReviewPayContent.tsx
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { LaborHoursForService } from "@/convex/laborTimes";

const EMPTY: LaborHoursForService[] = [];

function areConvexIds(ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => !id.startsWith("svc_"));
}

export function useBookingLaborHours(
  vehicleOwnerId: string | undefined,
  serviceIds: string[],
) {
  const shouldQuery = !!vehicleOwnerId && areConvexIds(serviceIds);

  const data = useQuery(
    api.laborTimes.getLaborHoursForServices,
    shouldQuery
      ? {
          vehicleOwnerId: vehicleOwnerId as Id<"vehicle_owners">,
          serviceIds: serviceIds as Id<"services">[],
        }
      : "skip",
  ) as LaborHoursForService[] | undefined;

  return useMemo(
    () => ({
      laborHours: data ?? EMPTY,
      isLoading: shouldQuery && data === undefined,
      // True when at least one selected service fell through to
      // services.default_labor_hours (no vehicle-specific row in
      // labor_times). The Estimate pill on Review & Pay reads this so
      // customers know their quote includes an interpolated value.
      hasFallback:
        !!data && data.some((s: LaborHoursForService) => s.source === "default"),
    }),
    [data, shouldQuery],
  );
}
