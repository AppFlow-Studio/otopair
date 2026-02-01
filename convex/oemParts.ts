/**
 * oemParts.ts - OEM Parts normalization APIs
 *
 * Provides upsert and lookup helpers for normalized OEM parts catalog.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * MUTATION: upsertOemPart
 * Idempotent insert/update by oem_part_number.
 */
export const upsertOemPart = mutation({
  args: {
    oem_part_number: v.string(),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("oem_parts")
      .withIndex("by_part_number", (q) => q.eq("oem_part_number", args.oem_part_number))
      .unique();

    if (existing) {
      const updates: Partial<typeof existing> = {};
      if (args.name !== undefined) updates.name = args.name;
      if (args.category !== undefined) updates.category = args.category;
      if (args.notes !== undefined) updates.notes = args.notes;
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }
      return await ctx.db.get(existing._id);
    }

    const now = Date.now();
    const partId = await ctx.db.insert("oem_parts", {
      oem_part_number: args.oem_part_number,
      name: args.name,
      category: args.category,
      notes: args.notes,
      created_at: now,
    });
    return await ctx.db.get(partId);
  },
});

/**
 * QUERY: getOemPartByNumber
 * Lookup part by OEM part number (unique).
 */
export const getOemPartByNumber = query({
  args: { oem_part_number: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("oem_parts")
      .withIndex("by_part_number", (q) => q.eq("oem_part_number", args.oem_part_number))
      .unique();
  },
});

/**
 * QUERY: searchOemParts
 * Simple substring match against part number and name with optional category filter.
 */
export const searchOemParts = query({
  args: {
    q: v.optional(v.string()),
    category: v.optional(v.string()),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 100);
    const searchTerm = args.q?.toLowerCase().trim();

    let baseQuery = ctx.db.query("oem_parts");
    if (args.category) {
      baseQuery = baseQuery.withIndex("by_category", (q) => q.eq("category", args.category));
    }

    const items = await baseQuery.collect();

    const filtered = items.filter((item) => {
      if (!searchTerm) return true;
      const numMatch = item.oem_part_number.toLowerCase().includes(searchTerm);
      const nameMatch = item.name ? item.name.toLowerCase().includes(searchTerm) : false;
      return numMatch || nameMatch;
    });

    return filtered.slice(0, limit);
  },
});
