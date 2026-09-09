/**
 * useRotorBookingStore
 *
 * PURPOSE: UI-only state for the Rotor Booking Flow. Spec:
 *          docs/rotor-booking/SPEC_v1.pdf (June 2026). Holds the four
 *          selection fields the customer picks on Shop Rotors:
 *          brake system type, axle, include-pads toggle, pad type.
 *          Quantity is derived from axle (front=2, rear=2, both=4).
 */

import { create } from "zustand";

import {
  MOCK_SHOP_RESPONSES,
  quantityForAxle,
  type BrakeSystemType,
  type PadType,
  type RotorAxle,
  type RotorQuote,
} from "@/constants/rotorFlow";

interface RotorBookingState {
  vehicleId: string | null;
  brakeSystemType: BrakeSystemType | null;
  /** Which axle pair(s) the customer wants done. Single-select. */
  axle: RotorAxle | null;
  /** Whether to combo brake pads into the request. Default true. */
  includePads: boolean;
  /** Pad material — only meaningful when includePads is true. */
  padType: PadType | null;

  // Results
  quotes: RotorQuote[];
  isLoading: boolean;
  selectedQuoteId: string | null;

  // Mutators
  reset: () => void;
  setVehicleId: (id: string | null) => void;
  setBrakeSystemType: (type: BrakeSystemType | null) => void;
  setAxle: (axle: RotorAxle | null) => void;
  setIncludePads: (include: boolean) => void;
  setPadType: (type: PadType | null) => void;
  fireRequest: () => Promise<void>;
  cancelRequest: () => void;
  acceptQuote: (quoteId: string) => RotorQuote | null;
}

const DEFAULT_STATE = {
  vehicleId: null as string | null,
  brakeSystemType: null as BrakeSystemType | null,
  axle: null as RotorAxle | null,
  includePads: true,
  padType: "oem_recommended" as PadType | null,
  quotes: [] as RotorQuote[],
  isLoading: false,
  selectedQuoteId: null as string | null,
};

export const useRotorBookingStore = create<RotorBookingState>((set, get) => ({
  ...DEFAULT_STATE,

  reset: () => set({ ...DEFAULT_STATE }),

  setVehicleId: (id) => set({ vehicleId: id }),
  setBrakeSystemType: (brakeSystemType) => set({ brakeSystemType }),
  setAxle: (axle) => set({ axle }),
  setIncludePads: (includePads) =>
    set((s) => ({
      includePads,
      // Toggling pads off clears pad selection so we don't carry stale state.
      padType: includePads ? (s.padType ?? "oem_recommended") : null,
    })),
  setPadType: (padType) => set({ padType }),

  fireRequest: async () => {
    const { brakeSystemType, axle, includePads, padType } = get();
    if (!brakeSystemType || !axle) return;
    if (includePads && !padType) return;

    set({ isLoading: true, quotes: [] });

    const allQuotes = MOCK_SHOP_RESPONSES({
      brakeSystemType,
      axle,
      includePads,
      padType: includePads ? padType : null,
    });

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
  },

  cancelRequest: () => set({ isLoading: false, quotes: [] }),

  acceptQuote: (quoteId) => {
    const quote = get().quotes.find((q) => q.id === quoteId);
    if (!quote) return null;
    set({ selectedQuoteId: quoteId });
    return quote;
  },
}));

// Re-export quantityForAxle so call sites that already imported it via the
// store keep working (mirror of the tire store re-export pattern).
export { quantityForAxle };
