import { query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("service_vehicle_specs").collect();
  },
});

export const getById = query({
  args: { id: v.id("service_vehicle_specs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Lookup labor/parts specs for a given engine + service (for pricing when VIN → vehicle → engine_id is known).
 * Returns single doc or null: labor_hours, parts_cost_low, parts_cost_high, confidence_score, tech_notes.
 */
export const getByEngineAndService = query({
  args: {
    engineId: v.id("engines"),
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("service_vehicle_specs")
      .withIndex("by_engine_and_service", (q) => q.eq("engine_id", args.engineId).eq("service_id", args.serviceId))
      .unique();
    if (!doc) return null;
    return {
      labor_hours: doc.labor_hours,
      parts_cost_low: doc.parts_cost_low,
      parts_cost_high: doc.parts_cost_high,
      confidence_score: doc.confidence_score,
      tech_notes: doc.tech_notes,
    };
  },
});

/**
 * Lookup labor/parts specs for an engine + multiple services (car-specific pricing).
 * Returns map of serviceId -> specs including confidence for Smart Pricing.
 */
export const getSpecsForEngineAndServices = query({
  args: {
    engineId: v.id("engines"),
    serviceIds: v.array(v.id("services")),
  },
  handler: async (ctx, args) => {
    const specs: Record<
      string,
      {
        labor_hours: number;
        parts_cost_avg: number;
        parts_cost_low: number;
        parts_cost_high: number;
        confidence_score: number;
      }
    > = {};
    for (const serviceId of args.serviceIds) {
      const doc = await ctx.db
        .query("service_vehicle_specs")
        .withIndex("by_engine_and_service", (q) => q.eq("engine_id", args.engineId).eq("service_id", serviceId))
        .unique();
      if (doc) {
        specs[serviceId] = {
          labor_hours: doc.labor_hours,
          parts_cost_avg: (doc.parts_cost_low + doc.parts_cost_high) / 2,
          parts_cost_low: doc.parts_cost_low,
          parts_cost_high: doc.parts_cost_high,
          confidence_score: doc.confidence_score,
        };
      }
    }
    return specs;
  },
});
