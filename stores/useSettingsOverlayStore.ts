/**
 * useSettingsOverlayStore
 *
 * PURPOSE: Hands off the avatar's screen rect from
 *          ProfileInitialsButton (which measures itself with
 *          `view.measureInWindow`) to the profile-overlay route
 *          (which uses it as the morph anchor — the card grows
 *          from this rect to fullscreen and shrinks back on
 *          close).
 *
 *          Open/close lifecycle is owned by the router now —
 *          the overlay is a route (`app/profile-overlay.tsx`),
 *          so navigation pushes destinations on top of it
 *          naturally and back gestures reveal it underneath.
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
  fromRect: SettingsOverlayRect | null;
  revealHomeAvatar: boolean;
  setFromRect: (rect: SettingsOverlayRect | null) => void;
  setRevealHomeAvatar: (reveal: boolean) => void;
}

export const useSettingsOverlayStore = create<SettingsOverlayState>((set) => ({
  fromRect: null,
  revealHomeAvatar: false,
  setFromRect: (rect) => set({ fromRect: rect, revealHomeAvatar: false }),
  setRevealHomeAvatar: (reveal) => set({ revealHomeAvatar: reveal }),
}));
