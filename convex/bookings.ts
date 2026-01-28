import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
    const bookingId = await ctx.db.insert("bookings", {
      ...args,
      status: "confirmed",
    });

    return bookingId;
  },
});
