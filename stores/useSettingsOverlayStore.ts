/**
 * useSettingsOverlayStore
 *
 * PURPOSE: Drives the shared-element open animation that lifts the
 *          Settings page on top of Home. The Home initials button
 *          measures itself with `view.measureInWindow` and writes the
 *          screen-space rect here; the SettingsOverlay reads that
 *          rect to know where the card should grow from.
 *
 * USED IN:
 *   - components/home/ProfileInitialsButton.tsx (writes)
 *   - components/settings/SettingsOverlay.tsx   (reads)
 *
 * OWNER: Ahmad Hamoudeh
 */

import { create } from "zustand";

export interface SettingsOverlayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SettingsOverlayState {
  isOpen: boolean;
  isTransitionVisible: boolean;
  fromRect: SettingsOverlayRect | null;
  /** Bumped whenever an instant-dismiss is requested. Overlay watches
   *  this to tear down without playing the reverse spring (used when
   *  navigating to a sub-page — the user shouldn't see Settings shrink
   *  back into the home button before the next screen appears). */
  instantCloseToken: number;
  open: (rect: SettingsOverlayRect) => void;
  close: () => void;
  closeInstant: () => void;
  finishClose: () => void;
}

export const useSettingsOverlayStore = create<SettingsOverlayState>((set) => ({
  isOpen: false,
  isTransitionVisible: false,
  fromRect: null,
  instantCloseToken: 0,
  open: (rect) => set({ isOpen: true, isTransitionVisible: true, fromRect: rect }),
  close: () => set({ isOpen: false }),
  closeInstant: () =>
    set((s) => ({
      isOpen: false,
      isTransitionVisible: false,
      fromRect: null,
      instantCloseToken: s.instantCloseToken + 1,
    })),
  finishClose: () => set({ isTransitionVisible: false, fromRect: null }),
}));
