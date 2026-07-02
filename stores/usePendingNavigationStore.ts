/**
 * usePendingNavigationStore
 *
 * PURPOSE: Holds one-time "do X after the next navigation lands" flags.
 *          Used when we need to router.back() / router.replace() first
 *          and then run a side-effect once the destination regains focus.
 *
 * USED IN:
 *   - pendingNavigateToCars     — app/booking/map.tsx (set), home (consume)
 *   - pendingEnrichmentToast    — app/add-vehicle-review.tsx (set), home (consume)
 *
 * FLOWS:
 *   pendingNavigateToCars:
 *     Map sets pendingNavigateToCars=true, calls router.back() → Home gains focus →
 *     useFocusEffect sees flag → router.navigate to cars → clears flag.
 *
 *   pendingEnrichmentToast:
 *     Add-vehicle-review confirms the vehicle, stashes the car label
 *     (e.g. "2024 VW Tiguan") in the store, then routes to /vehicle-added.
 *     User eventually lands on home → useFocusEffect fires the
 *     `toast.trust("Enriching your 2024 VW Tiguan", ...)` toast and
 *     clears the field so it only fires once.
 */

import { create } from "zustand";

interface PendingNavigationState {
  pendingNavigateToCars: boolean;
  setPendingNavigateToCars: (v: boolean) => void;
  /** Vehicle label (e.g. "2024 Volkswagen Tiguan") queued for an
   *  enrichment toast on the next home-screen focus. Null when no
   *  toast is pending. Consumed-then-cleared by home's useFocusEffect. */
  pendingEnrichmentToast: string | null;
  setPendingEnrichmentToast: (v: string | null) => void;
}

export const usePendingNavigationStore = create<PendingNavigationState>((set) => ({
  pendingNavigateToCars: false,
  setPendingNavigateToCars: (v) => set({ pendingNavigateToCars: v }),
  pendingEnrichmentToast: null,
  setPendingEnrichmentToast: (v) => set({ pendingEnrichmentToast: v }),
}));
