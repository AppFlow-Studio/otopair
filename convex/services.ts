import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const services = await ctx.db.query("services").collect();
    return await Promise.all(
      services.map(async (service) => {
        const serviceCategory = await ctx.db.get(service.service_category_id);
        return { ...service, serviceCategory };
      })
    );
  },
});

export const getById = query({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.id);
    if (!service) {
      return null;
    }
    const serviceCategory = await ctx.db.get(service.service_category_id);
    return { ...service, serviceCategory };
  },
});
