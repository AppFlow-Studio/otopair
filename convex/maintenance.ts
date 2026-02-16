/**
 * maintenance.ts - User-provided Maintenance Records
 *
 * DESCRIPTION:
 * CRUD operations for maintenance records that users manually provide
 * for items Smartcar doesn't cover (brakes, inspection, battery, etc.).
 *
 * TABLE: maintenance_records
 *   - One record per vehicle + type (upsert pattern)
 *   - Stores last service date, mileage, and type-specific custom inputs
 *
 * OWNER: Ahmad Hamoudeh
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * QUERY: getRecordsByVehicle
 * Returns all maintenance records for a given vehicleOwnerId.
 */
export const getRecordsByVehicle = query({
  args: {
    vehicleOwnerId: v.id("vehicle_owners"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("maintenance_records")
      .withIndex("by_vehicle_owner", (q) => q.eq("vehicleOwnerId", args.vehicleOwnerId))
      .collect();
  },
});

/**
 * MUTATION: upsertRecord
 * Insert or update a maintenance record for a given vehicleOwnerId + type.
 * If a record already exists for that vehicle+type, update it; otherwise insert.
 */
export const upsertRecord = mutation({
  args: {
    vehicleOwnerId: v.id("vehicle_owners"),
    type: v.string(),
    lastServiceDate: v.optional(v.float64()),
    lastServiceMileage: v.optional(v.float64()),
    customInputs: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Check for existing record with this vehicle + type
    const existing = await ctx.db
      .query("maintenance_records")
      .withIndex("by_vehicle_and_type", (q) =>
        q.eq("vehicleOwnerId", args.vehicleOwnerId).eq("type", args.type)
      )
      .unique();

    if (existing) {
      // Update existing record
      await ctx.db.patch(existing._id, {
        lastServiceDate: args.lastServiceDate,
        lastServiceMileage: args.lastServiceMileage,
        customInputs: args.customInputs,
        updatedAt: now,
      });
      return existing._id;
    }

    // Insert new record
    return await ctx.db.insert("maintenance_records", {
      vehicleOwnerId: args.vehicleOwnerId,
      type: args.type,
      lastServiceDate: args.lastServiceDate,
      lastServiceMileage: args.lastServiceMileage,
      customInputs: args.customInputs,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * MUTATION: deleteRecord
 * Remove a maintenance record by ID.
 */
export const deleteRecord = mutation({
  args: {
    id: v.id("maintenance_records"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
