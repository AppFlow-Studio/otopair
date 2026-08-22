/**
 * useBookingWizardStore
 *
 * In-memory progress for the in-chat booking wizard (BookServiceComponent),
 * keyed by conversation id. When the user leaves an Oto booking mid-flow and
 * returns to that conversation, the wizard remounts fresh — without this it
 * always restarts at Step 1. We stash the current step + selections here so it
 * resumes exactly where they left off.
 *
 * Session-scoped (not persisted to disk): survives tab switches / new-chat +
 * back within a session, which is the "leave and come back" case. Cleared when
 * the flow is dismissed or handed off to payment.
 */

import { create } from "zustand";

export interface BookingWizardProgress {
  stage: number;
  selectedIds: string[];
  diagnosticSystem: string;
  customerNotes: string;
  priority: string;
  selectedMechanicId: string | null;
  selectedSlotId: string | null;
}

interface BookingWizardStore {
  progress: Record<string, BookingWizardProgress>;
  saveProgress: (key: string, progress: BookingWizardProgress) => void;
  getProgress: (key: string) => BookingWizardProgress | undefined;
  clearProgress: (key: string) => void;
}

export const useBookingWizardStore = create<BookingWizardStore>((set, get) => ({
  progress: {},
  saveProgress: (key, progress) =>
    set((state) => ({ progress: { ...state.progress, [key]: progress } })),
  getProgress: (key) => get().progress[key],
  clearProgress: (key) =>
    set((state) => {
      if (!(key in state.progress)) return state;
      const next = { ...state.progress };
      delete next[key];
      return { progress: next };
    }),
}));
