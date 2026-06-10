/**
 * useClosestShop
 *
 * Returns the single shop closest to the user's current location.
 * Powers the "Closest Shop" hero card on the new booking-flow entry
 * screen (Screen 1).
 *
 * Pure client-side derivation — no new Convex query needed. Reuses
 * the existing useShopsFromConvex hydration and the user's location
 * from useBookingStore.
 */

import { useMemo } from "react";

import { distanceBetween } from "@/utils/geo";
import { useBookingStore } from "@/stores/useBookingStore";
import { useShopStore } from "@/stores/useShopStore";
import type { Shop } from "@/stores/types/store.types";

const KM_PER_MI = 1.609344;

export interface ClosestShopResult {
  shop: Shop;
  distanceMi: number;
}

export function useClosestShop(): {
  result: ClosestShopResult | null;
  isLoading: boolean;
} {
  const shopIds = useShopStore((s) => s.shopIds);
  const shops = useShopStore((s) => s.shops);
  const userLocation = useBookingStore((s) => s.userLocation);

  return useMemo(() => {
    if (shopIds.length === 0) return { result: null, isLoading: true };
    if (!userLocation) return { result: null, isLoading: false };

    let closest: Shop | null = null;
    let closestKm = Number.POSITIVE_INFINITY;
    for (const id of shopIds) {
      const shop = shops[id];
      if (!shop) continue;
      if (shop.latitude === 0 && shop.longitude === 0) continue;
      const km = distanceBetween(
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        { latitude: shop.latitude, longitude: shop.longitude },
      );
      if (km < closestKm) {
        closestKm = km;
        closest = shop;
      }
    }

    if (!closest) return { result: null, isLoading: false };
    return {
      result: {
        shop: closest,
        distanceMi: closestKm / KM_PER_MI,
      },
      isLoading: false,
    };
  }, [shopIds, shops, userLocation]);
}
