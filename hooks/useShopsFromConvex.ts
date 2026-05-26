/**
 * useShopsFromConvex
 *
 * Fetches shops from Convex with service IDs and hydrates useShopStore.
 * Used for search, shop carousel, shop details.
 *
 * USED IN: Discovery, search, shop detail screens
 */

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
import * as Location from "expo-location";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { Shop } from "@/stores/types/store.types";
import { useShopStore } from "@/stores/useShopStore";

// Shops we've already tried to geocode this app session — module-level so
// the attempt isn't repeated across the many screens that mount this hook.
const attemptedShopGeocode = new Set<string>();

function shopNeedsCoords(s: Shop): boolean {
  return (
    s.latitude == null ||
    s.longitude == null ||
    (s.latitude === 0 && s.longitude === 0)
  );
}

function mapConvexShopToStore(shop: Doc<"shops">, serviceIds: string[]): Shop {
  const address = [shop.address, shop.city, shop.state, shop.zip].filter(Boolean).join(", ");
  return {
    id: shop._id,
    name: shop.name,
    address: address || "Address not available",
    phone: shop.phone,
    latitude: shop.lat ?? 0,
    longitude: shop.lng ?? 0,
    distanceKm: null,
    rating: shop.rating ?? null,
    reviewCount: shop.review_count != null ? Math.round(Number(shop.review_count)) : undefined,
    imageUrl: null,
    availability: shop.is_active ? 7 : 0,
    hasAvailableSlots: shop.is_active ?? false,
    nextAvailableSlot: shop.is_active ? null : null,
    serviceIds,
    labor_rate: shop.labor_rate,
  };
}

export function useShopsFromConvex() {
  const convexShops = useQuery(api.shops.list);
  const shopServicesList = useQuery(api.shop_services.list);
  const setShops = useShopStore((s) => s.setShops);
  const setShopCoords = useMutation(api.shops.setShopCoords);

  const shops: Shop[] = useMemo(() => {
    if (!convexShops || !shopServicesList) return [];

    const serviceIdsByShop: Record<string, string[]> = {};
    for (const ss of shopServicesList) {
      if (!ss.is_offered) continue;
      const shopKey = ss.shop_id as string;
      if (!serviceIdsByShop[shopKey]) serviceIdsByShop[shopKey] = [];
      serviceIdsByShop[shopKey].push(ss.service_id as string);
    }

    return (convexShops as Doc<"shops">[]).map((shop) => mapConvexShopToStore(shop, serviceIdsByShop[shop._id as string] ?? []));
  }, [convexShops, shopServicesList]);

  useEffect(() => {
    if (shops.length > 0) {
      setShops(shops);
    }
  }, [shops, setShops]);

  // Keyless geocode backfill: any shop without coords gets its address
  // resolved on-device (expo-location, no API key) and persisted to
  // Convex. The first session to view shops fills coords for everyone;
  // the mutation only backfills, so it never clobbers real coords.
  useEffect(() => {
    const missing = shops.filter(
      (s) =>
        !attemptedShopGeocode.has(s.id) &&
        !!s.address &&
        s.address !== "Address not available" &&
        shopNeedsCoords(s),
    );
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      for (const shop of missing) {
        if (cancelled) break;
        attemptedShopGeocode.add(shop.id);
        try {
          const results = await Location.geocodeAsync(shop.address);
          const hit = results?.[0];
          if (
            hit &&
            typeof hit.latitude === "number" &&
            typeof hit.longitude === "number"
          ) {
            await setShopCoords({
              shopId: shop.id as Id<"shops">,
              lat: hit.latitude,
              lng: hit.longitude,
            });
          }
        } catch {
          // OS geocoder rate-limited or unavailable — leave for a later
          // session rather than spamming retries.
        }
        // Gentle throttle to respect the OS geocoder's rate limits.
        await new Promise((r) => setTimeout(r, 400));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shops, setShopCoords]);

  return {
    shops,
    isLoading: convexShops === undefined,
    error: convexShops === null ? "Failed to load shops" : null,
  };
}
