/**
 * useMechanicStore
 *
 * PURPOSE: Manages mechanic shop data, discovery, filtering, and selection state
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
import type { FilterOption, ServiceCategory, Shop } from "./types/store.types";

// ─────────────────────────────────────────────────────────────
// STORE STATE INTERFACE
// ─────────────────────────────────────────────────────────────

interface MechanicState {
  // ═══════════════ DATA (like database tables) ═══════════════
  /** All shops indexed by ID */
  shops: Record<number, Shop>;
  /** Ordered list of shop IDs */
  shopIds: number[];
  /** Currently selected shop ID */
  selectedShopId: number | null;

  // ═══════════════ FILTER STATE ═══════════════
  /** Selected filter option (Available Now, Top Rated, Specialists) */
  selectedFilter: FilterOption | null;
  /** Selected service category for filtering shops */
  selectedServiceCategory: ServiceCategory | null;

  // ═══════════════ LOADING & ERROR STATE ═══════════════
  /** Loading state for shop operations */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;

  // ═══════════════ SHOP ACTIONS ═══════════════
  /** Set shops data (from API) */
  setShops: (shops: Shop[]) => void;
  /** Add or update a single shop */
  setShop: (shop: Shop) => void;
  /** Remove a shop by ID */
  removeShop: (shopId: number) => void;
  /** Clear all shops */
  clearShops: () => void;

  // ═══════════════ SELECTION ACTIONS ═══════════════
  /** Set the selected shop ID */
  setSelectedShopId: (shopId: number | null) => void;
  /** Clear selected shop */
  clearSelectedShop: () => void;

  // ═══════════════ FILTER ACTIONS ═══════════════
  /** Set the selected filter option */
  setSelectedFilter: (filter: FilterOption | null) => void;
  /** Set the selected service category */
  setSelectedServiceCategory: (category: ServiceCategory | null) => void;
  /** Clear all filters */
  clearFilters: () => void;

  // ═══════════════ GETTERS ═══════════════
  /** Get shop by ID */
  getShopById: (shopId: number) => Shop | undefined;
  /** Get currently selected shop */
  getSelectedShop: () => Shop | null;
  /** Get all shops as array */
  getAllShops: () => Shop[];
  /** Get shops filtered by current filters */
  getFilteredShops: () => Shop[];
  /** Get nearby shops sorted by distance */
  getNearbyShops: (latitude: number, longitude: number, maxDistance?: number) => Shop[];
  /** Check if filters are active */
  hasActiveFilters: () => boolean;
  /** Get shops count */
  getShopsCount: () => number;
}

// ─────────────────────────────────────────────────────────────
// STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────

export const useMechanicStore = create<MechanicState>()((set, get) => {
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
    selectedFilter: null,
    selectedServiceCategory: null,
    isLoading: false,
    error: null,

    // ═══════════════ SHOP ACTIONS ═══════════════
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

    setShop: (shop) =>
      set((state) => {
        const newShops = { ...state.shops, [shop.id]: shop };
        const newShopIds = state.shopIds.includes(shop.id) ? state.shopIds : [...state.shopIds, shop.id];
        return {
          shops: newShops,
          shopIds: newShopIds,
        };
      }),

    removeShop: (shopId) =>
      set((state) => {
        const { [shopId]: removed, ...remainingShops } = state.shops;
        return {
          shops: remainingShops,
          shopIds: state.shopIds.filter((id) => id !== shopId),
          selectedShopId: state.selectedShopId === shopId ? null : state.selectedShopId,
        };
      }),

    clearShops: () =>
      set({
        shops: {},
        shopIds: [],
        selectedShopId: null,
      }),

    // ═══════════════ SELECTION ACTIONS ═══════════════
    setSelectedShopId: (shopId) =>
      set({
        selectedShopId: shopId,
      }),

    clearSelectedShop: () =>
      set({
        selectedShopId: null,
      }),

    // ═══════════════ FILTER ACTIONS ═══════════════
    setSelectedFilter: (filter) =>
      set({
        selectedFilter: filter,
      }),

    setSelectedServiceCategory: (category) =>
      set({
        selectedServiceCategory: category,
      }),

    clearFilters: () =>
      set({
        selectedFilter: null,
        selectedServiceCategory: null,
      }),

    // ═══════════════ GETTERS ═══════════════
    getShopById: (shopId) => {
      const { shops } = get();
      return shops[shopId];
    },

    getSelectedShop: () => {
      const { shops, selectedShopId } = get();
      return selectedShopId ? shops[selectedShopId] || null : null;
    },

    getAllShops: () => {
      const { shops, shopIds } = get();
      return shopIds.map((id) => shops[id]).filter(Boolean);
    },

    getFilteredShops: () => {
      const { shops, shopIds, selectedFilter, selectedServiceCategory } = get();
      let filtered = shopIds.map((id) => shops[id]).filter(Boolean);

      // Filter by service category (if selected)
      if (selectedServiceCategory) {
        // TODO: Filter by shops that offer services in this category
        // This would require a shop.services or shop.serviceCategories field
        // For now, return all shops
      }

      // Filter by filter option
      if (selectedFilter === "available_now") {
        // Only show shops with availability > 0 (not closed)
        filtered = filtered.filter((shop) => shop.availability > 0);
      } else if (selectedFilter === "top_rated") {
        // Sort by rating (highest first), then by verified status
        filtered = filtered.sort((a, b) => {
          if (b.rating !== a.rating) {
            return b.rating - a.rating;
          }
          // If ratings are equal, prioritize verified shops
          return a.isVerified === b.isVerified ? 0 : a.isVerified ? -1 : 1;
        });
      } else if (selectedFilter === "specialists") {
        // Filter by verified shops (as a proxy for specialists)
        filtered = filtered.filter((shop) => shop.isVerified);
      }

      return filtered;
    },

    getNearbyShops: (latitude, longitude, maxDistance) => {
      const { shops, shopIds } = get();
      const allShops = shopIds.map((id) => shops[id]).filter(Boolean);

      // Calculate distance using Haversine formula
      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 3959; // Earth's radius in miles
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      // Calculate distances and sort
      const shopsWithDistance = allShops.map((shop) => ({
        shop,
        distance: calculateDistance(latitude, longitude, shop.coordinate.latitude, shop.coordinate.longitude),
      }));

      // Filter by maxDistance if provided
      let filtered = shopsWithDistance;
      if (maxDistance !== undefined && maxDistance > 0) {
        filtered = shopsWithDistance.filter((item) => item.distance <= maxDistance);
      }

      // Sort by distance and return shops
      return filtered.sort((a, b) => a.distance - b.distance).map((item) => item.shop);
    },

    hasActiveFilters: () => {
      const { selectedFilter, selectedServiceCategory } = get();
      return selectedFilter !== null || selectedServiceCategory !== null;
    },

    getShopsCount: () => {
      const { shopIds } = get();
      return shopIds.length;
    },
  };
});
