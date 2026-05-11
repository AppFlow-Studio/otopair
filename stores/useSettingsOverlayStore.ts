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
  fromRect: SettingsOverlayRect | null;
  open: (rect: SettingsOverlayRect) => void;
  close: () => void;
}

export const useSettingsOverlayStore = create<SettingsOverlayState>((set) => ({
  isOpen: false,
  fromRect: null,
  open: (rect) => set({ isOpen: true, fromRect: rect }),
  close: () => set({ isOpen: false }),
}));
