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
import { positionForChoice } from "@/constants/serviceVariants";

const EMPTY: PricedPartsForService[] = [];

function areConvexIds(ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => !id.startsWith("svc_"));
}

interface ServiceMeta {
  id: string;
  slug?: string;
}

export function useBookingPartsBreakdown(
  vehicleOwnerId: string | undefined,
  serviceIds: string[],
  /** Per-service axle/position choice keyed by serviceId (e.g. "front",
   *  "rear", "both"). Pulled from `useBookingStore.serviceVariants` and
   *  translated through SERVICE_VARIANTS so the resolver picks the right
   *  fitment instead of any well-evidenced one. */
  serviceVariantChoices?: Record<string, string>,
  /** Service metadata (id + slug) needed to map a serviceId's stored choice
   *  to a stable position value. Drawn from useBookingStore.availableServices
   *  by the caller. */
  servicesMeta?: ServiceMeta[],
) {
  const shouldQuery = !!vehicleOwnerId && areConvexIds(serviceIds);

  const serviceVariants = useMemo(() => {
    if (!serviceVariantChoices || !servicesMeta) return undefined;
    const out: Array<{ serviceId: Id<"services">; position: string }> = [];
    for (const id of serviceIds) {
      const choice = serviceVariantChoices[id];
      if (!choice) continue;
      const meta = servicesMeta.find((s) => s.id === id);
      const position = positionForChoice(meta?.slug, choice);
      if (!position) continue;
      out.push({ serviceId: id as Id<"services">, position });
    }
    return out.length > 0 ? out : undefined;
  }, [serviceIds, serviceVariantChoices, servicesMeta]);

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
