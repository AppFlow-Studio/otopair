/**
 * Mock Schedule Data - Mechanic Availability Calendars
 *
 * This file contains sample availability data for all mechanics.
 * Generates a full month of availability data for December 2025 and January 2026.
 *
 * OWNER: Waleed Mansour
 */

import type { DayAvailability, DayAvailabilityStatus, MechanicSchedule, MonthlyAvailability } from "../types/store.types";

// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

const TIME_SLOTS = ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];

/**
 * Generate random time slots for a day
 */
function generateTimeSlots(count: number): string[] {
  const shuffled = [...TIME_SLOTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).sort((a, b) => {
    const hourA = parseInt(a.split(":")[0]);
    const hourB = parseInt(b.split(":")[0]);
    const isPmA = a.includes("PM");
    const isPmB = b.includes("PM");
    const adjustedA = isPmA && hourA !== 12 ? hourA + 12 : hourA;
    const adjustedB = isPmB && hourB !== 12 ? hourB + 12 : hourB;
    return adjustedA - adjustedB;
  });
}

/**
 * Get day of week name abbreviation
 */
function getDayOfWeekName(dayOfWeek: number): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[dayOfWeek];
}

/**
 * Generate availability for a single day based on mechanic availability pattern
 */
function generateDayAvailability(
  date: Date,
  mechanicAvailabilityScore: number,
  bookedDays: number[]
): DayAvailability {
  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const dayOfWeek = date.getDay();
  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // Sundays are always unavailable (shop closed)
  if (dayOfWeek === 0) {
    return {
      date: dateStr,
      day,
      month,
      year,
      dayOfWeek,
      status: "unavailable",
      timeSlots: [],
    };
  }

  // Check if this day is in the booked list
  if (bookedDays.includes(day)) {
    return {
      date: dateStr,
      day,
      month,
      year,
      dayOfWeek,
      status: "booked",
      timeSlots: [],
    };
  }

  // Higher availability score = more available slots
  const slotProbability = mechanicAvailabilityScore / 10;
  const isAvailable = Math.random() < slotProbability;

  if (!isAvailable) {
    return {
      date: dateStr,
      day,
      month,
      year,
      dayOfWeek,
      status: "unavailable",
      timeSlots: [],
    };
  }

  // Generate time slots based on availability score
  const minSlots = Math.max(1, Math.floor(mechanicAvailabilityScore / 3));
  const maxSlots = Math.min(TIME_SLOTS.length, Math.ceil(mechanicAvailabilityScore / 2) + 1);
  const slotCount = Math.floor(Math.random() * (maxSlots - minSlots + 1)) + minSlots;

  return {
    date: dateStr,
    day,
    month,
    year,
    dayOfWeek,
    status: "available",
    timeSlots: generateTimeSlots(slotCount),
  };
}

/**
 * Generate a month of availability data
 */
function generateMonthlyAvailability(
  mechanicId: number,
  year: number,
  month: number,
  availabilityScore: number,
  bookedDays: number[]
): MonthlyAvailability {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: DayAvailability[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    days.push(generateDayAvailability(date, availabilityScore, bookedDays));
  }

  return {
    mechanicId,
    month,
    year,
    days,
  };
}

// ─────────────────────────────────────────────────────────────
// MECHANIC SCHEDULE DATA
// ─────────────────────────────────────────────────────────────

// Define booked days per mechanic (simulating existing appointments)
const MECHANIC_BOOKED_DAYS: Record<number, { dec: number[]; jan: number[] }> = {
  1: { dec: [5, 7, 14, 20, 21, 25, 28], jan: [1, 4, 11, 18, 25] },
  2: { dec: [6, 7, 13, 14, 20, 21, 25, 27], jan: [1, 3, 10, 17, 24, 31] },
  3: { dec: [5, 7, 12, 14, 19, 21, 25, 26, 30], jan: [1, 2, 9, 16, 23, 30] },
  4: { dec: [7, 14, 20, 21, 25], jan: [1, 5, 12, 19, 26] },
  5: { dec: [6, 7, 13, 14, 21, 25, 28, 30], jan: [1, 4, 6, 13, 20, 27] },
  6: { dec: [7, 14, 21, 25, 28], jan: [1, 11, 18, 25] },
  7: { dec: [7, 14, 21, 25], jan: [1, 4, 11, 18, 25] },
  8: { dec: [5, 6, 7, 12, 13, 14, 19, 20, 21, 25, 26, 27], jan: [1, 2, 3, 9, 10, 16, 17, 23, 24, 30, 31] },
  9: { dec: [7, 14, 20, 21, 25, 27], jan: [1, 3, 10, 17, 24, 31] },
  10: { dec: [7, 14, 21, 25], jan: [1, 4, 11, 18, 25] },
  11: { dec: [6, 7, 13, 14, 20, 21, 25, 27, 28], jan: [1, 3, 4, 10, 11, 17, 18, 24, 25, 31] },
  12: { dec: [7, 14, 21, 25], jan: [1, 4, 11, 18, 25] },
};

// Availability scores from mockMechanics.ts
const MECHANIC_AVAILABILITY_SCORES: Record<number, number> = {
  1: 8,
  2: 6,
  3: 3,
  4: 9,
  5: 7,
  6: 8,
  7: 10,
  8: 2,
  9: 6,
  10: 7,
  11: 5,
  12: 9,
};

/**
 * Generate all mechanic schedules
 */
function generateAllSchedules(): Record<number, MechanicSchedule> {
  const schedules: Record<number, MechanicSchedule> = {};

  for (let mechanicId = 1; mechanicId <= 12; mechanicId++) {
    const availabilityScore = MECHANIC_AVAILABILITY_SCORES[mechanicId] || 5;
    const bookedDays = MECHANIC_BOOKED_DAYS[mechanicId] || { dec: [], jan: [] };

    // Generate December 2025
    const dec2025 = generateMonthlyAvailability(mechanicId, 2025, 11, availabilityScore, bookedDays.dec);

    // Generate January 2026
    const jan2026 = generateMonthlyAvailability(mechanicId, 2026, 0, availabilityScore, bookedDays.jan);

    schedules[mechanicId] = {
      mechanicId,
      monthlySchedules: {
        "2025-11": dec2025,
        "2026-00": jan2026,
      },
    };
  }

  return schedules;
}

// Export the generated schedules
export const MOCK_SCHEDULES = generateAllSchedules();

// ─────────────────────────────────────────────────────────────
// UTILITY EXPORTS
// ─────────────────────────────────────────────────────────────

/**
 * Get schedule for a specific mechanic
 */
export function getMechanicSchedule(mechanicId: number): MechanicSchedule | null {
  return MOCK_SCHEDULES[mechanicId] || null;
}

/**
 * Get monthly availability for a specific mechanic and month
 */
export function getMonthlyAvailability(
  mechanicId: number,
  year: number,
  month: number
): MonthlyAvailability | null {
  const schedule = MOCK_SCHEDULES[mechanicId];
  if (!schedule) return null;

  const key = `${year}-${String(month).padStart(2, "0")}`;
  return schedule.monthlySchedules[key] || null;
}

/**
 * Get available days for a mechanic in a given month
 */
export function getAvailableDays(mechanicId: number, year: number, month: number): DayAvailability[] {
  const monthly = getMonthlyAvailability(mechanicId, year, month);
  if (!monthly) return [];
  return monthly.days.filter((day) => day.status === "available");
}

/**
 * Get time slots for a specific date
 */
export function getTimeSlotsForDate(mechanicId: number, date: Date): string[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  const monthly = getMonthlyAvailability(mechanicId, year, month);
  if (!monthly) return [];

  const dayAvailability = monthly.days.find((d) => d.day === day);
  return dayAvailability?.timeSlots || [];
}




