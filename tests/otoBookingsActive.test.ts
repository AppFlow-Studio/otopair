/**
 * #317 — Oto's "active" bookings must include a car sitting at the shop.
 *
 * `get_bookings(status_filter: "active")` used a hand-kept allow-list
 * (pending, confirmed, in_progress). An arrived car waits in
 * `vehicle_at_shop` — through the whole estimate-approval stage too — so
 * mid-job Oto found no active booking and told the customer their car
 * wasn't at a shop.
 */
import { describe, expect, test } from "vitest";
import { internal } from "../convex/_generated/api";
import { makeT } from "./helpers";

async function seed(t: ReturnType<typeof makeT>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      clerkUserId: "user_oto_bookings_active",
      email: "oto-active@example.com",
    } as any);
    const base = {
      user_id: userId,
      vin: "2T1BURHE0JC000001",
      service_ids: [],
      scheduled_date: "2026-09-24",
      scheduled_time: "10:00",
      created_at: now,
      updated_at: now,
    };
    const at = async (status: string, extra: Record<string, unknown> = {}) =>
      await ctx.db.insert("bookings", { ...base, status, ...extra } as any);
    return {
      userId,
      atShop: await at("vehicle_at_shop", {
        live_stage: "inspection_complete",
        cancel_requested_at_ms: 1_758_700_000_000,
        pickup_response: "bringing_out",
      }),
      working: await at("in_progress"),
      upcoming: await at("confirmed"),
      done: await at("completed"),
      cancelled: await at("cancelled"),
    };
  });
}

describe("Oto get_bookings — active set (#317)", () => {
  test("THE BUG: a car at the shop (vehicle_at_shop) counts as an active booking", async () => {
    const t = makeT();
    const s = await seed(t);
    const rows = await t.query(internal.oto.bookings.getBookingsForUser, {
      actingUserId: s.userId,
      status_filter: "active",
      limit: 20,
    });
    const ids = rows.map((r) => r.id).sort();
    expect(ids).toEqual([s.atShop, s.working, s.upcoming].map(String).sort());
  });

  test("rows say whether the car is at the shop, and carry the car-back request", async () => {
    const t = makeT();
    const s = await seed(t);
    const rows = await t.query(internal.oto.bookings.getBookingsForUser, {
      actingUserId: s.userId,
      status_filter: "active",
      limit: 20,
    });
    const byId = new Map(rows.map((r) => [String(r.id), r]));
    expect(byId.get(String(s.atShop))).toMatchObject({
      car_at_shop: true,
      live_stage: "inspection_complete",
      pickup_requested_at: 1_758_700_000_000,
      pickup_response: "bringing_out",
    });
    expect(byId.get(String(s.working))?.car_at_shop).toBe(true);
    expect(byId.get(String(s.upcoming))).toMatchObject({
      car_at_shop: false,
      pickup_requested_at: null,
      pickup_response: null,
    });
  });

  test("finished bookings stay out of the active set", async () => {
    const t = makeT();
    const s = await seed(t);
    const completed = await t.query(internal.oto.bookings.getBookingsForUser, {
      actingUserId: s.userId,
      status_filter: "completed",
    });
    expect(completed.map((r) => String(r.id))).toEqual([String(s.done)]);
  });
});
