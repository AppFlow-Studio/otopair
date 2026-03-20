/**
 * vehicleEnrichment/mutations.ts — Convex internal mutations
 *
 * Write operations for storing enrichment results and linking
 * them to vehicle records.
 */

import { v } from "convex/values";
import { internalMutation, mutation } from "../_generated/server";
import { internal } from "../_generated/api";

/** Insert a fully enriched engine config record. Returns the new document ID. */
export const storeEnrichedData = internalMutation({
  args: { data: v.any() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("enriched_engine_configs", args.data);
  },
});

/** Update an existing enriched engine config record (v4 re-enrichment). */
export const updateEnrichedData = internalMutation({
  args: {
    id: v.id("enriched_engine_configs"),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.replace(args.id, args.data);
  },
});

/** Set the enrichedEngineConfigId on a vehicle record. */
export const attachToVehicle = internalMutation({
  args: {
    vehicleId: v.id("vehicles"),
    enrichedDataId: v.id("enriched_engine_configs"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.vehicleId, {
      enriched_engine_config_id: args.enrichedDataId,
    });
  },
});

/** [TEST] Delete enrichment record and unlink from vehicle. Remove after testing. */
export const debugCleanup = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    enrichedId: v.id("enriched_engine_configs"),
  },
  handler: async (ctx, args) => {
    // Unlink from vehicle
    await ctx.db.patch(args.vehicleId, {
      enriched_engine_config_id: undefined,
    });
    // Delete enrichment record
    await ctx.db.delete(args.enrichedId);
    return { success: true };
  },
});

/** [TEST] Schedule enrichment pipeline for a vehicle (bypasses normal booking flow). */
export const debugScheduleEnrichment = mutation({
  args: {
    vehicleId: v.id("vehicles"),
    year: v.float64(),
    make: v.string(),
    model: v.string(),
    trim: v.string(),
    engineCode: v.string(),
    displacement: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, internal.vehicleEnrichment.v3pipeline.enrichVehicleBatchV3, {
      vehicleId: args.vehicleId,
      year: args.year,
      make: args.make,
      model: args.model,
      trim: args.trim,
      engineCode: args.engineCode,
      displacement: args.displacement,
    });
    return { scheduled: true };
  },
});

/** [TEST] Delete enrichment record by engine key (cache clear). Remove after testing. */
export const debugDeleteByEngineKey = mutation({
  args: { engineKey: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("enriched_engine_configs")
      .withIndex("by_engine_config", (q) => q.eq("engineConfig", args.engineKey))
      .first();
    if (record) {
      await ctx.db.delete(record._id);
      return { deleted: true, id: record._id };
    }
    return { deleted: false };
  },
});
