/**
 * useShopFixedPricesForServices
 *
 * Resolves per-(shop, service) flat-price overrides for the customer's
 * vehicle tier. Wraps `api.shopServiceFixedPrices.getForBooking` — the
 * server picks the right tier from the vehicle's pricing_tier (or detects
 * it), so the client never has to know what tier a car is in.
 *
 * Skips the query when any input is missing so the hook is safe to mount
 * before the user has selected a shop / vehicle.
 *
 * USED IN: ReviewPayContent, ServiceBottomSheet footer, ShopCard (via
 * MechanicSelectionContent batch).
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type FixedPriceMap = Map<string, number>;

export type UseShopFixedPricesForServicesResult = {
  /** serviceId → flat price in dollars. Only flagged services are present. */
  map: FixedPriceMap;
  /** True while Convex is hydrating. False once a definitive answer (even
   *  an empty map) has been received. */
  isLoading: boolean;
  /** Convenience flag — true iff `map.size > 0`. UI uses this to decide
   *  whether to render the "Fixed price" badge at the total level. */
  hasAnyFixed: boolean;
};

export function useShopFixedPricesForServices(
  shopId: string | null | undefined,
  vehicleOwnerId: string | null | undefined,
  serviceIds: string[],
): UseShopFixedPricesForServicesResult {
  const canQuery =
    !!shopId && !!vehicleOwnerId && serviceIds.length > 0;

  const result = useQuery(
    api.shopServiceFixedPrices.getForBooking,
    canQuery
      ? {
          shop_id: shopId as Id<"shops">,
          vehicle_owner_id: vehicleOwnerId as Id<"vehicle_owners">,
          service_ids: serviceIds as Id<"services">[],
        }
      : "skip",
  );

  return useMemo(() => {
    const map: FixedPriceMap = new Map();
    if (result) {
      for (const [serviceId, cents] of Object.entries(result)) {
        map.set(serviceId, (cents as number) / 100);
      }
    }
    return {
      map,
      isLoading: canQuery && result === undefined,
      hasAnyFixed: map.size > 0,
    };
  }, [result, canQuery]);
}
