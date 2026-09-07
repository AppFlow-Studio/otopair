/**
 * Walk-in stub adoption — the customer's car has to follow them into their
 * new account.
 *
 * The flow: a shop creates a walk-in, which mints a `shop-created-*` stub user
 * and links the vehicle and booking to that row's `_id`. The customer opens
 * `otopair://claim/<token>`, signs up with Clerk, and the app immediately calls
 * `users.getOrCreateMe`.
 *
 * That mutation matched on `clerkUserId` alone. The stub's is
 * `shop-created-...`, so nothing matched and a SECOND user row was inserted.
 * The stub kept the car and the job; the real account owned nothing, and the
 * Cars tab came up empty (Ahmad, 2026-09-07).
 *
 * Adoption logic did exist — in `upsertFromClerk`, reached by the Clerk
 * `user.created` webhook — but the app wins that race almost every time, and
 * once a row exists under the new clerkUserId, `upsertFromClerk` finds it and
 * returns before ever looking for a stub. So it never ran.
 *
 * Both entry points now share `adoptClaimableStub`, and these tests pin the
 * property that actually matters: the returned `_id` is the STUB's `_id`,
 * because every vehicle, booking and maintenance record points at it.
 */
import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { makeT } from "./helpers";

const CLERK_ID = "user_realclerkid";
const EMAIL = "walkin@example.com";
const PHONE = "+15551234567";

/** A shop-created walk-in: stub user + a vehicle linked to it. */
async function seedWalkIn(
  t: ReturnType<typeof makeT>,
  over: Record<string, unknown> = {},
) {
  return await t.run(async (ctx: any) => {
    const stubId = await ctx.db.insert("users", {
      clerkUserId: `shop-created-${Date.now()}-abc123`,
      email: EMAIL,
      phone: PHONE,
      first_name: "Walk",
      last_name: "In",
      onboardingCompleted: false,
      createdAt: Date.now(),
      ...over,
    });
    await ctx.db.insert("vehicle_owners", {
      vin: "4JGFD8KBXPA931326",
      user_id: stubId,
      status: "active",
      is_primary: true,
      added_at: Date.now(),
    });
    return stubId;
  });
}

const identity = { subject: CLERK_ID, email: EMAIL, emailVerified: true };

/** What the Cars tab actually renders from. */
async function carsFor(t: ReturnType<typeof makeT>, userId: unknown) {
  return await t.query(api.vehicles.listVehiclesByUser, { userId } as never);
}

describe("the app's own signup path", () => {
  it("adopts the stub instead of minting a second user", async () => {
    const t = makeT();
    const stubId = await seedWalkIn(t);
    const user = await t.withIdentity(identity).mutation(api.users.getOrCreateMe, {});
    expect(user?._id).toBe(stubId);
  });

  it("leaves the customer's car on their account", async () => {
    // The regression itself: this returned [] before, because the new row had
    // no vehicle_owners pointing at it.
    const t = makeT();
    await seedWalkIn(t);
    const user = await t.withIdentity(identity).mutation(api.users.getOrCreateMe, {});
    const cars = await carsFor(t, user!._id);
    expect(cars).toHaveLength(1);
    expect(cars[0].vin).toBe("4JGFD8KBXPA931326");
  });

  it("creates exactly one user row", async () => {
    const t = makeT();
    await seedWalkIn(t);
    await t.withIdentity(identity).mutation(api.users.getOrCreateMe, {});
    const all = await t.run(async (ctx: any) => await ctx.db.query("users").collect());
    expect(all).toHaveLength(1);
  });

  it("stamps walkInClaimedAt so the claim link stops offering itself", async () => {
    const t = makeT();
    await seedWalkIn(t);
    const user = await t.withIdentity(identity).mutation(api.users.getOrCreateMe, {});
    expect(user?.walkInClaimedAt).toBeGreaterThan(0);
    expect(user?.clerkUserId).toBe(CLERK_ID);
  });
});

describe("what must not be adopted", () => {
  it("ignores a real account that happens to share the email", async () => {
    // Only "shop-created-" / "presignup-" rows are claimable. A real account
    // with a matching address must never be taken over.
    const t = makeT();
    await seedWalkIn(t, { clerkUserId: "user_someoneelse" });
    const user = await t.withIdentity(identity).mutation(api.users.getOrCreateMe, {});
    const all = await t.run(async (ctx: any) => await ctx.db.query("users").collect());
    expect(all).toHaveLength(2);
    expect(user?.clerkUserId).toBe(CLERK_ID);
  });

  it("does not match on an unverified email", async () => {
    // Anyone can type a stranger's address into a signup form. Clerk verifies
    // ownership; until it says so, an address is not evidence.
    const t = makeT();
    await seedWalkIn(t);
    const user = await t
      .withIdentity({ subject: CLERK_ID, email: EMAIL, emailVerified: false })
      .mutation(api.users.getOrCreateMe, {});
    const all = await t.run(async (ctx: any) => await ctx.db.query("users").collect());
    expect(all).toHaveLength(2);
    expect(user?.walkInClaimedAt).toBeUndefined();
  });

  it("does nothing when there is no stub at all", async () => {
    const t = makeT();
    const user = await t.withIdentity(identity).mutation(api.users.getOrCreateMe, {});
    expect(user?.walkInClaimedAt).toBeUndefined();
    expect(user?.onboardingCompleted).toBe(false);
  });
});

describe("the claim token", () => {
  it("adopts a phone-only signup, where no email can match", async () => {
    // The token is proof the customer followed a link only their shop could
    // have sent — stronger evidence than a matching address, and the only
    // signal available when the signup carries no verified email.
    const t = makeT();
    const stubId = await t.run(async (ctx: any) => {
      const id = await ctx.db.insert("users", {
        clerkUserId: `shop-created-${Date.now()}-tok`,
        phone: PHONE,
        onboardingCompleted: false,
        createdAt: Date.now(),
        claim_token: "tok_abc",
        claim_token_expires_at: Date.now() + 86_400_000,
      });
      await ctx.db.insert("vehicle_owners", {
        vin: "1FTFW1ET5DFC10312", user_id: id, status: "active",
        is_primary: true, added_at: Date.now(),
      });
      return id;
    });
    const user = await t
      .withIdentity({ subject: CLERK_ID })
      .mutation(api.users.getOrCreateMe, { claimToken: "tok_abc" });
    expect(user?._id).toBe(stubId);
    expect(await carsFor(t, user!._id)).toHaveLength(1);
  });

  it("refuses an expired token", async () => {
    const t = makeT();
    await t.run(async (ctx: any) => {
      await ctx.db.insert("users", {
        clerkUserId: `shop-created-${Date.now()}-exp`,
        onboardingCompleted: false,
        createdAt: Date.now(),
        claim_token: "tok_old",
        claim_token_expires_at: Date.now() - 1,
      });
    });
    const user = await t
      .withIdentity({ subject: CLERK_ID })
      .mutation(api.users.getOrCreateMe, { claimToken: "tok_old" });
    expect(user?.walkInClaimedAt).toBeUndefined();
  });
});

describe("the webhook path still works", () => {
  it("adopts the same stub through upsertFromClerk", async () => {
    // Whichever of the two lands first must produce the same outcome — that is
    // why they share one helper rather than keeping parallel copies.
    const t = makeT();
    const stubId = await seedWalkIn(t);
    const id = await t.mutation(api.users.upsertFromClerk, {
      clerkUserId: CLERK_ID,
      email: EMAIL,
    });
    expect(id).toBe(stubId);
    expect(await carsFor(t, id)).toHaveLength(1);
  });
});
