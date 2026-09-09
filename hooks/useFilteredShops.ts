/**
 * useFilteredShops
 *
 * PURPOSE: Filters and sorts shops based on user location and filter criteria
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * FEATURES:
 *   - Filters by availability, rating, service IDs
 *   - Sorts by distance or rating
 *   - Limits results for carousel display
 *   - Debounces updates to prevent rapid re-renders
 *
 * OWNER: Waleed Mansour
 */

import { useEffect, useMemo, useRef, useState } from "react";

import type { Shop, ShopFilters, UserLocation } from "@/stores/types/store.types";
import { calculateDistanceKm } from "@/utils/geo";

// ============================================================================
// TYPES
// ============================================================================

interface UseFilteredShopsOptions {
  /** All shops keyed by ID */
  shops: Record<string, Shop>;
  /** Ordered list of shop IDs */
  shopIds: string[];
  /** Current filter criteria */
  filters: ShopFilters;
  /** User's current location (for distance sorting) */
  userLocation: UserLocation | null;
  /** Maximum shops to return (default: 5) */
  maxResults?: number;
  /** Debounce delay in ms when reducing results (default: 50) */
  debounceMs?: number;
}

interface UseFilteredShopsResult {
  /** Filtered and sorted shops */
  filteredShops: Shop[];
  /** Debounced shops for carousel display */
  carouselShops: Shop[];
  /** Whether the filter is currently being applied */
  isFiltering: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_DEBOUNCE_MS = 50;

// ============================================================================
// HOOK
// ============================================================================

export function useFilteredShops({
  shops,
  shopIds,
  filters,
  userLocation,
  maxResults = DEFAULT_MAX_RESULTS,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseFilteredShopsOptions): UseFilteredShopsResult {
  // ═══════════════ FILTERED SHOPS ═══════════════
  const filteredShops = useMemo(() => {
    // Safety check - ensure we have valid data
    if (!shopIds || !shops) return [];

    let filtered = shopIds.map((id) => shops[id]).filter((shop): shop is Shop => shop != null);

    // Apply availability filter (show only shops with availability > 0)
    if (filters.availableOnly) {
      filtered = filtered.filter((shop) => shop.availability > 0);
    }

    // Apply minimum rating filter (for "top_rated" - also sort by rating)
    if (filters.minRating > 0) {
      filtered = filtered
        .filter((shop) => (shop.rating ?? 0) >= filters.minRating)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)); // Sort by rating descending
    }

    // Apply service ID filter
    if (filters.serviceIds && filters.serviceIds.length > 0) {
      filtered = filtered.filter(
        (shop) => shop.serviceIds && filters.serviceIds.some((svcId) => shop.serviceIds.includes(svcId))
      );
    }

    // If no rating filter applied, sort by distance from user location (closest first)
    if (filters.minRating === 0 && userLocation?.latitude && userLocation?.longitude) {
      filtered = [...filtered].sort((a, b) => {
        const distA = calculateDistanceKm(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude);
        const distB = calculateDistanceKm(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude);
        return distA - distB;
      });
    }

    // Limit to max results
    return filtered.slice(0, maxResults);
  }, [shops, shopIds, filters, userLocation, maxResults]);

  // ═══════════════ DEBOUNCED CAROUSEL SHOPS ═══════════════
  const [carouselShops, setCarouselShops] = useState<Shop[]>(filteredShops);
  const [isFiltering, setIsFiltering] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const prevFilteredShopsLengthRef = useRef(filteredShops.length);

  useEffect(() => {
    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // If showing MORE shops (clearing filters), update immediately
    // If showing FEWER shops (adding filters), debounce to prevent crashes
    const isShowingMore = filteredShops.length > prevFilteredShopsLengthRef.current;
    prevFilteredShopsLengthRef.current = filteredShops.length;

    if (isShowingMore || filteredShops.length === 0) {
      // Immediate update when clearing filters or showing more
      setCarouselShops(filteredShops);
      setIsFiltering(false);
    } else {
      // Debounce when filtering down
      setIsFiltering(true);
      debounceRef.current = setTimeout(() => {
        setCarouselShops(filteredShops);
        setIsFiltering(false);
      }, debounceMs);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [filteredShops, debounceMs]);

  return {
    filteredShops,
    carouselShops,
    isFiltering,
  };
}
