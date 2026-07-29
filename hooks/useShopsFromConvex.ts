/**
 * useShopsFromConvex
 *
 * Fetches shops from Convex with service IDs and hydrates useShopStore.
 * Used for search, shop carousel, shop details.
 *
 * USED IN: Discovery, search, shop detail screens
 */

import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import * as Location from "expo-location";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { Shop } from "@/stores/types/store.types";
import { useShopStore } from "@/stores/useShopStore";
import { geocodeAddress, type Coords } from "@/utils/geocodeAddress";

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

function mapConvexShopToStore(shop: Doc<"shops"> & { logoUrl?: string | null }, serviceIds: string[]): Shop {
  const address = [shop.address, shop.city, shop.state, shop.zip].filter(Boolean).join(", ");
  return {
    id: shop._id,
    name: shop.name,
    address: address || "Address not available",
    state: shop.state,
    zip: shop.zip,
    phone: shop.phone,
    latitude: shop.lat ?? 0,
    longitude: shop.lng ?? 0,
    distanceKm: null,
    rating: shop.rating ?? null,
    reviewCount: shop.review_count != null ? Math.round(Number(shop.review_count)) : undefined,
    imageUrl: shop.logoUrl ?? null,
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

  // Geocoded coords for shops whose Convex record is missing lat/lng.
  // Keyed by shop id; resolved once per session via expo-location.
  const [geocoded, setGeocoded] = useState<Record<string, Coords>>({});

  const shops: Shop[] = useMemo(() => {
    if (convexShops === undefined || shopServicesList === undefined) return [];

    const serviceIdsByShop: Record<string, string[]> = {};
    for (const ss of shopServicesList) {
      if (!ss.is_offered) continue;
      const shopKey = ss.shop_id as string;
      if (!serviceIdsByShop[shopKey]) serviceIdsByShop[shopKey] = [];
      serviceIdsByShop[shopKey].push(ss.service_id as string);
    }

    return (convexShops as (Doc<"shops"> & { logoUrl?: string | null })[]).map((shop) => {
      const mapped = mapConvexShopToStore(shop, serviceIdsByShop[shop._id as string] ?? []);
      const fallback = geocoded[mapped.id];
      if (fallback && mapped.latitude === 0 && mapped.longitude === 0) {
        return { ...mapped, latitude: fallback.latitude, longitude: fallback.longitude };
      }
      return mapped;
    });
  }, [convexShops, shopServicesList, geocoded]);

  useEffect(() => {
    if (convexShops !== undefined && shopServicesList !== undefined) {
      setShops(shops);
    }
  }, [convexShops, shopServicesList, shops, setShops]);

  // Fire forward-geocoding for any shop missing lat/lng. Resolves are
  // batched into state so a single render hydrates them all.
  useEffect(() => {
    const needsGeocode = shops.filter(
      (s) => s.latitude === 0 && s.longitude === 0 && s.address && !geocoded[s.id],
    );
    if (needsGeocode.length === 0) return;

    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        needsGeocode.map(async (s) => {
          const coords = await geocodeAddress(s.address);
          return coords ? ([s.id, coords] as const) : null;
        }),
      );
      if (cancelled) return;
      const patch: Record<string, Coords> = {};
      for (const r of results) {
        if (r) patch[r[0]] = r[1];
      }
      if (Object.keys(patch).length > 0) {
        setGeocoded((prev) => ({ ...prev, ...patch }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shops, geocoded]);

  return {
    shops,
    isLoading: convexShops === undefined,
    error: convexShops === null ? "Failed to load shops" : null,
  };
}
