/**
 * specs.ts - Subsystem specification management (engine, transmission, trim).
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ----------------------------
// Helpers
// ----------------------------

const attachPart = async (ctx: { db: any }, fitment: any) => {
  const part = await ctx.db.get(fitment.part_id);
  return {
    ...fitment,
    oem_part_number: part?.oem_part_number,
    part_name: part?.name,
  };
};

const normalizeConfidence = (value?: number) =>
  value === undefined ? undefined : Math.min(1, Math.max(0, value));

// ----------------------------
// Upserts
// ----------------------------

export const upsertEngineSpecs = mutation({
  args: {
    engine_id: v.id("engines"),
    oil_viscosity: v.optional(v.string()),
    oil_capacity_qts: v.optional(v.float64()),
    coolant_type: v.optional(v.string()),
    coolant_capacity_qts: v.optional(v.float64()),
    brake_fluid_type: v.optional(v.string()),
    oil_change_interval: v.optional(v.string()),
    cabin_air_filter_interval: v.optional(v.string()),
    engine_air_filter_interval: v.optional(v.string()),
    spark_plug_interval: v.optional(v.string()),
    serpentine_belt_interval: v.optional(v.string()),
    brake_fluid_interval: v.optional(v.string()),
    coolant_interval: v.optional(v.string()),
    transmission_fluid_interval: v.optional(v.string()),
    tire_rotation_interval: v.optional(v.string()),
    confidence_score: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("engine_specs")
      .withIndex("by_engine", (q) => q.eq("engine_id", args.engine_id))
      .unique();

    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(args)) {
      if (key === "engine_id" || key === "confidence_score") continue;
      if (value !== undefined) updates[key] = value;
    }

    const providedConfidence = normalizeConfidence(args.confidence_score);

    if (existing) {
      if (providedConfidence !== undefined) {
        const newConfidence = Math.min(
          1,
          Math.max(existing.confidence_score ?? 0, providedConfidence)
        );
        updates.confidence_score = newConfidence;
      }
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }
      return await ctx.db.get(existing._id);
    }

    const now = Date.now();
    const specId = await ctx.db.insert("engine_specs", {
      engine_id: args.engine_id,
      ...updates,
      confidence_score: providedConfidence ?? 0.5,
      created_at: now,
    });
    return await ctx.db.get(specId);
  },
});

export const upsertTransmissionSpecs = mutation({
  args: {
    transmission_id: v.id("transmissions"),
    transmission_fluid_type: v.optional(v.string()),
    transmission_fluid_capacity_qts: v.optional(v.float64()),
    maintenance_interval: v.optional(v.string()),
    confidence_score: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("transmission_specs")
      .withIndex("by_transmission", (q) => q.eq("transmission_id", args.transmission_id))
      .unique();

    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(args)) {
      if (key === "transmission_id" || key === "confidence_score") continue;
      if (value !== undefined) updates[key] = value;
    }

    const providedConfidence = normalizeConfidence(args.confidence_score);

    if (existing) {
      if (providedConfidence !== undefined) {
        const newConfidence = Math.min(
          1,
          Math.max(existing.confidence_score ?? 0, providedConfidence)
        );
        updates.confidence_score = newConfidence;
      }
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }
      return await ctx.db.get(existing._id);
    }

    const now = Date.now();
    const specId = await ctx.db.insert("transmission_specs", {
      transmission_id: args.transmission_id,
      ...updates,
      confidence_score: providedConfidence ?? 0.5,
      created_at: now,
    });
    return await ctx.db.get(specId);
  },
});

export const upsertTrimSpecs = mutation({
  args: {
    trim_id: v.id("trims"),
    tire_size_front: v.optional(v.string()),
    tire_size_rear: v.optional(v.string()),
    recommended_tire_pressure_front_psi: v.optional(v.float64()),
    recommended_tire_pressure_rear_psi: v.optional(v.float64()),
    lug_nut_torque_ft_lbs: v.optional(v.float64()),
    parking_brake_type: v.optional(v.string()),
    confidence_score: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("trim_specs")
      .withIndex("by_trim", (q) => q.eq("trim_id", args.trim_id))
      .unique();

    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(args)) {
      if (key === "trim_id" || key === "confidence_score") continue;
      if (value !== undefined) updates[key] = value;
    }

    const providedConfidence = normalizeConfidence(args.confidence_score);

    if (existing) {
      if (providedConfidence !== undefined) {
        const newConfidence = Math.min(
          1,
          Math.max(existing.confidence_score ?? 0, providedConfidence)
        );
        updates.confidence_score = newConfidence;
      }
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }
      return await ctx.db.get(existing._id);
    }

    const now = Date.now();
    const specId = await ctx.db.insert("trim_specs", {
      trim_id: args.trim_id,
      ...updates,
      confidence_score: providedConfidence ?? 0.5,
      created_at: now,
    });
    return await ctx.db.get(specId);
  },
});

// ----------------------------
// Aggregated vehicle spec pack
// ----------------------------

export const getFullVehicleSpecPack = query({
  args: { vin: v.string() },
  handler: async (ctx, args) => {
    const normalizedVin = args.vin.toUpperCase().trim();

    const vehicle = await ctx.db
      .query("vehicles")
      .withIndex("by_vin", (q) => q.eq("vin", normalizedVin))
      .unique();

    if (!vehicle) {
      throw new Error(`Vehicle not found for VIN: ${args.vin}`);
    }

    const engineSpecs = vehicle.engine_id
      ? await ctx.db
          .query("engine_specs")
          .withIndex("by_engine", (q) => q.eq("engine_id", vehicle.engine_id))
          .unique()
      : null;

    const transmissionSpecs = vehicle.transmission_id
      ? await ctx.db
          .query("transmission_specs")
          .withIndex("by_transmission", (q) => q.eq("transmission_id", vehicle.transmission_id))
          .unique()
      : null;

    const trimSpecs = vehicle.trim_id
      ? await ctx.db
          .query("trim_specs")
          .withIndex("by_trim", (q) => q.eq("trim_id", vehicle.trim_id))
          .unique()
      : null;

    const engineFitments = vehicle.engine_id
      ? await ctx.db
          .query("engine_part_fitments")
          .withIndex("by_engine", (q) => q.eq("engine_id", vehicle.engine_id))
          .collect()
      : [];

    const transmissionFitments = vehicle.transmission_id
      ? await ctx.db
          .query("transmission_part_fitments")
          .withIndex("by_transmission", (q) => q.eq("transmission_id", vehicle.transmission_id))
          .collect()
      : [];

    const trimFitments = vehicle.trim_id
      ? await ctx.db
          .query("trim_part_fitments")
          .withIndex("by_trim", (q) => q.eq("trim_id", vehicle.trim_id))
          .collect()
      : [];

    const [engineParts, transmissionParts, trimParts] = await Promise.all([
      Promise.all(engineFitments.map((f) => attachPart(ctx, f))),
      Promise.all(transmissionFitments.map((f) => attachPart(ctx, f))),
      Promise.all(trimFitments.map((f) => attachPart(ctx, f))),
    ]);

    return {
      vehicle,
      engine_specs: engineSpecs,
      transmission_specs: transmissionSpecs,
      trim_specs: trimSpecs,
      parts: {
        engine: engineParts,
        transmission: transmissionParts,
        trim: trimParts,
      },
    };
  },
});
