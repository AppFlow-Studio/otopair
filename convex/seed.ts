import { mutation } from "./_generated/server";

export const seedUserAndVehicle = mutation({
  args: {},
  handler: async (ctx) => {
    // Clean existing user data
    const existingUsers = await ctx.db.query("users").collect();
    for (const u of existingUsers) await ctx.db.delete(u._id);
    const existingVehicles = await ctx.db.query("user_vehicles").collect();
    for (const v of existingVehicles) await ctx.db.delete(v._id);

    // Look up the A25A-FKS engine
    const engines = await ctx.db.query("engines").collect();
    const engine = engines.find((e) => e.engine_code === "A25A-FKS");
    if (!engine) throw new Error("Engine A25A-FKS not found. Seed vehicle data first.");

    // Demo user
    const userId = await ctx.db.insert("users", {
      email: "demo@otopair.com",
      phone: "(512) 555-9999",
      first_name: "Alex",
      last_name: "Rivera",
      created_at: new Date().toISOString(),
    });

    // 2018 Toyota Camry LE
    await ctx.db.insert("user_vehicles", {
      user_id: userId,
      engine_id: engine._id,
      vin: "4T1B11HK5JU123456",
      license_plate: "TX-ABR2018",
      year: 2018,
      mileage: 72000,
      nickname: "My Camry",
      is_primary: true,
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
    // --- Make ---
    const toyotaId = await ctx.db.insert("makes", {
      name: "Toyota",
      logo_url: "https://upload.wikimedia.org/wikipedia/commons/9/9d/Toyota_carridge_logo.svg",
    });

    // --- Model ---
    const camryId = await ctx.db.insert("models", {
      make_id: toyotaId,
      name: "Camry",
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
      lat: 30.2500,
      lng: -97.7500,
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
      service_id: brakePadsId,
      is_offered: true,
    });

    // --- Mechanics ---
    await ctx.db.insert("mechanics", {
      shop_id: shop1Id,
      first_name: "Mike",
      last_name: "Johnson",
      is_active: true,
      rating: 4.9,
      review_count: 87,
    });

    await ctx.db.insert("mechanics", {
      shop_id: shop1Id,
      first_name: "Sarah",
      last_name: "Chen",
      is_active: true,
      rating: 4.7,
      review_count: 64,
    });

    await ctx.db.insert("mechanics", {
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
          date: dateStr,
          start_time: startTime,
          end_time: endTime,
          is_available: true,
        });
      }
    }

    // --- Demo User ---
    const userId = await ctx.db.insert("users", {
      email: "demo@otopair.com",
      phone: "(512) 555-9999",
      first_name: "Alex",
      last_name: "Demo",
      created_at: new Date().toISOString(),
    });

    // --- User Vehicle (2022 Camry LE) ---
    await ctx.db.insert("user_vehicles", {
      user_id: userId,
      engine_id: engineLeId,
      year: 2022,
      mileage: 35000,
      nickname: "My Camry",
      is_primary: true,
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

    const vehicles = await ctx.db.query("user_vehicles").collect();
    const vehicle = vehicles.find((uv) => uv.user_id === user._id);
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
    let slot = allSlots.find(
      (s) => s.shop_id === shop._id && s.is_available
    );

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
      user_vehicle_id: vehicle._id,
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
    });

    const engine = await ctx.db.get(vehicle.engine_id);

    return {
      success: true,
      bookingId,
      engineId: vehicle.engine_id,
      mechanicId: mechanic._id,
      summary: `Booking created: Oil Change for ${engine?.engine_code ?? "unknown"} at ${shop.name} with ${mechanic.first_name} ${mechanic.last_name}`,
    };
  },
});
