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

const DAY_ABBREV = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parse YYYY-MM-DD and return { dayOfWeek, day } for display */
export function dateToDayDisplay(dateStr: string): { dayOfWeek: string; day: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return {
    dayOfWeek: DAY_ABBREV[date.getDay()],
    day: String(date.getDate()),
  };
}
