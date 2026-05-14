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
import { MOCK_MECHANICS } from "./data/mockMechanics";
import type { Shop, ShopFilters } from "./types/store.types";

// ─────────────────────────────────────────────────────────────
// STORE STATE INTERFACE
// ─────────────────────────────────────────────────────────────

interface ShopState {
  // ═══════════════ DATA ═══════════════
  /** All shops indexed by ID (Convex _id as string) */
  shops: Record<string, Shop>;
  /** Ordered list of shop IDs */
  shopIds: string[];

  // ═══════════════ SELECTION ═══════════════
  /** Currently selected shop ID */
  selectedShopId: string | null;

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
  getShopById: (id: string) => Shop | undefined;
  /** Get filtered shops based on current filters */
  getFilteredShops: () => Shop[];
  /** Get currently selected shop */
  getSelectedShop: () => Shop | undefined;
  /** Get mechanic count for a specific shop */
  getMechanicCountByShopId: (shopId: string) => number;

  // ═══════════════ ACTIONS ═══════════════
  /** Set shops data (from API) */
  setShops: (shops: Shop[]) => void;
  /** Select a shop by ID */
  selectShop: (shopId: string | null) => void;
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
  // ─── TEMP: Skip the MOCK_SHOPS seed so the home/map/booking surfaces
  // stay empty until `useShopsFromConvex` hydrates the store with the
  // Chelala-only filter result. Re-enable the seed below (or drop the
  // upstream filter) when more shops launch on otopair-web. ───
  const initialShops: Record<string, Shop> = {};
  const initialShopIds: string[] = [];
  // MOCK_SHOPS.forEach((shop) => {
  //   const id = String(shop.id);
  //   initialShops[id] = { ...shop, id };
  //   initialShopIds.push(id);
  // });

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

    getMechanicCountByShopId: (shopId) => {
      return MOCK_MECHANICS.filter((m) => String(m.shopId) === shopId).length;
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
          filters.serviceIds.some((serviceId) => shop.serviceIds.includes(serviceId)),
        );
      }

      // Filter by max distance (if distanceKm is set)
      if (filters.maxDistance < 50) {
        filtered = filtered.filter((shop) => shop.distanceKm === null || shop.distanceKm <= filters.maxDistance);
      }

      return filtered;
    },

    // ═══════════════ ACTIONS ═══════════════
    setShops: (shops) =>
      set(() => {
        const shopsRecord: Record<string, Shop> = {};
        const shopIds: string[] = [];
        shops.forEach((shop) => {
          const id = typeof shop.id === "string" ? shop.id : String(shop.id);
          shopsRecord[id] = { ...shop, id };
          shopIds.push(id);
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
