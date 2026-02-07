import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * specs.ts - Subsystem specification & intelligence access layer
 *
 * Manages engine, transmission, and trim specs plus consolidated vehicle
 * intelligence packs that include fitments and confidence scoring.
 */

const assertConfidence = (value: number) => {
  if (Number.isNaN(value) || value < 0 || value > 1) {
    throw new Error("confidence_score must be between 0.0 and 1.0");
  }
};

const omitUndefined = (record: Record<string, any>) => {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
};

// -----------------------------------------------------------------------------
// Upserts
// -----------------------------------------------------------------------------

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
    confidence_score: v.float64(),
  },
  handler: async (ctx, args) => {
    assertConfidence(args.confidence_score);

    const existing = await ctx.db
      .query("engine_specs")
      .withIndex("by_engine", (q) => q.eq("engine_id", args.engine_id))
      .unique();

    const payload = omitUndefined({
      oil_viscosity: args.oil_viscosity,
      oil_capacity_qts: args.oil_capacity_qts,
      coolant_type: args.coolant_type,
      coolant_capacity_qts: args.coolant_capacity_qts,
      brake_fluid_type: args.brake_fluid_type,
      oil_change_interval: args.oil_change_interval,
      cabin_air_filter_interval: args.cabin_air_filter_interval,
      engine_air_filter_interval: args.engine_air_filter_interval,
      spark_plug_interval: args.spark_plug_interval,
      serpentine_belt_interval: args.serpentine_belt_interval,
      brake_fluid_interval: args.brake_fluid_interval,
      coolant_interval: args.coolant_interval,
      transmission_fluid_interval: args.transmission_fluid_interval,
      tire_rotation_interval: args.tire_rotation_interval,
      confidence_score: args.confidence_score,
    });

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return await ctx.db.get(existing._id);
    }

    const specId = await ctx.db.insert("engine_specs", {
      ...payload,
      engine_id: args.engine_id,
      created_at: Date.now(),
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
    confidence_score: v.float64(),
  },
  handler: async (ctx, args) => {
    assertConfidence(args.confidence_score);

    const existing = await ctx.db
      .query("transmission_specs")
      .withIndex("by_transmission", (q) => q.eq("transmission_id", args.transmission_id))
      .unique();

    const payload = omitUndefined({
      transmission_fluid_type: args.transmission_fluid_type,
      transmission_fluid_capacity_qts: args.transmission_fluid_capacity_qts,
      maintenance_interval: args.maintenance_interval,
      confidence_score: args.confidence_score,
    });

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return await ctx.db.get(existing._id);
    }

    const specId = await ctx.db.insert("transmission_specs", {
      ...payload,
      transmission_id: args.transmission_id,
      created_at: Date.now(),
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
    wiper_blade_driver_size_in: v.optional(v.float64()),
    wiper_blade_passenger_size_in: v.optional(v.float64()),
    wiper_blade_rear_size_in: v.optional(v.float64()),
    parking_brake_type: v.optional(v.string()),
    confidence_score: v.float64(),
  },
  handler: async (ctx, args) => {
    assertConfidence(args.confidence_score);

    const existing = await ctx.db
      .query("trim_specs")
      .withIndex("by_trim", (q) => q.eq("trim_id", args.trim_id))
      .unique();

    const payload = omitUndefined({
      tire_size_front: args.tire_size_front,
      tire_size_rear: args.tire_size_rear,
      recommended_tire_pressure_front_psi: args.recommended_tire_pressure_front_psi,
      recommended_tire_pressure_rear_psi: args.recommended_tire_pressure_rear_psi,
      lug_nut_torque_ft_lbs: args.lug_nut_torque_ft_lbs,
      wiper_blade_driver_size_in: args.wiper_blade_driver_size_in,
      wiper_blade_passenger_size_in: args.wiper_blade_passenger_size_in,
      wiper_blade_rear_size_in: args.wiper_blade_rear_size_in,
      parking_brake_type: args.parking_brake_type,
      confidence_score: args.confidence_score,
    });

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return await ctx.db.get(existing._id);
    }

    const specId = await ctx.db.insert("trim_specs", {
      ...payload,
      trim_id: args.trim_id,
      created_at: Date.now(),
    });
    return await ctx.db.get(specId);
  },
});

// -----------------------------------------------------------------------------
// Reads
// -----------------------------------------------------------------------------

export const getEngineSpecs = query({
  args: { engine_id: v.id("engines") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("engine_specs")
      .withIndex("by_engine", (q) => q.eq("engine_id", args.engine_id))
      .unique();
  },
});

export const getTransmissionSpecs = query({
  args: { transmission_id: v.id("transmissions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transmission_specs")
      .withIndex("by_transmission", (q) => q.eq("transmission_id", args.transmission_id))
      .unique();
  },
});

export const getTrimSpecs = query({
  args: { trim_id: v.id("trims") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trim_specs")
      .withIndex("by_trim", (q) => q.eq("trim_id", args.trim_id))
      .unique();
  },
});

// -----------------------------------------------------------------------------
// Aggregated vehicle spec pack
// -----------------------------------------------------------------------------

type ConfidenceEntry = {
  table: string;
  id: string;
  confidence_score: number;
};

const collectConfidence = (
  entries: ConfidenceEntry[],
  table: string,
  id: any,
  confidence: number | null | undefined,
) => {
  if (confidence === null || confidence === undefined) return;
  entries.push({ table, id: id as string, confidence_score: confidence });
};

const buildPartsMap = (fitmentGroups: any[][]) => {
  const partsById: Record<string, any> = {};
  for (const group of fitmentGroups) {
    for (const item of group) {
      if (item.part) {
        partsById[item.part._id] = item.part;
      }
    }
  }
  return partsById;
};

const fetchFitmentsWithParts = async (
  ctx: any,
  table: "engine_part_fitments" | "transmission_part_fitments" | "trim_part_fitments",
  indexName: string,
  field: string,
  value: any,
) => {
  const fitments = await ctx.db
    .query(table)
    .withIndex(indexName, (q: any) => q.eq(field, value))
    .collect();

  const expanded = await Promise.all(
    fitments.map(async (f: any) => {
      const part = await ctx.db.get(f.part_id);
      return { ...f, part };
    }),
  );

  return expanded;
};

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

    const [trim, engine, transmission, chassis_variant] = await Promise.all([
      vehicle.trim_id ? ctx.db.get(vehicle.trim_id) : null,
      vehicle.engine_id ? ctx.db.get(vehicle.engine_id) : null,
      vehicle.transmission_id ? ctx.db.get(vehicle.transmission_id) : null,
      vehicle.chassis_id ? ctx.db.get(vehicle.chassis_id) : null,
    ]);

    const [engineSpecs, transmissionSpecs, trimSpecs] = await Promise.all([
      vehicle.engine_id
        ? ctx.db
            .query("engine_specs")
            .withIndex("by_engine", (q) => q.eq("engine_id", vehicle.engine_id))
            .unique()
        : null,
      vehicle.transmission_id
        ? ctx.db
            .query("transmission_specs")
            .withIndex("by_transmission", (q) => q.eq("transmission_id", vehicle.transmission_id))
            .unique()
        : null,
      vehicle.trim_id
        ? ctx.db
            .query("trim_specs")
            .withIndex("by_trim", (q) => q.eq("trim_id", vehicle.trim_id))
            .unique()
        : null,
    ]);

    const [engineFitments, transmissionFitments, trimFitments] = await Promise.all([
      vehicle.engine_id
        ? fetchFitmentsWithParts(ctx, "engine_part_fitments", "by_engine", "engine_id", vehicle.engine_id)
        : [],
      vehicle.transmission_id
        ? fetchFitmentsWithParts(
            ctx,
            "transmission_part_fitments",
            "by_transmission",
            "transmission_id",
            vehicle.transmission_id,
          )
        : [],
      vehicle.trim_id ? fetchFitmentsWithParts(ctx, "trim_part_fitments", "by_trim", "trim_id", vehicle.trim_id) : [],
    ]);

    const confidenceEntries: ConfidenceEntry[] = [];
    collectConfidence(confidenceEntries, "engine_specs", engineSpecs?._id, engineSpecs?.confidence_score);
    collectConfidence(
      confidenceEntries,
      "transmission_specs",
      transmissionSpecs?._id,
      transmissionSpecs?.confidence_score,
    );
    collectConfidence(confidenceEntries, "trim_specs", trimSpecs?._id, trimSpecs?.confidence_score);

    engineFitments.forEach((f: any) =>
      collectConfidence(confidenceEntries, "engine_part_fitments", f._id, f.confidence_score),
    );
    transmissionFitments.forEach((f: any) =>
      collectConfidence(confidenceEntries, "transmission_part_fitments", f._id, f.confidence_score),
    );
    trimFitments.forEach((f: any) =>
      collectConfidence(confidenceEntries, "trim_part_fitments", f._id, f.confidence_score),
    );

    collectConfidence(confidenceEntries, "transmissions", transmission?._id, transmission?.confidence_score);
    collectConfidence(confidenceEntries, "chassis_variants", chassis_variant?._id, chassis_variant?.confidence_score);

    const overall =
      confidenceEntries.length > 0 ? Math.min(...confidenceEntries.map((entry) => entry.confidence_score)) : null;

    const lowest =
      confidenceEntries.length > 0
        ? confidenceEntries.reduce((min, entry) => (entry.confidence_score < min.confidence_score ? entry : min))
        : null;

    const partsById = buildPartsMap([engineFitments, transmissionFitments, trimFitments]);

    return {
      vehicle,
      trim,
      engine,
      transmission,
      chassis_variant,
      specs: {
        engine: engineSpecs,
        transmission: transmissionSpecs,
        trim: trimSpecs,
      },
      fitments: {
        engine: engineFitments,
        transmission: transmissionFitments,
        trim: trimFitments,
      },
      partsById,
      confidence: {
        overall,
        lowest,
      },
    };
  },
});
