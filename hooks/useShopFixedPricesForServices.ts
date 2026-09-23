/**
 * useShopFixedPricesForServices
 *
 * Resolves per-(shop, service) fixed/range overrides for the customer's
 * vehicle tier. Wraps `api.shopServiceFixedPrices.getPricingForBooking` — the
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
import {
  servicePricingMapFromCents,
  type ShopServicePriceMap,
} from "@/lib/shopServicePricing";

export type FixedPriceMap = ShopServicePriceMap;

export type UseShopFixedPricesForServicesResult = {
  /** serviceId → normalized dollar endpoints. Only shop overrides are present. */
  map: FixedPriceMap;
  /** True while Convex is hydrating. False once a definitive answer (even
   *  an empty map) has been received. */
  isLoading: boolean;
  /** True when at least one override collapses to one fixed amount. */
  hasAnyFixed: boolean;
  hasAnyRange: boolean;
};

export function useShopFixedPricesForServices(
  shopId: string | null | undefined,
  vehicleOwnerId: string | null | undefined,
  serviceIds: string[],
): UseShopFixedPricesForServicesResult {
  const canQuery =
    !!shopId && !!vehicleOwnerId && serviceIds.length > 0;

  const result = useQuery(
    api.shopServiceFixedPrices.getPricingForBooking,
    canQuery
      ? {
          shop_id: shopId as Id<"shops">,
          vehicle_owner_id: vehicleOwnerId as Id<"vehicle_owners">,
          service_ids: serviceIds as Id<"services">[],
        }
      : "skip",
  );

  return useMemo(() => {
    const map = servicePricingMapFromCents(result);
    return {
      map,
      isLoading: canQuery && result === undefined,
      hasAnyFixed: Array.from(map.values()).some((price) => price.isFixed),
      hasAnyRange: Array.from(map.values()).some((price) => !price.isFixed),
    };
  }, [result, canQuery]);
}
