import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("job_actuals").collect();
  },
});

export const getById = query({
  args: { id: v.id("job_actuals") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByBookingId = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("job_actuals")
      .withIndex("by_booking_id", (q) => q.eq("booking_id", args.bookingId))
      .unique();
  },
});

export const getPrefillData = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) return null;

    // Service
    const service = await ctx.db.get(booking.service_id);

    // Vehicle → engine → trim → model → make
    const vehicle = await ctx.db
      .query("vehicles")
      .withIndex("by_vin", (q) => q.eq("vin", booking.vin))
      .unique();
    if (!vehicle) return null;

    const engine = vehicle.engine_id ? await ctx.db.get(vehicle.engine_id) : null;
    if (!engine) return null;

    const trim = await ctx.db.get(engine.trim_id);
    const model = trim ? await ctx.db.get(trim.model_id) : null;
    const make = model ? await ctx.db.get(model.make_id) : null;

    const vehicleLabel = [make?.name, model?.name, trim?.name, vehicle.year].filter(Boolean).join(" ");

    // Mechanic
    const mechanic = booking.mechanic_id ? await ctx.db.get(booking.mechanic_id) : null;
    const mechanicName = mechanic ? `${mechanic.first_name} ${mechanic.last_name}` : "Unassigned";

    // Vehicle specs for suggested parts
    const allSpecs = await ctx.db.query("vehicle_specs").collect();
    const specs = allSpecs.find((s) => s.engine_id === engine._id);

    const suggestedParts: {
      part_name: string;
      oem_number: string;
      cost: number;
    }[] = [];

    if (specs && service) {
      const slug = service.slug;
      if (slug === "oil-change") {
        suggestedParts.push({
          part_name: "Oil Filter",
          oem_number: specs.oil_filter_oem ?? "",
          cost: 12,
        });
        suggestedParts.push({
          part_name: `Synthetic Oil ${specs.oil_capacity_qts ?? "—"}qt`,
          oem_number: specs.oil_viscocity ?? "",
          cost: 35,
        });
        if (specs.oil_drain_plug_gasket_oem) {
          suggestedParts.push({
            part_name: "Drain Plug Gasket",
            oem_number: specs.oil_drain_plug_gasket_oem,
            cost: 2,
          });
        }
      } else if (slug === "brake-pads") {
        suggestedParts.push({
          part_name: "Front Brake Pads",
          oem_number: specs.front_brake_pad_oem ?? "",
          cost: 45,
        });
        suggestedParts.push({
          part_name: "Rear Brake Pads",
          oem_number: specs.rear_brake_pad_oem ?? "",
          cost: 40,
        });
      } else if (slug === "engine-air-filter" && specs.engine_air_filter_oem) {
        suggestedParts.push({
          part_name: "Engine Air Filter",
          oem_number: specs.engine_air_filter_oem,
          cost: 25,
        });
      } else if (slug === "cabin-air-filter" && specs.cabin_air_filter_oem) {
        suggestedParts.push({
          part_name: "Cabin Air Filter",
          oem_number: specs.cabin_air_filter_oem,
          cost: 22,
        });
      } else if (slug === "spark-plugs" && specs.spark_plug_oem) {
        const qty = specs.spark_plug_quantity ?? 4;
        suggestedParts.push({
          part_name: `Spark Plugs (×${qty})`,
          oem_number: specs.spark_plug_oem,
          cost: 12 * qty,
        });
      } else if (slug === "serpentine-belt" && specs.serpentine_belt_oem) {
        suggestedParts.push({
          part_name: "Serpentine Belt",
          oem_number: specs.serpentine_belt_oem,
          cost: 45,
        });
      } else if (slug === "brake-rotors" && specs.front_brake_rotor_oem) {
        suggestedParts.push({
          part_name: "Front Brake Rotors",
          oem_number: specs.front_brake_rotor_oem ?? "",
          cost: 85,
        });
        if (specs.rear_brake_rotor_oem) {
          suggestedParts.push({
            part_name: "Rear Brake Rotors",
            oem_number: specs.rear_brake_rotor_oem,
            cost: 75,
          });
        }
      }
    }

    return {
      vehicleLabel,
      serviceName: service?.name ?? "",
      serviceSlug: service?.slug ?? "",
      engineCode: engine.engine_code,
      engineId: engine._id,
      serviceId: booking.service_id,
      mechanicName,
      suggestedParts,
    };
  },
});

export const startJob = mutation({
  args: {
    bookingId: v.id("bookings"),
    mechanicId: v.id("mechanics"),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");
    if (booking.status !== "confirmed") {
      throw new Error(`Booking status is "${booking.status}", expected "confirmed"`);
    }

    // Invariant: Ensure only one job_actuals per booking
    const existing = await ctx.db
      .query("job_actuals")
      .withIndex("by_booking_id", (q) => q.eq("booking_id", args.bookingId))
      .unique();
    if (existing) {
      throw new Error("Job actuals already exist for this booking");
    }

    // Update booking status
    const now = Date.now();
    await ctx.db.patch(args.bookingId, { status: "in_progress", updated_at: now });

    // Create job_actuals row
    const jobActualId = await ctx.db.insert("job_actuals", {
      booking_id: args.bookingId,
      mechanic_id: args.mechanicId,
      actual_labor_minutes: 0,
      parts_used: [],
      actual_parts_cost: 0,
      difficulty_rating: 3,
      technician_notes: "",
      started_at: now,
      created_at: now,
      updated_at: now,
    });

    return jobActualId;
  },
});

export const completeJob = mutation({
  args: {
    bookingId: v.id("bookings"),
  },
  handler: async (ctx, args) => {
    const allActuals = await ctx.db.query("job_actuals").collect();
    const jobActual = allActuals.find((r) => r.booking_id === args.bookingId);
    if (!jobActual) throw new Error("No job_actuals found for this booking");

    const now = Date.now();
    const startedAt = jobActual.started_at;
    const elapsedMinutes = Math.round((now - startedAt) / 60000);

    await ctx.db.patch(jobActual._id, {
      completed_at_ms: now,
      actual_labor_minutes: elapsedMinutes,
      updated_at: now,
    });

    return { elapsedMinutes };
  },
});

export const submitJobActuals = mutation({
  args: {
    bookingId: v.id("bookings"),
    parts_used: v.array(
      v.object({
        part_name: v.string(),
        oem_number: v.string(),
        cost: v.float64(),
      }),
    ),
    actual_parts_cost: v.float64(),
    difficulty_rating: v.float64(),
    technician_notes: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the job_actuals row
    const allActuals = await ctx.db.query("job_actuals").collect();
    const jobActual = allActuals.find((r) => r.booking_id === args.bookingId);
    if (!jobActual) throw new Error("No job_actuals found for this booking");

    const now = Date.now();

    // Update job_actuals with questionnaire data
    await ctx.db.patch(jobActual._id, {
      parts_used: args.parts_used,
      actual_parts_cost: args.actual_parts_cost,
      difficulty_rating: args.difficulty_rating,
      technician_notes: args.technician_notes,
      logged_at_ms: now,
      completed_at_ms: now,
      updated_at: now,
    });

    // Set booking to completed
    await ctx.db.patch(args.bookingId, { status: "completed", updated_at: now });

    // --- Learning aggregation ---
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");

    const service = await ctx.db.get(booking.service_id);
    if (!service) throw new Error("Service not found");

    const vehicle = await ctx.db
      .query("vehicles")
      .withIndex("by_vin", (q) => q.eq("vin", booking.vin))
      .unique();
    if (!vehicle) throw new Error("Vehicle not found");

    const engineId = vehicle.engine_id;
    const actualLaborHours = jobActual.actual_labor_minutes / 60;
    const estimatedLaborHours = service.default_labor_hours;

    // Track analytics event for job completion
    await ctx.db.insert("analytics_events", {
      user_id: booking.user_id,
      event_type: "job_completed",
      event_category: "booking",
      event_data: {
        booking_id: args.bookingId,
        shop_id: booking.shop_id,
        service_id: booking.service_id,
      },
      timestamp: Date.now(),
    });

    // Find or create service_insights
    const allInsights = await ctx.db.query("service_insights").collect();
    const existing = allInsights.find((r) => r.service_id === booking.service_id && r.engine_id === engineId);

    if (existing) {
      const oldCount = existing.completed_jobs_count;
      const newCount = oldCount + 1;
      const newAvgLabor = (existing.avg_actual_labor_hours * oldCount + actualLaborHours) / newCount;
      const newAvgParts = (existing.avg_actual_parts_cost * oldCount + args.actual_parts_cost) / newCount;
      const laborVariance = estimatedLaborHours > 0 ? (newAvgLabor - estimatedLaborHours) / estimatedLaborHours : 0;
      const confidence = Math.min(1.0, 0.5 + 0.15 * Math.log(newCount));

      await ctx.db.patch(existing._id, {
        avg_actual_labor_hours: newAvgLabor,
        avg_actual_parts_cost: newAvgParts,
        completed_jobs_count: newCount,
        labor_variance: laborVariance,
        confidence_level: confidence,
      });
    } else {
      const laborVariance =
        estimatedLaborHours > 0 ? (actualLaborHours - estimatedLaborHours) / estimatedLaborHours : 0;
      const confidence = Math.min(1.0, 0.5 + 0.15 * Math.log(1));

      await ctx.db.insert("service_insights", {
        service_id: booking.service_id,
        engine_id: engineId,
        estimated_labor_hours: estimatedLaborHours,
        avg_actual_labor_hours: actualLaborHours,
        avg_actual_parts_cost: args.actual_parts_cost,
        completed_jobs_count: 1,
        labor_variance: laborVariance,
        confidence_level: confidence,
      });
    }

    // Bump service_vehicle_specs confidence_score
    const allSVS = await ctx.db.query("service_vehicle_specs").collect();
    const svs = allSVS.find((r) => r.service_id === booking.service_id && r.engine_id === engineId);
    if (svs) {
      const newConfidence = Math.min(1.0, svs.confidence_score + 0.02);
      await ctx.db.patch(svs._id, { confidence_score: newConfidence });

      // Track spec variance if there's a significant difference
      const predictedLabor = svs.labor_hours;
      const predictedParts = (svs.parts_cost_low + svs.parts_cost_high) / 2;

      await ctx.scheduler.runAfter(0, internal.spec_variances.flagSpecVariance, {
        engine_id: engineId,
        service_id: booking.service_id,
        job_actual_id: jobActual._id,
        predicted_labor_hours: predictedLabor,
        actual_labor_hours: actualLaborHours,
        predicted_parts_cost: predictedParts,
        actual_parts_cost: args.actual_parts_cost,
      });
    }

    // Create follow-up reminder for maintenance (7 days later for oil change, 30 days for others)
    const followUpDays = service.slug === "oil-change" ? 90 : 180; // 3 months or 6 months
    const scheduledFor = Date.now() + followUpDays * 24 * 60 * 60 * 1000;

    await ctx.db.insert("follow_ups", {
      user_id: booking.user_id,
      vin: booking.vin,
      booking_id: args.bookingId,
      service_id: booking.service_id,
      follow_up_type: "maintenance_due",
      scheduled_for: scheduledFor,
      status: "pending",
      message: `Time to schedule your next ${service.name}`,
      created_at: Date.now(),
    });

    return { success: true };
  },
});
