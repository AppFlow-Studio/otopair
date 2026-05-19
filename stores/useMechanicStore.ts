/**
 * useMechanicStore
 *
 * PURPOSE: Manages mechanic data for mechanic selection during booking flow
 *
 * TABLES: Mechanics (future integration)
 *
 * RELATIONSHIPS:
 *   - Mechanic belongs to Shop (via shopId)
 *   - Mechanic has many Specialties (service IDs)
 *   - Mechanic has many Availability Slots
 *
 * OWNER: Waleed Mansour
 */

import { create } from "zustand";
import { MOCK_MECHANICS } from "./data/mockMechanics";
import type { Mechanic, MechanicFilters } from "./types/store.types";

// ─────────────────────────────────────────────────────────────
// STORE STATE INTERFACE
// ─────────────────────────────────────────────────────────────

interface MechanicState {
  // ═══════════════ DATA ═══════════════
  /** All mechanics indexed by ID (Convex _id as string) */
  mechanics: Record<string, Mechanic>;
  /** Ordered list of mechanic IDs */
  mechanicIds: string[];

  // ═══════════════ SELECTION ═══════════════
  /** Currently selected mechanic ID */
  selectedMechanicId: string | null;

  // ═══════════════ FILTERS ═══════════════
  /** Current filter settings */
  filters: MechanicFilters;

  // ═══════════════ LOADING STATE ═══════════════
  /** Loading state for mechanic operations */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;

  // ═══════════════ GETTERS ═══════════════
  /** Get mechanic by ID */
  getMechanicById: (id: string) => Mechanic | undefined;
  /** Get filtered mechanics based on current filters */
  getFilteredMechanics: () => Mechanic[];
  /** Get currently selected mechanic */
  getSelectedMechanic: () => Mechanic | undefined;
  /** Get mechanics by shop ID */
  getMechanicsByShopId: (shopId: string) => Mechanic[];

  // ═══════════════ ACTIONS ═══════════════
  /** Set mechanics data (from API) */
  setMechanics: (mechanics: Mechanic[]) => void;
  /** Select a mechanic by ID */
  selectMechanic: (mechanicId: number | null) => void;
  /** Update filter settings */
  setFilters: (filters: Partial<MechanicFilters>) => void;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Clear all filters to defaults */
  clearFilters: () => void;
}

// ─────────────────────────────────────────────────────────────
// DEFAULT FILTER VALUES
// ─────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: MechanicFilters = {
  filterType: "available_now",
  searchQuery: "",
};

// ─────────────────────────────────────────────────────────────
// STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────

export const useMechanicStore = create<MechanicState>()((set, get) => {
  // Skip the MOCK_MECHANICS seed — `useMechanicsFromConvex` hydrates the
  // store with real Convex data.
  const initialMechanics: Record<string, Mechanic> = {};
  const initialMechanicIds: string[] = [];

  return {
    // ═══════════════ INITIAL STATE ═══════════════
    mechanics: initialMechanics,
    mechanicIds: initialMechanicIds,
    selectedMechanicId: null,
    filters: DEFAULT_FILTERS,
    isLoading: false,
    error: null,

    // ═══════════════ GETTERS ═══════════════
    getMechanicById: (id) => {
      const { mechanics } = get();
      return mechanics[id];
    },

    getSelectedMechanic: () => {
      const { mechanics, selectedMechanicId } = get();
      return selectedMechanicId ? mechanics[selectedMechanicId] : undefined;
    },

    getMechanicsByShopId: (shopId) => {
      const { mechanics, mechanicIds } = get();
      return mechanicIds.map((id) => mechanics[id]).filter((m) => m && String(m.shopId) === shopId);
    },

    getFilteredMechanics: () => {
      const { mechanics, mechanicIds, filters } = get();
      let filtered = mechanicIds.map((id) => mechanics[id]).filter(Boolean);

      // Filter by search query
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (mechanic) => mechanic.name.toLowerCase().includes(query) || mechanic.shopName.toLowerCase().includes(query),
        );
      }

      // Apply filter type and sort
      switch (filters.filterType) {
        case "available_now":
          // Filter to only available mechanics, then sort by response time (Quick first)
          filtered = filtered
            .filter((mechanic) => mechanic.isAvailable)
            .sort((a, b) => {
              const responseOrder = { Quick: 0, Normal: 1, Slow: 2 };
              return responseOrder[a.responseTime] - responseOrder[b.responseTime];
            });
          break;
        case "distance":
          // Sort by distance (closest first)
          filtered = [...filtered].sort((a, b) => a.distanceMi - b.distanceMi);
          break;
        case "rating":
          // Sort by rating (highest first)
          filtered = [...filtered].sort((a, b) => b.rating - a.rating);
          break;
      }

      return filtered;
    },

    // ═══════════════ ACTIONS ═══════════════
    setMechanics: (mechanics) =>
      set(() => {
        const mechanicsRecord: Record<string, Mechanic> = {};
        const mechanicIds: string[] = [];
        mechanics.forEach((mechanic) => {
          const id = typeof mechanic.id === "string" ? mechanic.id : String(mechanic.id);
          const shopId = typeof mechanic.shopId === "string" ? mechanic.shopId : String(mechanic.shopId);
          mechanicsRecord[id] = { ...mechanic, id, shopId };
          mechanicIds.push(id);
        });
        return {
          mechanics: mechanicsRecord,
          mechanicIds,
        };
      }),

    selectMechanic: (mechanicId) =>
      set({
        selectedMechanicId: mechanicId,
      }),

    setFilters: (newFilters) =>
      set((state) => ({
        filters: {
          ...state.filters,
          ...newFilters,
        },
      })),

    setSearchQuery: (query) =>
      set((state) => ({
        filters: {
          ...state.filters,
          searchQuery: query,
        },
      })),

    clearFilters: () =>
      set({
        filters: DEFAULT_FILTERS,
      }),
  };
});
