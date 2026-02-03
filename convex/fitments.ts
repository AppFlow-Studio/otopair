import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * fitments.ts - Engine/Transmission/Trim fitment access layer
 *
 * Manages role-based fitments between vehicle variants and OEM parts.
 * Enforces required confidence_score (0.0–1.0) on all writes.
 */

const ROLE_ALLOWLIST = [
  "oil_filter",
  "spark_plug",
  "serpentine_belt",
  "engine_air_filter",
  "cabin_air_filter",
  "oil_drain_plug_gasket",
  "battery",
  "front_brake_pad",
  "rear_brake_pad",
  "front_brake_rotor",
  "rear_brake_rotor",
  "wiper_blade_driver",
  "wiper_blade_passenger",
  "wiper_blade_rear",
  "transmission_filter",
  "transmission_pan_gasket",
] as const;

type FitmentRole = (typeof ROLE_ALLOWLIST)[number];

const assertValidRole = (role: string): asserts role is FitmentRole => {
  if (!ROLE_ALLOWLIST.includes(role as FitmentRole)) {
    throw new Error(`Invalid fitment role: ${role}`);
  }
};

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

const attachPart = async (ctx: { db: any }, fitment: any) => {
  const part = await ctx.db.get(fitment.part_id);
  return { ...fitment, part };
};

// -----------------------------------------------------------------------------
// Engine fitments
// -----------------------------------------------------------------------------

export const upsertEnginePartFitment = mutation({
  args: {
    engine_id: v.id("engines"),
    part_id: v.id("oem_parts"),
    role: v.string(),
    quantity: v.optional(v.float64()),
    spark_plug_gap_mm: v.optional(v.float64()),
    notes: v.optional(v.string()),
    confidence_score: v.float64(),
  },
  handler: async (ctx, args) => {
    assertValidRole(args.role);
    assertConfidence(args.confidence_score);

    const part = await ctx.db.get(args.part_id);
    if (!part) throw new Error("Referenced OEM part not found");

    const existing = await ctx.db
      .query("engine_part_fitments")
      .withIndex("by_engine_role", (q) => q.eq("engine_id", args.engine_id).eq("role", args.role))
      .unique();

    const payload = omitUndefined({
      part_id: args.part_id,
      role: args.role,
      quantity: args.quantity,
      spark_plug_gap_mm: args.spark_plug_gap_mm,
      notes: args.notes,
      confidence_score: args.confidence_score,
    });

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return await ctx.db.get(existing._id);
    }

    const fitmentId = await ctx.db.insert("engine_part_fitments", {
      ...payload,
      engine_id: args.engine_id,
      created_at: Date.now(),
    });
    return await ctx.db.get(fitmentId);
  },
});

export const listEngineFitments = query({
  args: { engine_id: v.id("engines") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("engine_part_fitments")
      .withIndex("by_engine", (q) => q.eq("engine_id", args.engine_id))
      .collect();
  },
});

export const listEngineFitmentsExpanded = query({
  args: { engine_id: v.id("engines") },
  handler: async (ctx, args) => {
    const fitments = await ctx.db
      .query("engine_part_fitments")
      .withIndex("by_engine", (q) => q.eq("engine_id", args.engine_id))
      .collect();
    return await Promise.all(fitments.map((f) => attachPart(ctx, f)));
  },
});

// -----------------------------------------------------------------------------
// Transmission fitments
// -----------------------------------------------------------------------------

export const upsertTransmissionPartFitment = mutation({
  args: {
    transmission_id: v.id("transmissions"),
    part_id: v.id("oem_parts"),
    role: v.string(),
    quantity: v.optional(v.float64()),
    notes: v.optional(v.string()),
    confidence_score: v.float64(),
  },
  handler: async (ctx, args) => {
    assertValidRole(args.role);
    assertConfidence(args.confidence_score);

    const part = await ctx.db.get(args.part_id);
    if (!part) throw new Error("Referenced OEM part not found");

    const existing = await ctx.db
      .query("transmission_part_fitments")
      .withIndex("by_transmission_role", (q) =>
        q.eq("transmission_id", args.transmission_id).eq("role", args.role)
      )
      .unique();

    const payload = omitUndefined({
      part_id: args.part_id,
      role: args.role,
      quantity: args.quantity,
      notes: args.notes,
      confidence_score: args.confidence_score,
    });

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return await ctx.db.get(existing._id);
    }

    const fitmentId = await ctx.db.insert("transmission_part_fitments", {
      ...payload,
      transmission_id: args.transmission_id,
      created_at: Date.now(),
    });
    return await ctx.db.get(fitmentId);
  },
});

export const listTransmissionFitments = query({
  args: { transmission_id: v.id("transmissions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transmission_part_fitments")
      .withIndex("by_transmission", (q) => q.eq("transmission_id", args.transmission_id))
      .collect();
  },
});

export const listTransmissionFitmentsExpanded = query({
  args: { transmission_id: v.id("transmissions") },
  handler: async (ctx, args) => {
    const fitments = await ctx.db
      .query("transmission_part_fitments")
      .withIndex("by_transmission", (q) => q.eq("transmission_id", args.transmission_id))
      .collect();
    return await Promise.all(fitments.map((f) => attachPart(ctx, f)));
  },
});

// -----------------------------------------------------------------------------
// Trim fitments
// -----------------------------------------------------------------------------

export const upsertTrimPartFitment = mutation({
  args: {
    trim_id: v.id("trims"),
    part_id: v.id("oem_parts"),
    role: v.string(),
    quantity: v.optional(v.float64()),
    wiper_size_in: v.optional(v.float64()),
    notes: v.optional(v.string()),
    confidence_score: v.float64(),
  },
  handler: async (ctx, args) => {
    assertValidRole(args.role);
    assertConfidence(args.confidence_score);

    const part = await ctx.db.get(args.part_id);
    if (!part) throw new Error("Referenced OEM part not found");

    const existing = await ctx.db
      .query("trim_part_fitments")
      .withIndex("by_trim_role", (q) => q.eq("trim_id", args.trim_id).eq("role", args.role))
      .unique();

    const payload = omitUndefined({
      part_id: args.part_id,
      role: args.role,
      quantity: args.quantity,
      wiper_size_in: args.wiper_size_in,
      notes: args.notes,
      confidence_score: args.confidence_score,
    });

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return await ctx.db.get(existing._id);
    }

    const fitmentId = await ctx.db.insert("trim_part_fitments", {
      ...payload,
      trim_id: args.trim_id,
      created_at: Date.now(),
    });
    return await ctx.db.get(fitmentId);
  },
});

export const listTrimFitments = query({
  args: { trim_id: v.id("trims") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("trim_part_fitments")
      .withIndex("by_trim", (q) => q.eq("trim_id", args.trim_id))
      .collect();
  },
});

export const listTrimFitmentsExpanded = query({
  args: { trim_id: v.id("trims") },
  handler: async (ctx, args) => {
    const fitments = await ctx.db
      .query("trim_part_fitments")
      .withIndex("by_trim", (q) => q.eq("trim_id", args.trim_id))
      .collect();
    return await Promise.all(fitments.map((f) => attachPart(ctx, f)));
  },
});
