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
  /** True from the moment open() is called until the close spring fully
   *  unmounts the overlay. Used by ProfileInitialsButton to stay hidden
   *  for the entire open+close lifecycle (avoids visual doubling between
   *  the home button and the overlay's floating avatar). */
  isMounted: boolean;
  fromRect: SettingsOverlayRect | null;
  open: (rect: SettingsOverlayRect) => void;
  close: () => void;
  /** Called by SettingsOverlay's close-spring completion handler. */
  finishClose: () => void;
}

export const useSettingsOverlayStore = create<SettingsOverlayState>((set) => ({
  isOpen: false,
  isMounted: false,
  fromRect: null,
  open: (rect) => set({ isOpen: true, isMounted: true, fromRect: rect }),
  close: () => set({ isOpen: false }),
  finishClose: () => set({ isMounted: false }),
}));
