/**
 * useRotorBookingStore
 *
 * PURPOSE: UI-only state for the Rotor Booking Flow. Mirrors
 *          `useTireBookingStore` but with rotor-specific selectors
 *          (axle pair + tier — no type, no size). Quantity is derived
 *          from the chosen axle (front=2, rear=2, both=4).
 */

import { create } from "zustand";

import {
  MOCK_SHOP_RESPONSES,
  quantityForAxle,
  type RotorAxle,
  type RotorQuote,
  type RotorTierId,
} from "@/constants/rotorFlow";

interface RotorBookingState {
  vehicleId: string | null;
  /** Which axle pair(s) the customer wants done. Single-select. */
  axle: RotorAxle | null;
  tier: RotorTierId | null;

  // Results
  quotes: RotorQuote[];
  isLoading: boolean;
  selectedQuoteId: string | null;

  // Mutators
  reset: () => void;
  setVehicleId: (id: string | null) => void;
  setAxle: (axle: RotorAxle) => void;
  setTier: (tier: RotorTierId) => void;
  fireRequest: () => Promise<void>;
  cancelRequest: () => void;
  acceptQuote: (quoteId: string) => RotorQuote | null;
}

const DEFAULT_STATE = {
  vehicleId: null as string | null,
  axle: null as RotorAxle | null,
  tier: null as RotorTierId | null,
  quotes: [] as RotorQuote[],
  isLoading: false,
  selectedQuoteId: null as string | null,
};

export const useRotorBookingStore = create<RotorBookingState>((set, get) => ({
  ...DEFAULT_STATE,

  reset: () => set({ ...DEFAULT_STATE }),

  setVehicleId: (id) => set({ vehicleId: id }),
  setAxle: (axle) => set({ axle }),
  setTier: (tier) => set({ tier }),

  fireRequest: async () => {
    const { tier, axle } = get();
    if (!tier || !axle) return;
    const qty = quantityForAxle(axle);

    set({ isLoading: true, quotes: [] });

    const allQuotes = MOCK_SHOP_RESPONSES(tier, qty);

    // First response lands quickly so the UI shows motion right away.
    await new Promise((res) => setTimeout(res, 500));

    for (let i = 0; i < allQuotes.length; i++) {
      if (!get().isLoading) return;
      set((s) => ({ quotes: [...s.quotes, allQuotes[i]] }));
      if (i < allQuotes.length - 1) {
        const gap = 600 + Math.random() * 500;
        await new Promise((res) => setTimeout(res, gap));
      }
    }

    // Same pattern as the tire flow: stay in loading state once shops have
    // acknowledged. Final firm quotes land via the Quotes tab + push
    // notification once the backend pipe is live.
  },

  cancelRequest: () => set({ isLoading: false, quotes: [] }),

  acceptQuote: (quoteId) => {
    const quote = get().quotes.find((q) => q.id === quoteId);
    if (!quote) return null;
    set({ selectedQuoteId: quoteId });
    return quote;
  },
}));
