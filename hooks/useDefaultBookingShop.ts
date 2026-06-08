/**
 * useDefaultBookingShop
 *
 * Derives the default shop for Screen 3 of the booking flow:
 *   the closest shop (by haversine distance from the user) that
 *   offers every service in the user's current cart.
 *
 * Falls back gracefully:
 *  - If no shop offers ALL selected services, returns the closest
 *    shop that offers at least one, with `coversAll: false`.
 *  - If the user has no selection yet, returns the closest active
 *    shop regardless of services.
 *
 * Pure client-side derivation — no new Convex query. Reads from the
 * already-hydrated shop store + booking store.
 */

import { useMemo } from "react";

import { distanceBetween } from "@/utils/geo";
import { useBookingStore } from "@/stores/useBookingStore";
import { useShopStore } from "@/stores/useShopStore";
import type { Shop } from "@/stores/types/store.types";

const KM_PER_MI = 1.609344;

export interface DefaultBookingShopResult {
  shop: Shop;
  distanceMi: number;
  /** True when this shop offers every service in selectedServiceIds. */
  coversAll: boolean;
}

export function useDefaultBookingShop(): {
  result: DefaultBookingShopResult | null;
  isLoading: boolean;
} {
  const shopIds = useShopStore((s) => s.shopIds);
  const shops = useShopStore((s) => s.shops);
  const userLocation = useBookingStore((s) => s.userLocation);
  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);

  return useMemo(() => {
    if (shopIds.length === 0) return { result: null, isLoading: true };
    if (!userLocation) return { result: null, isLoading: false };

    const candidates: { shop: Shop; km: number; coversAll: boolean }[] = [];
    for (const id of shopIds) {
      const shop = shops[id];
      if (!shop) continue;
      if (shop.latitude === 0 && shop.longitude === 0) continue;
      const km = distanceBetween(
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        { latitude: shop.latitude, longitude: shop.longitude },
      );
      const coversAll =
        selectedServiceIds.length === 0
          ? true
          : selectedServiceIds.every((sid) => shop.serviceIds.includes(sid));
      candidates.push({ shop, km, coversAll });
    }

    if (candidates.length === 0) return { result: null, isLoading: false };

    // Prefer covers-all; among those, pick closest. If none cover all,
    // pick the closest overall.
    candidates.sort((a, b) => {
      if (a.coversAll !== b.coversAll) return a.coversAll ? -1 : 1;
      return a.km - b.km;
    });
    const top = candidates[0];
    return {
      result: {
        shop: top.shop,
        distanceMi: top.km / KM_PER_MI,
        coversAll: top.coversAll,
      },
      isLoading: false,
    };
  }, [shopIds, shops, userLocation, selectedServiceIds]);
}
