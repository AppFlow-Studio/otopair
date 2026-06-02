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
import { positionFromOption } from "@/constants/serviceVariants";
import type { ServiceOptionSelection } from "@/stores/types/store.types";

const EMPTY: PricedPartsForService[] = [];

function areConvexIds(ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => !id.startsWith("svc_"));
}

export function useBookingPartsBreakdown(
  vehicleOwnerId: string | undefined,
  serviceIds: string[],
  /** The full `selectedServiceOptions` map from `useBookingStore`. Position-
   *  bearing options (option_type === "position") are translated to a
   *  `position` filter on `getPricedPartsForServices` so the resolver returns
   *  the customer-picked axle instead of any well-evidenced fitment. */
  selectedServiceOptions?: Record<string, ServiceOptionSelection>,
) {
  const shouldQuery = !!vehicleOwnerId && areConvexIds(serviceIds);

  const serviceVariants = useMemo(() => {
    if (!selectedServiceOptions) return undefined;
    const out: Array<{ serviceId: Id<"services">; position: string }> = [];
    for (const id of serviceIds) {
      const position = positionFromOption(selectedServiceOptions[id]);
      if (!position) continue;
      out.push({ serviceId: id as Id<"services">, position });
    }
    return out.length > 0 ? out : undefined;
  }, [serviceIds, selectedServiceOptions]);

  const data = useQuery(
    api.serviceParts.getPricedPartsForServices,
    shouldQuery
      ? {
          vehicleOwnerId: vehicleOwnerId as Id<"vehicle_owners">,
          serviceIds: serviceIds as Id<"services">[],
          ...(serviceVariants ? { serviceVariants } : {}),
        }
      : "skip",
  ) as PricedPartsForService[] | undefined;

  return useMemo(
    () => ({
      breakdown: data ?? EMPTY,
      isLoading: shouldQuery && data === undefined,
      hasRealData: !!data && data.some((s: PricedPartsForService) => s.winner !== null),
    }),
    [data, shouldQuery],
  );
}
