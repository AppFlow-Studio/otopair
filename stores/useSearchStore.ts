/**
 * useSearchStore
 *
 * PURPOSE: Manages search state for the home page search functionality
 *          Tracks recent shops, search queries, and provides matching functions
 *
 * USED IN: components/home/HomeSearchOverlay.tsx
 *
 * OWNER: Waleed Mansour
 */

import { create } from "zustand";
import type { Service, ServiceCategory } from "./types/store.types";
import { SERVICE_CATEGORIES_COMPACT } from "@/constants/services";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

/** Maximum number of recent shops to track */
const MAX_RECENT_SHOPS = 5;

/** Maximum number of service suggestions to return */
const MAX_SERVICE_SUGGESTIONS = 3;

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

/** A recent shop entry with timestamp */
interface RecentShop {
  shopId: number;
  timestamp: number;
}

/** Service suggestion result */
export interface ServiceSuggestion {
  type: "service";
  service: Service;
}

/** Category suggestion result */
export interface CategorySuggestion {
  type: "category";
  category: ServiceCategory;
  label: string;
}

/** Combined search suggestion type */
export type SearchSuggestion = ServiceSuggestion | CategorySuggestion;

// ─────────────────────────────────────────────────────────────
// STORE STATE INTERFACE
// ─────────────────────────────────────────────────────────────

interface SearchState {
  // ═══════════════ DATA ═══════════════
  /** Recent shops (most recent first) */
  recentShops: RecentShop[];
  /** Current search query */
  searchQuery: string;

  // ═══════════════ ACTIONS ═══════════════
  /** Set the current search query */
  setSearchQuery: (query: string) => void;
  /** Clear the search query */
  clearSearchQuery: () => void;
  /** Add a shop to recent history */
  addRecentShop: (shopId: number) => void;
  /** Remove a shop from recent history */
  removeRecentShop: (shopId: number) => void;
  /** Clear all recent shops */
  clearRecentShops: () => void;

  // ═══════════════ GETTERS ═══════════════
  /** Get recent shop IDs (most recent first) */
  getRecentShopIds: () => number[];
  /** Get matching services based on query */
  getMatchingServices: (query: string, availableServices: Service[]) => ServiceSuggestion[];
  /** Get matching categories based on query */
  getMatchingCategories: (query: string) => CategorySuggestion[];
  /** Get all search suggestions (services + categories) */
  getSearchSuggestions: (query: string, availableServices: Service[]) => SearchSuggestion[];
}

// ─────────────────────────────────────────────────────────────
// STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────

export const useSearchStore = create<SearchState>()((set, get) => ({
  // ═══════════════ INITIAL STATE ═══════════════
  recentShops: [],
  searchQuery: "",

  // ═══════════════ ACTIONS ═══════════════
  setSearchQuery: (query) =>
    set({
      searchQuery: query,
    }),

  clearSearchQuery: () =>
    set({
      searchQuery: "",
    }),

  addRecentShop: (shopId) =>
    set((state) => {
      // Remove if already exists (to move to front)
      const filtered = state.recentShops.filter((r) => r.shopId !== shopId);
      // Add to front with current timestamp
      const updated = [{ shopId, timestamp: Date.now() }, ...filtered];
      // Keep only MAX_RECENT_SHOPS
      return {
        recentShops: updated.slice(0, MAX_RECENT_SHOPS),
      };
    }),

  removeRecentShop: (shopId) =>
    set((state) => ({
      recentShops: state.recentShops.filter((r) => r.shopId !== shopId),
    })),

  clearRecentShops: () =>
    set({
      recentShops: [],
    }),

  // ═══════════════ GETTERS ═══════════════
  getRecentShopIds: () => {
    const { recentShops } = get();
    return recentShops.map((r) => r.shopId);
  },

  getMatchingServices: (query, availableServices) => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase().trim();

    // Score each service based on match quality
    const scored = availableServices
      .map((service) => {
        const nameLower = service.name.toLowerCase();
        const descLower = service.description.toLowerCase();

        let score = 0;
        // Exact name match = highest score
        if (nameLower === lowerQuery) score = 100;
        // Name starts with query = high score
        else if (nameLower.startsWith(lowerQuery)) score = 80;
        // Name contains query = medium score
        else if (nameLower.includes(lowerQuery)) score = 60;
        // Description contains query = lower score
        else if (descLower.includes(lowerQuery)) score = 40;

        return { service, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SERVICE_SUGGESTIONS)
      .map((item): ServiceSuggestion => ({ type: "service", service: item.service }));

    return scored;
  },

  getMatchingCategories: (query) => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase().trim();

    return SERVICE_CATEGORIES_COMPACT.filter((cat) => cat.label.toLowerCase().includes(lowerQuery)).map(
      (cat): CategorySuggestion => ({
        type: "category",
        category: cat.key,
        label: cat.label,
      })
    );
  },

  getSearchSuggestions: (query, availableServices) => {
    const services = get().getMatchingServices(query, availableServices);
    const categories = get().getMatchingCategories(query);

    // Combine: services first, then categories
    return [...services, ...categories];
  },
}));
