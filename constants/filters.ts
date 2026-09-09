/**
 * Filter Constants
 *
 * PURPOSE: Centralized filter option definitions for booking flow
 *
 * USED IN: TopBar, bookings screen, and filter-related components
 *
 * OWNER: Waleed Mansour
 */

import type { FilterOption } from "@/stores/types/store.types";

// ============================================================================
// SHOP FILTER OPTIONS
// ============================================================================

/** Shop filter display item */
export interface FilterOptionItem {
  id: FilterOption;
  label: string;
}

/** Available shop filter options */
export const SHOP_FILTER_OPTIONS: FilterOptionItem[] = [
  { id: "available_now", label: "Available Now" },
  { id: "top_rated", label: "Top Rated" },
  { id: "specialists", label: "Specialists" },
];

// ============================================================================
// MECHANIC FILTER OPTIONS
// ============================================================================

/** Mechanic filter type */
export type MechanicFilterOption = "available_now" | "distance" | "rating";

/** Mechanic filter display item */
export interface MechanicFilterItem {
  id: MechanicFilterOption;
  label: string;
}

/** Available mechanic filter options */
export const MECHANIC_FILTER_OPTIONS: MechanicFilterItem[] = [
  { id: "available_now", label: "Available Now" },
  { id: "distance", label: "Distance" },
  { id: "rating", label: "Rating" },
];

// ============================================================================
// FILTER PRESETS
// ============================================================================

/** Default shop filter state */
export const DEFAULT_SHOP_FILTERS = {
  availableOnly: false,
  minRating: 0,
  serviceIds: [] as string[],
};

/** Filter preset for "Available Now" */
export const AVAILABLE_NOW_FILTER = {
  availableOnly: true,
  minRating: 0,
};

/** Filter preset for "Top Rated" (4+ stars) */
export const TOP_RATED_FILTER = {
  availableOnly: false,
  minRating: 4.0,
};
