import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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
    const all = await ctx.db.query("job_actuals").collect();
    return all.find((row) => row.booking_id === args.bookingId) ?? null;
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
    const userVehicle = await ctx.db.get(booking.user_vehicle_id);
    if (!userVehicle) return null;

    const engine = await ctx.db.get(userVehicle.engine_id);
    if (!engine) return null;

    const trim = await ctx.db.get(engine.trim_id);
    const model = trim ? await ctx.db.get(trim.model_id) : null;
    const make = model ? await ctx.db.get(model.make_id) : null;

    const vehicleLabel = [
      make?.name,
      model?.name,
      trim?.name,
      userVehicle.year,
    ]
      .filter(Boolean)
      .join(" ");

    // Mechanic
    const mechanic = booking.mechanic_id
      ? await ctx.db.get(booking.mechanic_id)
      : null;
    const mechanicName = mechanic
      ? `${mechanic.first_name} ${mechanic.last_name}`
      : "Unassigned";

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
          oem_number: specs.oil_filter_oem,
          cost: 12,
        });
        suggestedParts.push({
          part_name: `Synthetic Oil ${specs.oil_capacity_qts}qt`,
          oem_number: specs.oil_viscocity,
          cost: 35,
        });
      } else if (slug === "brake-pads") {
        suggestedParts.push({
          part_name: "Front Brake Pads",
          oem_number: specs.front_brake_pad_oem,
          cost: 45,
        });
        suggestedParts.push({
          part_name: "Rear Brake Pads",
          oem_number: specs.rear_brake_pad_oem,
          cost: 40,
        });
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

    // Update booking status
    await ctx.db.patch(args.bookingId, { status: "in_progress" });

    const now = new Date().toISOString();

    // Create job_actuals row
    const jobActualId = await ctx.db.insert("job_actuals", {
      booking_id: args.bookingId,
      mechanic_id: args.mechanicId,
      actual_labor_minutes: 0,
      parts_used: [],
      actual_parts_cost: 0,
      difficulty_rating: 3,
      technician_notes: "",
      job_started_at: now,
      completed_at: now,
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

    const now = new Date().toISOString();
    const startedAt = new Date(jobActual.job_started_at).getTime();
    const completedAt = new Date(now).getTime();
    const elapsedMinutes = Math.round((completedAt - startedAt) / 60000);

    await ctx.db.patch(jobActual._id, {
      job_completed_at: now,
      actual_labor_minutes: elapsedMinutes,
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
      })
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

    const now = new Date().toISOString();

    // Update job_actuals with questionnaire data
    await ctx.db.patch(jobActual._id, {
      parts_used: args.parts_used,
      actual_parts_cost: args.actual_parts_cost,
      difficulty_rating: args.difficulty_rating,
      technician_notes: args.technician_notes,
      logged_at: now,
      completed_at: now,
    });

    // Set booking to completed
    await ctx.db.patch(args.bookingId, { status: "completed" });

    // --- Learning aggregation ---
    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");

    const service = await ctx.db.get(booking.service_id);
    if (!service) throw new Error("Service not found");

    const userVehicle = await ctx.db.get(booking.user_vehicle_id);
    if (!userVehicle) throw new Error("User vehicle not found");

    const engineId = userVehicle.engine_id;
    const actualLaborHours = jobActual.actual_labor_minutes / 60;
    const estimatedLaborHours = service.default_labor_hours;

    // Find or create service_insights
    const allInsights = await ctx.db.query("service_insights").collect();
    const existing = allInsights.find(
      (r) => r.service_id === booking.service_id && r.engine_id === engineId
    );

    if (existing) {
      const oldCount = existing.completed_jobs_count;
      const newCount = oldCount + 1;
      const newAvgLabor =
        (existing.avg_actual_labor_hours * oldCount + actualLaborHours) / newCount;
      const newAvgParts =
        (existing.avg_actual_parts_cost * oldCount + args.actual_parts_cost) / newCount;
      const laborVariance =
        estimatedLaborHours > 0
          ? (newAvgLabor - estimatedLaborHours) / estimatedLaborHours
          : 0;
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
        estimatedLaborHours > 0
          ? (actualLaborHours - estimatedLaborHours) / estimatedLaborHours
          : 0;
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
    const svs = allSVS.find(
      (r) => r.service_id === booking.service_id && r.engine_id === engineId
    );
    if (svs) {
      const newConfidence = Math.min(1.0, svs.confidence_score + 0.02);
      await ctx.db.patch(svs._id, { confidence_score: newConfidence });
    }

    return { success: true };
  },
});
