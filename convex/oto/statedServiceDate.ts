// #376: "my Jeep had an oil change on September 22" produced a save card for
// Sep 22 2024, "(24 months ago)". Asked for a Unix timestamp, the model
// guessed the year, and in longer chats also missed the day ("december 15"
// came back as Dec 16). The model now writes the date as YYYY-MM-DD, which
// serviceDateToMs turns into a timestamp. A month and day said without a year
// means the most recent such date that isn't in the future, so code settles
// the year.

import { localNow } from "./localTime";

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH =
  "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";
const DAY = "(\\d{1,2})(?:st|nd|rd|th)?";
const MONTH_DAY = new RegExp(`\\b${MONTH}\\s+${DAY}\\b`, "gi");
const DAY_MONTH = new RegExp(`\\b${DAY}\\s+(?:of\\s+)?${MONTH}\\b`, "gi");
// "9/18" (US month/day), or "18/9" when the first number can't be a month.
// "9/18/24" carries a year and is left alone.
const NUMERIC = /\b(\d{1,2})\/(\d{1,2})\b(?!\/\d)/g;
const WEEKDAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const WEEKDAY = "(sun|mon|tue|wed|thu|fri|sat)(?:day|sday|nesday|rsday|urday|s|rs)?\\b";
const PAST_WEEKDAY = new RegExp(`\\b(?:last|this past)\\s+${WEEKDAY}`, "gi");
const ANY_WEEKDAY = new RegExp(`\\b${WEEKDAY}`, "gi");
// Another way of saying when, which a claim near "last Saturday" could belong to.
const OTHER_WHEN = /\bago\b|\b(?:yesterday|today|tonight)\b|\blast (?:week|month|year)\b/i;
const DAY_MS = 86_400_000;

export interface MonthDay {
  month: number;
  day: number;
}

/** Dates in the message said without a year ("September 22", "22nd of Sept", "9/18"). Empty when the message names any year. */
export function yearlessDates(message: string): MonthDay[] {
  if (/\b(?:19|20)\d{2}\b/.test(message)) return [];
  const found: MonthDay[] = [];
  const add = (month: number | undefined, day: number) => {
    if (month && month <= 12 && day >= 1 && day <= 31) found.push({ month, day });
  };
  for (const m of message.matchAll(MONTH_DAY)) add(MONTHS[m[1].toLowerCase()], Number(m[2]));
  for (const m of message.matchAll(DAY_MONTH)) add(MONTHS[m[2].toLowerCase()], Number(m[1]));
  for (const m of message.matchAll(NUMERIC)) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a > 12) add(b, a);
    else add(a, b);
  }
  return found;
}

/**
 * The claim's service_date as a timestamp. The model writes YYYY-MM-DD; a
 * number from an older payload passes through. Anything else is dropped.
 */
export function serviceDateToMs(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return undefined;
  const date = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const ms = dateToServiceMs(date);
  // Rejects "2026-02-30", which Date.UTC would roll into March.
  return new Date(ms).toISOString().slice(0, 10) === date ? ms : undefined;
}

export interface NamedDay {
  said: string;
  date: string;
  weekday: string;
}

/**
 * Each "last Saturday" or "this past Saturday" in the message, with the most
 * recent such day before today. Reading it off the calendar line, the model
 * still put "last Saturday" on the Sunday, or a week back.
 */
export function pastWeekdaysNamed(message: string, todayISO: string): NamedDay[] {
  const [y, m, d] = todayISO.split("-").map(Number);
  const todayIndex = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const found: NamedDay[] = [];
  for (const match of message.matchAll(PAST_WEEKDAY)) {
    const back = (todayIndex - WEEKDAY_INDEX[match[1].toLowerCase()] + 7) % 7 || 7;
    const day = new Date(Date.UTC(y, m - 1, d - back, 12));
    const said = match[0].toLowerCase().replace(/\s+/g, " ");
    if (found.some((f) => f.said === said)) continue;
    found.push({
      said,
      date: day.toISOString().slice(0, 10),
      weekday: day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    });
  }
  return found;
}

/** The latest occurrence of month/day on or before todayISO (YYYY-MM-DD). */
export function mostRecentPastDate({ month, day }: MonthDay, todayISO: string): string {
  const [y, m, d] = todayISO.split("-").map(Number);
  const year = month < m || (month === m && day <= d) ? y : y - 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Midday New York time, far enough from midnight that every US time zone
// reads the same calendar day.
function dateToServiceMs(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 16);
}

// The model writes either midnight UTC or a New York local time, so accept a
// match on either calendar.
function sameMonthDay(ms: number, { month, day }: MonthDay): boolean {
  const utc = new Date(ms);
  if (utc.getUTCMonth() + 1 === month && utc.getUTCDate() === day) return true;
  const [, m, d] = localNow(ms).date.split("-").map(Number);
  return m === month && d === day;
}

/**
 * A completed claim whose service_date has the month and day the user said
 * without a year gets that date's most recent past year. Everything else is
 * returned as is.
 */
export function correctYearlessServiceDates<T extends { kind?: unknown; service_date?: unknown }>(
  claims: T[],
  message: string,
  todayISO: string,
): T[] {
  const dates = yearlessDates(message);
  if (dates.length === 0) return claims;
  return claims.map((claim) => {
    if (claim.kind !== "completed" || typeof claim.service_date !== "number") return claim;
    const said = dates.find((d) => sameMonthDay(claim.service_date as number, d));
    if (!said) return claim;
    return { ...claim, service_date: dateToServiceMs(mostRecentPastDate(said, todayISO)) };
  });
}

/**
 * When "last Saturday" is the message's only way of saying when, a completed
 * claim dated within three days of it, or aged that far back, gets that day.
 * The card shows an age ahead of a date, so a converted claim drops its age.
 */
export function correctNamedWeekdayDates<
  T extends { kind?: unknown; service_date?: unknown; service_age_days?: unknown },
>(claims: T[], message: string, todayISO: string): T[] {
  const days = pastWeekdaysNamed(message, todayISO);
  if (days.length !== 1 || (message.match(ANY_WEEKDAY) ?? []).length !== 1) return claims;
  if (OTHER_WHEN.test(message) || yearlessDates(message).length > 0) return claims;
  const target = dateToServiceMs(days[0].date);
  const ageDays = Math.round((dateToServiceMs(todayISO) - target) / DAY_MS);
  return claims.map((claim) => {
    if (claim.kind !== "completed") return claim;
    if (typeof claim.service_date === "number") {
      return Math.abs(claim.service_date - target) <= 3.5 * DAY_MS ? { ...claim, service_date: target } : claim;
    }
    if (typeof claim.service_age_days === "number" && Math.abs(claim.service_age_days - ageDays) <= 3) {
      const { service_age_days: _age, ...rest } = claim;
      return { ...rest, service_date: target } as unknown as T;
    }
    return claim;
  });
}
