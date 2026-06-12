/**
 * support_requests.ts — internal query helpers for the customer
 * "report an issue" flow. Lives on the V8 runtime so the Node-side
 * action (`support_requests_node.submitSupportRequest`) can fetch
 * the booking + customer context before it hits Resend.
 *
 * Public surface is intentionally empty — clients call the Node
 * action; the query here is only meant to be reached via
 * `internal.support_requests.getDisputeContext`.
 */

import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

export const getDisputeContext = internalQuery({
  args: {
    bookingId: v.id("bookings"),
    clerkUserId: v.string(),
  },
  handler: async (ctx, { bookingId, clerkUserId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();
    if (!user) return null;

    const booking = await ctx.db.get(bookingId);
    if (!booking) return null;
    if (String(booking.user_id) !== String(user._id)) return null;

    const customerEmail = user.email ?? null;
    if (!customerEmail) return null;

    // Shop name — best-effort lookup. If the shop row is missing
    // (rare; reseeded shops in dev) we still send with a fallback
    // so the user isn't blocked.
    let shopName = "Unknown shop";
    if (booking.shop_id) {
      const shop = await ctx.db.get(booking.shop_id);
      if (shop && typeof (shop as { name?: string }).name === "string") {
        shopName = (shop as { name: string }).name;
      }
    }

    // Mechanic name (optional).
    let mechanicName: string | undefined;
    if (booking.mechanic_id) {
      const mech = await ctx.db.get(booking.mechanic_id);
      const m = mech as { first_name?: string; last_name?: string } | null;
      if (m) {
        const full = [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
        if (full) mechanicName = full;
      }
    }

    // Vehicle display (optional). Same year/make/model dance used by
    // `bookings.getByUserIdWithDetails`.
    let vehicleDisplay: string | undefined;
    const vehicle = booking.vin
      ? await ctx.db
          .query("vehicles")
          .withIndex("by_vin", (q) => q.eq("vin", booking.vin))
          .unique()
      : null;
    if (vehicle?.trim_id) {
      const trim = await ctx.db.get(vehicle.trim_id);
      if (trim) {
        const model = await ctx.db.get(trim.model_id);
        if (model) {
          const make = await ctx.db.get(model.make_id);
          const parts: string[] = [];
          if (vehicle.year != null) parts.push(String(vehicle.year));
          if (make?.name) parts.push(make.name);
          if (model.name) parts.push(model.name);
          if (trim.name) parts.push(trim.name);
          vehicleDisplay = parts.join(" ");
        }
      }
    }

    const totalDollars =
      typeof booking.total_cost === "number" ? booking.total_cost : undefined;

    const orderNumber = String(bookingId).slice(-8).toUpperCase();

    return {
      booking: {
        id: String(bookingId),
        orderNumber,
        shopName,
        mechanicName,
        date: booking.scheduled_date,
        time: booking.scheduled_time,
        vehicle: vehicleDisplay,
        totalDollars,
      },
      customer: {
        email: customerEmail,
        name:
          [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
          undefined,
        clerkUserId,
      },
    };
  },
});
