import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("manual_review_queue").collect();
  },
});

export const getById = query({
  args: { id: v.id("manual_review_queue") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getPending = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("manual_review_queue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
  },
});

export const getByPriorityAndStatus = query({
  args: {
    priority: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("manual_review_queue")
      .withIndex("by_priority_and_status", (q) =>
        q.eq("priority", args.priority).eq("status", args.status)
      )
      .collect();
  },
});

export const getByEngineId = query({
  args: { engineId: v.id("engines") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("manual_review_queue")
      .withIndex("by_engine_id", (q) => q.eq("engine_id", args.engineId))
      .collect();
  },
});

export const getAssignedTo = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("manual_review_queue")
      .withIndex("by_assigned_to", (q) => q.eq("assigned_to", args.userId))
      .collect();
  },
});

// Internal mutation called by pipeline code
export const queueForManualReview = internalMutation({
  args: {
    engine_id: v.id("engines"),
    service_id: v.id("services"),
    enrichment_log_id: v.id("ai_enrichment_logs"),
    priority: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const queueId = await ctx.db.insert("manual_review_queue", {
      ...args,
      status: "pending",
      created_at: Date.now(),
    });

    return queueId;
  },
});

export const assign = mutation({
  args: {
    id: v.id("manual_review_queue"),
    assigned_to: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      assigned_to: args.assigned_to,
      status: "in_review",
    });

    return await ctx.db.get(args.id);
  },
});

export const resolve = mutation({
  args: {
    id: v.id("manual_review_queue"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "resolved",
      resolved_at: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});
