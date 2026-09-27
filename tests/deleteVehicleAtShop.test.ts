/**
 * A car cannot be removed while the shop still has it.
 *
 * Ahmad, 2026-09-14: deleted a vehicle that had a diagnostic scan IN PROGRESS.
 * The booking survived with no vehicle behind it, so the Home hero rendered
 * "Diagnostic Scan · Chelala Service Center" with no car name and an empty
 * silhouette where the image should be.
 *
 * The guard is deliberately narrow. "Has a booking" is the wrong test — a
 * pending or confirmed job is a PLAN, and a driver is allowed to change their
 * mind about a plan. These three statuses mean the car is physically at the
 * shop: checked in, on a lift, or stalled mid-job.
 */
import { describe, expect, it } from "vitest";
import { api } from "../convex/_generated/api";
import { makeT } from "./helpers";

const VIN = "1FA6P8CF5J5170067";

async function seed(t: ReturnType<typeof makeT>, status: string | null) {
  return await t.run(async (ctx: any) => {
    const userId = await ctx.db.insert("users", {
      clerkUserId: "user_owner",
      onboardingCompleted: true,
      createdAt: Date.now(),
    });
    const ownershipId = await ctx.db.insert("vehicle_owners", {
      vin: VIN, user_id: userId, status: "active", is_primary: true, added_at: Date.now(),
    });
    // A record on the ownership, so a partial delete is visible if one happens.
    await ctx.db.insert("maintenance_records", {
      vehicleOwnerId: ownershipId, type: "oil", lastServiceMileage: 1000,
    } as any);
    if (status) {
      const shopId = await ctx.db.insert("shops", { name: "Chelala Service Center" } as any);
      await ctx.db.insert("bookings", {
        user_id: userId, shop_id: shopId, status, vin: VIN, service_ids: [],
        scheduled_date: "2026-09-14", scheduled_time: "17:20", created_at: Date.now(),
      } as any);
    }
    return { userId, ownershipId };
  });
}

const remove = (t: ReturnType<typeof makeT>, userId: unknown) =>
  t.mutation(api.vehicles.removeOwner, { vin: VIN, userId } as never);

describe("the car is at the shop", () => {
  it.each(["in_progress", "vehicle_at_shop", "delayed"])(
    "refuses to remove it during %s",
    async (status) => {
      const t = makeT();
      const { userId } = await seed(t, status);
      await expect(remove(t, userId)).rejects.toThrow(/at the shop right now/);
    },
  );

  it("leaves the vehicle and its records completely intact", async () => {
    // The mutation deletes maintenance records BEFORE the ownership row, so a
    // guard placed too late would half-delete the car and still throw.
    const t = makeT();
    const { userId, ownershipId } = await seed(t, "in_progress");
    await expect(remove(t, userId)).rejects.toThrow();
    const state = await t.run(async (ctx: any) => ({
      ownership: await ctx.db.get(ownershipId),
      records: (await ctx.db.query("maintenance_records").collect()).length,
    }));
    expect(state.ownership).not.toBeNull();
    expect(state.records).toBe(1);
  });
});

describe("a plan is not a commitment", () => {
  it.each(["confirmed", "pending", "pending_shop_acceptance", "quotes_ready"])(
    "still allows removal when the booking is only %s",
    async (status) => {
      // The car is not at the shop yet. Blocking here would trap a driver who
      // booked by mistake, which is a worse failure than an orphan they chose.
      const t = makeT();
      const { userId, ownershipId } = await seed(t, status);
      await remove(t, userId);
      expect(await t.run(async (ctx: any) => await ctx.db.get(ownershipId))).toBeNull();
    },
  );

  it.each(["completed", "cancelled", "no_show"])(
    "allows removal after a %s job",
    async (status) => {
      const t = makeT();
      const { userId, ownershipId } = await seed(t, status);
      await remove(t, userId);
      expect(await t.run(async (ctx: any) => await ctx.db.get(ownershipId))).toBeNull();
    },
  );

  it("allows removal with no bookings at all", async () => {
    const t = makeT();
    const { userId, ownershipId } = await seed(t, null);
    await remove(t, userId);
    expect(await t.run(async (ctx: any) => await ctx.db.get(ownershipId))).toBeNull();
  });
});

describe("the guard is scoped to the owner", () => {
  it("ignores another driver's live job on the same VIN", async () => {
    // Shared VINs happen in test data and after a resale. Someone else's job
    // is not a reason to trap this driver's car in their garage.
    const t = makeT();
    const { userId, ownershipId } = await seed(t, null);
    await t.run(async (ctx: any) => {
      const other = await ctx.db.insert("users", {
        clerkUserId: "user_other", onboardingCompleted: true, createdAt: Date.now(),
      });
      const shopId = await ctx.db.insert("shops", { name: "Other shop" } as any);
      await ctx.db.insert("bookings", {
        user_id: other, shop_id: shopId, status: "in_progress", vin: VIN,
        service_ids: [], scheduled_date: "2026-09-14", scheduled_time: "09:00",
        created_at: Date.now(),
      } as any);
    });
    await remove(t, userId);
    expect(await t.run(async (ctx: any) => await ctx.db.get(ownershipId))).toBeNull();
  });
});

describe("the id-based path is guarded too", () => {
  it("refuses removeOwnerById during an active job", async () => {
    // Two delete paths exist and the Cars tab can reach either. Guarding only
    // the one in the report would leave the bug alive by another route.
    const t = makeT();
    const { ownershipId } = await seed(t, "in_progress");
    await expect(
      t.mutation(api.vehicles.removeOwnerById, { vehicleOwnerId: ownershipId } as never),
    ).rejects.toThrow(/at the shop right now/);
  });
});
