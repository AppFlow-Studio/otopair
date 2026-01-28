import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("models").collect();
  },
});

export const getById = query({
  args: { id: v.id("models") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByMakeId = query({
  args: { makeId: v.id("makes") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("models")
      .filter((q) => q.eq(q.field("make_id"), args.makeId))
      .collect();
  },
});
