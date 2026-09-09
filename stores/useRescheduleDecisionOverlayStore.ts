/**
 * useRescheduleDecisionOverlayStore
 *
 * Drives the shared-element open animation for the Pending Customer
 * Acceptance overlay. The trigger (a notification row or a booking
 * card whose status is `pending_customer_acceptance`) measures itself
 * with `view.measureInWindow` and writes the screen-space rect plus
 * the target booking id here. `RescheduleDecisionOverlay` reads both
 * to grow a card from that rect to fullscreen.
 *
 * Mirrors the SettingsOverlay pattern in `useSettingsOverlayStore`.
 */

import { create } from "zustand";
import type { Id } from "@/convex/_generated/dataModel";

export interface OverlayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RescheduleDecisionOverlayState {
  isOpen: boolean;
  fromRect: OverlayRect | null;
  bookingId: Id<"bookings"> | null;
  open: (rect: OverlayRect, bookingId: Id<"bookings">) => void;
  close: () => void;
}

export const useRescheduleDecisionOverlayStore =
  create<RescheduleDecisionOverlayState>((set) => ({
    isOpen: false,
    fromRect: null,
    bookingId: null,
    open: (rect, bookingId) =>
      set({ isOpen: true, fromRect: rect, bookingId }),
    close: () => set({ isOpen: false }),
  }));
