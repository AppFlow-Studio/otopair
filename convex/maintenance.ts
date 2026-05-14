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
import { internal } from "./_generated/api";
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
 * QUERY: getRecordsByMultipleVehicles
 * Returns all maintenance records for a list of vehicleOwnerIds, grouped by id.
 */
export const getRecordsByMultipleVehicles = query({
  args: {
    vehicleOwnerIds: v.array(v.id("vehicle_owners")),
  },
  handler: async (ctx, args) => {
    const results: Record<string, any[]> = {};
    await Promise.all(
      args.vehicleOwnerIds.map(async (id) => {
        const records = await ctx.db
          .query("maintenance_records")
          .withIndex("by_vehicle_owner", (q) => q.eq("vehicleOwnerId", id))
          .collect();
        results[id] = records;
      })
    );
    return results;
  },
});

/**
 * MUTATION: upsertRecord
 * Insert or update a maintenance record for a given vehicleOwnerId + type.
 * If a record already exists for that vehicle+type, update it; otherwise insert.
 *
 * Trust-signal fields (confidence, serviceSource, confirmedHealthyAt) are
 * optional and only patched/inserted when explicitly provided. Callers that
 * don't pass them won't clobber existing values on the patch path. This was
 * extended in 2026-05 to support the AI's render-confirm flow (the chat
 * suggests a record correction; on user confirm the render component calls
 * this mutation with serviceSource: "ai_chat_correction" and an appropriate
 * confidence label, OR with confirmedHealthyAt: Date.now() for the
 * "yes-the-record-is-correct" path).
 *
 * Owners of writers and what they set:
 *   - onboarding flow         → confidence: "self_reported", serviceSource: "onboarding"
 *   - quarterly check-in      → confidence: "self_reported", serviceSource: "checkin",
 *                                confirmedHealthyAt: Date.now() on Q4b "fine" answer
 *   - completed booking path  → confidence: "verified", serviceSource: "booking"
 *   - service-record upload   → confidence: "verified", serviceSource: "uploaded_record"
 *   - mechanic onboarding     → confidence: "verified", serviceSource: "mechanic_onboarded"
 *   - AI chat correction      → confidence: "self_reported", serviceSource: "ai_chat_correction"
 */
export const upsertRecord = mutation({
  args: {
    vehicleOwnerId: v.id("vehicle_owners"),
    type: v.string(),
    lastServiceDate: v.optional(v.float64()),
    lastServiceMileage: v.optional(v.float64()),
    customInputs: v.optional(v.any()),
    // Trust-signal fields. Schema labels are categorical; see the doc above
    // each writer for the allowed values it sets.
    confidence: v.optional(v.string()),
    serviceSource: v.optional(v.string()),
    confirmedHealthyAt: v.optional(v.number()),
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

    // Build the patch/insert payload. Only include trust-signal fields when
    // the caller explicitly provided them — `undefined` from Convex's patch
    // semantics means "no change", so omitting these keeps prior values.
    const trustFields: {
      confidence?: string;
      serviceSource?: string;
      confirmedHealthyAt?: number;
    } = {};
    if (args.confidence !== undefined) trustFields.confidence = args.confidence;
    if (args.serviceSource !== undefined) trustFields.serviceSource = args.serviceSource;
    if (args.confirmedHealthyAt !== undefined) trustFields.confirmedHealthyAt = args.confirmedHealthyAt;

    let recordId;
    if (existing) {
      await ctx.db.patch(existing._id, {
        lastServiceDate: args.lastServiceDate,
        lastServiceMileage: args.lastServiceMileage,
        customInputs: args.customInputs,
        ...trustFields,
        updatedAt: now,
      });
      recordId = existing._id;
    } else {
      recordId = await ctx.db.insert("maintenance_records", {
        vehicleOwnerId: args.vehicleOwnerId,
        type: args.type,
        lastServiceDate: args.lastServiceDate,
        lastServiceMileage: args.lastServiceMileage,
        customInputs: args.customInputs,
        ...trustFields,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Re-run pipeline so health score reflects the updated service data
    const owner = await ctx.db.get(args.vehicleOwnerId);
    if (owner?.preOnboardingComplete) {
      await ctx.scheduler.runAfter(
        0,
        internal.maintenance_pipeline.runPipeline,
        { vehicleOwnerId: args.vehicleOwnerId, triggeredBy: "quick_read" }
      );
    }

    return recordId;
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
