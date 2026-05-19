/**
 * usePendingNavigationStore
 *
 * PURPOSE: Holds a one-time "navigate to X after back" flag.
 *          Used when we need to router.back() first (e.g. from a modal) and then
 *          navigate elsewhere once the back destination regains focus.
 *
 * USED IN: app/booking/map.tsx (sets flag), app/(main-tabs)/home/index.tsx (consumes)
 *
 * FLOW: Map sets pendingNavigateToCars=true, calls router.back() → Home gains focus →
 *       useFocusEffect sees flag → router.navigate to cars → clears flag
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
