import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * vehicles.ts - Canonical vehicle catalog management
 * 
 * Manages the canonical vehicle catalog (one row per VIN).
 * Ownership relationships are in vehicle_owners table.
 */

// QUERIES

/**
 * List all vehicles in the system
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("vehicles").collect();
  },
});

/**
 * Get a vehicle by ID
 */
export const getById = query({
  args: { id: v.id("vehicles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Get vehicle by canonical VIN (unique lookup)
 */
export const getByVin = query({
  args: { vin: v.string() },
  handler: async (ctx, args) => {
    const normalizedVin = args.vin.toUpperCase().trim();
    return await ctx.db
      .query("vehicles")
      .withIndex("by_vin", (q) => q.eq("vin", normalizedVin))
      .unique();
  },
});

/**
 * Get vehicle with all its active owners
 */
export const getVehicleWithOwners = query({
  args: { vin: v.string() },
  handler: async (ctx, args) => {
    const normalizedVin = args.vin.toUpperCase().trim();
    
    // Get the vehicle
    const vehicle = await ctx.db
      .query("vehicles")
      .withIndex("by_vin", (q) => q.eq("vin", normalizedVin))
      .unique();
    
    if (!vehicle) {
      throw new Error(`Vehicle not found: ${args.vin}`);
    }
    
    // Get active owners
    const owners = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_vin", (q) => q.eq("vin", normalizedVin))
      .collect();
    
    const activeOwners = owners.filter((o) => o.status === "active");
    
    return {
      vehicle,
      owners: activeOwners,
    };
  },
});

/**
 * Get a specific ownership relationship
 */
export const getVehicleOwner = query({
  args: {
    vin: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const normalizedVin = args.vin.toUpperCase().trim();
    
    return await ctx.db
      .query("vehicle_owners")
      .withIndex("by_vin_user", (q) =>
        q.eq("vin", normalizedVin).eq("user_id", args.userId)
      )
      .unique();
  },
});

/**
 * List all active vehicles for the currently authenticated user.
 * Returns null if not authenticated, empty array if no vehicles.
 */
export const getMyVehicles = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", identity.subject))
      .unique();
    if (!user) return [];

    const ownerships = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_user_status", (q) =>
        q.eq("user_id", user._id).eq("status", "active")
      )
      .collect();

    const results = await Promise.all(
      ownerships.map(async (ownership) => {
        const vehicle = await ctx.db
          .query("vehicles")
          .withIndex("by_vin", (q) => q.eq("vin", ownership.vin))
          .unique();

        return {
          vin: ownership.vin,
          vehicle,
          ownership,
        };
      })
    );

    return results;
  },
});

/**
 * List all active vehicles owned by a user
 */
export const listVehiclesByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get active ownerships for this user
    const ownerships = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_user_status", (q) =>
        q.eq("user_id", args.userId).eq("status", "active")
      )
      .collect();
    
    // Fetch vehicle for each ownership
    const results = await Promise.all(
      ownerships.map(async (ownership) => {
        const vehicle = await ctx.db
          .query("vehicles")
          .withIndex("by_vin", (q) => q.eq("vin", ownership.vin))
          .unique();
        
        return {
          vin: ownership.vin,
          vehicle,
          ownership,
          connectionStatus: ownership.connectionStatus || "unconnected",
          smartcarVehicleId: ownership.smartcarVehicleId || null,
        };
      })
    );
    
    return results;
  },
});

/**
 * Get just the VINs a user owns (for quick lookups)
 */
export const listOwnedVINsByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const ownerships = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_user_status", (q) =>
        q.eq("user_id", args.userId).eq("status", "active")
      )
      .collect();
    
    return ownerships.map((o) => o.vin);
  },
});

// MUTATIONS

/**
 * Create or update a vehicle (idempotent by VIN)
 * 
 * If vehicle with this VIN already exists, updates fields.
 * If not, creates new vehicle.
 */
export const upsertVehicle = mutation({
  args: {
    vin: v.string(),
    trim_id: v.optional(v.id("trims")),
    engine_id: v.optional(v.id("engines")),
    transmission_id: v.optional(v.id("transmissions")),
    chassis_id: v.optional(v.id("chassis_variants")),
    year: v.optional(v.float64()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Normalize VIN
    const normalizedVin = args.vin.toUpperCase().trim();
    
    // Check if vehicle exists
    const existing = await ctx.db
      .query("vehicles")
      .withIndex("by_vin", (q) => q.eq("vin", normalizedVin))
      .unique();
    
    if (existing) {
      // Update existing vehicle with new fields (preserve if undefined)
      const updates: any = { updated_at: Date.now() };
      if (args.trim_id !== undefined) updates.trim_id = args.trim_id;
      if (args.engine_id !== undefined) updates.engine_id = args.engine_id;
      if (args.transmission_id !== undefined)
        updates.transmission_id = args.transmission_id;
      if (args.chassis_id !== undefined) updates.chassis_id = args.chassis_id;
      if (args.year !== undefined) updates.year = args.year;
      if (args.metadata !== undefined) updates.metadata = args.metadata;
      
      await ctx.db.patch(existing._id, updates);
      const updated = await ctx.db.get(existing._id);
      return updated;
    } else {
      // Create new vehicle
      const now = Date.now();
      const vehicleId = await ctx.db.insert("vehicles", {
        vin: normalizedVin,
        trim_id: args.trim_id,
        engine_id: args.engine_id,
        transmission_id: args.transmission_id,
        chassis_id: args.chassis_id,
        year: args.year,
        metadata: args.metadata,
        created_at: now,
        updated_at: now,
      });
      
      return await ctx.db.get(vehicleId);
    }
  },
});

/**
 * Add an owner to a vehicle (or reactivate removed ownership)
 * 
 * - Creates vehicle if it doesn't exist
 * - If ownership exists with status="removed", reactivates it
 * - If ownership is already active, updates fields
 */
export const addOwner = mutation({
  args: {
    vin: v.string(),
    userId: v.id("users"),
    nickname: v.optional(v.string()),
    is_primary: v.optional(v.boolean()),
    mileage: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const normalizedVin = args.vin.toUpperCase().trim();
    
    // Ensure vehicle exists (upsert it if not)
    let vehicle = await ctx.db
      .query("vehicles")
      .withIndex("by_vin", (q) => q.eq("vin", normalizedVin))
      .unique();
    
    if (!vehicle) {
      const now = Date.now();
      const vehicleId = await ctx.db.insert("vehicles", {
        vin: normalizedVin,
        created_at: now,
        updated_at: now,
      });
      vehicle = await ctx.db.get(vehicleId);
    }
    
    // Check for existing ownership
    const existing = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_vin_user", (q) =>
        q.eq("vin", normalizedVin).eq("user_id", args.userId)
      )
      .unique();
    
    const now = Date.now();
    
    if (existing) {
      if (existing.status === "removed") {
        // Reactivate removed ownership
        const updates: any = {
          status: "active",
          removed_at: null,
          added_at: now,
          connectionStatus: existing.connectionStatus || "unconnected",
        };
        if (args.nickname !== undefined) updates.nickname = args.nickname;
        if (args.is_primary !== undefined) updates.is_primary = args.is_primary;
        if (args.mileage !== undefined) updates.mileage = args.mileage;
        
        await ctx.db.patch(existing._id, updates);
        return existing._id;
      } else {
        // Active ownership - update fields
        const updates: any = {};
        if (args.nickname !== undefined) updates.nickname = args.nickname;
        if (args.is_primary !== undefined) updates.is_primary = args.is_primary;
        if (args.mileage !== undefined) updates.mileage = args.mileage;
        // Ensure connectionStatus is set if missing
        if (!existing.connectionStatus) updates.connectionStatus = "unconnected";
        
        if (Object.keys(updates).length > 0) {
          await ctx.db.patch(existing._id, updates);
        }
        return existing._id;
      }
    } else {
      // Create new ownership
      const ownershipId = await ctx.db.insert("vehicle_owners", {
        vin: normalizedVin,
        user_id: args.userId,
        status: "active",
        nickname: args.nickname,
        is_primary: args.is_primary ?? false,
        mileage: args.mileage,
        added_at: now,
        connectionStatus: "unconnected",
      });
      
      return ownershipId;
    }
  },
});

/**
 * Soft-delete ownership (remove vehicle from user)
 * 
 * Sets status="removed" and removed_at timestamp.
 * Vehicle catalog remains; user just no longer owns it.
 */
export const removeOwner = mutation({
  args: {
    vin: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const normalizedVin = args.vin.toUpperCase().trim();
    
    // Find ownership
    const ownership = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_vin_user", (q) =>
        q.eq("vin", normalizedVin).eq("user_id", args.userId)
      )
      .unique();
    
    if (!ownership) {
      throw new Error(`No ownership found for VIN: ${args.vin}, User: ${args.userId}`);
    }
    
    // Soft-delete by setting status="removed"
    await ctx.db.patch(ownership._id, {
      status: "removed",
      removed_at: Date.now(),
      is_primary: false,  // Force non-primary when removed
    });
  },
});

/**
 * Set a vehicle as primary for a user
 * 
 * Ensures only one primary vehicle per user.
 * Automatically removes is_primary from other active ownerships.
 */
export const updateOwnershipPrimary = mutation({
  args: {
    vin: v.string(),
    userId: v.id("users"),
    is_primary: v.boolean(),
  },
  handler: async (ctx, args) => {
    const normalizedVin = args.vin.toUpperCase().trim();
    
    // Find ownership to update
    const ownership = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_vin_user", (q) =>
        q.eq("vin", normalizedVin).eq("user_id", args.userId)
      )
      .unique();
    
    if (!ownership) {
      throw new Error(`No ownership found for VIN: ${args.vin}, User: ${args.userId}`);
    }
    
    if (args.is_primary) {
      // Remove primary from all other active ownerships for this user
      const otherOwnerships = await ctx.db
        .query("vehicle_owners")
        .withIndex("by_user_status", (q) =>
          q.eq("user_id", args.userId).eq("status", "active")
        )
        .collect();
      
      await Promise.all(
        otherOwnerships.map(async (o) => {
          if (o._id !== ownership._id && o.is_primary) {
            await ctx.db.patch(o._id, { is_primary: false });
          }
        })
      );
    }
    
    // Update the target ownership
    await ctx.db.patch(ownership._id, { is_primary: args.is_primary });
  },
});

/**
 * Update vehicle mileage
 */
export const updateMileage = mutation({
  args: {
    vin: v.string(),
    userId: v.id("users"),
    mileage: v.float64(),
  },
  handler: async (ctx, args) => {
    const normalizedVin = args.vin.toUpperCase().trim();
    
    // Find ownership
    const ownership = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_vin_user", (q) =>
        q.eq("vin", normalizedVin).eq("user_id", args.userId)
      )
      .unique();
    
    if (!ownership) {
      throw new Error(`No ownership found for VIN: ${args.vin}, User: ${args.userId}`);
    }
    
    await ctx.db.patch(ownership._id, { mileage: args.mileage });
  },
});

// ============================================================================
// VEHICLE ONBOARDING (Non-Smartcar)
// ============================================================================

/**
 * Reset onboarding — clears profile fields on vehicle_owners and
 * deletes all maintenance_records for this vehicle, taking the user
 * back to the onboarding prompt.
 */
export const resetVehicleOnboarding = mutation({
  args: {
    vehicleOwnerId: v.id("vehicle_owners"),
  },
  handler: async (ctx, args) => {
    // Clear profile fields
    await ctx.db.patch(args.vehicleOwnerId, {
      mileage: undefined,
      avgMonthlyDriving: undefined,
      drivingConditions: undefined,
      knownIssues: undefined,
      onboardingComplete: undefined,
    });

    // Delete all maintenance_records for this vehicle
    const records = await ctx.db
      .query("maintenance_records")
      .withIndex("by_vehicle_owner", (q) =>
        q.eq("vehicleOwnerId", args.vehicleOwnerId)
      )
      .collect();

    for (const rec of records) {
      await ctx.db.delete(rec._id);
    }

    return { success: true };
  },
});

/**
 * Save a single onboarding field.
 *
 * Persists one field at a time:
 *   - "mileage" / "avgMonthlyDriving" / "drivingConditions" → patches vehicle_owners
 *   - "oil" / "tires" / "brakes" / "battery" / "inspection" → upserts maintenance_records
 *
 * After saving, checks whether all 6 required fields are complete.
 * If so, sets onboardingComplete = true on vehicle_owners.
 */
export const saveOnboardingField = mutation({
  args: {
    vehicleOwnerId: v.id("vehicle_owners"),
    field: v.string(),   // "mileage" | "avgMonthlyDriving" | "oil" | "tires" | "brakes" | "battery" | "inspection" | "drivingConditions"
    value: v.any(),      // shape depends on field (see handler)
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { vehicleOwnerId, field, value } = args;

    // ── Helper: upsert maintenance_record ──────────────────────────────
    async function upsertRecord(
      type: string,
      lastServiceDate?: number,
      lastServiceMileage?: number,
      customInputs?: Record<string, unknown>
    ) {
      const existing = await ctx.db
        .query("maintenance_records")
        .withIndex("by_vehicle_and_type", (q) =>
          q.eq("vehicleOwnerId", vehicleOwnerId).eq("type", type)
        )
        .unique();

      const data = { lastServiceDate, lastServiceMileage, customInputs, updatedAt: now };

      if (existing) {
        await ctx.db.patch(existing._id, data);
      } else {
        await ctx.db.insert("maintenance_records", {
          vehicleOwnerId,
          type,
          ...data,
          createdAt: now,
        });
      }
    }

    // ── Dispatch by field ──────────────────────────────────────────────
    switch (field) {
      case "mileage": {
        await ctx.db.patch(vehicleOwnerId, { mileage: value as number });
        break;
      }
      case "avgMonthlyDriving": {
        await ctx.db.patch(vehicleOwnerId, { avgMonthlyDriving: value as string });
        break;
      }
      case "drivingConditions": {
        await ctx.db.patch(vehicleOwnerId, { drivingConditions: value as string });
        break;
      }
      case "oil": {
        // value: { date?: number, mileage?: number }
        const v = value as { date?: number; mileage?: number };
        await upsertRecord("oil", v.date, v.mileage);
        break;
      }
      case "tires": {
        // value: { type: string, date?: number }
        const v = value as { type: string; date?: number };
        await upsertRecord("tires", v.date, undefined, { tireServiceType: v.type });
        break;
      }
      case "brakes": {
        // value: { date?: number }
        const v = value as { date?: number };
        await upsertRecord("brakes", v.date);
        break;
      }
      case "battery": {
        // value: { date?: number, isOriginal?: boolean, modelYear?: number }
        const v = value as { date?: number; isOriginal?: boolean; modelYear?: number };
        let installDate = v.date;
        if (v.isOriginal && !installDate && v.modelYear) {
          installDate = new Date(v.modelYear, 0, 1).getTime();
        }
        await upsertRecord("battery", installDate);
        break;
      }
      case "inspection": {
        // value: { date: number }
        const v = value as { date: number };
        const expirationDate = v.date + 12 * 30.44 * 24 * 60 * 60 * 1000;
        await upsertRecord("inspection", v.date, undefined, { expirationDate });
        break;
      }
      default:
        throw new Error(`Unknown onboarding field: ${field}`);
    }

    // ── Auto-compute onboardingComplete ────────────────────────────────
    // Required: mileage, avgMonthlyDriving, oil, tires, brakes, battery
    const owner = await ctx.db.get(vehicleOwnerId);
    if (!owner) return { success: true };

    const hasMileage = owner.mileage != null && owner.mileage > 0;
    const hasUsage = !!owner.avgMonthlyDriving;

    // Check maintenance_records for oil, tires, brakes, battery
    const requiredTypes = ["oil", "tires", "brakes", "battery"];
    const records = await ctx.db
      .query("maintenance_records")
      .withIndex("by_vehicle_owner", (q) => q.eq("vehicleOwnerId", vehicleOwnerId))
      .collect();

    const recordTypes = new Set(records.map((r) => r.type));
    const hasAllRecords = requiredTypes.every((t) => recordTypes.has(t));

    const isComplete = hasMileage && hasUsage && hasAllRecords;

    if (isComplete && !owner.onboardingComplete) {
      await ctx.db.patch(vehicleOwnerId, { onboardingComplete: true });
    }

    return { success: true, onboardingComplete: isComplete };
  },
});
