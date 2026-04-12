import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    shopId: v.id("shops"),
    firstName: v.string(),
    lastName: v.string(),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("mechanics", {
      shop_id: args.shopId,
      first_name: args.firstName,
      last_name: args.lastName,
      title: args.title,
      is_active: true,
      rating: 0,
      review_count: 0,
    });
  },
});

export const getByShop = query({
  args: { shopId: v.id("shops") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mechanics")
      .withIndex("by_shop_id", (q) => q.eq("shop_id", args.shopId))
      .collect();
  },
});
