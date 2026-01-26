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

// Helper to generate pseudo-random booked days based on mechanic ID
function generateBookedDays(mechanicId: number): { dec: number[]; jan: number[] } {
  // Use mechanic ID as seed for deterministic results
  const seed = mechanicId * 7;
  const decBooked: number[] = [7, 14, 21, 25]; // Always include common holidays/Sundays
  const janBooked: number[] = [1, 4, 11, 18, 25];
  
  // Add some additional booked days based on mechanic ID
  if (mechanicId % 2 === 0) {
    decBooked.push(5, 13, 20, 27);
    janBooked.push(3, 10, 17, 24, 31);
  }
  if (mechanicId % 3 === 0) {
    decBooked.push(6, 12, 19, 26);
    janBooked.push(2, 9, 16, 23, 30);
  }
  if (mechanicId % 5 === 0) {
    decBooked.push(4, 11, 18, 28);
    janBooked.push(5, 12, 19, 26);
  }
  
  return {
    dec: [...new Set(decBooked)].sort((a, b) => a - b),
    jan: [...new Set(janBooked)].sort((a, b) => a - b),
  };
}

// Helper to get availability score based on mechanic ID
function getAvailabilityScore(mechanicId: number): number {
  // Base scores for original mechanics
  const baseScores: Record<number, number> = {
    1: 8, 2: 6, 3: 3, 4: 9, 5: 7, 6: 8, 7: 10, 8: 6,
    9: 7, 10: 5, 11: 6, 12: 2, 13: 7, 14: 5, 15: 8,
    16: 9, 17: 3, 18: 6, 19: 5, 20: 2, 21: 5, 22: 9,
    23: 8, 24: 7, 25: 4, 26: 6, 27: 5, 28: 9, 29: 4,
    30: 2, 31: 7, 32: 4, 33: 2, 34: 8, 35: 6, 36: 5,
    37: 3, 38: 4, 39: 10, 40: 4, 41: 6, 42: 7, 43: 2,
    44: 8, 45: 5, 46: 9, 47: 5, 48: 10, 49: 6, 50: 9,
  };
  return baseScores[mechanicId] || 5;
}

/**
 * Generate all mechanic schedules (for all 50 mechanics)
 */
function generateAllSchedules(): Record<number, MechanicSchedule> {
  const schedules: Record<number, MechanicSchedule> = {};

  // Generate schedules for all 50 mechanics
  for (let mechanicId = 1; mechanicId <= 50; mechanicId++) {
    const availabilityScore = getAvailabilityScore(mechanicId);
    const bookedDays = generateBookedDays(mechanicId);

    // Generate December 2025
    const dec2025 = generateMonthlyAvailability(mechanicId, 2025, 11, availabilityScore, bookedDays.dec);

    // Generate January 2026
    const jan2026 = generateMonthlyAvailability(mechanicId, 2026, 0, availabilityScore, bookedDays.jan);
    
    // Generate February 2026
    const feb2026 = generateMonthlyAvailability(mechanicId, 2026, 1, availabilityScore, bookedDays.jan);

    schedules[mechanicId] = {
      mechanicId,
      monthlySchedules: {
        "2025-11": dec2025,
        "2026-00": jan2026,
        "2026-01": feb2026,
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





