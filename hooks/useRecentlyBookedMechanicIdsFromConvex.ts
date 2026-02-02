/**
 * useRecentlyBookedMechanicIdsFromConvex
 *
 * Fetches the current user's recently booked mechanic IDs from Convex (ordered by
 * most recent booking first). Used in the booking flow search to show
 * "Recently booked" mechanics alongside shops.
 *
 * USED IN: FullSearchModal, SearchSuggestions, ServiceBottomSheet
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUserFromConvex } from "./useUserFromConvex";

const DEFAULT_LIMIT = 5;

export function useRecentlyBookedMechanicIdsFromConvex(limit = DEFAULT_LIMIT) {
  const { userId } = useUserFromConvex();
  const mechanicIds = useQuery(
    api.bookings.getRecentlyBookedMechanicIdsByUserId,
    userId ? { userId, limit } : "skip"
  );

  return {
    recentlyBookedMechanicIds: mechanicIds ?? [],
    isLoading: userId !== undefined && mechanicIds === undefined,
  };
}
