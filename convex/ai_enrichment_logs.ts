import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("ai_enrichment_logs").collect();
  },
});

export const getById = query({
  args: { id: v.id("ai_enrichment_logs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByEngineId = query({
  args: { engineId: v.id("engines") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ai_enrichment_logs")
      .withIndex("by_engine_id", (q) => q.eq("engine_id", args.engineId))
      .collect();
  },
});

export const getPendingReview = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("ai_enrichment_logs")
      .withIndex("by_review_status", (q) => q.eq("review_status", "pending"))
      .collect();
  },
});

export const getLowConfidence = query({
  args: {
    threshold: v.float64(),
  },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("ai_enrichment_logs").collect();
    return all.filter((log) => log.confidence_score < args.threshold);
  },
});

export const create = mutation({
  args: {
    engine_id: v.id("engines"),
    service_id: v.id("services"),
    source: v.string(),
    confidence_score: v.float64(),
    enriched_data: v.object({
      labor_hours: v.optional(v.float64()),
      parts_cost_low: v.optional(v.float64()),
      parts_cost_high: v.optional(v.float64()),
      tech_notes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("ai_enrichment_logs", {
      ...args,
      created_at: Date.now(),
      review_status: "pending",
    });

    return logId;
  },
});

export const approve = mutation({
  args: {
    id: v.id("ai_enrichment_logs"),
    reviewed_by: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      review_status: "approved",
      reviewed_by: args.reviewed_by,
    });

    return await ctx.db.get(args.id);
  },
});

export const reject = mutation({
  args: {
    id: v.id("ai_enrichment_logs"),
    reviewed_by: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      review_status: "rejected",
      reviewed_by: args.reviewed_by,
    });

    return await ctx.db.get(args.id);
  },
});
