/**
 * vehicleEnrichment/scraperQueries.ts — Convex queries/mutations for raw_scrape_cache
 */

import { v } from "convex/values";
import { internalQuery, internalMutation, mutation } from "../_generated/server";

/** Return a non-expired cached scrape for this vehicle + source type, or null. */
export const getCachedScrape = internalQuery({
  args: {
    vehicleMake: v.string(),
    vehicleModel: v.string(),
    vehicleYear: v.float64(),
    sourceType: v.union(
      v.literal("parts_catalog"),
      v.literal("owner_manual"),
      v.literal("pricing"),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const rows = await ctx.db
      .query("raw_scrape_cache")
      .withIndex("by_vehicle", (q) =>
        q
          .eq("vehicleMake", args.vehicleMake)
          .eq("vehicleModel", args.vehicleModel)
          .eq("vehicleYear", args.vehicleYear),
      )
      .filter((q) => q.eq(q.field("sourceType"), args.sourceType))
      .order("desc")
      .take(1);

    const row = rows[0];
    if (!row) return null;
    if (row.expiresAt < now) return null; // expired
    return row;
  },
});

/** [TEST] Delete all scrape cache entries for a vehicle. */
export const debugClearVehicleCache = mutation({
  args: {
    vehicleMake: v.string(),
    vehicleModel: v.string(),
    vehicleYear: v.float64(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("raw_scrape_cache")
      .withIndex("by_vehicle", (q) =>
        q
          .eq("vehicleMake", args.vehicleMake)
          .eq("vehicleModel", args.vehicleModel)
          .eq("vehicleYear", args.vehicleYear),
      )
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return { deleted: rows.length };
  },
});

/** Upsert a scraped page into cache. */
export const storeScrapeCache = internalMutation({
  args: {
    url: v.string(),
    scrapedAt: v.float64(),
    markdown: v.string(),
    vehicleMake: v.string(),
    vehicleModel: v.string(),
    vehicleYear: v.float64(),
    sourceType: v.union(
      v.literal("parts_catalog"),
      v.literal("owner_manual"),
      v.literal("pricing"),
    ),
    expiresAt: v.float64(),
  },
  handler: async (ctx, args) => {
    // Check for existing row to overwrite
    const existing = await ctx.db
      .query("raw_scrape_cache")
      .withIndex("by_vehicle", (q) =>
        q
          .eq("vehicleMake", args.vehicleMake)
          .eq("vehicleModel", args.vehicleModel)
          .eq("vehicleYear", args.vehicleYear),
      )
      .filter((q) => q.eq(q.field("sourceType"), args.sourceType))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        url: args.url,
        scrapedAt: args.scrapedAt,
        markdown: args.markdown,
        expiresAt: args.expiresAt,
      });
    } else {
      await ctx.db.insert("raw_scrape_cache", args);
    }
  },
});
