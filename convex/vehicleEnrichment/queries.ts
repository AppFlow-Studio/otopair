/**
 * vehicleEnrichment/queries.ts — Convex internal queries
 *
 * Read-only lookups for the enrichment pipeline and consumers.
 */

import { v } from "convex/values";
import { internalQuery, query } from "../_generated/server";

/** Look up enriched data by normalized engine config key. */
export const getByEngineKey = internalQuery({
  args: { engineKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("enriched_engine_configs")
      .withIndex("by_engine_config", (q) => q.eq("engineConfig", args.engineKey))
      .first();
  },
});

/** Find all enriched records sharing an engine code (for sibling lookup). */
export const getByEngineCode = internalQuery({
  args: { engineCode: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("enriched_engine_configs")
      .withIndex("by_engine_code", (q) => q.eq("engineCode", args.engineCode))
      .collect();
  },
});

/** Join vehicle → enriched data via the enrichedEngineConfigId foreign key. */
export const getForVehicle = internalQuery({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle?.enriched_engine_config_id) return null;

    return await ctx.db.get(vehicle.enriched_engine_config_id);
  },
});

/** [TEST] Public query to inspect enriched data by engine key. Remove after testing. */
export const debugGetByEngineKey = query({
  args: { engineKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("enriched_engine_configs")
      .withIndex("by_engine_config", (q) => q.eq("engineConfig", args.engineKey))
      .first();
  },
});

/** [TEST] Public delete for cleanup. Remove after testing. */
export const debugDeleteEnriched = query({
  args: { id: v.id("enriched_engine_configs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/** [TEST] Find a vehicle by VIN or by engine_code for test triggering. */
export const debugFindVehicle = query({
  args: { vin: v.optional(v.string()), engineCode: v.optional(v.string()) },
  handler: async (ctx, args) => {
    // Try VIN first
    if (args.vin) {
      const vehicle = await ctx.db
        .query("vehicles")
        .withIndex("by_vin", (q) => q.eq("vin", args.vin!))
        .first();
      if (vehicle) return { id: vehicle._id, vin: vehicle.vin, year: vehicle.year };
    }
    // Try by engine code
    if (args.engineCode) {
      const engine = await ctx.db
        .query("engines")
        .withIndex("by_engine_code", (q) => q.eq("engine_code", args.engineCode!))
        .first();
      if (engine) {
        const vehicle = await ctx.db
          .query("vehicles")
          .withIndex("by_engine_id", (q) => q.eq("engine_id", engine._id))
          .first();
        if (vehicle) return { id: vehicle._id, vin: vehicle.vin, year: vehicle.year };
      }
    }
    return null;
  },
});
