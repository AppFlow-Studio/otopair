/**
 * useNotificationsSheetStore
 *
 * Drives the bell-icon notifications sheet (mounted globally in the
 * main-tabs layout). Any header bell triggers `open()`; tapping a
 * notification row calls `close()` and may then open the reschedule
 * decision overlay.
 */

import { create } from "zustand";

interface NotificationsSheetState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export const useNotificationsSheetStore = create<NotificationsSheetState>(
  (set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
  }),
);
