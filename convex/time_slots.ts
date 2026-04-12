import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("time_slots").collect();
  },
});

export const getById = query({
  args: { id: v.id("time_slots") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByShopAndDate = query({
  args: {
    shopId: v.id("shops"),
    date: v.string(),
    mechanicId: v.optional(v.id("mechanics")),
  },
  handler: async (ctx, args) => {
    const slots = await ctx.db
      .query("time_slots")
      .filter((q) =>
        q.and(
          q.eq(q.field("shop_id"), args.shopId),
          q.eq(q.field("date"), args.date),
          q.eq(q.field("is_available"), true),
        ),
      )
      .collect();
    if (args.mechanicId !== undefined) {
      return slots.filter((s) => s.mechanic_id === args.mechanicId);
    }
    return slots;
  },
});

export const getAvailableByShopId = query({
  args: { shopId: v.id("shops") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("time_slots")
      .filter((q) => q.and(q.eq(q.field("shop_id"), args.shopId), q.eq(q.field("is_available"), true)))
      .collect();
  },
});

export const getAvailableByShopAndDateTime = query({
  args: { shopId: v.id("shops"), date: v.string(), startTime: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("time_slots")
      .filter((q) =>
        q.and(
          q.eq(q.field("shop_id"), args.shopId),
          q.eq(q.field("date"), args.date),
          q.eq(q.field("start_time"), args.startTime),
          q.eq(q.field("is_available"), true),
        ),
      )
      .collect();
  },
});

/**
 * Next N available slots for a shop, optionally filtered by mechanic.
 * When mechanicId is omitted ("Any"), returns earliest N distinct date+time slots (one per time).
 * When mechanicId is set, returns that mechanic's slots.
 */
export const getNextAvailableByShop = query({
  args: {
    shopId: v.id("shops"),
    limit: v.optional(v.number()),
    mechanicId: v.optional(v.id("mechanics")),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 12;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const slots = await ctx.db
      .query("time_slots")
      .withIndex("by_shop_id", (q) => q.eq("shop_id", args.shopId))
      .collect();

    const filtered = slots
      .filter((s) => {
        if (!s.is_available) return false;
        if (s.date < today) return false;
        if (args.mechanicId !== undefined) {
          return s.mechanic_id === args.mechanicId;
        }
        return true;
      })
      .sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        if (d !== 0) return d;
        return a.start_time.localeCompare(b.start_time);
      });

    if (args.mechanicId !== undefined) {
      return filtered.slice(0, limit);
    }

    // "Any" selected: deduplicate by (date, start_time), keep first slot per distinct time
    const seen = new Set<string>();
    const distinct: typeof filtered = [];
    for (const s of filtered) {
      const key = `${s.date}-${s.start_time}`;
      if (seen.has(key)) continue;
      seen.add(key);
      distinct.push(s);
      if (distinct.length >= limit) break;
    }
    return distinct;
  },
});

/**
 * Next N available slots per mechanic for a shop.
 * Returns one list of slots per mechanic so each mechanic card can show their own time slots.
 * Used by ShopDetails "Available Mechanics & Bays" to show slots for Mike, Sarah, etc.
 */
export const getNextAvailableByShopPerMechanic = query({
  args: {
    shopId: v.id("shops"),
    limitPerMechanic: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limitPerMechanic = args.limitPerMechanic ?? 12;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const mechanics = await ctx.db
      .query("mechanics")
      .withIndex("by_shop_id", (q) => q.eq("shop_id", args.shopId))
      .filter((q) => q.eq(q.field("is_active"), true))
      .collect();

    const allSlots = await ctx.db
      .query("time_slots")
      .withIndex("by_shop_id", (q) => q.eq("shop_id", args.shopId))
      .collect();

    const result: { mechanicId: (typeof mechanics)[0]["_id"]; slots: typeof allSlots }[] = [];

    for (const mechanic of mechanics) {
      const mechanicSlots = allSlots
        .filter((s) => {
          if (!s.is_available) return false;
          if (s.date < today) return false;
          return s.mechanic_id === mechanic._id;
        })
        .sort((a, b) => {
          const d = a.date.localeCompare(b.date);
          if (d !== 0) return d;
          return a.start_time.localeCompare(b.start_time);
        })
        .slice(0, limitPerMechanic);
      result.push({ mechanicId: mechanic._id, slots: mechanicSlots });
    }

    return result;
  },
});

/**
 * Calendar availability for a shop (and optional mechanic) for a given month.
 * Returns which dates have at least one available slot vs which have slots but all booked.
 * Used by AvailabilityModal "All Availability" calendar highlighting.
 */
export const getAvailabilityByShopAndMonth = query({
  args: {
    shopId: v.id("shops"),
    year: v.number(),
    month: v.number(), // 0-indexed (0 = January)
    mechanicId: v.optional(v.id("mechanics")),
  },
  handler: async (ctx, args) => {
    const start = new Date(args.year, args.month, 1);
    const end = new Date(args.year, args.month + 1, 0);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const slots = await ctx.db
      .query("time_slots")
      .withIndex("by_shop_id", (q) => q.eq("shop_id", args.shopId))
      .collect();

    const inRange = slots.filter((s) => {
      if (s.date < startStr || s.date > endStr) return false;
      if (args.mechanicId !== undefined) {
        return s.mechanic_id === args.mechanicId;
      }
      return true;
    });

    const availableDates = new Set<string>();
    const bookedDates = new Set<string>();

    for (const s of inRange) {
      if (s.is_available) {
        availableDates.add(s.date);
      } else {
        bookedDates.add(s.date);
      }
    }

    return {
      availableDates: [...availableDates],
      bookedDates: [...bookedDates],
    };
  },
});
