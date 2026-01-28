import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("makes").collect();
  },
});

export const getById = query({
  args: { id: v.id("makes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});