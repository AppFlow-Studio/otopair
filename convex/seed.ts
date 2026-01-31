import { mutation } from "./_generated/server";

const TABLES_TO_CLEAR = [
  "booking_status_history",
  "payment_status_history",
  "job_actuals",
  "reviews",
  "payments",
  "follow_ups",
  "bookings",
  "ai_messages",
  "ai_conversations",
  "analytics_events",
  "conversion_funnels",
  "spec_variances",
  "spec_confirmations",
  "manual_review_queue",
  "ai_enrichment_logs",
  "service_insights",
  "shop_services",
  "time_slots",
  "shops_hours",
  "mechanics",
  "shops",
  "service_vehicle_specs",
  "service_options",
  "services",
  "service_categories",
  "vehicle_specs",
  "engines",
  "trims",
  "models",
  "makes",
  "vehicle_owners",
  "vehicles",
  "user_question_answers",
  "onboarding_question_answers",
  "onboarding_questions",
  "users",
];

const clearTables = async (ctx: any) => {
  for (const table of TABLES_TO_CLEAR) {
    const rows = await ctx.db.query(table).collect();
    for (const r of rows) {
      await ctx.db.delete(r._id);
    }
  }
};

export const seedUserAndVehicle = mutation({
  args: {},
  handler: async (ctx) => {
    // Clean existing user + vehicle ownership data
    const existingOwners = await ctx.db.query("vehicle_owners").collect();
    for (const o of existingOwners) await ctx.db.delete(o._id);
    const existingVehicles = await ctx.db.query("vehicles").collect();
    for (const v of existingVehicles) await ctx.db.delete(v._id);
    const existingUsers = await ctx.db.query("users").collect();
    for (const u of existingUsers) await ctx.db.delete(u._id);

    // Look up the A25A-FKS engine
    const engines = await ctx.db.query("engines").collect();
    const engine = engines.find((e) => e.engine_code === "A25A-FKS");
    if (!engine) throw new Error("Engine A25A-FKS not found. Seed vehicle data first.");

    // Demo user
    const userId = await ctx.db.insert("users", {
      clerkUserId: "seed-demo-user-1",
      onboardingCompleted: true,
      createdAt: Date.now(),
      email: "demo@otopair.com",
      phone: "(512) 555-9999",
      first_name: "Alex",
      last_name: "Rivera",
      created_at: new Date().toISOString(),
    });

    // 2018 Toyota Camry LE
    const now = Date.now();
    const vin = "4T1B11HK5JU123456";
    await ctx.db.insert("vehicles", {
      vin,
      engine_id: engine._id,
      year: 2018,
      created_at: now,
      updated_at: now,
    });

    await ctx.db.insert("vehicle_owners", {
      vin,
      user_id: userId,
      status: "active",
      nickname: "My Camry",
      is_primary: true,
      mileage: 72000,
      added_at: now,
    });

    return { success: true };
  },
});

export const seedTimeSlots = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Delete all existing time_slots
    const existingSlots = await ctx.db.query("time_slots").collect();
    for (const slot of existingSlots) {
      await ctx.db.delete(slot._id);
    }

    // 2. Load all active mechanics and all shop_hours
    const allMechanics = await ctx.db.query("mechanics").collect();
    const activeMechanics = allMechanics.filter((m) => m.is_active);
    const allShopHours = await ctx.db.query("shops_hours").collect();

    // 3. Build lookup: shopId → dbDayOfWeek → { open_time, close_time, is_closed }
    const hoursMap: Record<string, Record<number, { open_time?: string; close_time?: string; is_closed: boolean }>> = {};
    for (const h of allShopHours) {
      const shopKey = h.shop_id as string;
      if (!hoursMap[shopKey]) hoursMap[shopKey] = {};
      hoursMap[shopKey][h.day_of_week] = {
        open_time: h.open_time,
        close_time: h.close_time,
        is_closed: h.is_closed,
      };
    }

    // 4. For each mechanic → next 7 days → generate 1-hour slots
    const today = new Date();
    let totalCreated = 0;

    for (const mechanic of activeMechanics) {
      const shopKey = mechanic.shop_id as string;
      const shopHours = hoursMap[shopKey];
      if (!shopHours) continue;

      for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
        const date = new Date(today);
        date.setDate(date.getDate() + dayOffset);
        const dateStr = date.toISOString().split("T")[0];

        // Convert JS getDay() (0=Sun) to DB convention (0=Mon, 6=Sun)
        const jsDay = date.getDay();
        const dbDay = (jsDay + 6) % 7;

        const dayHours = shopHours[dbDay];
        if (!dayHours || dayHours.is_closed) continue;

        const openTime = dayHours.open_time;
        const closeTime = dayHours.close_time;
        if (!openTime || !closeTime) continue;

        // Parse hours
        const [openH, openM] = openTime.split(":").map(Number);
        const [closeH] = closeTime.split(":").map(Number);

        // Round up to nearest hour if minutes > 0
        const firstSlotHour = openM > 0 ? openH + 1 : openH;

        for (let hour = firstSlotHour; hour < closeH; hour++) {
          const startTime = `${hour.toString().padStart(2, "0")}:00`;
          const endTime = `${(hour + 1).toString().padStart(2, "0")}:00`;

          await ctx.db.insert("time_slots", {
            shop_id: mechanic.shop_id,
            mechanic_id: mechanic._id,
            date: dateStr,
            start_time: startTime,
            end_time: endTime,
            is_available: true,
          });
          totalCreated++;
        }
      }
    }

    return { success: true, slotsCreated: totalCreated };
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    await clearTables(ctx);

    const now = Date.now();

    // --- Makes ---
    const toyotaId = await ctx.db.insert("makes", {
      name: "Toyota",
      logo_url: "https://upload.wikimedia.org/wikipedia/commons/9/9d/Toyota_carridge_logo.svg",
    });

    const hondaId = await ctx.db.insert("makes", {
      name: "Honda",
      logo_url: "https://upload.wikimedia.org/wikipedia/commons/7/7b/Honda-logo.svg",
    });

    // --- Models ---
    const camryId = await ctx.db.insert("models", {
      make_id: toyotaId,
      name: "Camry",
    });

    const accordId = await ctx.db.insert("models", {
      make_id: hondaId,
      name: "Accord",
    });

    // --- Trims ---
    const leId = await ctx.db.insert("trims", {
      model_id: camryId,
      name: "LE",
      year_start: 2018,
      year_end: 2024,
    });

    const seId = await ctx.db.insert("trims", {
      model_id: camryId,
      name: "SE",
      year_start: 2018,
      year_end: 2024,
    });

    const sportId = await ctx.db.insert("trims", {
      model_id: accordId,
      name: "Sport",
      year_start: 2019,
      year_end: 2024,
    });

    // --- Engines ---
    const engineLeId = await ctx.db.insert("engines", {
      trim_id: leId,
      engine_code: "A25A-FKS",
      displacement_liters: "2.5",
      cylinders: 4,
      fuel_type: "Gasoline",
    });

    const engineSeId = await ctx.db.insert("engines", {
      trim_id: seId,
      engine_code: "A25A-FKS",
      displacement_liters: "2.5",
      cylinders: 4,
      fuel_type: "Gasoline",
    });

    const engineAccordId = await ctx.db.insert("engines", {
      trim_id: sportId,
      engine_code: "L15BE",
      displacement_liters: "1.5",
      cylinders: 4,
      fuel_type: "Gasoline",
    });

    // --- Vehicle Specs ---
    await ctx.db.insert("vehicle_specs", {
      engine_id: engineLeId,
      oil_viscocity: "0W-20",
      oil_capacity_qts: "4.8",
      oil_filter_oem: "90915-YZZD4",
      front_brake_pad_oem: "04465-06200",
      rear_brake_pad_oem: "04466-06210",
      parking_brake_type: "Drum-in-hat",
      battery_group: "35",
      battery_cca: 550,
    });

    await ctx.db.insert("vehicle_specs", {
      engine_id: engineSeId,
      oil_viscocity: "0W-20",
      oil_capacity_qts: "4.8",
      oil_filter_oem: "90915-YZZD4",
      front_brake_pad_oem: "04465-06200",
      rear_brake_pad_oem: "04466-06210",
      parking_brake_type: "Drum-in-hat",
      battery_group: "35",
      battery_cca: 550,
    });

    await ctx.db.insert("vehicle_specs", {
      engine_id: engineAccordId,
      oil_viscocity: "0W-20",
      oil_capacity_qts: "3.7",
      oil_filter_oem: "15400-PLM-A02",
      front_brake_pad_oem: "45022-TVA-A00",
      rear_brake_pad_oem: "43022-TVA-A00",
      parking_brake_type: "Electric",
      battery_group: "51R",
      battery_cca: 500,
    });

    // --- Service Categories ---
    const maintenanceId = await ctx.db.insert("service_categories", {
      name: "Maintenance",
      icon_name: "wrench",
      display_order: 1,
    });

    const brakesId = await ctx.db.insert("service_categories", {
      name: "Brakes",
      icon_name: "disc",
      display_order: 2,
    });

    // --- Services ---
    const oilChangeId = await ctx.db.insert("services", {
      name: "Oil Change",
      slug: "oil-change",
      description: "Full synthetic oil change with filter replacement",
      service_category_id: maintenanceId,
      default_labor_hours: 0.5,
      is_labor_only: false,
      has_options: true,
      display_order: 1,
    });

    const brakePadsId = await ctx.db.insert("services", {
      name: "Brake Pad Replacement",
      slug: "brake-pads",
      description: "Replace front or rear brake pads",
      service_category_id: brakesId,
      default_labor_hours: 1.5,
      is_labor_only: false,
      has_options: true,
      display_order: 2,
    });

    const tireRotationId = await ctx.db.insert("services", {
      name: "Tire Rotation",
      slug: "tire-rotation",
      description: "Rotate tires for even wear",
      service_category_id: maintenanceId,
      default_labor_hours: 0.5,
      is_labor_only: true,
      has_options: false,
      display_order: 3,
    });

    // --- Service Options ---
    await ctx.db.insert("service_options", {
      service_id: oilChangeId,
      option_type: "oil_type",
      option_label: "Full Synthetic",
      parts_cost_low: 35,
      parts_cost_high: 55,
      labor_hours: 0.5,
      display_order: 1,
    });

    await ctx.db.insert("service_options", {
      service_id: oilChangeId,
      option_type: "oil_type",
      option_label: "Conventional",
      parts_cost_low: 20,
      parts_cost_high: 35,
      labor_hours: 0.5,
      display_order: 2,
    });

    await ctx.db.insert("service_options", {
      service_id: brakePadsId,
      option_type: "position",
      option_label: "Front Brake Pads",
      parts_cost_low: 40,
      parts_cost_high: 80,
      labor_hours: 1.5,
      display_order: 1,
    });

    await ctx.db.insert("service_options", {
      service_id: brakePadsId,
      option_type: "position",
      option_label: "Rear Brake Pads",
      parts_cost_low: 35,
      parts_cost_high: 70,
      labor_hours: 1.5,
      display_order: 2,
    });

    // --- Service Vehicle Specs ---
    await ctx.db.insert("service_vehicle_specs", {
      service_id: oilChangeId,
      engine_id: engineLeId,
      labor_hours: 0.5,
      parts_cost_low: 35,
      parts_cost_high: 55,
      tech_notes: "Uses 0W-20 full synthetic. Drain plug torque: 27 ft-lb.",
      confidence_score: 0.95,
    });

    await ctx.db.insert("service_vehicle_specs", {
      service_id: brakePadsId,
      engine_id: engineLeId,
      labor_hours: 1.5,
      parts_cost_low: 40,
      parts_cost_high: 80,
      tech_notes: "OEM pad part: 04465-06200. Rotor min thickness: 25mm.",
      confidence_score: 0.9,
    });

    await ctx.db.insert("service_vehicle_specs", {
      service_id: tireRotationId,
      engine_id: engineAccordId,
      labor_hours: 0.5,
      parts_cost_low: 0,
      parts_cost_high: 0,
      tech_notes: "Rotate tires in cross pattern. Check lug torque 80 ft-lb.",
      confidence_score: 0.85,
    });

    // --- Shops ---
    const shop1Id = await ctx.db.insert("shops", {
      name: "AutoPro Service Center",
      slug: "autopro-service-center",
      address: "1234 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      lat: 30.2672,
      lng: -97.7431,
      phone: "(512) 555-0100",
      rating: 4.8,
      review_count: 142,
      labor_rate: 95,
      is_active: true,
      is_verified: true,
    });

    const shop2Id = await ctx.db.insert("shops", {
      name: "QuickFix Auto",
      slug: "quickfix-auto",
      address: "5678 Congress Ave",
      city: "Austin",
      state: "TX",
      zip: "78704",
      lat: 30.25,
      lng: -97.75,
      phone: "(512) 555-0200",
      rating: 4.5,
      review_count: 89,
      labor_rate: 85,
      is_active: true,
      is_verified: true,
    });

    // --- Shop Hours (Mon-Sat for both shops) ---
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    for (const shopId of [shop1Id, shop2Id]) {
      for (let d = 0; d < 7; d++) {
        const isSunday = d === 6;
        await ctx.db.insert("shops_hours", {
          shop_id: shopId,
          day_of_week: d,
          day_name: dayNames[d],
          is_closed: isSunday,
          open_time: isSunday ? undefined : "08:00",
          close_time: isSunday ? undefined : "18:00",
        });
      }
    }

    // --- Shop Services ---
    await ctx.db.insert("shop_services", {
      shop_id: shop1Id,
      service_id: oilChangeId,
      is_offered: true,
    });
    await ctx.db.insert("shop_services", {
      shop_id: shop1Id,
      service_id: brakePadsId,
      is_offered: true,
    });
    await ctx.db.insert("shop_services", {
      shop_id: shop2Id,
      service_id: oilChangeId,
      is_offered: true,
    });
    await ctx.db.insert("shop_services", {
      shop_id: shop2Id,
      service_id: tireRotationId,
      is_offered: true,
    });

    // --- Mechanics ---
    const mech1Id = await ctx.db.insert("mechanics", {
      shop_id: shop1Id,
      first_name: "Mike",
      last_name: "Johnson",
      is_active: true,
      rating: 4.9,
      review_count: 87,
    });

    const mech2Id = await ctx.db.insert("mechanics", {
      shop_id: shop1Id,
      first_name: "Sarah",
      last_name: "Chen",
      is_active: true,
      rating: 4.7,
      review_count: 64,
    });

    const mech3Id = await ctx.db.insert("mechanics", {
      shop_id: shop2Id,
      first_name: "James",
      last_name: "Rodriguez",
      is_active: true,
      rating: 4.6,
      review_count: 51,
    });

    // --- Time Slots (next 3 days, 6 slots/day for shop 1) ---
    const today = new Date();
    for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset + 1);
      const dateStr = date.toISOString().split("T")[0];

      const startHours = [8, 9, 10, 11, 13, 14];
      for (const hour of startHours) {
        const startTime = `${hour.toString().padStart(2, "0")}:00`;
        const endTime = `${(hour + 1).toString().padStart(2, "0")}:00`;

        await ctx.db.insert("time_slots", {
          shop_id: shop1Id,
          mechanic_id: mech1Id,
          date: dateStr,
          start_time: startTime,
          end_time: endTime,
          is_available: true,
        });
      }
    }

    // --- Users ---
    const userId = await ctx.db.insert("users", {
      clerkUserId: "seed-demo-user-2",
      onboardingCompleted: true,
      createdAt: Date.now(),
      email: "demo@otopair.com",
      phone: "(512) 555-9999",
      first_name: "Alex",
      last_name: "Demo",
      created_at: new Date().toISOString(),
    });

    const user2Id = await ctx.db.insert("users", {
      clerkUserId: "seed-demo-user-3",
      onboardingCompleted: true,
      createdAt: Date.now(),
      email: "jordan@otopair.com",
      phone: "(512) 555-1111",
      first_name: "Jordan",
      last_name: "Lee",
      created_at: new Date().toISOString(),
    });

    // --- Vehicles (canonical VINs) ---
    const vinCamry = "4T1B11HK5JU123456";
    const vinAccord = "1HGCV1F39KA123456";

    await ctx.db.insert("vehicles", {
      vin: vinCamry,
      trim_id: leId,
      engine_id: engineLeId,
      year: 2022,
      metadata: { color: "Silver", body_style: "Sedan" },
      created_at: now,
      updated_at: now,
    });

    await ctx.db.insert("vehicles", {
      vin: vinAccord,
      trim_id: sportId,
      engine_id: engineAccordId,
      year: 2021,
      metadata: { color: "Black", body_style: "Sedan" },
      created_at: now,
      updated_at: now,
    });

    // --- Vehicle Owners (multi-owner demo) ---
    await ctx.db.insert("vehicle_owners", {
      vin: vinCamry,
      user_id: userId,
      status: "active",
      nickname: "My Camry",
      is_primary: true,
      mileage: 35000,
      added_at: now,
    });

    await ctx.db.insert("vehicle_owners", {
      vin: vinCamry,
      user_id: user2Id,
      status: "active",
      nickname: "Shared Camry",
      is_primary: false,
      mileage: 35200,
      added_at: now,
    });

    await ctx.db.insert("vehicle_owners", {
      vin: vinAccord,
      user_id: user2Id,
      status: "active",
      nickname: "My Accord",
      is_primary: true,
      mileage: 22000,
      added_at: now,
    });

    // --- Onboarding Questions + Answers ---
    const q1Id = await ctx.db.insert("onboarding_questions", {
      question_text: "How often do you service your car?",
      question_type: "single_select",
      display_order: 1,
      rank: 1,
      step_name: "maintenance",
      is_active: true,
    });

    const a1Id = await ctx.db.insert("onboarding_question_answers", {
      question_id: q1Id,
      answer_text: "Every 3 months",
      answer_value: "quarterly",
      display_order: 1,
      emoji: "🛠️",
    });

    await ctx.db.insert("user_question_answers", {
      user_id: userId,
      question_id: q1Id,
      answer_id: a1Id,
      answered_at: now,
    });

    // --- Booking + Payment + Status History ---
    const slot = await ctx.db.query("time_slots").collect();
    const timeSlot = slot[0];
    if (!timeSlot) throw new Error("No time slots available after seed");

    const bookingId = await ctx.db.insert("bookings", {
      user_id: userId,
      vin: vinCamry,
      shop_id: shop1Id,
      mechanic_id: mech2Id,
      service_id: oilChangeId,
      time_slot_id: timeSlot._id,
      scheduled_date: timeSlot.date,
      scheduled_time: timeSlot.start_time,
      labor_cost: 47.5,
      parts_cost: 45,
      total_cost: 92.5,
      status: "confirmed",
      created_at: now,
      updated_at: now,
    });

    await ctx.db.insert("booking_status_history", {
      booking_id: bookingId,
      old_status: undefined,
      new_status: "confirmed",
      changed_by: userId,
      reason: "seeded",
      changed_at: now,
    });

    const paymentId = await ctx.db.insert("payments", {
      booking_id: bookingId,
      user_id: userId,
      shop_id: shop1Id,
      amount: 92.5,
      payment_method: "card",
      status: "completed",
      transaction_id: "txn_seed_001",
      stripe_payment_intent_id: "pi_seed_001",
      idempotency_key: "seed_001",
      created_at: now,
      updated_at: now,
    });

    await ctx.db.insert("payment_status_history", {
      payment_id: paymentId,
      old_status: "processing",
      new_status: "completed",
      error_code: undefined,
      error_message: undefined,
      changed_at: now,
    });

    // --- Job Actuals ---
    const jobActualId = await ctx.db.insert("job_actuals", {
      booking_id: bookingId,
      mechanic_id: mech2Id,
      actual_labor_minutes: 30,
      actual_parts_cost: 42,
      started_at: now - 30 * 60 * 1000,
      completed_at_ms: now - 5 * 60 * 1000,
      logged_at_ms: now,
      created_at: now,
      updated_at: now,
      difficulty_rating: 2,
      parts_used: [
        { part_name: "Oil Filter", oem_number: "90915-YZZD4", cost: 12 },
      ],
      technician_notes: "Standard oil change completed.",
    });

    // --- Review ---
    await ctx.db.insert("reviews", {
      booking_id: bookingId,
      shop_id: shop1Id,
      user_id: userId,
      mechanic_id: mech2Id,
      rating: 5,
      comment: "Great service!",
      created_at: now,
    });

    // --- Follow-up ---
    await ctx.db.insert("follow_ups", {
      user_id: userId,
      vin: vinCamry,
      booking_id: bookingId,
      service_id: oilChangeId,
      follow_up_type: "maintenance_due",
      scheduled_for: now + 90 * 24 * 60 * 60 * 1000,
      status: "pending",
      message: "Time to schedule your next oil change",
      created_at: now,
    });

    // --- AI Conversations + Messages ---
    const convoId = await ctx.db.insert("ai_conversations", {
      user_id: userId,
      started_at: now - 10 * 60 * 1000,
      ended_at: now - 5 * 60 * 1000,
      scenario_detected: "price_check",
      led_to_booking: true,
      booking_id: bookingId,
      message_count: 2,
      session_id: "seed-session-001",
    });

    await ctx.db.insert("ai_messages", {
      conversation_id: convoId,
      role: "user",
      content: "How much is an oil change?",
      timestamp: now - 9 * 60 * 1000,
    });

    await ctx.db.insert("ai_messages", {
      conversation_id: convoId,
      role: "assistant",
      content: "Most oil changes range from $70-$110 for synthetic.",
      timestamp: now - 8 * 60 * 1000,
      confidence_score: 0.88,
    });

    // --- Analytics Events ---
    await ctx.db.insert("analytics_events", {
      user_id: userId,
      event_type: "booking_created",
      event_category: "booking",
      event_data: {
        booking_id: bookingId,
        shop_id: shop1Id,
        service_id: oilChangeId,
        screen_name: "BookingConfirmation",
      },
      timestamp: now,
      session_id: "seed-session-001",
    });

    // --- Conversion Funnel ---
    await ctx.db.insert("conversion_funnels", {
      user_id: userId,
      funnel_type: "booking_flow",
      stage: "completed",
      booking_id: bookingId,
      entered_at: now - 30 * 60 * 1000,
      exited_at: now - 25 * 60 * 1000,
      completed: true,
      drop_off_reason: undefined,
    });

    // --- Service Insights ---
    await ctx.db.insert("service_insights", {
      engine_id: engineLeId,
      service_id: oilChangeId,
      avg_actual_labor_hours: 0.5,
      avg_actual_parts_cost: 42,
      completed_jobs_count: 10,
      confidence_level: 0.9,
      estimated_labor_hours: 0.5,
      labor_variance: 0.02,
    });

    // --- AI Enrichment Logs + Manual Review Queue ---
    const enrichLogId = await ctx.db.insert("ai_enrichment_logs", {
      engine_id: engineLeId,
      service_id: oilChangeId,
      source: "openai",
      confidence_score: 0.65,
      enriched_data: {
        labor_hours: 0.6,
        parts_cost_low: 35,
        parts_cost_high: 55,
        tech_notes: "Standard synthetic oil change",
      },
      created_at: now,
      review_status: "pending",
      reviewed_by: undefined,
    });

    await ctx.db.insert("manual_review_queue", {
      engine_id: engineLeId,
      service_id: oilChangeId,
      enrichment_log_id: enrichLogId,
      priority: "medium",
      reason: "low_confidence",
      status: "pending",
      assigned_to: undefined,
      created_at: now,
      resolved_at: undefined,
    });

    // --- Spec Variances ---
    await ctx.db.insert("spec_variances", {
      engine_id: engineLeId,
      service_id: oilChangeId,
      job_actual_id: jobActualId,
      predicted_labor_hours: 0.5,
      actual_labor_hours: 0.5,
      predicted_parts_cost: 45,
      actual_parts_cost: 42,
      variance_percentage: -6.7,
      flagged_for_review: false,
      reviewed_at: undefined,
      notes: undefined,
      created_at: now,
    });

    // --- Spec Confirmations ---
    await ctx.db.insert("spec_confirmations", {
      user_id: userId,
      engine_id: engineLeId,
      service_id: oilChangeId,
      booking_id: bookingId,
      confirmed_accurate: true,
      feedback: "Specs matched my vehicle.",
      confirmed_at: now,
    });

    return { success: true };
  },
});

export const seedLearningPipelineDemo = mutation({
  args: {},
  handler: async (ctx) => {
    // 1. Clean existing demo bookings (confirmed/in_progress) + their job_actuals + service_insights
    const allBookings = await ctx.db.query("bookings").collect();
    const demoBookings = allBookings.filter(
      (b) => b.status === "confirmed" || b.status === "in_progress"
    );
    for (const b of demoBookings) {
      const allActuals = await ctx.db.query("job_actuals").collect();
      const related = allActuals.filter((ja) => ja.booking_id === b._id);
      for (const ja of related) {
        await ctx.db.delete(ja._id);
      }
      await ctx.db.delete(b._id);
    }

    // Clean service_insights so each demo run starts fresh
    const allInsights = await ctx.db.query("service_insights").collect();
    for (const si of allInsights) {
      await ctx.db.delete(si._id);
    }

    // 2. Look up existing entities
    const users = await ctx.db.query("users").collect();
    const user = users.find((u) => u.email === "demo@otopair.com");
    if (!user) throw new Error("Demo user not found. Run seed first.");

    const owners = await ctx.db.query("vehicle_owners").collect();
    const owner = owners.find((o) => o.user_id === user._id && o.status === "active");
    if (!owner) throw new Error("Demo vehicle owner not found. Run seed first.");

    const vehicle = await ctx.db
      .query("vehicles")
      .withIndex("by_vin", (q) => q.eq("vin", owner.vin))
      .unique();
    if (!vehicle) throw new Error("Demo vehicle not found. Run seed first.");

    const services = await ctx.db.query("services").collect();
    const oilChange = services.find((s) => s.slug === "oil-change");
    if (!oilChange) throw new Error("Oil Change service not found. Run seed first.");

    const shops = await ctx.db.query("shops").collect();
    const activeShops = shops.filter((s) => s.is_active);
    if (activeShops.length === 0) throw new Error("No active shop found. Run seed first.");

    const mechanics = await ctx.db.query("mechanics").collect();

    // Find a shop that has an active mechanic
    let shop = activeShops[0];
    let mechanic = mechanics.find((m) => m.shop_id === shop._id && m.is_active);

    for (const s of activeShops) {
      const m = mechanics.find((m) => m.shop_id === s._id && m.is_active);
      if (m) {
        shop = s;
        mechanic = m;
        break;
      }
    }
    if (!mechanic) throw new Error("No active mechanic found at any shop.");

    // 3. Find or create an available time slot
    const allSlots = await ctx.db.query("time_slots").collect();
    let slot: (typeof allSlots)[number] | null =
      allSlots.find((s) => s.shop_id === shop._id && s.is_available) ?? null;

    if (!slot) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split("T")[0];

      const slotId = await ctx.db.insert("time_slots", {
        shop_id: shop._id,
        mechanic_id: mechanic._id,
        date: dateStr,
        start_time: "10:00",
        end_time: "11:00",
        is_available: true,
      });
      slot = await ctx.db.get(slotId);
    }

    if (!slot) throw new Error("Failed to find or create time slot");

    // Mark slot as unavailable
    await ctx.db.patch(slot._id, { is_available: false });

    // 4. Insert a confirmed booking
    const laborHours = oilChange.default_labor_hours;
    const laborCost = laborHours * shop.labor_rate;
    const partsCost = 47;
    const totalCost = laborCost + partsCost;

    const bookingId = await ctx.db.insert("bookings", {
      user_id: user._id,
      vin: vehicle.vin,
      shop_id: shop._id,
      mechanic_id: mechanic._id,
      service_id: oilChange._id,
      time_slot_id: slot._id,
      scheduled_date: slot.date,
      scheduled_time: slot.start_time,
      labor_cost: laborCost,
      parts_cost: partsCost,
      total_cost: totalCost,
      status: "confirmed",
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    const engine = vehicle.engine_id ? await ctx.db.get(vehicle.engine_id) : null;

    return {
      success: true,
      bookingId,
      engineId: vehicle.engine_id,
      mechanicId: mechanic._id,
      summary: `Booking created: Oil Change for ${engine?.engine_code ?? "unknown"} at ${shop.name} with ${mechanic.first_name} ${mechanic.last_name}`,
    };
  },
});
