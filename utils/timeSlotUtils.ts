/**
 * timeSlotUtils
 *
 * Converts display time (e.g. "9:00 AM") to Convex HH:MM format ("09:00").
 */

/**
 * Convert display time like "9:00 AM", "1:00 PM" to 24h "HH:MM"
 */
export function displayTimeToHHMM(displayTime: string): string {
  const match = displayTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return "09:00"; // fallback
  let hour = parseInt(match[1], 10);
  const min = match[2];
  const pm = match[3].toUpperCase() === "PM";
  if (pm && hour !== 12) hour += 12;
  if (!pm && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${min}`;
}

/** Converts 24h "09:00" to display "9:00 AM" */
export function hhmmToDisplayTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (h === 0) return `12:${String(m).padStart(2, "0")} AM`;
  if (h < 12) return `${h}:${String(m).padStart(2, "0")} AM`;
  if (h === 12) return `12:${String(m).padStart(2, "0")} PM`;
  return `${h - 12}:${String(m).padStart(2, "0")} PM`;
}

/** Today's date as "YYYY-MM-DD" in the device's local timezone. */
export function todayLocalISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Minimum advance notice for a booking, in minutes. A slot must start at
 * least this far in the future to be bookable, so same-day slots inside
 * the window are hidden on every booking surface. Single source of truth:
 * retune the lead time everywhere by changing this one number.
 */
export const MIN_ADVANCE_NOTICE_MINUTES = 60;

/**
 * User-facing caption for the advance-notice rule. Rendered wherever the
 * customer picks a time so the constraint is visible, not just enforced.
 */
export const MIN_ADVANCE_NOTICE_LABEL = "Bookings require at least 1 hour's notice.";

/**
 * Earliest bookable minute-of-day in local time: now + the advance-notice
 * window, rounded up to the next 15-minute slot boundary. Rounding only
 * ever pushes later, so the guarantee stays "at least 1 hour." Can exceed
 * 1440 late at night — callers treat that as "nothing bookable today."
 */
export function minBookableMinutes(): number {
  const now = new Date();
  const raw = now.getHours() * 60 + now.getMinutes() + MIN_ADVANCE_NOTICE_MINUTES;
  return Math.ceil(raw / 15) * 15;
}

/**
 * Earliest bookable slot time as "HH:MM" in local time — the same floor as
 * {@link minBookableMinutes}, formatted for slot comparisons ("HH:MM" is
 * lexically chronological). Returns "24:00" when the window runs past
 * midnight (all of today's slots fall within the lead time).
 */
export function minBookableHHMM(): string {
  const rounded = minBookableMinutes();
  if (rounded >= 1440) return "24:00";
  const hh = String(Math.floor(rounded / 60)).padStart(2, "0");
  const mm = String(rounded % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

const DAY_ABBREV = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parse YYYY-MM-DD and return { dayOfWeek, day } for display */
export function dateToDayDisplay(dateStr: string): {
  dayOfWeek: string;
  day: string;
} {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return {
    dayOfWeek: DAY_ABBREV[date.getDay()],
    day: String(date.getDate()),
  };
}
