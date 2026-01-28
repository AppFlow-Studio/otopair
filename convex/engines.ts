import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const engines = await ctx.db.query("engines").collect();
    return await Promise.all(
      engines.map(async (engine) => {
        const trim = await ctx.db.get(engine.trim_id);
        const model = trim ? await ctx.db.get(trim.model_id) : null;
        return { ...engine, trim, model };
      })
    );
  },
});

export const getById = query({
  args: { id: v.id("engines") },
  handler: async (ctx, args) => {
    const engine = await ctx.db.get(args.id);
    if (!engine) {
      return null;
    }
    const trim = await ctx.db.get(engine.trim_id);
    const model = trim ? await ctx.db.get(trim.model_id) : null;
    return { ...engine, trim, model };
  },
});

export const getByTrimId = query({
  args: { trimId: v.id("trims") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("engines")
      .filter((q) => q.eq(q.field("trim_id"), args.trimId))
      .collect();
  },
});
