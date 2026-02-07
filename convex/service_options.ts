import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const options = await ctx.db.query("service_options").collect();
    return await Promise.all(
      options.map(async (option) => {
        const service = await ctx.db.get(option.service_id);
        const serviceCategory = service
          ? await ctx.db.get(service.service_category_id)
          : null;
        return { ...option, service, serviceCategory };
      })
    );
  },
});

export const getById = query({
  args: { id: v.id("service_options") },
  handler: async (ctx, args) => {
    const option = await ctx.db.get(args.id);
    if (!option) {
      return null;
    }
    const service = await ctx.db.get(option.service_id);
    const serviceCategory = service
      ? await ctx.db.get(service.service_category_id)
      : null;
    return { ...option, service, serviceCategory };
  },
});
