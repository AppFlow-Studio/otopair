/**
 * useRecentlyBookedShopIdsFromConvex
 *
 * Fetches the current user's recently booked shop IDs from Convex (ordered by
 * most recent booking first). Used in the booking flow search to show
 * "Recently booked" shops.
 *
 * USED IN: FullSearchModal, SearchSuggestions, ServiceBottomSheet
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUserFromConvex } from "./useUserFromConvex";

const DEFAULT_LIMIT = 5;

export function useRecentlyBookedShopIdsFromConvex(limit = DEFAULT_LIMIT) {
  const { userId } = useUserFromConvex();
  const shopIds = useQuery(api.bookings.getRecentlyBookedShopIdsByUserId, userId ? { userId, limit } : "skip");

  return {
    recentlyBookedShopIds: shopIds ?? [],
    isLoading: userId !== undefined && shopIds === undefined,
  };
}
