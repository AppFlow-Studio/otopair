import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const specs = await ctx.db.query("vehicle_specs").collect();
    return await Promise.all(
      specs.map(async (spec) => {
        const engine = await ctx.db.get(spec.engine_id);
        const trim = engine ? await ctx.db.get(engine.trim_id) : null;
        const model = trim ? await ctx.db.get(trim.model_id) : null;
        return { ...spec, engine, trim, model };
      })
    );
  },
});

export const getById = query({
  args: { id: v.id("vehicle_specs") },
  handler: async (ctx, args) => {
    const spec = await ctx.db.get(args.id);
    if (!spec) {
      return null;
    }
    const engine = await ctx.db.get(spec.engine_id);
    const trim = engine ? await ctx.db.get(engine.trim_id) : null;
    const model = trim ? await ctx.db.get(trim.model_id) : null;
    return { ...spec, engine, trim, model };
  },
});
