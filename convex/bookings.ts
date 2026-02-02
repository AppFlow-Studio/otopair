/**
 * bookings.ts - Service Booking Management
 *
 * DESCRIPTION:
 * Central booking management API for the platform.
 * Handles creating, querying, and managing confirmed service bookings.
 * Bookings link users, vehicles, shops, mechanics, and services together.
 *
 * TABLE: bookings
 *   - Stores confirmed service appointments
 *   - One record per booking (user + vehicle + shop + service + time)
 *   - Status progresses: confirmed → completed/cancelled
 *   - VIN normalized to uppercase for consistency
 *   - Time slot becomes unavailable when booking is confirmed
 *
 * KEY ENTITIES:
 *   - bookings: Main booking records
 *   - vehicles: Vehicle catalog (by canonical VIN)
 *   - vehicle_owners: User-vehicle ownership relationships
 *   - time_slots: Available appointment slots
 *   - booking_status_history: Audit log of status changes
 *   - analytics_events: Booking event tracking
 *   - conversion_funnels: User funnel completion
 *
 * RELATIONSHIPS:
 *   - Requires active vehicle ownership (status="active")
 *   - Reserves time slot (marks unavailable)
 *   - Creates analytics event on creation
 *   - Completes conversion funnel if provided
 *
 * OWNER: Booking Team
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * QUERY: list
 * Returns all bookings in the system.
 * Use with caution - consider filtering in production.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("bookings").collect();
  },
});

/**
 * QUERY: getById
 * Fetch a specific booking by ID.
 *
 * ARGS:
 *   - id: Booking ID
 *
 * RETURNS: Booking record or null if not found
 */
export const getById = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * QUERY: getByUserId
 * Get all bookings for a specific user.
 * Used to show user's booking history.
 *
 * ARGS:
 *   - userId: User ID
 *
 * RETURNS: Array of bookings
 */
export const getByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.userId))
      .collect();
  },
});

/**
 * QUERY: getByShopId
 * Get all bookings for a specific shop.
 * Used by shops to view their upcoming appointments.
 *
 * ARGS:
 *   - shopId: Shop ID
 *
 * RETURNS: Array of bookings at shop
 */
export const getByShopId = query({
  args: { shopId: v.id("shops") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bookings")
      .withIndex("by_shop_id", (q) => q.eq("shop_id", args.shopId))
      .collect();
  },
});

/**
 * MUTATION: create
 * Create a new service booking.
 *
 * VALIDATION:
 *   1. Vehicle with given VIN must exist
 *   2. User must own vehicle (active ownership)
 *   3. Time slot must be available
 *
 * SIDE EFFECTS:
 *   1. Marks time slot as unavailable
 *   2. Creates booking record
 *   3. Tracks analytics event
 *   4. Completes conversion funnel (if provided)
 *
 * ARGS:
 *   - user_id: User making booking
 *   - vin: Vehicle VIN (normalized to uppercase)
 *   - shop_id: Shop providing service
 *   - mechanic_id: (optional) Specific mechanic assigned
 *   - service_id: Service being booked
 *   - time_slot_id: Chosen time slot
 *   - scheduled_date: Date in YYYY-MM-DD format
 *   - scheduled_time: Time in HH:MM format
 *   - labor_cost: Estimated labor cost ($)
 *   - parts_cost: Estimated parts cost ($)
 *   - total_cost: Sum of labor + parts
 *   - session_id: (optional) Client session for analytics
 *   - funnel_id: (optional) Conversion funnel to complete
 *
 * RETURNS: Booking ID
 *
 * THROWS:
 *   - "Vehicle not found": VIN doesn't exist
 *   - "User does not own this vehicle": User lacks active ownership
 *   - "This time slot is no longer available": Slot is reserved
 */
export const create = mutation({
  args: {
    user_id: v.id("users"),
    vin: v.string(),
    shop_id: v.id("shops"),
    mechanic_id: v.optional(v.id("mechanics")),
    service_id: v.id("services"),
    time_slot_id: v.id("time_slots"),
    scheduled_date: v.string(),
    scheduled_time: v.string(),
    labor_cost: v.float64(),
    parts_cost: v.float64(),
    total_cost: v.float64(),
    session_id: v.optional(v.string()),
    funnel_id: v.optional(v.id("conversion_funnels")),
  },
  handler: async (ctx, args) => {
    const normalizedVin = args.vin.toUpperCase().trim();

    // Validate vehicle exists
    const vehicle = await ctx.db
      .query("vehicles")
      .withIndex("by_vin", (q) => q.eq("vin", normalizedVin))
      .unique();
    if (!vehicle) {
      throw new Error(`Vehicle not found: ${args.vin}`);
    }

    // Validate user owns this vehicle (active ownership)
    const ownership = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_vin_user", (q) => q.eq("vin", normalizedVin).eq("user_id", args.user_id))
      .unique();
    if (!ownership || ownership.status !== "active") {
      throw new Error("User does not own this vehicle");
    }

    // Verify the slot is still available (race-condition guard)
    const slot = await ctx.db.get(args.time_slot_id);
    if (!slot || !slot.is_available) {
      throw new Error("This time slot is no longer available.");
    }

    // Mark the time slot as unavailable
    await ctx.db.patch(args.time_slot_id, { is_available: false });

    // Insert the booking with VIN
    const { session_id, funnel_id, ...bookingData } = args;
    const now = Date.now();
    const bookingId = await ctx.db.insert("bookings", {
      ...bookingData,
      vin: normalizedVin,
      status: "confirmed",
      created_at: now,
      updated_at: now,
    });

    // Track analytics event
    await ctx.db.insert("analytics_events", {
      user_id: args.user_id,
      event_type: "booking_created",
      event_category: "booking",
      event_data: {
        booking_id: bookingId,
        shop_id: args.shop_id,
        service_id: args.service_id,
      },
      timestamp: Date.now(),
      session_id,
    });

    // Complete conversion funnel if provided
    if (funnel_id) {
      await ctx.db.patch(funnel_id, {
        completed: true,
        exited_at: Date.now(),
        booking_id: bookingId,
        stage: "completed",
      });
    }

    return bookingId;
  },
});

/**
 * MUTATION: createBatch
 * Create multiple service bookings for the same time slot (e.g. Oil Change + Tire Rotation).
 * Marks the slot unavailable once, inserts N booking records.
 *
 * ARGS:
 *   - user_id, vin, shop_id, mechanic_id?, time_slot_id, scheduled_date, scheduled_time
 *   - services: Array of { service_id, labor_cost, parts_cost } (total_cost = labor + parts per service)
 *   - session_id, funnel_id: optional
 *
 * RETURNS: Array of created booking IDs
 */
export const createBatch = mutation({
  args: {
    user_id: v.id("users"),
    vin: v.string(),
    shop_id: v.id("shops"),
    mechanic_id: v.optional(v.id("mechanics")),
    time_slot_id: v.id("time_slots"),
    scheduled_date: v.string(),
    scheduled_time: v.string(),
    services: v.array(
      v.object({
        service_id: v.id("services"),
        labor_cost: v.float64(),
        parts_cost: v.float64(),
      }),
    ),
    session_id: v.optional(v.string()),
    funnel_id: v.optional(v.id("conversion_funnels")),
  },
  handler: async (ctx, args) => {
    if (args.services.length === 0) {
      throw new Error("At least one service is required");
    }

    const normalizedVin = args.vin.toUpperCase().trim();

    // Validate vehicle exists
    const vehicle = await ctx.db
      .query("vehicles")
      .withIndex("by_vin", (q) => q.eq("vin", normalizedVin))
      .unique();
    if (!vehicle) {
      throw new Error(`Vehicle not found: ${args.vin}`);
    }

    // Validate user owns this vehicle
    const ownership = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_vin_user", (q) => q.eq("vin", normalizedVin).eq("user_id", args.user_id))
      .unique();
    if (!ownership || ownership.status !== "active") {
      throw new Error("User does not own this vehicle");
    }

    // Verify slot is still available
    const slot = await ctx.db.get(args.time_slot_id);
    if (!slot || !slot.is_available) {
      throw new Error("This time slot is no longer available.");
    }

    // Mark slot unavailable once
    await ctx.db.patch(args.time_slot_id, { is_available: false });

    const now = Date.now();
    const bookingIds: (typeof args.time_slot_id)[] = [];

    for (const svc of args.services) {
      const total_cost = svc.labor_cost + svc.parts_cost;
      const bookingId = await ctx.db.insert("bookings", {
        user_id: args.user_id,
        vin: normalizedVin,
        shop_id: args.shop_id,
        mechanic_id: args.mechanic_id,
        service_id: svc.service_id,
        time_slot_id: args.time_slot_id,
        scheduled_date: args.scheduled_date,
        scheduled_time: args.scheduled_time,
        labor_cost: svc.labor_cost,
        parts_cost: svc.parts_cost,
        total_cost,
        status: "confirmed",
        created_at: now,
        updated_at: now,
      });
      bookingIds.push(bookingId);

      await ctx.db.insert("analytics_events", {
        user_id: args.user_id,
        event_type: "booking_created",
        event_category: "booking",
        event_data: {
          booking_id: bookingId,
          shop_id: args.shop_id,
          service_id: svc.service_id,
        },
        timestamp: Date.now(),
        session_id: args.session_id,
      });
    }

    if (args.funnel_id) {
      await ctx.db.patch(args.funnel_id, {
        completed: true,
        exited_at: Date.now(),
        booking_id: bookingIds[0],
        stage: "completed",
      });
    }

    return bookingIds;
  },
});

/**
 * MUTATION: updateStatus
 * Update booking status with FSM validation.
 *
 * VALIDATION:
 *   1. Booking must exist
 *   2. Status transition must be valid (FSM rules)
 *   3. Cannot transition from terminal states
 *
 * SIDE EFFECTS:
 *   1. Updates booking status
 *   2. Logs change to booking_status_history (async)
 *
 * ARGS:
 *   - bookingId: Booking to update
 *   - newStatus: New status to transition to
 *   - changed_by: (optional) User ID who initiated change
 *   - reason: (optional) Reason for status change
 *
 * RETURNS:
 *   {
 *     success: true,
 *     oldStatus: string,
 *     newStatus: string
 *   }
 *
 * THROWS:
 *   - "Booking not found": Invalid booking ID
 *   - Invalid status transition error from FSM
 *   - "Cannot transition from terminal state": From completed/cancelled
 */
export const updateStatus = mutation({
  args: {
    bookingId: v.id("bookings"),
    newStatus: v.string(),
    changed_by: v.optional(v.id("users")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get current booking
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");

    // Validate status transition using FSM
    const { validateTransition, isTerminal } = await import("./booking_status_history");
    const error = validateTransition(booking.status, args.newStatus);
    if (error) throw new Error(error);

    // Prevent transitions from terminal states
    if (isTerminal(booking.status)) {
      throw new Error(`Cannot transition from terminal state: ${booking.status}`);
    }

    // Patch booking with new status
    const now = Date.now();
    await ctx.db.patch(args.bookingId, {
      status: args.newStatus,
      updated_at: now,
    });

    // Log status change to history (async, non-blocking)
    await ctx.scheduler.runAfter(0, internal.booking_status_history.log, {
      booking_id: args.bookingId,
      old_status: booking.status,
      new_status: args.newStatus,
      changed_by: args.changed_by,
      reason: args.reason,
    });

    return { success: true, oldStatus: booking.status, newStatus: args.newStatus };
  },
});
