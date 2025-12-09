/**
 * useShopStore
 *
 * PURPOSE: Manages shop/mechanic data for discovery and booking
 *
 * TABLES: Shops (future integration)
 *
 * RELATIONSHIPS:
 *   - Shop has many Bookings (queried from booking store)
 *   - Shop offers many Services (via serviceIds)
 *
 * OWNER: Waleed Mansour
 */

import { create } from "zustand";
import { MOCK_SHOPS } from "./data/mockShops";
import type { Shop, ShopFilters } from "./types/store.types";

// ─────────────────────────────────────────────────────────────
// STORE STATE INTERFACE
// ─────────────────────────────────────────────────────────────

interface ShopState {
  // ═══════════════ DATA ═══════════════
  /** All shops indexed by ID */
  shops: Record<number, Shop>;
  /** Ordered list of shop IDs */
  shopIds: number[];

  // ═══════════════ SELECTION ═══════════════
  /** Currently selected shop ID */
  selectedShopId: number | null;

  // ═══════════════ FILTERS ═══════════════
  /** Current filter settings */
  filters: ShopFilters;

  // ═══════════════ LOADING STATE ═══════════════
  /** Loading state for shop operations */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;

  // ═══════════════ GETTERS ═══════════════
  /** Get shop by ID */
  getShopById: (id: number) => Shop | undefined;
  /** Get filtered shops based on current filters */
  getFilteredShops: () => Shop[];
  /** Get currently selected shop */
  getSelectedShop: () => Shop | undefined;

  // ═══════════════ ACTIONS ═══════════════
  /** Set shops data (from API) */
  setShops: (shops: Shop[]) => void;
  /** Select a shop by ID */
  selectShop: (shopId: number | null) => void;
  /** Update filter settings */
  setFilters: (filters: Partial<ShopFilters>) => void;
  /** Clear all filters to defaults */
  clearFilters: () => void;
}

// ─────────────────────────────────────────────────────────────
// DEFAULT FILTER VALUES
// ─────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: ShopFilters = {
  maxDistance: 50, // 50 km
  minRating: 0,
  availableOnly: false,
  serviceIds: [],
};

// ─────────────────────────────────────────────────────────────
// STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────

export const useShopStore = create<ShopState>()((set, get) => {
  // Initialize with mock data
  const initialShops: Record<number, Shop> = {};
  const initialShopIds: number[] = [];
  MOCK_SHOPS.forEach((shop) => {
    initialShops[shop.id] = shop;
    initialShopIds.push(shop.id);
  });

  return {
    // ═══════════════ INITIAL STATE ═══════════════
    shops: initialShops,
    shopIds: initialShopIds,
    selectedShopId: null,
    filters: DEFAULT_FILTERS,
    isLoading: false,
    error: null,

    // ═══════════════ GETTERS ═══════════════
    getShopById: (id) => {
      const { shops } = get();
      return shops[id];
    },

    getSelectedShop: () => {
      const { shops, selectedShopId } = get();
      return selectedShopId ? shops[selectedShopId] : undefined;
    },

    getFilteredShops: () => {
      const { shops, shopIds, filters } = get();
      let filtered = shopIds.map((id) => shops[id]).filter(Boolean);

      // Filter by availability
      if (filters.availableOnly) {
        filtered = filtered.filter((shop) => shop.hasAvailableSlots);
      }

      // Filter by minimum rating
      if (filters.minRating > 0) {
        filtered = filtered.filter((shop) => (shop.rating ?? 0) >= filters.minRating);
      }

      // Filter by service IDs
      if (filters.serviceIds.length > 0) {
        filtered = filtered.filter((shop) =>
          filters.serviceIds.some((serviceId) => shop.serviceIds.includes(serviceId))
        );
      }

      // Filter by max distance (if distanceKm is set)
      if (filters.maxDistance < 50) {
        filtered = filtered.filter(
          (shop) => shop.distanceKm === null || shop.distanceKm <= filters.maxDistance
        );
      }

      return filtered;
    },

    // ═══════════════ ACTIONS ═══════════════
    setShops: (shops) =>
      set(() => {
        const shopsRecord: Record<number, Shop> = {};
        const shopIds: number[] = [];
        shops.forEach((shop) => {
          shopsRecord[shop.id] = shop;
          shopIds.push(shop.id);
        });
        return {
          shops: shopsRecord,
          shopIds,
        };
      }),

    selectShop: (shopId) =>
      set({
        selectedShopId: shopId,
      }),

    setFilters: (newFilters) =>
      set((state) => ({
        filters: {
          ...state.filters,
          ...newFilters,
          // Ensure serviceIds is always an array
          serviceIds: newFilters.serviceIds ?? state.filters.serviceIds ?? [],
        },
      })),

    clearFilters: () =>
      set({
        filters: DEFAULT_FILTERS,
      }),
  };
});

