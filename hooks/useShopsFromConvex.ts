/**
 * useShopsFromConvex
 *
 * Fetches shops from Convex with service IDs and hydrates useShopStore.
 * Used for search, shop carousel, shop details.
 *
 * USED IN: Discovery, search, shop detail screens
 */

import { useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { Shop } from "@/stores/types/store.types";
import { useShopStore } from "@/stores/useShopStore";

function mapConvexShopToStore(shop: Doc<"shops">, serviceIds: string[]): Shop {
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

  return {
    shops,
    isLoading: convexShops === undefined,
    error: convexShops === null ? "Failed to load shops" : null,
  };
}
