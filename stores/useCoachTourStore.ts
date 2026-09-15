/**
 * useCoachTourStore — where the spotlight tour is up to.
 *
 * UI state only, and it lives in a store rather than in the overlay because
 * the tour spans four tabs: it is started from Home (when the phone-mock
 * tour finishes) but driven by a component mounted on the tab LAYOUT, which
 * is the only place that survives navigating between tabs.
 */
import { create } from "zustand";

import { COACH_STEPS } from "@/components/coach/coachSteps";

interface CoachTourState {
  running: boolean;
  index: number;
  start: () => void;
  next: () => void;
  back: () => void;
  stop: () => void;
}

export const useCoachTourStore = create<CoachTourState>((set) => ({
  running: false,
  index: 0,
  start: () => set({ running: true, index: 0 }),
  next: () =>
    set((s) =>
      s.index >= COACH_STEPS.length - 1
        ? { running: false, index: 0 }
        : { index: s.index + 1 },
    ),
  back: () => set((s) => ({ index: Math.max(0, s.index - 1) })),
  stop: () => set({ running: false, index: 0 }),
}));
