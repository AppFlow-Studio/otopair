/**
 * useTireBookingStore
 *
 * PURPOSE: UI-only state for the Tire Booking Flow skeleton. Tracks the
 *          user's size/type/tier selections, the set of tire positions they
 *          want replaced (FL/FR/RL/RR), the mocked shop-quote results, and
 *          the accepted quote. Mirrors the spec's Request/Response shape so
 *          a Convex wire-up later is a straight swap.
 *
 * TODO(convex): replace fireRequest() with a real Convex action that
 *   broadcasts to partner shops and subscribes to responses. Keep the same
 *   store API so screens don't have to change.
 */

import { create } from "zustand";

import {
  MOCK_SHOP_RESPONSES,
  type TireQuote,
  type TireTierId,
  type TireTypeId,
} from "@/constants/tireFlow";

// ============================================================================
// TYPES
// ============================================================================

export type TirePosition = "FL" | "FR" | "RL" | "RR";

interface TireBookingState {
  vehicleId: string | null;
  tireSize: string | null;
  tireType: TireTypeId | null;
  tier: TireTierId | null;
  /** Tire positions the user wants replaced. Quantity is derived from length. */
  selectedTirePositions: TirePosition[];

  // Results
  quotes: TireQuote[];
  isLoading: boolean;
  selectedQuoteId: string | null;

  // Mutators
  reset: () => void;
  setVehicleId: (id: string | null) => void;
  setSize: (size: string) => void;
  setType: (type: TireTypeId) => void;
  setTier: (tier: TireTierId) => void;
  toggleTirePosition: (p: TirePosition) => void;
  setTirePositions: (p: TirePosition[]) => void;
  fireRequest: () => Promise<void>;
  cancelRequest: () => void;
  acceptQuote: (quoteId: string) => TireQuote | null;
}

// ============================================================================
// DEFAULTS
// ============================================================================

const DEFAULT_STATE = {
  vehicleId: null as string | null,
  tireSize: null as string | null,
  tireType: null as TireTypeId | null,
  tier: null as TireTierId | null,
  selectedTirePositions: [] as TirePosition[],
  quotes: [] as TireQuote[],
  isLoading: false,
  selectedQuoteId: null as string | null,
};

// Fixed canonical order used whenever we normalize a position set.
const POSITION_ORDER: TirePosition[] = ["FL", "FR", "RL", "RR"];

function normalize(positions: TirePosition[]): TirePosition[] {
  const set = new Set(positions);
  return POSITION_ORDER.filter((p) => set.has(p));
}

// ============================================================================
// STORE
// ============================================================================

export const useTireBookingStore = create<TireBookingState>((set, get) => ({
  ...DEFAULT_STATE,

  reset: () => set({ ...DEFAULT_STATE }),

  setVehicleId: (id) => set({ vehicleId: id }),
  setSize: (size) => set({ tireSize: size }),
  setType: (type) => set({ tireType: type }),
  setTier: (tier) => set({ tier }),

  toggleTirePosition: (p) => {
    const cur = get().selectedTirePositions;
    const has = cur.includes(p);
    const next = has ? cur.filter((q) => q !== p) : [...cur, p];
    set({ selectedTirePositions: normalize(next) });
  },

  setTirePositions: (p) => set({ selectedTirePositions: normalize(p) }),

  fireRequest: async () => {
    const { tier, selectedTirePositions, tireSize } = get();
    if (!tier) return; // CTA should block this, but guard anyway.
    const qty = selectedTirePositions.length;

    set({ isLoading: true, quotes: [] });

    const allQuotes = MOCK_SHOP_RESPONSES(tier, qty, tireSize ?? "225/45R18");

    // First response lands quickly so the UI shows motion right away.
    await new Promise((res) => setTimeout(res, 500));

    for (let i = 0; i < allQuotes.length; i++) {
      // Cancelled (cancelRequest flipped isLoading to false).
      if (!get().isLoading) return;
      set((s) => ({ quotes: [...s.quotes, allQuotes[i]] }));
      if (i < allQuotes.length - 1) {
        const gap = 600 + Math.random() * 500; // 600–1100ms between shops
        await new Promise((res) => setTimeout(res, gap));
      }
    }

    // Per the Apr 23 redesign: once all shops acknowledge the request, stay
    // in the loading state with an ETA window visible to the user. Final
    // firm quotes arrive asynchronously (notification + Quotes tab flow),
    // so we intentionally do NOT flip `isLoading` false or auto-reveal the
    // quote cards here. `cancelRequest` is still the way out.
  },

  cancelRequest: () => set({ isLoading: false, quotes: [] }),

  acceptQuote: (quoteId) => {
    const quote = get().quotes.find((q) => q.id === quoteId);
    if (!quote) return null;
    set({ selectedQuoteId: quoteId });
    return quote;
  },
}));
