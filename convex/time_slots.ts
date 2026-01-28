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
  args: { shopId: v.id("shops"), date: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("time_slots")
      .filter((q) =>
        q.and(
          q.eq(q.field("shop_id"), args.shopId),
          q.eq(q.field("date"), args.date),
          q.eq(q.field("is_available"), true)
        )
      )
      .collect();
  },
});

export const getAvailableByShopId = query({
  args: { shopId: v.id("shops") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("time_slots")
      .filter((q) =>
        q.and(
          q.eq(q.field("shop_id"), args.shopId),
          q.eq(q.field("is_available"), true)
        )
      )
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
          q.eq(q.field("is_available"), true)
        )
      )
      .collect();
  },
});
