/**
 * useNearbyBookingShops
 *
 * Returns the top-N nearest shops, ordered by:
 *   1. coversAll (shops offering every selected service first)
 *   2. distance (closer first)
 *
 * Used by Screen 3 of the booking flow so the user can swipe the
 * bottom sheet horizontally to walk through nearby shops, with the
 * map camera animating to the active shop on each page change.
 *
 * Pure client-side derivation — no new Convex query. Mirrors
 * useDefaultBookingShop but returns an ordered list instead of the
 * single best match.
 */

import { useMemo } from "react";

import { distanceBetween } from "@/utils/geo";
import { useBookingStore } from "@/stores/useBookingStore";
import { useShopStore } from "@/stores/useShopStore";
import type { Shop } from "@/stores/types/store.types";

const KM_PER_MI = 1.609344;

export interface NearbyShopResult {
  shop: Shop;
  distanceMi: number;
  coversAll: boolean;
}

export function useNearbyBookingShops(limit = 5): {
  results: NearbyShopResult[];
  isLoading: boolean;
} {
  const shopIds = useShopStore((s) => s.shopIds);
  const shops = useShopStore((s) => s.shops);
  const userLocation = useBookingStore((s) => s.userLocation);
  const isLoadingLocation = useBookingStore((s) => s.isLoadingLocation);
  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);

  return useMemo(() => {
    if (shopIds.length === 0) return { results: [], isLoading: true };
    if (!userLocation) return { results: [], isLoading: isLoadingLocation };

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

    candidates.sort((a, b) => {
      if (a.coversAll !== b.coversAll) return a.coversAll ? -1 : 1;
      return a.km - b.km;
    });

    // Dedupe by shop name (case-insensitive) — Ahmad's dev Convex
    // has a few rows that share a name (e.g. "Sunset Auto Repair"
    // appears 3 times). Keep the closest one. Each Convex row has
    // its own `_id`, so id-based dedup would be a no-op; name dedup
    // is the right axis for the user-visible list.
    const seenNames = new Set<string>();
    const deduped: typeof candidates = [];
    for (const c of candidates) {
      const key = c.shop.name.trim().toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      deduped.push(c);
    }

    const top = deduped.slice(0, limit).map((c) => ({
      shop: c.shop,
      distanceMi: c.km / KM_PER_MI,
      coversAll: c.coversAll,
    }));
    return { results: top, isLoading: false };
  }, [shopIds, shops, userLocation, isLoadingLocation, selectedServiceIds, limit]);
}
