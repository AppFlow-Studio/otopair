// OtoPair serves New York drivers only, so every "today", "tomorrow" or
// "8 PM" Oto reasons about is New York wall-clock time. When shops outside
// the Eastern time zone go live, this becomes the user's or shop's own zone.
export const OTO_LOCAL_TIMEZONE = "America/New_York";

export interface LocalNow {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24-hour */
  time: string;
  /** "Thursday" */
  weekday: string;
}

export function localNow(nowMs: number = Date.now()): LocalNow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: OTO_LOCAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "long",
  }).formatToParts(new Date(nowMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    weekday: get("weekday"),
  };
}

export interface CalendarDay {
  /** YYYY-MM-DD */
  date: string;
  /** "Sat" */
  weekday: string;
}

// Left to count from today, the model turned "Saturday" into Sunday's date and
// "last Saturday" into 3 days ago (#434, #376). A list it can read the date off
// replaces the arithmetic.
export function calendarAround(dateISO: string, back = 7, ahead = 7): CalendarDay[] {
  const [y, m, d] = dateISO.split("-").map(Number);
  const days: CalendarDay[] = [];
  for (let offset = -back; offset <= ahead; offset++) {
    const day = new Date(Date.UTC(y, m - 1, d + offset, 12));
    days.push({
      date: day.toISOString().slice(0, 10),
      weekday: day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    });
  }
  return days;
}
