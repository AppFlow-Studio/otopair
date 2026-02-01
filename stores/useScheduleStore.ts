/**
 * useScheduleStore
 *
 * PURPOSE: Manages mechanic schedule and availability data for booking calendar
 *
 * TABLES: Schedules (future integration)
 *
 * RELATIONSHIPS:
 *   - Schedule belongs to Mechanic
 *   - Schedule has many TimeSlots
 *
 * OWNER: Waleed Mansour
 */

import { create } from "zustand";

import {
  getAvailableDays,
  getMechanicSchedule,
  getMonthlyAvailability,
  getTimeSlotsForDate,
  MOCK_SCHEDULES,
} from "./data/mockSchedules";
import type { DayAvailability, MechanicSchedule, MonthlyAvailability } from "./types/store.types";

// ─────────────────────────────────────────────────────────────
// STORE STATE INTERFACE
// ─────────────────────────────────────────────────────────────

/** Confirmed booking selection per mechanic */
interface ConfirmedSelection {
  date: Date;
  time: string;
}

interface ScheduleState {
  // ═══════════════ SCHEDULE DATA ═══════════════
  /** All mechanic schedules indexed by mechanic ID (string for Convex compatibility) */
  schedules: Record<string, MechanicSchedule>;
  /** Currently selected mechanic ID for viewing schedule */
  selectedMechanicId: string | null;
  /** Currently viewed month */
  currentMonth: Date;
  /** Selected date on calendar */
  selectedDate: Date | null;
  /** Selected time slot */
  selectedTime: string | null;
  /** Confirmed selections per mechanic (persisted until booking is complete) */
  confirmedSelections: Record<string, ConfirmedSelection>;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;

  // ═══════════════ ACTIONS ═══════════════
  /** Load schedule for a specific mechanic */
  loadMechanicSchedule: (mechanicId: string) => void;
  /** Set the current month being viewed */
  setCurrentMonth: (date: Date) => void;
  /** Go to previous month */
  prevMonth: () => void;
  /** Go to next month */
  nextMonth: () => void;
  /** Select a date on the calendar */
  selectDate: (date: Date | null) => void;
  /** Select a time slot */
  selectTime: (time: string | null) => void;
  /** Confirm the current selection (saves it for the mechanic) */
  confirmSelection: () => void;
  /** Clear selection */
  clearSelection: () => void;
  /** Clear confirmed selection for a mechanic */
  clearConfirmedSelection: (mechanicId: string) => void;
  /** Reset to initial state */
  reset: () => void;

  // ═══════════════ GETTERS ═══════════════
  /** Get monthly availability for current view */
  getCurrentMonthAvailability: () => MonthlyAvailability | null;
  /** Get available days for current month */
  getAvailableDaysForCurrentMonth: () => DayAvailability[];
  /** Get time slots for selected date */
  getTimeSlotsForSelectedDate: () => string[];
  /** Get all available days as array of day numbers */
  getAvailableDayNumbers: () => number[];
  /** Get all booked days as array of day numbers */
  getBookedDayNumbers: () => number[];
  /** Check if a specific day is available */
  isDayAvailable: (day: number) => boolean;
  /** Check if a specific day is booked */
  isDayBooked: (day: number) => boolean;
  /** Get formatted selection summary */
  getSelectionSummary: () => string | null;
}

// ─────────────────────────────────────────────────────────────
// STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────

// Convert mock schedules (keyed by number) to string keys for app consistency
const initialSchedules: Record<string, MechanicSchedule> = {};
Object.entries(MOCK_SCHEDULES).forEach(([k, v]) => {
  initialSchedules[k] = v;
});

export const useScheduleStore = create<ScheduleState>()((set, get) => ({
  // ═══════════════ INITIAL STATE ═══════════════
  schedules: initialSchedules,
  selectedMechanicId: null,
  currentMonth: new Date(),
  selectedDate: null,
  selectedTime: null,
  confirmedSelections: {},
  isLoading: false,
  error: null,

  // ═══════════════ ACTIONS ═══════════════
  loadMechanicSchedule: (mechanicId) => {
    set({ isLoading: true, error: null });

    const schedule = getMechanicSchedule(mechanicId);
    const { confirmedSelections } = get();

    if (schedule) {
      // Check if there's a previously confirmed selection for this mechanic
      const confirmedSelection = confirmedSelections[mechanicId];

      if (confirmedSelection) {
        // Restore the confirmed selection
        set({
          selectedMechanicId: mechanicId,
          isLoading: false,
          selectedDate: confirmedSelection.date,
          selectedTime: confirmedSelection.time,
          currentMonth: new Date(confirmedSelection.date.getFullYear(), confirmedSelection.date.getMonth(), 1),
        });
      } else {
        // No previous selection, start fresh
        set({
          selectedMechanicId: mechanicId,
          isLoading: false,
          selectedDate: null,
          selectedTime: null,
          currentMonth: new Date(),
        });
      }
    } else {
      set({
        error: `No schedule found for mechanic ${mechanicId}`,
        isLoading: false,
      });
    }
  },

  setCurrentMonth: (date) => {
    set({ currentMonth: date });
  },

  prevMonth: () => {
    set((state) => ({
      currentMonth: new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1),
    }));
  },

  nextMonth: () => {
    set((state) => ({
      currentMonth: new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1),
    }));
  },

  selectDate: (date) => {
    set({ selectedDate: date, selectedTime: null });
  },

  selectTime: (time) => {
    set({ selectedTime: time });
  },

  confirmSelection: () => {
    const { selectedMechanicId, selectedDate, selectedTime } = get();
    if (!selectedMechanicId || !selectedDate || !selectedTime) return;

    set((state) => ({
      confirmedSelections: {
        ...state.confirmedSelections,
        [selectedMechanicId]: {
          date: selectedDate,
          time: selectedTime,
        },
      },
    }));
  },

  clearSelection: () => {
    set({ selectedDate: null, selectedTime: null });
  },

  clearConfirmedSelection: (mechanicId) => {
    set((state) => {
      const { [mechanicId]: _, ...rest } = state.confirmedSelections;
      return { confirmedSelections: rest };
    });
  },

  reset: () => {
    set({
      selectedMechanicId: null,
      currentMonth: new Date(),
      selectedDate: null,
      selectedTime: null,
      isLoading: false,
      error: null,
    });
  },

  // ═══════════════ GETTERS ═══════════════
  getCurrentMonthAvailability: () => {
    const { selectedMechanicId, currentMonth } = get();
    if (!selectedMechanicId) return null;

    return getMonthlyAvailability(selectedMechanicId, currentMonth.getFullYear(), currentMonth.getMonth());
  },

  getAvailableDaysForCurrentMonth: () => {
    const { selectedMechanicId, currentMonth } = get();
    if (!selectedMechanicId) return [];

    return getAvailableDays(selectedMechanicId, currentMonth.getFullYear(), currentMonth.getMonth());
  },

  getTimeSlotsForSelectedDate: () => {
    const { selectedMechanicId, selectedDate } = get();
    if (!selectedMechanicId || !selectedDate) return [];

    return getTimeSlotsForDate(selectedMechanicId, selectedDate);
  },

  getAvailableDayNumbers: () => {
    const { selectedMechanicId, currentMonth } = get();
    if (!selectedMechanicId) return [];

    const monthly = getMonthlyAvailability(selectedMechanicId, currentMonth.getFullYear(), currentMonth.getMonth());
    if (!monthly) return [];

    return monthly.days.filter((d) => d.status === "available").map((d) => d.day);
  },

  getBookedDayNumbers: () => {
    const { selectedMechanicId, currentMonth } = get();
    if (!selectedMechanicId) return [];

    const monthly = getMonthlyAvailability(selectedMechanicId, currentMonth.getFullYear(), currentMonth.getMonth());
    if (!monthly) return [];

    return monthly.days.filter((d) => d.status === "booked").map((d) => d.day);
  },

  isDayAvailable: (day) => {
    const availableDays = get().getAvailableDayNumbers();
    return availableDays.includes(day);
  },

  isDayBooked: (day) => {
    const bookedDays = get().getBookedDayNumbers();
    return bookedDays.includes(day);
  },

  getSelectionSummary: () => {
    const { selectedDate, selectedTime } = get();
    if (!selectedDate || !selectedTime) return null;

    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    };
    const dateStr = selectedDate.toLocaleDateString("en-US", options);
    return `${dateStr} at ${selectedTime}`;
  },
}));

