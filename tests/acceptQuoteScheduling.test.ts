import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { makeT } from "./helpers";

/**
 * Seeds a shop (wide-open hours) + mechanic + a `pending_quote` booking with
 * no shop/mechanic/schedule set yet (mirrors `createTireQuoteRequest` /
 * `createRotorQuoteRequest`'s real shape), plus one quote response with a
 * known `availability` floor.
 */
async function seedQuoteFixture(
  t: ReturnType<typeof makeT>,
  quoteType: "tire" | "rotor",
) {
  return t.run(async (ctx) => {
    const now = Date.now();

    const ownerId = await ctx.db.insert("users", {
      clerkUserId: `clerk_owner_${now}_${Math.random().toString(36).slice(2)}`,
      email: "owner@test.local",
      first_name: "Owner",
      role: "shop_owner",
      createdAt: now,
    });
    const customerId = await ctx.db.insert("users", {
      clerkUserId: `clerk_customer_${now}_${Math.random().toString(36).slice(2)}`,
      email: "customer@test.local",
      first_name: "Cust",
      role: "user",
      createdAt: now,
    });

    const shopId = await ctx.db.insert("shops", {
      name: "Brooklyn Auto",
      owner_user_id: ownerId,
      is_active: true,
      timezone: "America/New_York",
      no_show_threshold_minutes: 30,
      overrun_default_extension_percent: 25,
      overrun_extension_floor_minutes: 5,
      max_bookings_per_mechanic_rolling_hour: 2,
      entity_label_mode: "mechanic",
    } as any);

    const mechanicId = await ctx.db.insert("mechanics", {
      shop_id: shopId,
      first_name: "Alice",
      last_name: "Mechanic",
      is_active: true,
    } as any);

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let day = 0; day < 7; day++) {
      await ctx.db.insert("shops_hours", {
        shop_id: shopId,
        day_of_week: day,
        day_name: dayNames[day],
        open_time: "08:00",
        close_time: "20:00",
        is_closed: false,
      } as any);
    }

    const bookingId = await ctx.db.insert("bookings", {
      user_id: customerId,
      vin: "1HGCM82633A004352",
      service_ids: [],
      status: "quotes_ready",
      created_at: now,
      updated_at: now,
    } as any);

    const availability = { date: "2026-06-10", time: "14:00" };
    const responseId =
      quoteType === "tire"
        ? await ctx.db.insert("tire_quote_responses", {
            booking_id: bookingId,
            shop_id: shopId,
            mechanic_id: mechanicId,
            tire_brand: "Michelin",
            per_tire_price: 111,
            quantity: 2,
            labor_cost: 111,
            total: 333,
            availability,
            created_at: now,
          } as any)
        : await ctx.db.insert("rotor_quote_responses", {
            booking_id: bookingId,
            shop_id: shopId,
            mechanic_id: mechanicId,
            rotor_brand: "Brembo",
            per_rotor_price: 111,
            quantity: 2,
            labor_cost: 111,
            total: 333,
            availability,
            created_at: now,
          } as any);

    return { bookingId, responseId, availability };
  });
}

describe("acceptTireQuote scheduling", () => {
  test("rejects a scheduled time earlier than the quoted availability", async () => {
    const t = makeT();
    const { bookingId, responseId } = await seedQuoteFixture(t, "tire");
    await expect(
      t.mutation(api.bookings.acceptTireQuote, {
        booking_id: bookingId,
        response_id: responseId,
        scheduled_date: "2026-06-10",
        scheduled_time: "13:00",
      }),
    ).rejects.toThrow();
  });

  test("accepts the exact quoted floor time (inclusive boundary)", async () => {
    const t = makeT();
    const { bookingId, responseId, availability } = await seedQuoteFixture(t, "tire");
    await t.mutation(api.bookings.acceptTireQuote, {
      booking_id: bookingId,
      response_id: responseId,
      scheduled_date: availability.date,
      scheduled_time: availability.time,
    });
    const booking = await t.run((ctx) => ctx.db.get(bookingId));
    expect(booking?.status).toBe("confirmed");
    expect(booking?.scheduled_date).toBe(availability.date);
    expect(booking?.scheduled_time).toBe(availability.time);
  });

  test("accepts a later time and stores the submitted slot, not the quoted one; price still comes from the response", async () => {
    const t = makeT();
    const { bookingId, responseId } = await seedQuoteFixture(t, "tire");
    await t.mutation(api.bookings.acceptTireQuote, {
      booking_id: bookingId,
      response_id: responseId,
      scheduled_date: "2026-06-11",
      scheduled_time: "09:00",
    });
    const booking = await t.run((ctx) => ctx.db.get(bookingId));
    expect(booking?.scheduled_date).toBe("2026-06-11");
    expect(booking?.scheduled_time).toBe("09:00");
    expect(booking?.total_cost).toBe(333);
    expect(booking?.labor_cost).toBe(111);
    expect(booking?.parts_cost).toBe(222);
  });
});

describe("acceptRotorQuote scheduling", () => {
  test("rejects a scheduled time earlier than the quoted availability", async () => {
    const t = makeT();
    const { bookingId, responseId } = await seedQuoteFixture(t, "rotor");
    await expect(
      t.mutation(api.bookings.acceptRotorQuote, {
        booking_id: bookingId,
        response_id: responseId,
        scheduled_date: "2026-06-09",
        scheduled_time: "23:00",
      }),
    ).rejects.toThrow();
  });

  test("accepts a later time and stores the submitted slot, not the quoted one; price still comes from the response", async () => {
    const t = makeT();
    const { bookingId, responseId } = await seedQuoteFixture(t, "rotor");
    await t.mutation(api.bookings.acceptRotorQuote, {
      booking_id: bookingId,
      response_id: responseId,
      scheduled_date: "2026-06-11",
      scheduled_time: "09:00",
    });
    const booking = await t.run((ctx) => ctx.db.get(bookingId));
    expect(booking?.scheduled_date).toBe("2026-06-11");
    expect(booking?.scheduled_time).toBe("09:00");
    expect(booking?.total_cost).toBe(333);
    expect(booking?.labor_cost).toBe(111);
    expect(booking?.parts_cost).toBe(222);
  });
});
