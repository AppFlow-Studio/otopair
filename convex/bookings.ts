import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("bookings").collect();
  },
});

export const getById = query({
  args: { id: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    user_id: v.id("users"),
    user_vehicle_id: v.id("user_vehicles"),
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
    // Verify the slot is still available (race-condition guard)
    const slot = await ctx.db.get(args.time_slot_id);
    if (!slot || !slot.is_available) {
      throw new Error("This time slot is no longer available.");
    }

    // Mark the time slot as unavailable
    await ctx.db.patch(args.time_slot_id, { is_available: false });

    // Insert the booking
    const { session_id, funnel_id, ...bookingData } = args;
    const now = Date.now();
    const bookingId = await ctx.db.insert("bookings", {
      ...bookingData,
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
