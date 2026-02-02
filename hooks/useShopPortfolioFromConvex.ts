/**
 * useShopPortfolioFromConvex
 *
 * Fetches portfolio items (images) for a shop from Convex (cdn_assets + shop_portfolio).
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
  display_order: number;
}

export function useShopPortfolioFromConvex(shopId: string | null) {
  const items = useQuery(
    api.shop_portfolio.listByShopId,
    shopId ? { shopId: shopId as Id<"shops"> } : "skip"
  );

  const portfolio = useMemo((): PortfolioItem[] => {
    if (!items) return [];
    return items
      .filter((x): x is typeof x & { url: string } => x.url != null)
      .map((x) => ({
        id: x._id,
        url: x.url,
        caption: x.caption ?? null,
        display_order: x.display_order,
      }));
  }, [items]);

  return {
    portfolio,
    isLoading: items === undefined,
    error: items === null ? "Failed to load portfolio" : null,
  };
}
