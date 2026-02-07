/**
 * bookings.ts - Service Booking Management
 *
 * DESCRIPTION:
 * Central booking management API for the platform.
 * Handles creating, querying, and managing confirmed service bookings.
 * Bookings link users, vehicles, shops, mechanics, and services together.
 *
 * TABLE: bookings
 *   - Stores service appointment requests and confirmed appointments
 *   - One record per booking (user + vehicle + shop + services + time)
 *   - Status progresses: pending (user submitted) → confirmed (shop accepts) → completed/cancelled
 *   - VIN normalized to uppercase for consistency
 *   - Time slot becomes unavailable when user confirms appointment (pending); shop can then accept or cancel
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

/** Live Tracker stage slugs stored on bookings when status is in_progress */
export const LIVE_STAGE_SLUGS = ["booking_confirmed", "service_in_progress", "vehicle_ready"] as const;
export type LiveStageSlug = (typeof LIVE_STAGE_SLUGS)[number];

/** Display title for each live stage (for currentStage in UI) */
export const LIVE_STAGE_TITLES: Record<string, string> = {
  booking_confirmed: "Booking Confirmed",
  service_in_progress: "Service in Progress",
  vehicle_ready: "Your vehicle is ready",
};

/** Progress percent when no job_actuals elapsed time (stage-based fallback) */
const LIVE_STAGE_PROGRESS: Record<string, number> = {
  booking_confirmed: 25,
  service_in_progress: 50,
  vehicle_ready: 90,
};

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
 * QUERY: getByUserIdWithDetails
 * Get all bookings for a user with shop, mechanic, vehicle, and service names resolved.
 * Used by My Bookings screen for Live Tracker, Upcoming, and History.
 *
 * ARGS:
 *   - userId: User ID
 *
 * RETURNS: Array of booking rows with display fields (shopName, shopPhone, mechanicName, vehicleDisplay, licensePlate, serviceNames, progressPercent?, currentStage?, delayMinutes?)
 */
export const getByUserIdWithDetails = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.userId))
      .collect();

    const results = await Promise.all(
      bookings.map(async (booking) => {
        const shop = await ctx.db.get(booking.shop_id);
        const mechanic = booking.mechanic_id ? await ctx.db.get(booking.mechanic_id) : null;
        const shopName = shop?.name ?? "Unknown Shop";
        const shopPhone = shop?.phone ?? "";
        const mechanicName = mechanic ? `${mechanic.first_name} ${mechanic.last_name}` : shopName;
        let mechanicImageUrl: string | undefined;
        if (mechanic?.photo) {
          const photoAsset = await ctx.db.get(mechanic.photo);
          mechanicImageUrl = photoAsset?.url;
        }

        const serviceIds = booking.service_ids ?? [];
        const serviceNames = await Promise.all(
          serviceIds.map(async (id) => {
            const svc = await ctx.db.get(id);
            return svc?.name ?? "";
          }),
        ).then((a) => a.filter(Boolean));

        const vehicle = await ctx.db
          .query("vehicles")
          .withIndex("by_vin", (q) => q.eq("vin", booking.vin))
          .unique();
        let vehicleDisplay = "Unknown Vehicle";
        let licensePlate = booking.vin.slice(-4);
        let makeLogoUrl: string | undefined;
        if (vehicle) {
          const parts: string[] = [];
          if (vehicle.trim_id) {
            const trim = await ctx.db.get(vehicle.trim_id);
            if (trim) {
              const model = await ctx.db.get(trim.model_id);
              if (model) {
                const make = await ctx.db.get(model.make_id);
                if (make) {
                  parts.push(make.name);
                  if (make.logo) {
                    const logoAsset = await ctx.db.get(make.logo);
                    makeLogoUrl = logoAsset?.url;
                  }
                }
                parts.push(model.name);
              }
              parts.push(trim.name);
            }
          }
          if (vehicle.year != null) parts.push(String(vehicle.year));
          if (parts.length > 0) vehicleDisplay = parts.join(" ");
        }

        let progressPercent: number | undefined;
        let currentStage: string | undefined;
        let delayMinutes: number | undefined;
        const liveStage = booking.live_stage;
        if (booking.status === "in_progress") {
          const jobActual = await ctx.db
            .query("job_actuals")
            .withIndex("by_booking_id", (q) => q.eq("booking_id", booking._id))
            .unique();
          const estimatedMinutes = booking.estimated_labor_minutes ?? 60;
          // Use stored live_stage for currentStage when set; else infer from job_actual
          if (liveStage && LIVE_STAGE_TITLES[liveStage]) {
            currentStage = LIVE_STAGE_TITLES[liveStage];
          } else if (jobActual) {
            currentStage = "Service in Progress";
          } else {
            currentStage = "Car checked in";
          }
          // Progress: from job_actuals elapsed when available, else from live_stage
          if (jobActual) {
            const elapsedMs = Date.now() - jobActual.started_at * 1000;
            const totalMs = estimatedMinutes * 60 * 1000;
            progressPercent = Math.min(100, Math.round((elapsedMs / totalMs) * 100));
            const scheduledStartMs = new Date(`${booking.scheduled_date}T${booking.scheduled_time}`).getTime();
            const lateMs = Date.now() - scheduledStartMs;
            if (lateMs > 0) delayMinutes = Math.round(lateMs / 60000);
          } else {
            progressPercent = (liveStage && LIVE_STAGE_PROGRESS[liveStage]) ?? 25;
          }
        }

        return {
          _id: booking._id,
          status: booking.status,
          scheduled_date: booking.scheduled_date,
          scheduled_time: booking.scheduled_time,
          total_cost: booking.total_cost,
          shop_id: booking.shop_id,
          mechanic_id: booking.mechanic_id,
          vin: booking.vin,
          shopName,
          shopPhone,
          mechanicName,
          mechanicImageUrl,
          vehicleDisplay,
          licensePlate,
          makeLogoUrl,
          serviceNames,
          progressPercent,
          currentStage,
          delayMinutes,
          liveStage: liveStage ?? undefined,
        };
      }),
    );

    return results;
  },
});

/**
 * QUERY: getRecentlyBookedShopIdsByUserId
 * Get unique shop IDs the user has booked at, ordered by most recent booking first.
 * Used to show "Recently booked" in booking flow search.
 *
 * ARGS:
 *   - userId: User ID
 *   - limit: Max number of shop IDs to return (default 5)
 *
 * RETURNS: Array of shop IDs (most recently booked first)
 */
export const getRecentlyBookedShopIdsByUserId = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.userId))
      .collect();
    // Sort by most recent booking first
    bookings.sort((a, b) => b.created_at - a.created_at);
    const seen = new Set<string>();
    const shopIds: string[] = [];
    for (const b of bookings) {
      const id = b.shop_id;
      if (!seen.has(id)) {
        seen.add(id);
        shopIds.push(id);
        if (shopIds.length >= limit) break;
      }
    }
    return shopIds;
  },
});

/**
 * QUERY: getRecentlyBookedMechanicIdsByUserId
 * Get unique mechanic IDs the user has booked with, ordered by most recent booking first.
 * Only includes bookings that have mechanic_id set.
 *
 * ARGS:
 *   - userId: User ID
 *   - limit: Max number of mechanic IDs to return (default 5)
 *
 * RETURNS: Array of mechanic IDs (most recently booked first)
 */
export const getRecentlyBookedMechanicIdsByUserId = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 5;
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_user_id", (q) => q.eq("user_id", args.userId))
      .collect();
    bookings.sort((a, b) => b.created_at - a.created_at);
    const seen = new Set<string>();
    const mechanicIds: string[] = [];
    for (const b of bookings) {
      const mid = b.mechanic_id;
      if (mid && !seen.has(mid)) {
        seen.add(mid);
        mechanicIds.push(mid);
        if (mechanicIds.length >= limit) break;
      }
    }
    return mechanicIds;
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

    // Verify the slot is still available (no pending/confirmed booking on it)
    const slot = await ctx.db.get(args.time_slot_id);
    if (!slot || !slot.is_available) {
      throw new Error("This time slot is no longer available.");
    }

    // Mark slot unavailable until booking is freed (cancelled/no_show/completed via updateStatus)
    await ctx.db.patch(args.time_slot_id, { is_available: false });

    const { session_id, funnel_id, service_id, ...bookingData } = args;
    const now = Date.now();
    const bookingId = await ctx.db.insert("bookings", {
      ...bookingData,
      vin: normalizedVin,
      service_ids: [service_id],
      status: "pending",
      created_at: now,
      updated_at: now,
    });

    await ctx.db.insert("booking_status_history", {
      booking_id: bookingId,
      new_status: "pending",
      changed_at: now,
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
 * Create one booking for an appointment (one time slot) with multiple services.
 * Total cost and estimated time are aggregated; one row per appointment.
 *
 * ARGS:
 *   - user_id, vin, shop_id, mechanic_id?, time_slot_id, scheduled_date, scheduled_time
 *   - services: Array of { service_id, labor_cost, parts_cost, labor_hours? }
 *   - taxes_and_fees: (optional) Taxes & fees to include in total_cost
 *   - platform_fee: (optional) Platform fee to include in total_cost
 *   - session_id, funnel_id: optional
 *
 * RETURNS: Single-element array [bookingId]
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
        labor_hours: v.optional(v.float64()),
      }),
    ),
    taxes_and_fees: v.optional(v.float64()),
    platform_fee: v.optional(v.float64()),
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

    // Verify slot is still available (no pending/confirmed booking on it)
    const slot = await ctx.db.get(args.time_slot_id);
    if (!slot || !slot.is_available) {
      throw new Error("This time slot is no longer available.");
    }

    // Mark slot unavailable until booking is freed (cancelled/no_show/completed via updateStatus)
    await ctx.db.patch(args.time_slot_id, { is_available: false });

    const labor_cost = args.services.reduce((sum, s) => sum + s.labor_cost, 0);
    const parts_cost = args.services.reduce((sum, s) => sum + s.parts_cost, 0);
    const taxes_and_fees = args.taxes_and_fees ?? 0;
    const platform_fee = args.platform_fee ?? 0;
    const total_cost = labor_cost + parts_cost + taxes_and_fees + platform_fee;
    const estimated_labor_minutes = args.services.reduce((sum, s) => sum + (s.labor_hours ?? 0) * 60, 0);

    const now = Date.now();
    const firstServiceId = args.services[0].service_id;

    const bookingId = await ctx.db.insert("bookings", {
      user_id: args.user_id,
      vin: normalizedVin,
      shop_id: args.shop_id,
      mechanic_id: args.mechanic_id,
      service_ids: args.services.map((s) => s.service_id),
      time_slot_id: args.time_slot_id,
      scheduled_date: args.scheduled_date,
      scheduled_time: args.scheduled_time,
      labor_cost,
      parts_cost,
      total_cost,
      estimated_labor_minutes: estimated_labor_minutes > 0 ? estimated_labor_minutes : undefined,
      status: "pending",
      created_at: now,
      updated_at: now,
    });

    await ctx.db.insert("booking_status_history", {
      booking_id: bookingId,
      new_status: "pending",
      changed_at: now,
    });

    await ctx.db.insert("analytics_events", {
      user_id: args.user_id,
      event_type: "booking_created",
      event_category: "booking",
      event_data: {
        booking_id: bookingId,
        shop_id: args.shop_id,
        service_id: firstServiceId,
      },
      timestamp: Date.now(),
      session_id: args.session_id,
    });

    if (args.funnel_id) {
      await ctx.db.patch(args.funnel_id, {
        completed: true,
        exited_at: Date.now(),
        booking_id: bookingId,
        stage: "completed",
      });
    }

    return [bookingId];
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
 *   2. If new status is cancelled | no_show | completed, sets the booking's time_slot is_available = true (releases slot for mechanics)
 *   3. Logs change to booking_status_history (async)
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

    // Patch booking with new status; set or clear live_stage for Live Tracker
    const now = Date.now();
    const patch: { status: string; updated_at: number; live_stage?: string } = {
      status: args.newStatus,
      updated_at: now,
    };
    if (args.newStatus === "in_progress") {
      patch.live_stage = "service_in_progress";
    } else if (["cancelled", "no_show", "completed"].includes(args.newStatus)) {
      patch.live_stage = undefined;
    }
    await ctx.db.patch(args.bookingId, patch);

    // When booking is freed (cancelled, no_show, completed), release the time slot so it shows available on the mechanics side
    const slotReleasingStatuses = ["cancelled", "no_show", "completed"];
    if (slotReleasingStatuses.includes(args.newStatus) && booking.time_slot_id) {
      await ctx.db.patch(booking.time_slot_id, { is_available: true });
    }

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

/**
 * MUTATION: updateLiveStage
 * Update the Live Tracker stage for an in_progress booking.
 * Used when mechanic/shop advances the stage (e.g. "vehicle_ready").
 *
 * ARGS:
 *   - bookingId: Booking to update
 *   - liveStage: "booking_confirmed" | "service_in_progress" | "vehicle_ready"
 *
 * THROWS: "Booking not found" | "Booking is not in progress" | "Invalid live stage"
 */
export const updateLiveStage = mutation({
  args: {
    bookingId: v.id("bookings"),
    liveStage: v.union(v.literal("booking_confirmed"), v.literal("service_in_progress"), v.literal("vehicle_ready")),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "in_progress") {
      throw new Error("Booking is not in progress");
    }
    await ctx.db.patch(args.bookingId, {
      live_stage: args.liveStage,
      updated_at: Date.now(),
    });
    return { success: true, liveStage: args.liveStage };
  },
});
