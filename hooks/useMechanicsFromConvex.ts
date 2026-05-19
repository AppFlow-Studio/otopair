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
import type { Doc, Id } from "@/convex/_generated/dataModel";
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
    // Dedupe by (shop, full-name) — the `mechanics` table has duplicate
    // rows for some mechanics (likely a seed re-run), so without this the
    // picker shows "Luke / Luke / James / James". Keep the first row for
    // each name within a shop.
    const seen = new Set<string>();
    const deduped = (convexMechanics as ConvexMechanicListRow[]).filter((m) => {
      const key = `${String(m.shop_id)}::${(m.first_name ?? "").trim().toLowerCase()}::${(m.last_name ?? "").trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // ─── TEMP: After dedup, only surface mechanics belonging to Chelala
    // Service Center. Same rationale as the Chelala filter in
    // `useShopsFromConvex.ts` — keep mobile in sync with the only shop
    // wired up end-to-end on otopair-web. Remove when more shops go
    // live. ───
    const chelalaOnly = deduped.filter((m) =>
      (m.shop?.name ?? "").toLowerCase().includes("chelala"),
    );
    return chelalaOnly.map((m) => mapConvexMechanicToStore(m as ConvexMechanicListRow));
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
