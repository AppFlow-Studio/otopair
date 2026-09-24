/**
 * #244 — Oto must never tell a customer "Timing Belt".
 *
 * The `services` rows still read "Timing Belt" on every deployment (the slug
 * `timing_belt` is the binding key, so the data stays). The app renames at
 * display time with utils/serviceDisplayName; Oto's tools handed the model
 * the raw row, and the model quotes it back word for word.
 */
import { describe, expect, test } from "vitest";
import { internal } from "../convex/_generated/api";
import { makeT } from "./helpers";

describe("Oto service names (#244)", () => {
  test("THE BUG: a booking's Timing Belt service reaches Oto as Drive Belt", async () => {
    const t = makeT();
    const userId = await t.run(async (ctx) => {
      const now = Date.now();
      const userId = await ctx.db.insert("users", {
        clerkUserId: "user_oto_drive_belt",
        email: "oto-drive-belt@example.com",
      } as any);
      const serviceId = await ctx.db.insert("services", {
        name: "Timing Belt",
        slug: "timing_belt",
        description: "Timing belt kit replacement",
      } as any);
      await ctx.db.insert("bookings", {
        user_id: userId,
        vin: "2T1BURHE0JC000002",
        service_ids: [serviceId],
        scheduled_date: "2026-09-24",
        scheduled_time: "10:00",
        status: "confirmed",
        created_at: now,
        updated_at: now,
      } as any);
      return userId;
    });

    const [row] = await t.query(internal.oto.bookings.getBookingsForUser, {
      actingUserId: userId,
      status_filter: "active",
    });
    expect(row.service_names).toEqual(["Drive Belt"]);
    expect(row.service_slugs).toEqual(["timing_belt"]); // the key stays
  });
});
