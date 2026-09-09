/**
 * useShopPortfolioFromConvex
 *
 * Fetches portfolio items (images) for a shop from Convex. Rows resolve from
 * two sources server-side: owner uploads in Convex storage and legacy
 * cdn_assets seed references. The server returns them pre-sorted by
 * display_order (tie-broken by creation time) — that order is canonical, so
 * no client-side re-sort.
 *
 * USED IN: ShopPortfolioSection
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export interface PortfolioItem {
  id: string;
  url: string;
  caption: string | null;
}

export function useShopPortfolioFromConvex(shopId: string | null) {
  const items = useQuery(api.shop_portfolio.listByShopId, shopId ? { shopId: shopId as Id<"shops"> } : "skip");

  const portfolio = useMemo((): PortfolioItem[] => {
    if (!items) return [];
    const rows: PortfolioItem[] = [];
    for (const item of items) {
      if (item.url != null) {
        rows.push({ id: item._id, url: item.url, caption: item.caption ?? null });
      }
    }
    return rows;
  }, [items]);

  return {
    portfolio,
    isLoading: items === undefined,
    error: items === null ? "Failed to load portfolio" : null,
  };
}
