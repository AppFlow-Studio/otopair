/**
 * Shop Filtering Utilities
 *
 * PURPOSE: Provides reusable filtering logic for shop/mechanic listings
 *
 * USED IN: components/booking/map.tsx, and other components that need shop filtering
 *
 * OWNER: Waleed Mansour, Ahmad Hamoudeh
 */

import type { Shop, ShopFilters } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

export interface FilterShopsOptions {
  /** Record of shops keyed by id */
  shopsRecord: Record<string, Shop>;
  /** Ordered array of shop ids */
  shopIds: string[];
  /** Active filter settings */
  filters: ShopFilters;
}

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Filters shops based on the provided filter settings
 *
 * @param options - The shops data and filter settings
 * @returns Array of filtered shops
 *
 * @example
 * const filteredShops = filterShops({
 *   shopsRecord: shops,
 *   shopIds: ['shop1', 'shop2'],
 *   filters: { availableOnly: true, minRating: 4 }
 * });
 */
export function filterShops({ shopsRecord, shopIds, filters }: FilterShopsOptions): Shop[] {
  // Safety check - ensure we have valid data
  if (!shopIds || !shopsRecord) return [];

  let filtered = shopIds.map((id) => shopsRecord[id]).filter((shop): shop is Shop => shop != null);

  // Filter by availability (show only shops with availability > 0)
  if (filters.availableOnly) {
    filtered = filtered.filter((shop) => shop.availability > 0);
  }

  // Filter by minimum rating
  if (filters.minRating > 0) {
    filtered = filtered.filter((shop) => (shop.rating ?? 0) >= filters.minRating);
  }

  // Filter by service IDs
  if (filters.serviceIds && filters.serviceIds.length > 0) {
    filtered = filtered.filter(
      (shop) => shop.serviceIds && filters.serviceIds.some((serviceId) => shop.serviceIds.includes(serviceId))
    );
  }

  return filtered;
}

/**
 * Checks if a single shop matches the given filters
 *
 * @param shop - The shop to check
 * @param filters - The filter settings to apply
 * @returns true if the shop matches all filters
 *
 * @example
 * if (shopMatchesFilters(shop, { minRating: 4.5 })) {
 *   // Shop has rating >= 4.5
 * }
 */
export function shopMatchesFilters(shop: Shop, filters: Partial<ShopFilters>): boolean {
  // Check availability filter
  if (filters.availableOnly && shop.availability <= 0) {
    return false;
  }

  // Check minimum rating filter
  if (filters.minRating && (shop.rating ?? 0) < filters.minRating) {
    return false;
  }

  // Check service IDs filter
  if (filters.serviceIds && filters.serviceIds.length > 0) {
    if (!shop.serviceIds || !filters.serviceIds.some((serviceId) => shop.serviceIds.includes(serviceId))) {
      return false;
    }
  }

  return true;
}




