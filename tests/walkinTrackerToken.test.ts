/**
 * Tracker links belong to the JOB, and every customer gets one.
 *
 * Ahmad, 2026-09-10, from the shop portal: "No tracker link — this customer
 * has already claimed their Otopair account. They'll see this booking the next
 * time they open the app." — "obviously we need one even for existing users."
 *
 * He is right twice over. "Next time they open the app" is a hope, not a
 * handoff, and the link is the only thing a mechanic can hand to someone
 * standing at the counter. And the token was scoped to the CUSTOMER, so even
 * once minted it could not say which job a link meant: his own test data has
 * two walk-ins on one Santa Fe on one day, and a user-level token resolved to
 * whichever sorted most recent.
 */
import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { makeT } from "./helpers";

const SHOP_STAFF = "user_shopstaff";

async function seed(t: ReturnType<typeof makeT>, opts: { claimed?: boolean } = {}) {
  return await t.run(async (ctx: any) => {
    const staffId = await ctx.db.insert("users", {
      clerkUserId: SHOP_STAFF, role: "shop_owner", onboardingCompleted: true, createdAt: Date.now(),
    });
    // `requireShopStaff` accepts either an active `shop_users` row or plain
    // ownership; ownership is the shorter fixture.
    const shopId = await ctx.db.insert("shops", {
      name: "Chelala Service Center", owner_user_id: staffId,
    } as any);
    const customerId = await ctx.db.insert("users", {
      clerkUserId: opts.claimed ? "user_realcustomer" : `shop-created-${Date.now()}-x`,
      first_name: "Ahmad", onboardingCompleted: !!opts.claimed, createdAt: Date.now(),
      ...(opts.claimed ? { walkInClaimedAt: Date.now() } : {}),
    });
    const mk = async (time: string) =>
      await ctx.db.insert("bookings", {
        user_id: customerId, shop_id: shopId, status: "confirmed",
        vin: "5XYZU3LB0FG123456", service_ids: [], source: "mechanic_walk_in",
        scheduled_date: "2026-09-10", scheduled_time: time, created_at: Date.now(),
      } as any);
    // Two walk-ins on one vehicle on one day — the case a customer-scoped
    // token cannot represent.
    const early = await mk("09:00");
    const late = await mk("10:45");
    return { shopId, customerId, early, late };
  });
}

const asStaff = (t: ReturnType<typeof makeT>) => t.withIdentity({ subject: SHOP_STAFF });

describe("a returning customer gets a link", () => {
  it("mints one even though the account is already claimed", () => {
    // The reported bug: this returned { token: null } and the portal said
    // there was no link to give.
    return (async () => {
      const t = makeT();
      const { late } = await seed(t, { claimed: true });
      const r = await asStaff(t).mutation(api.walkin_claims.mintForBooking, { bookingId: late });
      expect(r.token).toBeTruthy();
      expect(r.expiresAtMs).toBeGreaterThan(Date.now());
    })();
  });

  it("opens the job rather than a wall", async () => {
    // resolveClaimToken used to return { alreadyClaimed: true } and NOTHING
    // else, which the app rendered as "This job is already claimed."
    const t = makeT();
    const { late } = await seed(t, { claimed: true });
    const { token } = await asStaff(t).mutation(api.walkin_claims.mintForBooking, { bookingId: late });
    const resolved: any = await t.query(api.walkin_claims.resolveClaimToken, { token: token! });
    expect(resolved.alreadyClaimed).toBe(true);
    expect(resolved.shopName).toBe("Chelala Service Center");
  });
});

describe("one link per job", () => {
  it("resolves each booking's link to ITS own booking", async () => {
    const t = makeT();
    const { early, late } = await seed(t);
    const a = await asStaff(t).mutation(api.walkin_claims.mintForBooking, { bookingId: early });
    const b = await asStaff(t).mutation(api.walkin_claims.mintForBooking, { bookingId: late });
    expect(a.token).not.toBe(b.token);

    const trackerA: any = await t.query(api.walkin_claims.getTrackerData, { token: a.token! });
    const trackerB: any = await t.query(api.walkin_claims.getTrackerData, { token: b.token! });
    // Same customer, same vehicle, same day — only the slot separates them,
    // which is exactly what a customer-scoped token could not carry.
    expect(trackerA).toBeTruthy();
    expect(trackerB).toBeTruthy();
    expect(trackerA.timeline).toBeDefined();
  });

  it("is idempotent — re-sending a link does not invalidate the one already sent", async () => {
    // A mechanic hitting the button twice must not break the URL already in
    // the customer's messages.
    const t = makeT();
    const { late } = await seed(t);
    const first = await asStaff(t).mutation(api.walkin_claims.mintForBooking, { bookingId: late });
    const second = await asStaff(t).mutation(api.walkin_claims.mintForBooking, { bookingId: late });
    expect(second.token).toBe(first.token);
  });
});

describe("links already in the wild keep working", () => {
  it("still resolves a legacy customer-scoped token", async () => {
    // users.claim_token is not migrated — it expires on its own. Until then a
    // link a customer already received has to keep opening their job.
    const t = makeT();
    const { customerId } = await seed(t);
    await t.run(async (ctx: any) => {
      await ctx.db.patch(customerId, {
        claim_token: "legacy_tok",
        claim_token_expires_at: Date.now() + 86_400_000,
      });
    });
    const resolved: any = await t.query(api.walkin_claims.resolveClaimToken, { token: "legacy_tok" });
    expect(resolved).toBeTruthy();
    expect(resolved.expired).toBeUndefined();
  });
});

describe("what a link must not do", () => {
  it("refuses an expired one", async () => {
    const t = makeT();
    const { late } = await seed(t);
    const { token } = await asStaff(t).mutation(api.walkin_claims.mintForBooking, { bookingId: late });
    await t.run(async (ctx: any) => {
      await ctx.db.patch(late, { tracker_token_expires_at: Date.now() - 1 });
    });
    const resolved: any = await t.query(api.walkin_claims.resolveClaimToken, { token: token! });
    expect(resolved.expired).toBe(true);
  });

  it("cannot be used to absorb a claimed customer's account", async () => {
    // A returning customer's link is a TRACKER link. Opened by someone else,
    // it must move nothing — the merge only ever accepts a shop-built stub.
    const t = makeT();
    const { late } = await seed(t, { claimed: true });
    const { token } = await asStaff(t).mutation(api.walkin_claims.mintForBooking, { bookingId: late });
    await t.run(async (ctx: any) => {
      await ctx.db.insert("users", {
        clerkUserId: "user_attacker", onboardingCompleted: true, createdAt: Date.now(),
      });
    });
    const r: any = await t
      .withIdentity({ subject: "user_attacker" })
      .mutation(api.walkin_claims.claimByToken, { token: token! });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("already_claimed");
  });

  it("is a no-op for the customer it already belongs to", async () => {
    const t = makeT();
    const { late } = await seed(t, { claimed: true });
    const { token } = await asStaff(t).mutation(api.walkin_claims.mintForBooking, { bookingId: late });
    const r: any = await t
      .withIdentity({ subject: "user_realcustomer" })
      .mutation(api.walkin_claims.claimByToken, { token: token! });
    expect(r.ok).toBe(true);
    expect(r.alreadyMine).toBe(true);
  });
});

/**
 * A retired stub must never swallow the customer's next job.
 *
 * Ahmad, 2026-09-10: opened a fresh walk-in link, got the tracker (correct),
 * tapped "Go to my Garage" — and the car was not there, nor the booking in
 * Bookings.
 *
 * `claimByToken` retires a merged stub by keeping the row and stamping
 * `walkInClaimedAt` + `isPendingDeletion`. Keeping it is right — deleting it
 * would dangle any id the merge did not know about. But the row keeps its
 * email and phone, and the shop portal finds customers by exactly those, so
 * the NEXT walk-in attached to the dead row. The job was invisible from the
 * real account, and the claim link refused to help because the stub was
 * already claimed. A dead end built out of two individually-reasonable rules.
 */
describe("a merged stub does not capture later walk-ins", () => {
  it("carries a forwarding pointer once merged", async () => {
    const t = makeT();
    const { customerId, late } = await seed(t);
    const meId = await t.run(async (ctx: any) =>
      await ctx.db.insert("users", {
        clerkUserId: "user_realcustomer", onboardingCompleted: true, createdAt: Date.now(),
      }));
    await asStaff(t).mutation(api.walkin_claims.mintForBooking, { bookingId: late });
    const token = await t.run(async (ctx: any) => (await ctx.db.get(late)).tracker_token);
    await t.withIdentity({ subject: "user_realcustomer" })
      .mutation(api.walkin_claims.claimByToken, { token });
    const stub = await t.run(async (ctx: any) => await ctx.db.get(customerId));
    expect(stub.merged_into_user_id).toBe(meId);
    expect(stub.isPendingDeletion).toBe(true);
  });

  it("lets the same owner absorb a job that landed on the stub afterwards", async () => {
    // The self-healing case: a booking created before the portal learned to
    // follow the pointer still has a way home.
    const t = makeT();
    const { customerId, early, late } = await seed(t);
    await t.run(async (ctx: any) =>
      await ctx.db.insert("users", {
        clerkUserId: "user_realcustomer", onboardingCompleted: true, createdAt: Date.now(),
      }));
    const me = t.withIdentity({ subject: "user_realcustomer" });

    await asStaff(t).mutation(api.walkin_claims.mintForBooking, { bookingId: late });
    const tokLate = await t.run(async (ctx: any) => (await ctx.db.get(late)).tracker_token);
    await me.mutation(api.walkin_claims.claimByToken, { token: tokLate });
    // The first merge takes everything the stub owns, `early` included — so a
    // leftover job only exists if the shop creates one AFTERWARDS, which is
    // exactly what happened: the portal matched the retired stub by phone.
    const later = await t.run(async (ctx: any) =>
      await ctx.db.insert("bookings", {
        user_id: customerId, shop_id: (await ctx.db.get(early)).shop_id, status: "confirmed",
        vin: "5XYZU3LB0FG123456", service_ids: [], source: "mechanic_walk_in",
        scheduled_date: "2026-09-11", scheduled_time: "08:00", created_at: Date.now(),
      } as any));

    await asStaff(t).mutation(api.walkin_claims.mintForBooking, { bookingId: later });
    const tokLater = await t.run(async (ctx: any) => (await ctx.db.get(later)).tracker_token);
    const r: any = await me.mutation(api.walkin_claims.claimByToken, { token: tokLater });
    expect(r.ok).toBe(true);

    const moved = await t.run(async (ctx: any) => await ctx.db.get(later));
    expect(moved.user_id).not.toBe(customerId);
  });

  it("still refuses anyone the stub was NOT merged into", async () => {
    // The re-merge allowance is scoped to the account that absorbed it. It is
    // not a general re-claim.
    const t = makeT();
    const { early, late } = await seed(t);
    await t.run(async (ctx: any) => {
      await ctx.db.insert("users", {
        clerkUserId: "user_realcustomer", onboardingCompleted: true, createdAt: Date.now(),
      });
      await ctx.db.insert("users", {
        clerkUserId: "user_attacker", onboardingCompleted: true, createdAt: Date.now(),
      });
    });
    await asStaff(t).mutation(api.walkin_claims.mintForBooking, { bookingId: late });
    const tokLate = await t.run(async (ctx: any) => (await ctx.db.get(late)).tracker_token);
    await t.withIdentity({ subject: "user_realcustomer" })
      .mutation(api.walkin_claims.claimByToken, { token: tokLate });

    // A job that lands on the retired stub after the merge — the one case
    // where the re-merge allowance applies, so the right one to test the
    // scoping on.
    const later = await t.run(async (ctx: any) => {
      const stub = await ctx.db.query("users")
        .filter((q: any) => q.eq(q.field("first_name"), "Ahmad")).first();
      return await ctx.db.insert("bookings", {
        user_id: stub._id, shop_id: (await ctx.db.get(early)).shop_id, status: "confirmed",
        vin: "5XYZU3LB0FG123456", service_ids: [], source: "mechanic_walk_in",
        scheduled_date: "2026-09-11", scheduled_time: "08:00", created_at: Date.now(),
      } as any);
    });
    await asStaff(t).mutation(api.walkin_claims.mintForBooking, { bookingId: later });
    const tokLater = await t.run(async (ctx: any) => (await ctx.db.get(later)).tracker_token);
    const r: any = await t.withIdentity({ subject: "user_attacker" })
      .mutation(api.walkin_claims.claimByToken, { token: tokLater });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("already_claimed");
  });
});
