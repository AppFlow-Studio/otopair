import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const trims = await ctx.db.query("trims").collect();
    return await Promise.all(
      trims.map(async (trim) => {
        const model = await ctx.db.get(trim.model_id);
        return { ...trim, model };
      })
    );
  },
});

export const getById = query({
  args: { id: v.id("trims") },
  handler: async (ctx, args) => {
    const trim = await ctx.db.get(args.id);
    if (!trim) {
      return null;
    }
    const model = await ctx.db.get(trim.model_id);
    return { ...trim, model };
  },
});

export const getByModelId = query({
  args: { modelId: v.id("models") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trims")
      .filter((q) => q.eq(q.field("model_id"), args.modelId))
      .collect();
  },
});
