/**
 * useBookingLaborHoursMap
 *
 * Thin wrapper over useBookingLaborHours that returns the resolved
 * per-service labor hours as a `Map<serviceId, hours>` — ready for the
 * `laborHoursMap.get(id) ?? fallback` lookup the booking flow uses
 * everywhere (legacy mechanic picker, Review & Pay, persisted
 * `estimated_labor_minutes`, and the new (booking-flow) screens).
 *
 * Hours are already engine-adjusted + director-rounded server-side with
 * the empirical → book → engine-tier → catalog-default fallback cascade
 * (see convex/laborTimes.ts `getLaborHoursForServices`). `hasFallback`
 * is true when any selected service fell through to the catalog default,
 * mirroring the Estimate pill on Review & Pay.
 */

import { useMemo } from "react";

import { useBookingLaborHours } from "@/hooks/useBookingLaborHours";

export function useBookingLaborHoursMap(
  vehicleOwnerId: string | undefined,
  serviceIds: string[],
) {
  const { laborHours, isLoading, hasFallback, hasLaborFloor, hasLaborAboveTier } =
    useBookingLaborHours(vehicleOwnerId, serviceIds);

  const laborHoursMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of laborHours) {
      map.set(String(row.serviceId), row.hours);
    }
    return map;
  }, [laborHours]);

  return { laborHoursMap, hasFallback, hasLaborFloor, hasLaborAboveTier, isLoading };
}
