import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("service_insights").collect();
  },
});

export const getById = query({
  args: { id: v.id("service_insights") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByServiceAndEngine = query({
  args: {
    serviceId: v.id("services"),
    engineId: v.id("engines"),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("service_insights").collect();
    return (
      all.find(
        (row) =>
          row.service_id === args.serviceId && row.engine_id === args.engineId
      ) ?? null
    );
  },
});
