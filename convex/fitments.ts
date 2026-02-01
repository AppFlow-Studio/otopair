/**
 * fitments.ts - Fitment management for engines, transmissions, and trims.
 *
 * Handles role-based part fitments and normalizes OEM parts.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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

const upsertPartByNumber = async (
  ctx: { db: any },
  oem_part_number: string
) => {
  const existing = await ctx.db
    .query("oem_parts")
    .withIndex("by_part_number", (q: any) => q.eq("oem_part_number", oem_part_number))
    .unique();

  if (existing) return existing;

  const now = Date.now();
  const partId = await ctx.db.insert("oem_parts", {
    oem_part_number,
    created_at: now,
  });
  return await ctx.db.get(partId);
};

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

// ENGINE FITMENTS
export const setEngineFitment = mutation({
  args: {
    engine_id: v.id("engines"),
    role: v.string(),
    oem_part_number: v.string(),
    quantity: v.optional(v.float64()),
    spark_plug_gap_mm: v.optional(v.float64()),
    notes: v.optional(v.string()),
    confidence_score: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    assertValidRole(args.role);
    const part = await upsertPartByNumber(ctx, args.oem_part_number);
    const providedConfidence = normalizeConfidence(args.confidence_score);

    const existing = await ctx.db
      .query("engine_part_fitments")
      .withIndex("by_engine_role", (q) =>
        q.eq("engine_id", args.engine_id).eq("role", args.role)
      )
      .unique();

    const updates: any = { part_id: part._id };
    if (args.quantity !== undefined) updates.quantity = args.quantity;
    if (args.spark_plug_gap_mm !== undefined)
      updates.spark_plug_gap_mm = args.spark_plug_gap_mm;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (providedConfidence !== undefined) {
      const current = existing?.confidence_score ?? 0;
      updates.confidence_score = Math.min(1, Math.max(current, providedConfidence));
    }

    if (existing) {
      await ctx.db.patch(existing._id, updates);
      const saved = await ctx.db.get(existing._id);
      return await attachPart(ctx, saved);
    }

    const now = Date.now();
    const insertDoc: any = {
      engine_id: args.engine_id,
      part_id: part._id,
      role: args.role,
      created_at: now,
    };
    if (args.quantity !== undefined) insertDoc.quantity = args.quantity;
    if (args.spark_plug_gap_mm !== undefined)
      insertDoc.spark_plug_gap_mm = args.spark_plug_gap_mm;
    if (args.notes !== undefined) insertDoc.notes = args.notes;
    insertDoc.confidence_score = providedConfidence ?? 0.5;

    const fitmentId = await ctx.db.insert("engine_part_fitments", insertDoc);
    const saved = await ctx.db.get(fitmentId);
    return await attachPart(ctx, saved);
  },
});

// TRANSMISSION FITMENTS
export const setTransmissionFitment = mutation({
  args: {
    transmission_id: v.id("transmissions"),
    role: v.string(),
    oem_part_number: v.string(),
    quantity: v.optional(v.float64()),
    notes: v.optional(v.string()),
    confidence_score: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    assertValidRole(args.role);
    const part = await upsertPartByNumber(ctx, args.oem_part_number);
    const providedConfidence = normalizeConfidence(args.confidence_score);

    const existing = await ctx.db
      .query("transmission_part_fitments")
      .withIndex("by_transmission_role", (q) =>
        q.eq("transmission_id", args.transmission_id).eq("role", args.role)
      )
      .unique();

    const updates: any = { part_id: part._id };
    if (args.quantity !== undefined) updates.quantity = args.quantity;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (providedConfidence !== undefined) {
      const current = existing?.confidence_score ?? 0;
      updates.confidence_score = Math.min(1, Math.max(current, providedConfidence));
    }

    if (existing) {
      await ctx.db.patch(existing._id, updates);
      const saved = await ctx.db.get(existing._id);
      return await attachPart(ctx, saved);
    }

    const now = Date.now();
    const insertDoc: any = {
      transmission_id: args.transmission_id,
      part_id: part._id,
      role: args.role,
      created_at: now,
    };
    if (args.quantity !== undefined) insertDoc.quantity = args.quantity;
    if (args.notes !== undefined) insertDoc.notes = args.notes;
    insertDoc.confidence_score = providedConfidence ?? 0.5;

    const fitmentId = await ctx.db.insert("transmission_part_fitments", insertDoc);
    const saved = await ctx.db.get(fitmentId);
    return await attachPart(ctx, saved);
  },
});

// TRIM FITMENTS
export const setTrimFitment = mutation({
  args: {
    trim_id: v.id("trims"),
    role: v.string(),
    oem_part_number: v.string(),
    quantity: v.optional(v.float64()),
    wiper_size_in: v.optional(v.float64()),
    notes: v.optional(v.string()),
    confidence_score: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    assertValidRole(args.role);
    const part = await upsertPartByNumber(ctx, args.oem_part_number);
    const providedConfidence = normalizeConfidence(args.confidence_score);

    const existing = await ctx.db
      .query("trim_part_fitments")
      .withIndex("by_trim_role", (q) =>
        q.eq("trim_id", args.trim_id).eq("role", args.role)
      )
      .unique();

    const updates: any = { part_id: part._id };
    if (args.quantity !== undefined) updates.quantity = args.quantity;
    if (args.wiper_size_in !== undefined) updates.wiper_size_in = args.wiper_size_in;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (providedConfidence !== undefined) {
      const current = existing?.confidence_score ?? 0;
      updates.confidence_score = Math.min(1, Math.max(current, providedConfidence));
    }

    if (existing) {
      await ctx.db.patch(existing._id, updates);
      const saved = await ctx.db.get(existing._id);
      return await attachPart(ctx, saved);
    }

    const now = Date.now();
    const insertDoc: any = {
      trim_id: args.trim_id,
      part_id: part._id,
      role: args.role,
      created_at: now,
    };
    if (args.quantity !== undefined) insertDoc.quantity = args.quantity;
    if (args.wiper_size_in !== undefined) insertDoc.wiper_size_in = args.wiper_size_in;
    if (args.notes !== undefined) insertDoc.notes = args.notes;
    insertDoc.confidence_score = providedConfidence ?? 0.5;

    const fitmentId = await ctx.db.insert("trim_part_fitments", insertDoc);
    const saved = await ctx.db.get(fitmentId);
    return await attachPart(ctx, saved);
  },
});

// QUERY HELPERS
export const getEngineFitments = query({
  args: { engine_id: v.id("engines") },
  handler: async (ctx, args) => {
    const fitments = await ctx.db
      .query("engine_part_fitments")
      .withIndex("by_engine", (q) => q.eq("engine_id", args.engine_id))
      .collect();

    return await Promise.all(fitments.map((f) => attachPart(ctx, f)));
  },
});

export const getTransmissionFitments = query({
  args: { transmission_id: v.id("transmissions") },
  handler: async (ctx, args) => {
    const fitments = await ctx.db
      .query("transmission_part_fitments")
      .withIndex("by_transmission", (q) => q.eq("transmission_id", args.transmission_id))
      .collect();

    return await Promise.all(fitments.map((f) => attachPart(ctx, f)));
  },
});

export const getTrimFitments = query({
  args: { trim_id: v.id("trims") },
  handler: async (ctx, args) => {
    const fitments = await ctx.db
      .query("trim_part_fitments")
      .withIndex("by_trim", (q) => q.eq("trim_id", args.trim_id))
      .collect();

    return await Promise.all(fitments.map((f) => attachPart(ctx, f)));
  },
});
