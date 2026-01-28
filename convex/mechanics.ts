import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const mechanics = await ctx.db.query("mechanics").collect();
    return await Promise.all(
      mechanics.map(async (mechanic) => {
        const shop = await ctx.db.get(mechanic.shop_id);
        return { ...mechanic, shop };
      })
    );
  },
});

export const getById = query({
  args: { id: v.id("mechanics") },
  handler: async (ctx, args) => {
    const mechanic = await ctx.db.get(args.id);
    if (!mechanic) {
      return null;
    }
    const shop = await ctx.db.get(mechanic.shop_id);
    return { ...mechanic, shop };
  },
});

export const getByShopId = query({
  args: { shopId: v.id("shops") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mechanics")
      .filter((q) =>
        q.and(
          q.eq(q.field("shop_id"), args.shopId),
          q.eq(q.field("is_active"), true)
        )
      )
      .collect();
  },
});
