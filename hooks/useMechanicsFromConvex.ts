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
  /** Resolved download URL for `photo` (a storage id), added by
   *  `mechanics.list`. Absent from the raw Doc, which is why this row type
   *  has to state it — and why it went unnoticed that the mapper dropped it. */
  photoUrl?: string | null;
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
    // `mechanics.list` resolves this from the mechanic's `photo` storage id
    // (convex/mechanics.ts → resolveMechanicPhotoUrl) and returns it on every
    // row. This mapper used to hardcode null, so a photo a shop uploaded in
    // the portal's Team page never reached the app — every mechanic rendered
    // as initials no matter what the shop did. The other zeroed fields below
    // ARE correct: the mechanics table has no specialties / years_experience /
    // is_verified columns, so there is genuinely nothing upstream to map.
    photoUrl: mechanic.photoUrl ?? null,
    rating: mechanic.rating ?? 0,
    reviewCount: mechanic.review_count != null ? Math.round(Number(mechanic.review_count)) : undefined,
    shopRating: mechanic.shopRating ?? 0,
    shopReviewCount: mechanic.shopReviewCount ?? 0,
    isVerified: false,
    isBay: (mechanic as any).entity_type === "bay",
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
    if (convexMechanics !== undefined) {
      setMechanics(mechanics);
    }
  }, [convexMechanics, mechanics, setMechanics]);

  return {
    mechanics,
    isLoading: convexMechanics === undefined,
    error: convexMechanics === null ? "Failed to load mechanics" : null,
  };
}
