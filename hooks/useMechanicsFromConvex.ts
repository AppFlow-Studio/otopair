/**
 * useMechanicsFromConvex
 *
 * Fetches mechanics from Convex (with shop names) and hydrates useMechanicStore.
 * Used for search, mechanic selection, shop details.
 *
 * USED IN: Discovery, search, shop detail, mechanic selection
 */

import { useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { Mechanic } from "@/stores/types/store.types";
import { useMechanicStore } from "@/stores/useMechanicStore";

type ConvexMechanicListRow = Doc<"mechanics"> & {
  shop?: { name: string } | null;
  shopRating?: number;
  shopReviewCount?: number;
};

function mapConvexMechanicToStore(mechanic: ConvexMechanicListRow): Mechanic {
  const name = `${mechanic.first_name} ${mechanic.last_name}`.trim();
  const shopName = mechanic.shop?.name ?? "Shop";
  return {
    id: mechanic._id as string,
    shopId: mechanic.shop_id as string,
    name,
    title: mechanic.title,
    shopName,
    photoUrl: null,
    rating: mechanic.rating ?? 0,
    reviewCount: mechanic.review_count != null ? Math.round(Number(mechanic.review_count)) : undefined,
    shopRating: mechanic.shopRating ?? 0,
    shopReviewCount: mechanic.shopReviewCount ?? 0,
    isVerified: false,
    distanceMi: 0,
    services: [],
    specialties: [],
    yearsExperience: 0,
    isAvailable: mechanic.is_active ?? true,
    responseTime: "Normal",
    availability: mechanic.is_active ? 7 : 0,
    nextAvailability: [],
  };
}

export function useMechanicsFromConvex() {
  const convexMechanics = useQuery(api.mechanics.list);
  const setMechanics = useMechanicStore((s) => s.setMechanics);

  const mechanics: Mechanic[] = useMemo(() => {
    if (!convexMechanics) return [];
    return (convexMechanics as ConvexMechanicListRow[])
      .filter((m) => m.is_active !== false)
      .map((m) => mapConvexMechanicToStore(m));
  }, [convexMechanics]);

  useEffect(() => {
    if (mechanics.length > 0) {
      setMechanics(mechanics);
    }
  }, [mechanics, setMechanics]);

  return {
    mechanics,
    isLoading: convexMechanics === undefined,
    error: convexMechanics === null ? "Failed to load mechanics" : null,
  };
}
