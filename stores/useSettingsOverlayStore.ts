/**
 * useSettingsOverlayStore
 *
 * PURPOSE: Drives the SettingsOverlay (profile screen) lifecycle and the
 *          shared-element morph anchor:
 *
 *          - `open(rect)` lifts the overlay from the given button rect to
 *            fullscreen via the Reanimated morph spring. Callers measure the
 *            avatar with `view.measureInWindow` first.
 *          - `close()` is internal — flips isOpen=false. The reverse-morph
 *            spring is owned by the overlay component, which calls `close()`
 *            in its finish callback.
 *          - `requestClose(after?)` lets any caller (e.g. a row inside
 *            SettingsContent) ask the overlay to play its close morph and
 *            then run a follow-up. Needed when the destination is a sibling
 *            of the overlay in the layout tree (the Cars tab) so it
 *            wouldn't cover the overlay — we morph back to the avatar
 *            first, THEN switch tabs.
 *
 *          The overlay is mounted as a layout-level absolute component
 *          (see app/(main-tabs)/_layout.tsx) instead of a route, so child
 *          screen pushes (Saved Addresses, Payment Methods, etc.) land in
 *          the normal root-Stack card mode and slide-from-right — modal
 *          stack mode is avoided entirely.
 *
 * USED IN:
 *   - components/home/ProfileInitialsButton.tsx    (open)
 *   - components/ai-chat/OtoRenderTools.tsx        (open)
 *   - components/settings/SettingsOverlay.tsx      (consume + close)
 *   - app/(main-tabs)/_layout.tsx                  (mount point)
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
  isOpen: boolean;
  // Bumped each time a caller requests an animated close. The overlay
  // watches this and triggers its own close spring; the counter ensures
  // each bump is detected as a discrete event (even if the same caller
  // requests close twice in a row).
  closeRequestId: number;
  // Optional callback invoked AFTER the close spring lands. Set by
  // `requestClose(after)` and cleared by the overlay's finish path.
  pendingAfterClose: (() => void) | null;
  setFromRect: (rect: SettingsOverlayRect | null) => void;
  setRevealHomeAvatar: (reveal: boolean) => void;
  open: (rect: SettingsOverlayRect) => void;
  close: () => void;
  requestClose: (after?: () => void) => void;
  consumePendingAfterClose: () => (() => void) | null;
}

export const useSettingsOverlayStore = create<SettingsOverlayState>((set, get) => ({
  fromRect: null,
  revealHomeAvatar: false,
  isOpen: false,
  closeRequestId: 0,
  pendingAfterClose: null,
  setFromRect: (rect) => set({ fromRect: rect, revealHomeAvatar: false }),
  setRevealHomeAvatar: (reveal) => set({ revealHomeAvatar: reveal }),
  open: (rect) => set({ fromRect: rect, isOpen: true, revealHomeAvatar: false }),
  close: () => set({ isOpen: false }),
  requestClose: (after) =>
    set((s) => ({
      closeRequestId: s.closeRequestId + 1,
      pendingAfterClose: after ?? null,
    })),
  consumePendingAfterClose: () => {
    const cb = get().pendingAfterClose;
    if (cb) set({ pendingAfterClose: null });
    return cb;
  },
}));
