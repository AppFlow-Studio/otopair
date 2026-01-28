import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("user_vehicles").collect();
  },
});

export const getById = query({
  args: { id: v.id("user_vehicles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("user_vehicles")
      .filter((q) => q.eq(q.field("user_id"), args.userId))
      .collect();
  },
});
