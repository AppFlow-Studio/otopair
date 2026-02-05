/**
 * Vehicle Pipeline — Internal Mutations & Queries
 *
 * Separated from vehicle_pipeline.ts (actions) to avoid circular
 * type inference through `internal.vehicle_pipeline.*`.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// ============================================
// INTERNAL QUERIES
// ============================================

export const getEngineSpecs = internalQuery({
  args: { engineId: v.id("engines") },
  handler: async (ctx, args) => {
    return (
      await ctx.db
        .query("engine_specs")
        .withIndex("by_engine", (q) => q.eq("engine_id", args.engineId))
        .first()
    ) || null;
  },
});

export const getEngine = internalQuery({
  args: { engineId: v.id("engines") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.engineId);
  },
});

export const getUserByClerkId = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .unique();
  },
});

// ============================================
// UPSERT MUTATIONS (Stage 2)
// ============================================

export const upsertMake = internalMutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("makes")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("makes", {
      name: args.name,
    });
  },
});

export const upsertModel = internalMutation({
  args: { makeId: v.id("makes"), name: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("models")
      .withIndex("by_make_id", (q) => q.eq("make_id", args.makeId))
      .collect();

    const match = existing.find(
      (m) => m.name.toLowerCase() === args.name.toLowerCase()
    );
    if (match) return match._id;

    return await ctx.db.insert("models", {
      make_id: args.makeId,
      name: args.name,
    });
  },
});

export const upsertTrim = internalMutation({
  args: {
    modelId: v.id("models"),
    name: v.string(),
    year: v.float64(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("trims")
      .withIndex("by_model_id", (q) => q.eq("model_id", args.modelId))
      .collect();

    const match = existing.find(
      (t) =>
        t.name.toLowerCase() === args.name.toLowerCase() &&
        args.year >= t.year_start &&
        args.year <= t.year_end
    );
    if (match) return match._id;

    return await ctx.db.insert("trims", {
      model_id: args.modelId,
      name: args.name,
      year_start: args.year,
      year_end: args.year,
    });
  },
});

export const upsertEngine = internalMutation({
  args: {
    trimId: v.id("trims"),
    engineCode: v.string(),
    cylinders: v.float64(),
    displacement: v.string(),
    fuelType: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("engines")
      .withIndex("by_trim_id", (q) => q.eq("trim_id", args.trimId))
      .collect();

    const match = existing.find(
      (e) =>
        e.engine_code === args.engineCode ||
        (e.cylinders === args.cylinders &&
          e.displacement_liters === args.displacement)
    );
    if (match) return match._id;

    return await ctx.db.insert("engines", {
      trim_id: args.trimId,
      engine_code: args.engineCode,
      cylinders: args.cylinders,
      displacement_liters: args.displacement,
      fuel_type: args.fuelType,
    });
  },
});

// ============================================
// SPECS STORAGE MUTATIONS (Stage 3)
// ============================================

export const storeEngineSpecs = internalMutation({
  args: {
    engineId: v.id("engines"),
    specs: v.any(),
    confidenceScore: v.float64(),
  },
  handler: async (ctx, args) => {
    const s = args.specs;
    await ctx.db.insert("engine_specs", {
      engine_id: args.engineId,
      oil_viscosity: s.oil_viscosity || "N/A",
      oil_capacity_qts: parseFloat(s.oil_capacity_qts) || 0,
      oil_change_interval: s.oil_change_interval || "N/A",
      coolant_type: s.coolant_type || "N/A",
      coolant_capacity_qts: parseFloat(s.coolant_capacity_qts) || undefined,
      brake_fluid_type: s.brake_fluid_type || "N/A",
      tire_rotation_interval: s.tire_rotation_interval || "N/A",
      spark_plug_interval: s.spark_plug_interval || undefined,
      serpentine_belt_interval: s.serpentine_belt_interval || undefined,
      transmission_fluid_interval: s.transmission_fluid_interval || undefined,
      engine_air_filter_interval: s.engine_air_filter_interval || undefined,
      cabin_air_filter_interval: s.cabin_air_filter_interval || undefined,
      confidence_score: args.confidenceScore,
      created_at: Date.now(),
    });
  },
});

export const storeVehicleSpecs = internalMutation({
  args: {
    engineId: v.id("engines"),
    specs: v.any(),
    confidenceScore: v.float64(),
  },
  handler: async (ctx, args) => {
    const s = args.specs;
    await ctx.db.insert("vehicle_specs", {
      engine_id: args.engineId,
      oil_filter_oem: s.oil_filter_oem || "N/A",
      oil_drain_plug_gasket_oem: s.oil_drain_plug_gasket_oem || "N/A",
      engine_air_filter_oem: s.engine_air_filter_oem || "N/A",
      cabin_air_filter_oem: s.cabin_air_filter_oem || "N/A",
      front_brake_pad_oem: s.front_brake_pad_oem || "N/A",
      rear_brake_pad_oem: s.rear_brake_pad_oem || "N/A",
      front_brake_rotor_oem: s.front_brake_rotor_oem || "N/A",
      rear_brake_rotor_oem: s.rear_brake_rotor_oem || "N/A",
      spark_plug_oem: s.spark_plug_oem || "N/A",
      spark_plug_quantity: parseFloat(s.spark_plug_quantity) || 0,
      spark_plug_gap_mm: parseFloat(s.spark_plug_gap_mm) || 0,
      serpentine_belt_oem: s.serpentine_belt_oem || "N/A",
      battery_group: s.battery_group || "N/A",
      battery_cca: parseFloat(s.battery_cca) || 0,
      oil_viscocity: s.oil_viscosity || "N/A",
      oil_capacity_qts: String(s.oil_capacity_qts || "N/A"),
      parking_brake_type: s.parking_brake_type || "N/A",
    });
  },
});

export const storeTrimSpecs = internalMutation({
  args: {
    trimId: v.id("trims"),
    specs: v.any(),
    confidenceScore: v.float64(),
  },
  handler: async (ctx, args) => {
    const s = args.specs;
    await ctx.db.insert("trim_specs", {
      trim_id: args.trimId,
      tire_size_front: s.tire_size_front || "N/A",
      tire_size_rear: s.tire_size_rear || "N/A",
      recommended_tire_pressure_front_psi:
        parseFloat(s.recommended_tire_pressure_front_psi) || 0,
      recommended_tire_pressure_rear_psi:
        parseFloat(s.recommended_tire_pressure_rear_psi) || 0,
      lug_nut_torque_ft_lbs: parseFloat(s.lug_nut_torque_ft_lbs) || 0,
      wiper_blade_driver_size_in:
        parseFloat(s.wiper_blade_driver_size_in) || 0,
      wiper_blade_passenger_size_in:
        parseFloat(s.wiper_blade_passenger_size_in) || 0,
      parking_brake_type: s.parking_brake_type || "N/A",
      confidence_score: args.confidenceScore,
      created_at: Date.now(),
    });
  },
});

/**
 * Log AI enrichment attempt for audit trail
 */
export const logEnrichment = internalMutation({
  args: {
    engineId: v.id("engines"),
    confidenceScore: v.float64(),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    console.log(
      `Enrichment logged: engine=${args.engineId} score=${args.confidenceScore} source=${args.source}`
    );
  },
});

// ============================================
// SERVICE PRICING QUERIES & MUTATIONS
// ============================================

/**
 * Return all rows from the services table.
 * Used by the pipeline to build the pricing prompt.
 */
export const listAllServices = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("services").collect();
  },
});

/**
 * Count service_vehicle_specs rows for a given engine_id.
 * Used for the re-enrichment guard so we skip pricing if already populated.
 */
export const getServiceVehicleSpecsCount = internalQuery({
  args: { engineId: v.id("engines") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("service_vehicle_specs")
      .withIndex("by_engine_id", (q) => q.eq("engine_id", args.engineId))
      .collect();
    return rows.length;
  },
});

/**
 * Upsert a row in service_vehicle_specs for an (engine, service) pair.
 * If a row exists and the new confidence >= existing, we patch; otherwise insert.
 * Idempotent — safe to re-run.
 */
export const upsertServiceVehicleSpec = internalMutation({
  args: {
    engineId: v.id("engines"),
    serviceId: v.id("services"),
    laborHours: v.float64(),
    partsCostLow: v.float64(),
    partsCostHigh: v.float64(),
    confidenceScore: v.float64(),
    techNotes: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("service_vehicle_specs")
      .withIndex("by_engine_and_service", (q) =>
        q.eq("engine_id", args.engineId).eq("service_id", args.serviceId)
      )
      .first();

    if (existing) {
      if (args.confidenceScore >= existing.confidence_score) {
        await ctx.db.patch(existing._id, {
          labor_hours: args.laborHours,
          parts_cost_low: args.partsCostLow,
          parts_cost_high: args.partsCostHigh,
          confidence_score: args.confidenceScore,
          tech_notes: args.techNotes,
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("service_vehicle_specs", {
      engine_id: args.engineId,
      service_id: args.serviceId,
      labor_hours: args.laborHours,
      parts_cost_low: args.partsCostLow,
      parts_cost_high: args.partsCostHigh,
      confidence_score: args.confidenceScore,
      tech_notes: args.techNotes,
    });
  },
});

/**
 * Insert a row into ai_enrichment_logs for a service pricing enrichment.
 * Auto-sets review_status to "approved" if confidence >= 0.7, else "pending".
 */
export const logServiceEnrichment = internalMutation({
  args: {
    engineId: v.id("engines"),
    serviceId: v.id("services"),
    source: v.string(),
    confidenceScore: v.float64(),
    enrichedData: v.object({
      labor_hours: v.optional(v.float64()),
      parts_cost_low: v.optional(v.float64()),
      parts_cost_high: v.optional(v.float64()),
      tech_notes: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("ai_enrichment_logs", {
      engine_id: args.engineId,
      service_id: args.serviceId,
      source: args.source,
      confidence_score: args.confidenceScore,
      enriched_data: args.enrichedData,
      review_status: args.confidenceScore >= 0.7 ? "approved" : "pending",
      created_at: Date.now(),
    });
  },
});
