/**
 * usePendingNavigationStore
 *
 * PURPOSE: Holds one-time "do X after the next navigation lands" flags.
 *          Used when we need to router.back() / router.replace() first
 *          and then run a side-effect once the destination regains focus.
 *
 * USED IN:
 *   - pendingNavigateToCars     — app/booking/map.tsx (set), home (consume)
 *
 * FLOWS:
 *   pendingNavigateToCars:
 *     Map sets pendingNavigateToCars=true, calls router.back() → Home gains focus →
 *     useFocusEffect sees flag → router.navigate to cars → clears flag.
 *
 * (pendingEnrichmentToast used to live here too — replaced by the
 * persistent EnrichmentStatusPill in the (main-tabs) layout, which
 * reads enrichment state reactively instead of via a queued one-shot.)
 */

import { create } from "zustand";

interface PendingNavigationState {
  pendingNavigateToCars: boolean;
  setPendingNavigateToCars: (v: boolean) => void;
}

export const usePendingNavigationStore = create<PendingNavigationState>((set) => ({
  pendingNavigateToCars: false,
  setPendingNavigateToCars: (v) => set({ pendingNavigateToCars: v }),
}));
