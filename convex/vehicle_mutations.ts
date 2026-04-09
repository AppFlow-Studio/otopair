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
      (await ctx.db
        .query("engine_specs")
        .withIndex("by_engine", (q) => q.eq("engine_id", args.engineId))
        .first()) || null
    );
  },
});

export const getEngine = internalQuery({
  args: { engineId: v.id("engines") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.engineId);
  },
});

export const getTrim = internalQuery({
  args: { trimId: v.id("trims") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.trimId);
  },
});

export const getModel = internalQuery({
  args: { modelId: v.id("models") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.modelId);
  },
});

export const getMake = internalQuery({
  args: { makeId: v.id("makes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.makeId);
  },
});

export const patchEngine = internalMutation({
  args: {
    engineId: v.id("engines"),
    timingType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.timingType) {
      await ctx.db.patch(args.engineId, { timing_type: args.timingType });
    }
  },
});

export const patchTrim = internalMutation({
  args: {
    trimId: v.id("trims"),
    steeringType: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.trimId, { steering_type: args.steeringType });
  },
});

/**
 * Get engine with trim (year_start, year_end) and model (name) for validation.
 */
export const getEngineWithTrimModel = internalQuery({
  args: { engineId: v.id("engines") },
  handler: async (ctx, args) => {
    const engine = await ctx.db.get(args.engineId);
    if (!engine) return null;
    const trim = await ctx.db.get(engine.trim_id);
    if (!trim) return { engine, trim: null, model: null };
    const model = await ctx.db.get(trim.model_id);
    if (!model) return { engine, trim, model: null };
    return { engine, trim, model };
  },
});

const OEM_PART_COLUMNS = [
  "oil_filter_oem",
  "oil_drain_plug_gasket_oem",
  "engine_air_filter_oem",
  "cabin_air_filter_oem",
  "front_brake_pad_oem",
  "rear_brake_pad_oem",
  "front_brake_rotor_oem",
  "rear_brake_rotor_oem",
  "spark_plug_oem",
  "serpentine_belt_oem",
] as const;

/**
 * Find engines that already have this part number (in vehicle_specs or engine_part_fitments).
 * Returns { engine_id, model_name, year_start, year_end } for year-mismatch detection.
 */
export const getOtherEnginesWithPartNumber = internalQuery({
  args: {
    partNumber: v.string(),
    excludeEngineId: v.id("engines"),
  },
  handler: async (ctx, args) => {
    const normalizedPart = args.partNumber.trim().toUpperCase();
    if (!normalizedPart || normalizedPart === "N/A") return [];

    const results: { engine_id: typeof args.excludeEngineId; model_name: string; year_start: number; year_end: number }[] = [];

    // Check engine_part_fitments via oem_parts
    const part = await ctx.db
      .query("oem_parts")
      .withIndex("by_part_number", (q) => q.eq("oem_part_number", normalizedPart))
      .unique();
    if (part) {
      const fitments = await ctx.db
        .query("engine_part_fitments")
        .withIndex("by_part", (q) => q.eq("part_id", part._id))
        .collect();
      for (const f of fitments) {
        if (f.engine_id === args.excludeEngineId) continue;
        const engine = await ctx.db.get(f.engine_id);
        if (!engine) continue;
        const trim = await ctx.db.get(engine.trim_id);
        if (!trim) continue;
        const model = await ctx.db.get(trim.model_id);
        if (!model) continue;
        results.push({
          engine_id: f.engine_id,
          model_name: model.name,
          year_start: trim.year_start,
          year_end: trim.year_end,
        });
      }
    }

    // Check vehicle_specs (parts stored as flat columns)
    const allVehicleSpecs = await ctx.db.query("vehicle_specs").collect();
    const seen = new Set(results.map((r) => r.engine_id));

    for (const vs of allVehicleSpecs) {
      if (vs.engine_id === args.excludeEngineId) continue;
      if (seen.has(vs.engine_id)) continue;

      for (const col of OEM_PART_COLUMNS) {
        const val = (vs as any)[col];
        if (val && String(val).trim().toUpperCase() === normalizedPart) {
          const engine = await ctx.db.get(vs.engine_id);
          if (!engine) continue;
          const trim = await ctx.db.get(engine.trim_id);
          if (!trim) continue;
          const model = await ctx.db.get(trim.model_id);
          if (!model) continue;
          results.push({
            engine_id: vs.engine_id,
            model_name: model.name,
            year_start: trim.year_start,
            year_end: trim.year_end,
          });
          seen.add(vs.engine_id);
          break;
        }
      }
    }

    return results;
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

export const createTestUser = internalMutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      clerkUserId: args.clerkUserId,
      first_name: "Test",
      last_name: "User",
      email: "test@otopair.com",
      role: "car_owner",
    });
  },
});

// ============================================
// UPSERT MUTATIONS (Stage 2)
// ============================================

export const upsertMake = internalMutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    // Try exact match first
    const exact = await ctx.db
      .query("makes")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    if (exact) return exact._id;

    // Fall back to case-insensitive slug match.
    // VIN decoders return "MERCEDES-BENZ" but seeded makes use "Mercedes-Benz".
    const slug = args.name.toLowerCase().replace(/\s+/g, "-");
    const bySlug = await ctx.db
      .query("makes")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (bySlug) return bySlug._id;

    // Only create if truly new — include slug so future lookups work
    return await ctx.db.insert("makes", {
      name: args.name,
      slug,
      logo_url: "",
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

    const match = existing.find((m) => m.name.toLowerCase() === args.name.toLowerCase());
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
      (t) => t.name.toLowerCase() === args.name.toLowerCase() && args.year >= t.year_start && args.year <= t.year_end,
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
        (e.cylinders === args.cylinders && e.displacement_liters === args.displacement),
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

/** Update an engine's engine_code (e.g. after AI infers it from model+trim+year). */
export const updateEngineCode = internalMutation({
  args: {
    engineId: v.id("engines"),
    engineCode: v.string(),
  },
  handler: async (ctx, args) => {
    const engine = await ctx.db.get(args.engineId);
    if (!engine) return;
    await ctx.db.patch(args.engineId, { engine_code: args.engineCode });
  },
});

/**
 * Get engines by engine_code (for sibling cross-reference in gap fill).
 */
export const getEnginesByCode = internalQuery({
  args: { engineCode: v.string() },
  handler: async (ctx, args) => {
    if (!args.engineCode?.trim()) return [];
    return await ctx.db
      .query("engines")
      .withIndex("by_engine_code", (q) => q.eq("engine_code", args.engineCode.trim()))
      .collect();
  },
});

/**
 * Get engines for a trim (for single-option engine code inference).
 */
export const getEnginesByTrim = internalQuery({
  args: { trimId: v.id("trims") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("engines")
      .withIndex("by_trim_id", (q) => q.eq("trim_id", args.trimId))
      .collect();
  },
});

const VEHICLE_ATTRIBUTE_KEYS = [
  "power_steering_type",
  "timing_system",
  "has_turbocharger",
  "fuel_injection_type",
  "transmission_type",
  "drivetrain_type",
] as const;

/**
 * Update vehicle attributes on engine_specs (power steering, timing, etc.).
 */
export const updateEngineAttributes = internalMutation({
  args: {
    engineId: v.id("engines"),
    attributes: v.object({
      power_steering_type: v.optional(v.union(v.string(), v.null())),
      timing_system: v.optional(v.union(v.string(), v.null())),
      has_turbocharger: v.optional(v.union(v.boolean(), v.null())),
      fuel_injection_type: v.optional(v.union(v.string(), v.null())),
      transmission_type: v.optional(v.union(v.string(), v.null())),
      drivetrain_type: v.optional(v.union(v.string(), v.null())),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("engine_specs")
      .withIndex("by_engine", (q) => q.eq("engine_id", args.engineId))
      .first();
    if (!existing) return;
    const patch: Record<string, any> = {};
    for (const k of VEHICLE_ATTRIBUTE_KEYS) {
      if (args.attributes[k] !== undefined) patch[k] = args.attributes[k];
    }
    if (Object.keys(patch).length) await ctx.db.patch(existing._id, patch);
  },
});

/**
 * Partial update of vehicle_specs (for gap fill).
 */
export const updateVehicleSpecs = internalMutation({
  args: {
    engineId: v.id("engines"),
    updates: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("vehicle_specs")
      .withIndex("by_engine_id", (q) => q.eq("engine_id", args.engineId))
      .first();
    if (!existing) return;
    const patch = args.updates as Record<string, any>;
    if (Object.keys(patch).length) await ctx.db.patch(existing._id, patch);
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
    const base: Record<string, any> = {
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
      brake_fluid_interval: s.brake_fluid_interval || undefined,
      coolant_interval: s.coolant_interval || undefined,
      confidence_score: args.confidenceScore,
      created_at: Date.now(),
    };
    // Structured intervals + vehicle attributes (pass-through from Call 1A)
    const optionalNum = (v: any) => (v != null && v !== "" ? parseFloat(v) : undefined);
    const optionalStr = (v: any) => (v != null && v !== "" ? v : undefined);
    const intervalKeys = [
      "oil_change_interval_miles", "oil_change_interval_months", "oil_change_interval_status",
      "coolant_interval_miles", "coolant_interval_months", "coolant_interval_status",
      "brake_fluid_interval_miles", "brake_fluid_interval_months", "brake_fluid_interval_status",
      "tire_rotation_interval_miles", "tire_rotation_interval_months", "tire_rotation_interval_status",
      "engine_air_filter_interval_miles", "engine_air_filter_interval_months", "engine_air_filter_interval_status",
      "cabin_air_filter_interval_miles", "cabin_air_filter_interval_months", "cabin_air_filter_interval_status",
      "spark_plug_interval_miles", "spark_plug_interval_months", "spark_plug_interval_status",
      "serpentine_belt_interval_miles", "serpentine_belt_interval_months", "serpentine_belt_interval_status",
      "transmission_fluid_interval_miles", "transmission_fluid_interval_months", "transmission_fluid_interval_status",
      "transmission_fluid_severe_interval_miles", "transmission_fluid_severe_note",
    ];
    for (const k of intervalKeys) {
      if (s[k] != null && s[k] !== "") {
        base[k] = k.includes("_miles") || k.includes("_months") ? optionalNum(s[k]) : s[k];
      }
    }
    await ctx.db.insert("engine_specs", base);
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
      recommended_tire_pressure_front_psi: parseFloat(s.recommended_tire_pressure_front_psi) || 0,
      recommended_tire_pressure_rear_psi: parseFloat(s.recommended_tire_pressure_rear_psi) || 0,
      lug_nut_torque_ft_lbs: parseFloat(s.lug_nut_torque_ft_lbs) || 0,
      wiper_blade_driver_size_in: parseFloat(s.wiper_blade_driver_size_in) || 0,
      wiper_blade_passenger_size_in: parseFloat(s.wiper_blade_passenger_size_in) || 0,
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
    console.log(`Enrichment logged: engine=${args.engineId} score=${args.confidenceScore} source=${args.source}`);
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
 * Get vehicle_specs (OEM part numbers) for an engine. Used by pricing prompt.
 */
export const getVehicleSpecs = internalQuery({
  args: { engineId: v.id("engines") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("vehicle_specs")
      .withIndex("by_engine_id", (q) => q.eq("engine_id", args.engineId))
      .first();
    if (!row) return null;
    return {
      oil_filter_oem: row.oil_filter_oem,
      oil_drain_plug_gasket_oem: row.oil_drain_plug_gasket_oem,
      engine_air_filter_oem: row.engine_air_filter_oem,
      cabin_air_filter_oem: row.cabin_air_filter_oem,
      front_brake_pad_oem: row.front_brake_pad_oem,
      rear_brake_pad_oem: row.rear_brake_pad_oem,
      front_brake_rotor_oem: row.front_brake_rotor_oem,
      rear_brake_rotor_oem: row.rear_brake_rotor_oem,
      spark_plug_oem: row.spark_plug_oem,
      spark_plug_quantity: row.spark_plug_quantity,
      spark_plug_gap_mm: row.spark_plug_gap_mm,
      serpentine_belt_oem: row.serpentine_belt_oem,
      battery_group: row.battery_group,
      battery_cca: row.battery_cca,
    };
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
    oemIntervalMiles: v.optional(v.float64()),
    oemIntervalMonths: v.optional(v.float64()),
    oemIntervalNote: v.optional(v.string()),
    partsRequired: v.optional(v.string()),
    isApplicable: v.optional(v.boolean()),
    exclusionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const oemFields = {
      oem_interval_miles: args.oemIntervalMiles,
      oem_interval_months: args.oemIntervalMonths,
      oem_interval_note: args.oemIntervalNote,
      parts_required: args.partsRequired,
      is_applicable: args.isApplicable,
      exclusion_reason: args.exclusionReason,
      data_source: "ai_enrichment" as const,
      last_enriched_at: now,
    };

    const existing = await ctx.db
      .query("service_vehicle_specs")
      .withIndex("by_engine_and_service", (q) => q.eq("engine_id", args.engineId).eq("service_id", args.serviceId))
      .first();

    const payload = {
      labor_hours: args.laborHours,
      parts_cost_low: args.partsCostLow,
      parts_cost_high: args.partsCostHigh,
      confidence_score: args.confidenceScore,
      tech_notes: args.techNotes,
      ...oemFields,
    };

    if (existing) {
      if (args.confidenceScore >= existing.confidence_score) {
        await ctx.db.patch(existing._id, payload);
      }
      return existing._id;
    }

    return await ctx.db.insert("service_vehicle_specs", {
      ...payload,
      engine_id: args.engineId,
      service_id: args.serviceId,
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
