import { action, internalMutation, mutation } from "./_generated/server";
import { api, internal } from "./_generated/api";

/**
 * Seed creates a demo user with clerkUserId "seed-demo-user-2". When you sign in with the
 * Clerk account from .env.local (EXPO_PUBLIC_GUEST_EMAIL / EXPO_PUBLIC_GUEST_PASSWORD),
 * claimSeedDataForCurrentUser runs and reassigns that seed user's data to your account.
 */
const SEED_DEMO_CLERK_USER_ID = "seed-demo-user-2";

const TABLES_TO_CLEAR = [
  "booking_status_history",
  "payment_status_history",
  "job_actuals",
  "reviews",
  "transactions",
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
  "shop_portfolio",
  "shop_services",
  "time_slots",
  "shops_hours",
  "mechanics",
  "shops",
  "cdn_assets",
  "service_vehicle_specs",
  "service_options",
  "services",
  "service_categories",
  "vehicle_specs",
  "engine_part_fitments",
  "transmission_part_fitments",
  "trim_part_fitments",
  "engine_specs",
  "transmission_specs",
  "trim_specs",
  "oem_parts",
  "chassis_variants",
  "transmissions",
  "engines",
  "trims",
  "models",
  "makes",
  "vehicle_owners",
  "vehicles",
  "onboarding_questions_answers",
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

    // Demo user (claimSeedDataForCurrentUser reassigns to signed-in guest account)
    const userId = await ctx.db.insert("users", {
      clerkUserId: SEED_DEMO_CLERK_USER_ID,
      onboardingCompleted: true,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      email: "demo@otopair.com",
      phone: "(512) 555-9999",
      first_name: "Alex",
      last_name: "Rivera",
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

/**
 * Reassigns all seed demo user data to the currently signed-in user (e.g. guest account from
 * .env.local). Run seed first, then sign in with EXPO_PUBLIC_GUEST_EMAIL / EXPO_PUBLIC_GUEST_PASSWORD;
 * this mutation is called on sign-in so the guest account gets vehicles, bookings, etc.
 * Idempotent: if current user already has data or no seed user exists, no-op.
 */
export const claimSeedDataForCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { claimed: false, reason: "not_authenticated" as const };

    const clerkUserId = identity.subject;
    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();
    if (!currentUser) return { claimed: false, reason: "current_user_not_found" as const };

    const myOwners = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_user_id", (q) => q.eq("user_id", currentUser._id))
      .collect();
    if (myOwners.length > 0) return { claimed: false, reason: "already_has_data" as const };

    const seedUser = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", SEED_DEMO_CLERK_USER_ID))
      .unique();
    if (!seedUser) return { claimed: false, reason: "no_seed_user" as const };

    const seedId = seedUser._id;
    const currentId = currentUser._id;

    const reassign = async (
      table:
        | "vehicle_owners"
        | "bookings"
        | "payments"
        | "reviews"
        | "onboarding_questions_answers"
        | "follow_ups"
        | "ai_conversations"
        | "conversion_funnels"
        | "spec_confirmations"
        | "user_reward_wallets"
        | "ownership_credit_transactions"
        | "user_contribution_claims"
        | "vehicle_tiers"
    ) => {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        if (row.user_id === seedId) await ctx.db.patch(row._id, { user_id: currentId });
      }
    };
    await reassign("vehicle_owners");
    await reassign("bookings");
    await reassign("payments");
    await reassign("reviews");
    await reassign("onboarding_questions_answers");
    await reassign("follow_ups");
    await reassign("ai_conversations");
    await reassign("conversion_funnels");
    await reassign("spec_confirmations");
    await reassign("user_reward_wallets");
    await reassign("ownership_credit_transactions");
    await reassign("user_contribution_claims");
    await reassign("vehicle_tiers");

    // Give claimed user a reward wallet with demo balance if none exists
    const wallet = await ctx.db
      .query("user_reward_wallets")
      .withIndex("by_user_id", (q) => q.eq("user_id", currentId))
      .unique();
    if (!wallet) {
      const now = Date.now();
      await ctx.db.insert("user_reward_wallets", {
        user_id: currentId,
        balance: 32.75,
        auto_apply_to_booking: true,
        created_at: now,
        updated_at: now,
      });
      await ctx.db.insert("ownership_credit_transactions", {
        user_id: currentId,
        amount: 32.75,
        type: "earn_service",
        description: "Maintenance rewards",
        created_at: now,
      });
    }

    const analyticsRows = await ctx.db.query("analytics_events").collect();
    for (const row of analyticsRows) {
      if (row.user_id === seedId) await ctx.db.patch(row._id, { user_id: currentId });
    }

    const statusHistoryRows = await ctx.db.query("booking_status_history").collect();
    for (const row of statusHistoryRows) {
      if (row.changed_by === seedId) await ctx.db.patch(row._id, { changed_by: currentId });
    }

    const enrichRows = await ctx.db.query("ai_enrichment_logs").collect();
    for (const row of enrichRows) {
      if (row.reviewed_by === seedId) await ctx.db.patch(row._id, { reviewed_by: currentId });
    }

    const reviewQueueRows = await ctx.db.query("manual_review_queue").collect();
    for (const row of reviewQueueRows) {
      if (row.assigned_to === seedId) await ctx.db.patch(row._id, { assigned_to: currentId });
    }

    await ctx.db.delete(seedId);
    return { claimed: true };
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
    const hoursMap: Record<
      string,
      Record<number, { open_time?: string; close_time?: string; is_closed: boolean }>
    > = {};
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

        // Schema: 0=Sunday, 1=Monday, ... 6=Saturday (same as JS getDay())
        const dbDay = date.getDay();

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

/**
 * One-command seed: runs base seed, vehicle intelligence (OEM parts, fitments, specs),
 * then regenerates time slots. Use: npx convex run seed:seedAll
 */
export const seedAll = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(api.seed.seed);
    await ctx.runMutation(internal.seed.seedVehicleIntelligenceDemoData);
    const result = await ctx.runMutation(api.seed.seedTimeSlots);
    await ctx.runMutation(api.seed.seedRewardDeals);
    return { success: true, ...result };
  },
});

/**
 * Seeds reward_deals for OTOPAIR Rewards Program. Idempotent - skips if deals exist.
 */
export const seedRewardDeals = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("reward_deals").first();
    if (existing) return { skipped: true };

    const now = Date.now();
    const deals = [
      {
        title: "Synthetic Oil Change",
        description: "Full synthetic + Filter + Fluids",
        credit_amount: 15,
        price: 69,
        is_special: true,
        display_order: 0,
      },
      {
        title: "Tire Rotation",
        description: "Rotate all 4 tires + Inspection",
        credit_amount: 10,
        price: 29,
        is_special: false,
        display_order: 1,
      },
      {
        title: "Brake Inspection",
        description: "Full brake system check",
        credit_amount: 12,
        price: 49,
        is_special: true,
        display_order: 2,
      },
      {
        title: "AC System Service",
        description: "Recharge + Leak check + Filter",
        credit_amount: 20,
        price: 89,
        is_special: false,
        display_order: 3,
      },
      {
        title: "Full Detail Package",
        description: "Interior + Exterior + Engine bay",
        credit_amount: 25,
        price: 149,
        is_special: true,
        display_order: 4,
      },
    ];
    for (const d of deals) {
      await ctx.db.insert("reward_deals", { ...d, created_at: now });
    }
    return { skipped: false, count: deals.length };
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    await clearTables(ctx);

    const now = Date.now();

    // --- Makes (logo stored in cdn_assets, makes reference by id) ---
    const toyotaLogoId = await ctx.db.insert("cdn_assets", {
      url: "https://upload.wikimedia.org/wikipedia/commons/9/9d/Toyota_carridge_logo.svg",
    });
    const toyotaId = await ctx.db.insert("makes", {
      name: "Toyota",
      logo: toyotaLogoId,
    });

    const hondaLogoId = await ctx.db.insert("cdn_assets", {
      url: "https://upload.wikimedia.org/wikipedia/commons/7/7b/Honda-logo.svg",
    });
    const hondaId = await ctx.db.insert("makes", {
      name: "Honda",
      logo: hondaLogoId,
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

    // --- Engine Specs (oil, fluids, maintenance intervals) ---
    await ctx.db.insert("engine_specs", {
      engine_id: engineLeId,
      oil_viscosity: "0W-20",
      oil_capacity_qts: 4.8,
      coolant_type: "Toyota Super Long Life",
      coolant_capacity_qts: 9.2,
      brake_fluid_type: "DOT 3",
      oil_change_interval: "10,000 miles / 12 months",
      cabin_air_filter_interval: "15,000 miles",
      engine_air_filter_interval: "15,000 miles",
      tire_rotation_interval: "5,000 miles",
      confidence_score: 0.93,
      created_at: now,
    });

    await ctx.db.insert("engine_specs", {
      engine_id: engineSeId,
      oil_viscosity: "0W-20",
      oil_capacity_qts: 4.8,
      coolant_type: "Toyota Super Long Life",
      coolant_capacity_qts: 9.2,
      brake_fluid_type: "DOT 3",
      oil_change_interval: "10,000 miles / 12 months",
      tire_rotation_interval: "5,000 miles",
      confidence_score: 0.93,
      created_at: now,
    });

    await ctx.db.insert("engine_specs", {
      engine_id: engineAccordId,
      oil_viscosity: "0W-20",
      oil_capacity_qts: 3.7,
      coolant_type: "Honda Type 2",
      brake_fluid_type: "DOT 3",
      oil_change_interval: "7,500 miles / 12 months",
      tire_rotation_interval: "7,500 miles",
      confidence_score: 0.9,
      created_at: now,
    });

    // --- Vehicle Specs (OEM part numbers for job_actuals suggested parts) ---
    await ctx.db.insert("vehicle_specs", {
      engine_id: engineLeId,
      oil_viscocity: "0W-20",
      oil_capacity_qts: "4.8",
      oil_filter_oem: "90915-YZZD4",
      oil_drain_plug_gasket_oem: "90430-12031",
      front_brake_pad_oem: "04465-06200",
      rear_brake_pad_oem: "04466-06210",
      front_brake_rotor_oem: "43512-06820",
      rear_brake_rotor_oem: "42431-06930",
      parking_brake_type: "Drum-in-hat",
      battery_group: "35",
      battery_cca: 550,
      engine_air_filter_oem: "17801-0H050",
      cabin_air_filter_oem: "87139-07010",
      spark_plug_oem: "90919-01253",
      spark_plug_quantity: 4,
      spark_plug_gap_mm: 1.0,
      serpentine_belt_oem: "90916-02536",
    });

    await ctx.db.insert("vehicle_specs", {
      engine_id: engineSeId,
      oil_viscocity: "0W-20",
      oil_capacity_qts: "4.8",
      oil_filter_oem: "90915-YZZD4",
      oil_drain_plug_gasket_oem: "90430-12031",
      front_brake_pad_oem: "04465-06200",
      rear_brake_pad_oem: "04466-06210",
      front_brake_rotor_oem: "43512-06820",
      rear_brake_rotor_oem: "42431-06930",
      parking_brake_type: "Drum-in-hat",
      battery_group: "35",
      battery_cca: 550,
      engine_air_filter_oem: "17801-0H050",
      cabin_air_filter_oem: "87139-07010",
      spark_plug_oem: "90919-01253",
      spark_plug_quantity: 4,
      spark_plug_gap_mm: 1.0,
      serpentine_belt_oem: "90916-02536",
    });

    await ctx.db.insert("vehicle_specs", {
      engine_id: engineAccordId,
      oil_viscocity: "0W-20",
      oil_capacity_qts: "3.7",
      oil_filter_oem: "15400-PLM-A02",
      oil_drain_plug_gasket_oem: "94109-12000",
      front_brake_pad_oem: "45022-TVA-A00",
      rear_brake_pad_oem: "43022-TVA-A00",
      front_brake_rotor_oem: "45251-TVA-A00",
      rear_brake_rotor_oem: "43251-TVA-A00",
      parking_brake_type: "Electric",
      battery_group: "51R",
      battery_cca: 500,
      engine_air_filter_oem: "17220-5PC-A00",
      cabin_air_filter_oem: "80292-S5A-A01",
      spark_plug_oem: "98079-56805",
      spark_plug_quantity: 4,
      spark_plug_gap_mm: 0.9,
      serpentine_belt_oem: "38920-P5R-A01",
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

    // --- Shop Hours (Mon-Sat for both shops; schema: 0=Sunday, 1=Monday, ... 6=Saturday) ---
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    for (const shopId of [shop1Id, shop2Id]) {
      for (let d = 0; d < 7; d++) {
        const isSunday = d === 0;
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

    // --- Shop Services (both shops offer all services) ---
    for (const shopId of [shop1Id, shop2Id]) {
      await ctx.db.insert("shop_services", { shop_id: shopId, service_id: oilChangeId, is_offered: true });
      await ctx.db.insert("shop_services", { shop_id: shopId, service_id: brakePadsId, is_offered: true });
      await ctx.db.insert("shop_services", { shop_id: shopId, service_id: tireRotationId, is_offered: true });
    }

    // --- CDN assets (portfolio images) ---
    const asset1Id = await ctx.db.insert("cdn_assets", {
      url: "https://images.unsplash.com/photo-1486754735734-325b5831c3ad?w=800&h=600&fit=crop",
      type: "image",
      caption: "Shop bay",
    });
    const asset2Id = await ctx.db.insert("cdn_assets", {
      url: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop",
      type: "image",
      caption: "Service area",
    });
    const asset3Id = await ctx.db.insert("cdn_assets", {
      url: "https://images.unsplash.com/photo-1493238792000-8113da705763?w=800&h=600&fit=crop",
      type: "image",
      caption: "Waiting area",
    });

    // --- Shop portfolio (link shops to cdn_assets) ---
    for (const [order, assetId] of [asset1Id, asset2Id, asset3Id].entries()) {
      await ctx.db.insert("shop_portfolio", { shop_id: shop1Id, content_id: assetId, display_order: order });
      await ctx.db.insert("shop_portfolio", { shop_id: shop2Id, content_id: assetId, display_order: order });
    }

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
      title: "Master Mechanic",
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

    // --- Time Slots (next 7 days, multiple slots per mechanic) ---
    const today = new Date();
    const mechanicsWithSlots = [
      { shop_id: shop1Id, mechanic_id: mech1Id },
      { shop_id: shop1Id, mechanic_id: mech2Id },
      { shop_id: shop2Id, mechanic_id: mech3Id },
    ];
    const startHours = [8, 9, 10, 11, 13, 14, 15];

    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + dayOffset);
      const dateStr = date.toISOString().split("T")[0];

      for (const { shop_id, mechanic_id } of mechanicsWithSlots) {
        for (const hour of startHours) {
          const startTime = `${hour.toString().padStart(2, "0")}:00`;
          const endTime = `${(hour + 1).toString().padStart(2, "0")}:00`;
          await ctx.db.insert("time_slots", {
            shop_id,
            mechanic_id,
            date: dateStr,
            start_time: startTime,
            end_time: endTime,
            is_available: true,
          });
        }
      }
    }

    // --- Users (main demo user; claimSeedDataForCurrentUser reassigns to signed-in guest account) ---
    const userId = await ctx.db.insert("users", {
      clerkUserId: SEED_DEMO_CLERK_USER_ID,
      onboardingCompleted: true,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      email: "demo@otopair.com",
      phone: "(512) 555-9999",
      first_name: "Alex",
      last_name: "Demo",
    });

    const user2Id = await ctx.db.insert("users", {
      clerkUserId: "seed-demo-user-3",
      onboardingCompleted: true,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      email: "jordan@otopair.com",
      phone: "(512) 555-1111",
      first_name: "Jordan",
      last_name: "Lee",
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

    // --- Onboarding Q&A (unified table) ---
    await ctx.db.insert("onboarding_questions_answers", {
      user_id: userId,
      questions_and_answers: [{ question: "How often do you service your car?", answer: "Every 3 months" }],
      last_updated: now,
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
      service_ids: [oilChangeId],
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
      parts_used: [{ part_name: "Oil Filter", oem_number: "90915-YZZD4", cost: 12 }],
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
    const demoBookings = allBookings.filter((b) => b.status === "confirmed" || b.status === "in_progress");
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
    let slot: (typeof allSlots)[number] | null = allSlots.find((s) => s.shop_id === shop._id && s.is_available) ?? null;

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
      service_ids: [oilChange._id],
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

/**
 * Internal demo seed for vehicle intelligence tables (specs + fitments).
 *
 * Idempotently seeds a Camry LE powertrain with specs, fitments, and a demo VIN.
 */
export const seedVehicleIntelligenceDemoData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const ensureMake = async (name: string, logoUrl: string) => {
      const existing = (await ctx.db.query("makes").collect()).find((m) => m.name === name);
      if (existing) return existing;
      const logoId = await ctx.db.insert("cdn_assets", { url: logoUrl });
      const id = await ctx.db.insert("makes", { name, logo: logoId });
      return (await ctx.db.get(id))!;
    };

    const ensureModel = async (make_id: any, name: string) => {
      const existing = (await ctx.db.query("models").collect()).find((m) => m.make_id === make_id && m.name === name);
      if (existing) return existing;
      const id = await ctx.db.insert("models", { make_id, name });
      return (await ctx.db.get(id))!;
    };

    const ensureTrim = async (model_id: any, name: string, year_start: number, year_end: number) => {
      const existing = (await ctx.db.query("trims").collect()).find((t) => t.model_id === model_id && t.name === name);
      if (existing) return existing;
      const id = await ctx.db.insert("trims", { model_id, name, year_start, year_end });
      return (await ctx.db.get(id))!;
    };

    const ensureEngine = async (trim_id: any) => {
      const existing = (await ctx.db.query("engines").collect()).find(
        (e) => e.trim_id === trim_id && e.engine_code === "A25A-FKS"
      );
      if (existing) return existing;
      const id = await ctx.db.insert("engines", {
        trim_id,
        engine_code: "A25A-FKS",
        displacement_liters: "2.5",
        cylinders: 4,
        fuel_type: "Gasoline",
      });
      return (await ctx.db.get(id))!;
    };

    const ensureTransmission = async (trim_id: any) => {
      const existing = await ctx.db
        .query("transmissions")
        .withIndex("by_trim_type", (q) => q.eq("trim_id", trim_id).eq("transmission_type", "automatic"))
        .unique();
      if (existing) {
        const updates: Record<string, any> = {};
        if (!existing.code) updates.code = "UA80E";
        if (!existing.notes) updates.notes = "8-speed automatic";
        if (existing.confidence_score === undefined) updates.confidence_score = 0.9;
        if (Object.keys(updates).length > 0) {
          await ctx.db.patch(existing._id, updates);
        }
        return (await ctx.db.get(existing._id))!;
      }
      const id = await ctx.db.insert("transmissions", {
        trim_id,
        transmission_type: "automatic",
        code: "UA80E",
        notes: "8-speed automatic",
        confidence_score: 0.9,
        created_at: now,
      });
      return (await ctx.db.get(id))!;
    };

    const ensureChassisVariant = async (trim_id: any) => {
      const existing = await ctx.db
        .query("chassis_variants")
        .withIndex("by_trim_drivetrain", (q) => q.eq("trim_id", trim_id).eq("drivetrain_type", "fwd"))
        .unique();
      if (existing) {
        const updates: Record<string, any> = {};
        if (!existing.notes) updates.notes = "Front-wheel drive platform";
        if (existing.confidence_score === undefined) updates.confidence_score = 0.88;
        if (Object.keys(updates).length > 0) {
          await ctx.db.patch(existing._id, updates);
        }
        return (await ctx.db.get(existing._id))!;
      }
      const id = await ctx.db.insert("chassis_variants", {
        trim_id,
        drivetrain_type: "fwd",
        notes: "Front-wheel drive platform",
        confidence_score: 0.88,
        created_at: now,
      });
      return (await ctx.db.get(id))!;
    };

    const ensurePart = async (oem_part_number: string, name: string, category?: string, notes?: string) => {
      const existing = await ctx.db
        .query("oem_parts")
        .withIndex("by_part_number", (q) => q.eq("oem_part_number", oem_part_number))
        .unique();
      if (existing) return existing;
      const id = await ctx.db.insert("oem_parts", {
        oem_part_number,
        name,
        category,
        notes,
        created_at: now,
      });
      return (await ctx.db.get(id))!;
    };

    const ensureEngineSpecs = async (engine_id: any) => {
      const existing = await ctx.db
        .query("engine_specs")
        .withIndex("by_engine", (q) => q.eq("engine_id", engine_id))
        .unique();
      const payload = {
        oil_viscosity: "0W-20",
        oil_capacity_qts: 4.8,
        coolant_type: "Toyota Super Long Life",
        coolant_capacity_qts: 9.2,
        brake_fluid_type: "DOT 3",
        oil_change_interval: "10,000 miles / 12 months",
        cabin_air_filter_interval: "15,000 miles",
        engine_air_filter_interval: "15,000 miles",
        spark_plug_interval: "120,000 miles",
        serpentine_belt_interval: "90,000 miles",
        transmission_fluid_interval: "60,000 miles (inspect)",
        tire_rotation_interval: "5,000 miles",
        confidence_score: 0.93,
      };
      if (existing) {
        await ctx.db.patch(existing._id, payload);
        return (await ctx.db.get(existing._id))!;
      }
      const id = await ctx.db.insert("engine_specs", {
        ...payload,
        engine_id,
        created_at: now,
      });
      return (await ctx.db.get(id))!;
    };

    const ensureTransmissionSpecs = async (transmission_id: any) => {
      const existing = await ctx.db
        .query("transmission_specs")
        .withIndex("by_transmission", (q) => q.eq("transmission_id", transmission_id))
        .unique();
      const payload = {
        transmission_fluid_type: "Toyota WS ATF",
        transmission_fluid_capacity_qts: 7.6,
        maintenance_interval: "Inspect every 60,000 miles; service at 120,000 miles",
        confidence_score: 0.9,
      };
      if (existing) {
        await ctx.db.patch(existing._id, payload);
        return (await ctx.db.get(existing._id))!;
      }
      const id = await ctx.db.insert("transmission_specs", {
        ...payload,
        transmission_id,
        created_at: now,
      });
      return (await ctx.db.get(id))!;
    };

    const ensureTrimSpecs = async (trim_id: any) => {
      const existing = await ctx.db
        .query("trim_specs")
        .withIndex("by_trim", (q) => q.eq("trim_id", trim_id))
        .unique();
      const payload = {
        tire_size_front: "205/65R16",
        tire_size_rear: "205/65R16",
        recommended_tire_pressure_front_psi: 35,
        recommended_tire_pressure_rear_psi: 35,
        lug_nut_torque_ft_lbs: 76,
        wiper_blade_driver_size_in: 26,
        wiper_blade_passenger_size_in: 18,
        parking_brake_type: "drum-in-hat",
        confidence_score: 0.9,
      };
      if (existing) {
        await ctx.db.patch(existing._id, payload);
        return (await ctx.db.get(existing._id))!;
      }
      const id = await ctx.db.insert("trim_specs", {
        ...payload,
        trim_id,
        created_at: now,
      });
      return (await ctx.db.get(id))!;
    };

    const ensureEngineFitment = async (engine_id: any, role: string, part_id: any, extras: any) => {
      const existing = await ctx.db
        .query("engine_part_fitments")
        .withIndex("by_engine_role", (q) => q.eq("engine_id", engine_id).eq("role", role))
        .unique();
      const payload = {
        part_id,
        role,
        created_at: existing ? existing.created_at : now,
        ...extras,
      };
      if (existing) {
        await ctx.db.patch(existing._id, payload);
        return (await ctx.db.get(existing._id))!;
      }
      const id = await ctx.db.insert("engine_part_fitments", {
        engine_id,
        ...payload,
      });
      return (await ctx.db.get(id))!;
    };

    const ensureTransmissionFitment = async (transmission_id: any, role: string, part_id: any, extras: any) => {
      const existing = await ctx.db
        .query("transmission_part_fitments")
        .withIndex("by_transmission_role", (q) => q.eq("transmission_id", transmission_id).eq("role", role))
        .unique();
      const payload = { part_id, role, created_at: existing ? existing.created_at : now, ...extras };
      if (existing) {
        await ctx.db.patch(existing._id, payload);
        return (await ctx.db.get(existing._id))!;
      }
      const id = await ctx.db.insert("transmission_part_fitments", {
        transmission_id,
        ...payload,
      });
      return (await ctx.db.get(id))!;
    };

    const ensureTrimFitment = async (trim_id: any, role: string, part_id: any, extras: any) => {
      const existing = await ctx.db
        .query("trim_part_fitments")
        .withIndex("by_trim_role", (q) => q.eq("trim_id", trim_id).eq("role", role))
        .unique();
      const payload = { part_id, role, created_at: existing ? existing.created_at : now, ...extras };
      if (existing) {
        await ctx.db.patch(existing._id, payload);
        return (await ctx.db.get(existing._id))!;
      }
      const id = await ctx.db.insert("trim_part_fitments", {
        trim_id,
        ...payload,
      });
      return (await ctx.db.get(id))!;
    };

    const ensureVehicle = async (
      vin: string,
      fields: { trim_id: any; engine_id: any; transmission_id: any; chassis_id: any; year: number }
    ) => {
      const normalized = vin.toUpperCase().trim();
      const existing = await ctx.db
        .query("vehicles")
        .withIndex("by_vin", (q) => q.eq("vin", normalized))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          ...fields,
          updated_at: now,
        });
        return (await ctx.db.get(existing._id))!;
      }
      const id = await ctx.db.insert("vehicles", {
        vin: normalized,
        ...fields,
        created_at: now,
        updated_at: now,
      });
      return (await ctx.db.get(id))!;
    };

    // --- Hierarchy ---
    const make = await ensureMake(
      "Toyota",
      "https://upload.wikimedia.org/wikipedia/commons/9/9d/Toyota_carridge_logo.svg"
    );
    const model = await ensureModel(make._id, "Camry");
    const trim = await ensureTrim(model._id, "LE", 2018, 2024);
    const engine = await ensureEngine(trim._id);
    const transmission = await ensureTransmission(trim._id);
    const chassis = await ensureChassisVariant(trim._id);

    // --- Parts ---
    const oilFilter = await ensurePart("90915-YZZN1", "Engine Oil Filter", "filter", "Toyota OEM");
    const engineAirFilter = await ensurePart("17801-0H050", "Engine Air Filter", "filter");
    const cabinAirFilter = await ensurePart("87139-07010", "Cabin Air Filter", "filter");
    const atfFilter = await ensurePart("35330-33050", "ATF Filter Kit", "transmission");
    const battery = await ensurePart("35-AGM", "Group 35 AGM Battery", "battery");

    // --- Specs ---
    await ensureEngineSpecs(engine._id);
    await ensureTransmissionSpecs(transmission._id);
    await ensureTrimSpecs(trim._id);

    // --- Fitments ---
    await ensureEngineFitment(engine._id, "oil_filter", oilFilter._id, {
      quantity: 1,
      confidence_score: 0.92,
    });
    await ensureEngineFitment(engine._id, "engine_air_filter", engineAirFilter._id, {
      quantity: 1,
      confidence_score: 0.9,
    });
    await ensureEngineFitment(engine._id, "cabin_air_filter", cabinAirFilter._id, {
      quantity: 1,
      confidence_score: 0.9,
    });

    await ensureTransmissionFitment(transmission._id, "transmission_filter", atfFilter._id, {
      quantity: 1,
      confidence_score: 0.9,
    });

    await ensureTrimFitment(trim._id, "battery", battery._id, {
      quantity: 1,
      confidence_score: 0.9,
    });

    // --- Demo vehicle with VIN ---
    const vin = "4T1B11HK5JU123456";
    const vehicle = await ensureVehicle(vin, {
      trim_id: trim._id,
      engine_id: engine._id,
      transmission_id: transmission._id,
      chassis_id: chassis._id,
      year: 2018,
    });

    return {
      vin: vehicle.vin,
      trim_id: trim._id,
      engine_id: engine._id,
      transmission_id: transmission._id,
      chassis_id: chassis._id,
      parts_seeded: [oilFilter._id, engineAirFilter._id, cabinAirFilter._id, atfFilter._id, battery._id],
    };
  },
});

/** John Doe account: clerkUserId user_38uSI8ArZJ0HMY9AwvQLOZiIo53 */
const JOHN_DOE_CLERK_USER_ID = "user_38uSI8ArZJ0HMY9AwvQLOZiIo53";

/**
 * Seeds past (completed) bookings for the John Doe account so the History tab
 * shows data. Run: npx convex run seed:seedPastBookingsForJohnDoe
 */
export const seedPastBookingsForJohnDoe = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", JOHN_DOE_CLERK_USER_ID))
      .unique();
    if (!user) {
      throw new Error(
        `User with clerkUserId ${JOHN_DOE_CLERK_USER_ID} (John Doe) not found. Ensure the account exists.`
      );
    }

    const owners = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();
    let vin: string;
    if (owners.length > 0) {
      vin = owners[0].vin;
    } else {
      const vehicles = await ctx.db.query("vehicles").collect();
      if (vehicles.length === 0) throw new Error("No vehicles in DB. Run full seed first.");
      vin = vehicles[0].vin;
      await ctx.db.insert("vehicle_owners", {
        vin,
        user_id: user._id,
        status: "active",
        nickname: "My Car",
        is_primary: true,
        mileage: 40000,
        added_at: Date.now(),
      });
    }

    const shops = await ctx.db.query("shops").collect();
    const mechanics = await ctx.db.query("mechanics").collect();
    const services = await ctx.db.query("services").collect();
    const oilChange = services.find((s) => s.slug === "oil-change");
    const brakePads = services.find((s) => s.slug === "brake-pads");
    const tireRotation = services.find((s) => s.slug === "tire-rotation");
    if (!shops.length || !mechanics.length || !oilChange) {
      throw new Error("Shops, mechanics, or Oil Change service missing. Run full seed first.");
    }

    const shop1 = shops[0];
    const shop2 = shops[1] ?? shop1;
    const mech1 = mechanics.find((m) => m.shop_id === shop1._id) ?? mechanics[0];
    const mech2 = mechanics.find((m) => m.shop_id === shop2._id) ?? mech1;

    const pastBookings = [
      { daysAgo: 14, service: oilChange, shop: shop1, mechanic: mech1, labor: 47.5, parts: 45 },
      { daysAgo: 30, service: brakePads, shop: shop1, mechanic: mech2, labor: 95, parts: 60 },
      { daysAgo: 60, service: oilChange, shop: shop2, mechanic: mech2, labor: 42.5, parts: 40 },
      { daysAgo: 90, service: tireRotation, shop: shop1, mechanic: mech1, labor: 47.5, parts: 0 },
    ];

    const now = Date.now();
    let created = 0;

    for (const { daysAgo, service, shop, mechanic, labor, parts } of pastBookings) {
      const date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      const dateStr = date.toISOString().split("T")[0];
      const createdAt = now - daysAgo * 24 * 60 * 60 * 1000;
      const totalCost = labor + parts;

      const timeSlotId = await ctx.db.insert("time_slots", {
        shop_id: shop._id,
        mechanic_id: mechanic._id,
        date: dateStr,
        start_time: "10:00",
        end_time: "11:00",
        is_available: false,
      });

      const bookingId = await ctx.db.insert("bookings", {
        user_id: user._id,
        vin,
        shop_id: shop._id,
        mechanic_id: mechanic._id,
        service_ids: [service._id],
        time_slot_id: timeSlotId,
        scheduled_date: dateStr,
        scheduled_time: "10:00",
        labor_cost: labor,
        parts_cost: parts,
        total_cost: totalCost,
        status: "completed",
        created_at: createdAt,
        updated_at: createdAt,
      });

      await ctx.db.insert("booking_status_history", {
        booking_id: bookingId,
        old_status: "confirmed",
        new_status: "completed",
        changed_by: user._id,
        reason: "seeded_past",
        changed_at: createdAt,
      });

      const paymentId = await ctx.db.insert("payments", {
        booking_id: bookingId,
        user_id: user._id,
        shop_id: shop._id,
        amount: totalCost,
        payment_method: "card",
        status: "completed",
        transaction_id: `txn_johndoe_past_${created}`,
        stripe_payment_intent_id: `pi_johndoe_past_${created}`,
        idempotency_key: `johndoe_past_${created}`,
        created_at: createdAt,
        updated_at: createdAt,
      });

      await ctx.db.insert("payment_status_history", {
        payment_id: paymentId,
        old_status: "processing",
        new_status: "completed",
        error_code: undefined,
        error_message: undefined,
        changed_at: createdAt,
      });

      await ctx.db.insert("transactions", {
        user_id: user._id,
        created_at: createdAt,
        description: shop.name,
        sub_description: `${service.name}`,
        amount: -totalCost,
        currency: "USD",
        status: "completed",
        transaction_type: "charge",
        shop_id: shop._id,
        booking_id: bookingId,
        payment_id: paymentId,
        icon_type: "wrench",
      });

      const completedAt = createdAt + 45 * 60 * 1000;
      await ctx.db.insert("job_actuals", {
        booking_id: bookingId,
        mechanic_id: mechanic._id,
        actual_labor_minutes: 45,
        actual_parts_cost: parts,
        started_at: createdAt,
        completed_at_ms: completedAt,
        logged_at_ms: completedAt,
        created_at: completedAt,
        updated_at: completedAt,
        difficulty_rating: 2,
        parts_used: [{ part_name: "Service parts", oem_number: "N/A", cost: parts }],
        technician_notes: "Completed as requested.",
      });

      await ctx.db.insert("reviews", {
        booking_id: bookingId,
        shop_id: shop._id,
        user_id: user._id,
        mechanic_id: mechanic._id,
        rating: 5,
        comment: "Great service, would book again.",
        created_at: completedAt,
      });

      created++;
    }

    return { success: true, pastBookingsCreated: created };
  },
});

/**
 * Seeds one live (in_progress) booking for the John Doe account so the Live Tracker
 * tab shows data. Run: npx convex run seed:seedLiveBookingForJohnDoe
 */
export const seedLiveBookingForJohnDoe = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", JOHN_DOE_CLERK_USER_ID))
      .unique();
    if (!user) {
      throw new Error(
        `User with clerkUserId ${JOHN_DOE_CLERK_USER_ID} (John Doe) not found. Ensure the account exists.`
      );
    }

    const owners = await ctx.db
      .query("vehicle_owners")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();
    let vin: string;
    if (owners.length > 0) {
      vin = owners[0].vin;
    } else {
      const vehicles = await ctx.db.query("vehicles").collect();
      if (vehicles.length === 0) throw new Error("No vehicles in DB. Run full seed first.");
      vin = vehicles[0].vin;
      await ctx.db.insert("vehicle_owners", {
        vin,
        user_id: user._id,
        status: "active",
        nickname: "My Car",
        is_primary: true,
        mileage: 40000,
        added_at: Date.now(),
      });
    }

    const shops = await ctx.db.query("shops").collect();
    const mechanics = await ctx.db.query("mechanics").collect();
    const services = await ctx.db.query("services").collect();
    const oilChange = services.find((s) => s.slug === "oil-change");
    if (!shops.length || !mechanics.length || !oilChange) {
      throw new Error("Shops, mechanics, or Oil Change service missing. Run full seed first.");
    }

    const shop = shops[0];
    const mechanic = mechanics.find((m) => m.shop_id === shop._id) ?? mechanics[0];
    const now = Date.now();
    const today = new Date(now).toISOString().split("T")[0];
    const labor = 47.5;
    const parts = 45;
    const totalCost = labor + parts;
    const estimatedMinutes = 45;
    const startedAtSeconds = Math.floor(now / 1000) - 600;

    const timeSlotId = await ctx.db.insert("time_slots", {
      shop_id: shop._id,
      mechanic_id: mechanic._id,
      date: today,
      start_time: "10:00",
      end_time: "11:00",
      is_available: false,
    });

    const bookingId = await ctx.db.insert("bookings", {
      user_id: user._id,
      vin,
      shop_id: shop._id,
      mechanic_id: mechanic._id,
      service_ids: [oilChange._id],
      time_slot_id: timeSlotId,
      scheduled_date: today,
      scheduled_time: "10:00",
      labor_cost: labor,
      parts_cost: parts,
      total_cost: totalCost,
      status: "in_progress",
      live_stage: "service_in_progress",
      estimated_labor_minutes: estimatedMinutes,
      created_at: now,
      updated_at: now,
    });

    await ctx.db.insert("booking_status_history", {
      booking_id: bookingId,
      old_status: "confirmed",
      new_status: "in_progress",
      changed_by: user._id,
      reason: "seeded_live",
      changed_at: now,
    });

    await ctx.db.insert("job_actuals", {
      booking_id: bookingId,
      mechanic_id: mechanic._id,
      actual_labor_minutes: estimatedMinutes,
      actual_parts_cost: parts,
      started_at: startedAtSeconds,
      completed_at_ms: undefined,
      logged_at_ms: undefined,
      created_at: now,
      updated_at: now,
      difficulty_rating: 2,
      parts_used: [],
      technician_notes: "Service in progress.",
    });

    const paymentId = await ctx.db.insert("payments", {
      booking_id: bookingId,
      user_id: user._id,
      shop_id: shop._id,
      amount: totalCost,
      payment_method: "card",
      status: "completed",
      transaction_id: "txn_johndoe_live",
      stripe_payment_intent_id: "pi_johndoe_live",
      idempotency_key: "johndoe_live",
      created_at: now,
      updated_at: now,
    });

    await ctx.db.insert("transactions", {
      user_id: user._id,
      created_at: now,
      description: shop.name,
      sub_description: oilChange.name,
      amount: -totalCost,
      currency: "USD",
      status: "completed",
      transaction_type: "charge",
      shop_id: shop._id,
      booking_id: bookingId,
      payment_id: paymentId,
      icon_type: "wrench",
    });

    return { success: true, bookingId };
  },
});

/**
 * Seeds extra transactions for John Doe (credits, subscription, fuel) so the
 * Transactions screen shows variety. Run after seedPastBookingsForJohnDoe.
 * npx convex run seed:seedTransactionsForJohnDoe
 */
export const seedTransactionsForJohnDoe = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", JOHN_DOE_CLERK_USER_ID))
      .unique();
    if (!user) {
      throw new Error(
        `User with clerkUserId ${JOHN_DOE_CLERK_USER_ID} (John Doe) not found. Ensure the account exists.`
      );
    }

    const now = Date.now();
    const yesterday = now - 24 * 60 * 60 * 1000;
    const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;

    await ctx.db.insert("transactions", {
      user_id: user._id,
      created_at: yesterday,
      description: "Ownership credits",
      sub_description: "Referral reward",
      amount: 100,
      currency: "USD",
      status: "completed",
      transaction_type: "credit",
      icon_type: "leaf",
    });

    await ctx.db.insert("transactions", {
      user_id: user._id,
      created_at: twoDaysAgo,
      description: "Shell Station",
      sub_description: "Fuel",
      amount: -45,
      currency: "USD",
      status: "completed",
      transaction_type: "charge",
      icon_type: "fuel",
    });

    await ctx.db.insert("transactions", {
      user_id: user._id,
      created_at: twoDaysAgo - 60 * 60 * 1000,
      description: "Otopair Premium",
      sub_description: "Monthly Subscription",
      amount: -12.99,
      currency: "USD",
      status: "completed",
      transaction_type: "charge",
      icon_type: "card",
    });

    return { success: true, transactionsCreated: 3 };
  },
});
