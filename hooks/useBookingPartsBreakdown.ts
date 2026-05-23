/**
 * useBookingPartsBreakdown
 *
 * Fetches the per-service OEM parts + average unit prices that should drive
 * the Review & Pay breakdown for the currently-selected vehicle. Skips the
 * Convex query when the vehicle has no `ownershipId` (walk-in flow) or when
 * any selectedServiceIds are still mock slugs ("svc_*") — in either case the
 * caller falls back to the flat `default_parts_estimate` path.
 *
 * USED IN: components/booking/sheets/ReviewPayContent.tsx
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { PricedPartsForService } from "@/convex/serviceParts";

const EMPTY: PricedPartsForService[] = [];

function areConvexIds(ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => !id.startsWith("svc_"));
}

export function useBookingPartsBreakdown(
  vehicleOwnerId: string | undefined,
  serviceIds: string[],
) {
  const shouldQuery = !!vehicleOwnerId && areConvexIds(serviceIds);

  const data = useQuery(
    api.serviceParts.getPricedPartsForServices,
    shouldQuery
      ? {
          vehicleOwnerId: vehicleOwnerId as Id<"vehicle_owners">,
          serviceIds: serviceIds as Id<"services">[],
        }
      : "skip",
  ) as PricedPartsForService[] | undefined;

  return useMemo(
    () => ({
      breakdown: data ?? EMPTY,
      isLoading: shouldQuery && data === undefined,
      hasRealData: !!data && data.some((s: PricedPartsForService) => s.parts.length > 0),
    }),
    [data, shouldQuery],
  );
}
