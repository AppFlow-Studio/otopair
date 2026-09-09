import { describe, expect, test } from "vitest";
import { api } from "../convex/_generated/api";
import { identityFor, makeT, seedConfirmedBooking } from "./helpers";

describe("getJobDetail tire replacement positions", () => {
  test("returns the exact tire positions stored on the booking", async () => {
    const t = makeT();
    const seed = await seedConfirmedBooking(t);

    await t.run(async (ctx) => {
      await ctx.db.patch(seed.bookingId, {
        tire_specs: {
          quantity: 2,
          positions: ["FL", "RL"],
          size: "205/55R16",
          tier: "Premium",
          type: "All-Season",
        },
      });
    });

    const job = await t
      .withIdentity(identityFor(seed.ownerClerkId))
      .query(api.bookings.getJobDetail, { bookingId: seed.bookingId });

    expect(job?.tireSpecs?.positions).toEqual(["FL", "RL"]);
  });
});
