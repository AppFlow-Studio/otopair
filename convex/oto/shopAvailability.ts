// #434: asked for an oil change "at Waleedservicecenter tomorrow at 8 PM"
// (the shop closes at 5), Oto opened a booking card anyway. It could not see
// shop hours or open slots. This answers from the same availability the
// booking screen shows, so Oto can say why a time won't work and offer real
// ones.

import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { getBookableShopIds } from "../../lib/bookableShop";
import {
  listAvailableWindowsForShopDate,
  listNextAvailableWindowsForShop,
} from "../lib/timeSlotAvailability";
import { localNow } from "./localTime";

const DEFAULT_DURATION_MINUTES = 30;
const ALTERNATIVES = 4;

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// "Sat, Oct 3" — echoed back on every answer, so a date worked out for the
// wrong day ("Saturday" checked as Sunday) stands out to the model.
function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// "Fri, Oct 2, 4:30 PM" — written out so the model never converts times itself.
function label(date: string, time: string): string {
  const h = Number(time.slice(0, 2));
  return `${dayLabel(date)}, ${((h + 11) % 12) + 1}:${time.slice(3, 5)} ${h < 12 ? "AM" : "PM"}`;
}

// Only these answers leave a time that can be booked; after any other, a
// booking card reads as booking the refused time anyway (#434).
export const BOOKABLE_AVAILABILITY = new Set(["available", "open"]);

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// The model turned "Sunday" into Saturday's or Tuesday's date in 4 of 250
// checks (2026-10-01), with the dates on its calendar line. The day the user
// named wins: the nearest date on that day, never one before today.
function onWeekday(date: string, weekday: string, today: string): string {
  const want = WEEKDAYS.indexOf(weekday.toLowerCase());
  const ms = Date.parse(`${date}T12:00:00Z`);
  const have = new Date(ms).getUTCDay();
  if (want < 0 || want === have) return date;
  const shifted = (days: number) => new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
  const back = (have - want + 7) % 7;
  const earlier = shifted(-back);
  return back < 4 && earlier >= today ? earlier : shifted(7 - back);
}

const hhmm = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

/**
 * The times of day a message names, as HH:MM: "8pm" → 20:00, "sunday at
 * 1400" → 14:00, and both readings of a bare hour or clock time ("at 8" →
 * 08:00 and 20:00). Not "at 80 mph" or "at 1500 rpm".
 */
export function namedTimes(message: string): string[] {
  const times = new Set<string>();
  const either = (h: number, m: number) => {
    times.add(hhmm(h % 12, m));
    times.add(hhmm((h % 12) + 12, m));
  };
  for (const [, h, m, ap] of message.matchAll(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*([ap])\.?m\b/gi)) {
    times.add(hhmm((Number(h) % 12) + (ap.toLowerCase() === "p" ? 12 : 0), Number(m ?? 0))); // 8pm, 8:30 a.m.
  }
  for (const [, h, m] of message.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*[ap]\.?m\b)/gi)) {
    if (Number(h) === 0 || Number(h) > 12) times.add(hhmm(Number(h), Number(m))); // 20:00
    else either(Number(h), Number(m)); // "how about 4:30"
  }
  // "sunday at 1400", not "at 1500 rpm"
  for (const [, h, m] of message.matchAll(/\bat ([01]\d|2[0-3])([0-5]\d)\b(?!\s*(?:k|mi|miles|km|rpm)\b)/gi)) {
    times.add(hhmm(Number(h), Number(m)));
  }
  // "tonight at 8", not "at 80 mph"
  for (const [, h] of message.matchAll(/\bat ([1-9]|1[0-2])\b(?![.,:]?\d)(?!\s*[ap]\.?m\b)/gi)) either(Number(h), 0);
  if (/\bnoon\b/i.test(message)) times.add("12:00");
  return [...times];
}

/** True when the message names a time of day — the user is picking a slot. */
export function namesATime(message: string): boolean {
  return namedTimes(message).length > 0 || /\btonight\b/i.test(message);
}

const BOOKING_ASK = /\b(?:book|schedule|set (?:\w+ ){0,3}up|get (?:me|it|her|him|us) in(?:to)?)\b/i;
// "should I book it now?" asks for advice, not for a booking.
const ADVICE_ASK = /\b(?:should|do|would) i\b|\bis it (?:time|worth)\b/i;

/** True when the user asks to book, or names a time to bring the car in. */
export function asksToBook(message: string): boolean {
  return (BOOKING_ASK.test(message) || namesATime(message)) && !ADVICE_ASK.test(message);
}

const DAY_WORD = /\b(?:today|tonight|tomorrow|mon|tues?|wed|thu(?:rs)?|fri|sat|sun)(?:day|nesday|urday)?\b/i;

/** True when a message is about booking at a shop on a day or at a time. */
export function talksShopTimes(message: string): boolean {
  return /\bshops?\b/i.test(message) || DAY_WORD.test(message) || namesATime(message);
}

// Words too common to stand for a shop on their own ("the auto place").
const GENERIC_SHOP_WORDS = new Set([
  "auto", "autos", "car", "cars", "shop", "service", "services", "center", "centre", "motor",
  "motors", "garage", "tire", "tires", "repair", "repairs", "mobile", "mechanic", "express", "quick", "the",
]);

/**
 * Bookable shops the user named, by full name ("anesa shop", "kareem-shop")
 * or by a distinctive first word ("at Temur"). Told "can I bring it to anesa
 * shop tonight at 8?", Oto asked "which shop?" for three turns in 4 of 12
 * checked conversations (#434, 2026-10-01) instead of checking it.
 */
export function shopsNamedIn(texts: readonly string[], shopNames: readonly string[]): string[] {
  const joined = texts.join(" ");
  const flat = normalize(joined);
  const words = new Set(joined.toLowerCase().split(/[^a-z0-9]+/));
  return shopNames.filter((name) => {
    const full = normalize(name);
    const first = name.toLowerCase().split(/[^a-z0-9]+/).find(Boolean) ?? "";
    return (
      (full.length >= 4 && flat.includes(full)) ||
      (first.length >= 4 && !GENERIC_SHOP_WORDS.has(first) && words.has(first))
    );
  });
}

export const bookableShopNames = internalQuery({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const shops = await ctx.db.query("shops").collect();
    const bookableIds = await getBookableShopIds(ctx, shops);
    return shops.filter((s) => bookableIds.has(s._id)).map((s) => s.name);
  },
});

export const checkShopAvailability = internalQuery({
  args: {
    shop_name: v.string(),
    date: v.string(),
    time: v.optional(v.string()),
    weekday: v.optional(v.string()),
    duration_minutes: v.optional(v.number()),
    // Tests pin the clock; production uses the current time.
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const shops = await ctx.db.query("shops").collect();
    const bookableIds = await getBookableShopIds(ctx, shops);
    const bookable = shops.filter((s) => bookableIds.has(s._id));
    const wanted = normalize(args.shop_name);
    const exact = bookable.filter((s) => normalize(s.name ?? "") === wanted);
    const matches = exact.length
      ? exact
      : wanted
        ? bookable.filter((s) => {
            const name = normalize(s.name ?? "");
            return name !== "" && (name.includes(wanted) || wanted.includes(name));
          })
        : [];
    if (matches.length === 0) {
      return {
        status: "shop_not_found",
        shop_name: args.shop_name,
        bookable_shops: bookable.map((s) => s.name).slice(0, 10),
      };
    }
    if (matches.length > 1) {
      return { status: "ambiguous_shop", matches: matches.map((s) => s.name) };
    }
    const shop = matches[0];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date) || (args.time && !/^\d{2}:\d{2}$/.test(args.time))) {
      return { status: "invalid_request", reason: "date must be YYYY-MM-DD and time HH:MM (24-hour)" };
    }

    const now = localNow(args.now);
    const date = args.weekday ? onWeekday(args.date, args.weekday, now.date) : args.date;
    const duration = args.duration_minutes ?? DEFAULT_DURATION_MINUTES;
    const base = {
      shop: shop.name,
      date: date,
      day: dayLabel(date),
      ...(args.time ? { time: args.time } : {}),
    };
    // The first few open times, plus the latest one that day: told Saturday was
    // closed, with "Sun 9:00 to 9:45 AM" as the alternatives, Oto said Sunday at
    // 10 was taken (3 of 10 runs, 2026-10-01). The shop was open until 4:30.
    const nextOpen = async () => {
      const slots = await listNextAvailableWindowsForShop(ctx, {
        shopId: shop._id,
        startDate: date < now.date ? now.date : date,
        cutoffDate: now.date,
        cutoffTime: now.time,
        durationMinutes: duration,
        limit: ALTERNATIVES,
        distinctTimes: true,
      });
      const first = slots[0];
      const latest = first
        ? (
            await listAvailableWindowsForShopDate(ctx, {
              shopId: shop._id,
              date: first.date,
              durationMinutes: duration,
              cutoffTime: first.date === now.date ? now.time : undefined,
            })
          )
            .map((w) => w.start_time)
            .sort()
            .pop()
        : undefined;
      return {
        alternatives: slots.map((slot) => label(slot.date, slot.start_time)),
        ...(first && latest ? { last_open_time: label(first.date, latest) } : {}),
      };
    };

    if (date < now.date || (date === now.date && args.time !== undefined && args.time <= now.time)) {
      return { ...base, status: "past", ...(await nextOpen()) };
    }

    const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
    const hours = (
      await ctx.db
        .query("shops_hours")
        .withIndex("by_shop_id", (q) => q.eq("shop_id", shop._id))
        .collect()
    ).find((row) => row.day_of_week === dayOfWeek);
    if (!hours || hours.is_closed || !hours.open_time || !hours.close_time) {
      return { ...base, status: "closed_that_day", ...(await nextOpen()) };
    }
    const hoursLabel = `${label(date, hours.open_time).split(", ").pop()} to ${label(date, hours.close_time).split(", ").pop()}`;

    const windows = await listAvailableWindowsForShopDate(ctx, {
      shopId: shop._id,
      date: date,
      durationMinutes: duration,
      cutoffTime: date === now.date ? now.time : undefined,
    });
    const times = [...new Set(windows.map((w) => w.start_time))].sort();

    if (!args.time) {
      // open_times is only the first few, so the last one is not the latest:
      // asked "what's the latest today?", Oto answered 10:45 AM at a shop
      // taking cars until 4:30 PM.
      return times.length
        ? {
            ...base,
            status: "open",
            hours: hoursLabel,
            open_times: times.slice(0, 8).map((t) => label(date, t)),
            last_open_time: label(date, times[times.length - 1]),
          }
        : { ...base, status: "fully_booked", hours: hoursLabel, ...(await nextOpen()) };
    }
    if (times.includes(args.time)) {
      return { ...base, status: "available", hours: hoursLabel };
    }
    const outside =
      minutes(args.time) < minutes(hours.open_time) ||
      minutes(args.time) + duration > minutes(hours.close_time);
    const status = outside ? "outside_hours" : "taken";
    if (!times.length) return { ...base, status, hours: hoursLabel, ...(await nextOpen()) };
    const target = minutes(args.time);
    const alternatives = [...times]
      .sort((a, b) => Math.abs(minutes(a) - target) - Math.abs(minutes(b) - target))
      .slice(0, ALTERNATIVES)
      .sort()
      .map((t) => label(date, t));
    return { ...base, status, hours: hoursLabel, alternatives, last_open_time: label(date, times[times.length - 1]) };
  },
});
