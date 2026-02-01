import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * oemParts.ts - Normalized OEM part catalog access layer
 *
 * Provides CRUD-style helpers for the oem_parts table with idempotent
 * upserts keyed by the unique oem_part_number index.
 */

const normalizePartNumber = (partNumber: string) => partNumber.trim().toUpperCase();

export const upsert = mutation({
  args: {
    oem_part_number: v.string(),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedPartNumber = normalizePartNumber(args.oem_part_number);

    const existing = await ctx.db
      .query("oem_parts")
      .withIndex("by_part_number", (q) => q.eq("oem_part_number", normalizedPartNumber))
      .unique();

    const updates: Record<string, any> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.category !== undefined) updates.category = args.category;
    if (args.notes !== undefined) updates.notes = args.notes;

    if (existing) {
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }
      return await ctx.db.get(existing._id);
    }

    const partId = await ctx.db.insert("oem_parts", {
      oem_part_number: normalizedPartNumber,
      name: args.name,
      category: args.category,
      notes: args.notes,
      created_at: Date.now(),
    });

    return await ctx.db.get(partId);
  },
});

export const getById = query({
  args: { id: v.id("oem_parts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByOemPartNumber = query({
  args: { oem_part_number: v.string() },
  handler: async (ctx, args) => {
    const normalizedPartNumber = normalizePartNumber(args.oem_part_number);
    return await ctx.db
      .query("oem_parts")
      .withIndex("by_part_number", (q) => q.eq("oem_part_number", normalizedPartNumber))
      .unique();
  },
});

export const listByIds = query({
  args: { ids: v.array(v.id("oem_parts")) },
  handler: async (ctx, args) => {
    const rows = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
    return rows.filter(Boolean);
  },
});
