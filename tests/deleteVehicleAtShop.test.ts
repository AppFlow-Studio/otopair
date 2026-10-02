/**
 * Removing a car: when it's refused, and what a removal keeps.
 *
 * Ahmad, 2026-09-14: deleted a vehicle that had a diagnostic scan IN PROGRESS.
 * The booking survived with no vehicle behind it, so the Home hero rendered
 * "Diagnostic Scan · Chelala Service Center" with no car name and an empty
 * silhouette where the image should be.
 *
 * #395 (Kareem, Oyelade, Sep 25–28): the guard then only covered the three
 * at-shop statuses, so a car with an UPCOMING booking could still be removed —
 * the booking stayed live in Bookings and on the shop's schedule, on both
 * platforms. #396: the refusal must give the real reason and date.
 *
 * Removal is also a soft delete now: the ownership stays with status
 * "removed" and keeps its maintenance records, so re-adding the VIN brings
 * the car back as it was instead of starting over.
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
      nickname: "2018 Ford Mustang", mileage: 42000,
    });
    // A record on the ownership, so a lost history is visible if one happens.
    await ctx.db.insert("maintenance_records", {
      vehicleOwnerId: ownershipId, type: "oil", lastServiceMileage: 1000,
    } as any);
    let bookingId: string | null = null;
    if (status) {
      const shopId = await ctx.db.insert("shops", { name: "Chelala Service Center" } as any);
      bookingId = await ctx.db.insert("bookings", {
        user_id: userId, shop_id: shopId, status, vin: VIN, service_ids: [],
        scheduled_date: "2026-09-14", scheduled_time: "17:20", created_at: Date.now(),
      } as any);
    }
    return { userId, ownershipId, bookingId };
  });
}

const remove = (t: ReturnType<typeof makeT>, userId: unknown) =>
  t.mutation(api.vehicles.removeOwner, { vin: VIN, userId } as never);

const stateOf = (t: ReturnType<typeof makeT>, ownershipId: unknown) =>
  t.run(async (ctx: any) => ({
    ownership: await ctx.db.get(ownershipId),
    records: (await ctx.db.query("maintenance_records").collect()).length,
  }));

async function refusal(promise: Promise<unknown>): Promise<any> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error("expected the removal to be refused");
}

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
    const t = makeT();
    const { userId, ownershipId } = await seed(t, "in_progress");
    await expect(remove(t, userId)).rejects.toThrow();
    const state = await stateOf(t, ownershipId);
    expect(state.ownership.status).toBe("active");
    expect(state.records).toBe(1);
  });
});

describe("an upcoming booking still needs the car (#395)", () => {
  it.each(["confirmed", "pending", "pending_shop_acceptance", "pending_quote", "quotes_ready"])(
    "refuses to remove it while the booking is %s, naming the booking and its date",
    async (status) => {
      const t = makeT();
      const { userId, ownershipId, bookingId } = await seed(t, status);
      const err = await refusal(remove(t, userId));
      expect(err.data).toEqual({
        code: "VEHICLE_HAS_UPCOMING_BOOKING",
        bookingId: String(bookingId),
        dateLabel: "Mon, Sep 14",
        message: "Your 2018 Ford Mustang has a booking on Mon, Sep 14. Cancel it first to remove this car.",
      });
      expect((await stateOf(t, ownershipId)).ownership.status).toBe("active");
    },
  );

  it("points at the soonest open booking when there are several", async () => {
    const t = makeT();
    const { userId } = await seed(t, "confirmed"); // Sep 14
    const soonest = await t.run(async (ctx: any) => {
      const shopId = await ctx.db.insert("shops", { name: "Second shop" } as any);
      return await ctx.db.insert("bookings", {
        user_id: userId, shop_id: shopId, status: "pending", vin: VIN, service_ids: [],
        scheduled_date: "2026-09-10", scheduled_time: "08:00", created_at: Date.now(),
      } as any);
    });
    const err = await refusal(remove(t, userId));
    expect(err.data.bookingId).toBe(String(soonest));
    expect(err.data.message).toContain("Thu, Sep 10");
  });
});

describe("a removal is a soft delete", () => {
  it.each(["completed", "cancelled", "no_show", "declined"])(
    "removes the car after a %s job and keeps its history",
    async (status) => {
      const t = makeT();
      const { userId, ownershipId } = await seed(t, status);
      await remove(t, userId);
      const state = await stateOf(t, ownershipId);
      expect(state.ownership.status).toBe("removed");
      expect(state.ownership.removed_at).toEqual(expect.any(Number));
      expect(state.ownership.is_primary).toBe(false);
      expect(state.ownership.mileage).toBe(42000);
      expect(state.records).toBe(1);
    },
  );

  it("removes a car with no bookings at all", async () => {
    const t = makeT();
    const { userId, ownershipId } = await seed(t, null);
    await remove(t, userId);
    expect((await stateOf(t, ownershipId)).ownership.status).toBe("removed");
  });

  it("is a no-op on a car that is already removed", async () => {
    const t = makeT();
    const { userId, ownershipId } = await seed(t, null);
    await remove(t, userId);
    const firstRemovedAt = (await stateOf(t, ownershipId)).ownership.removed_at;
    await remove(t, userId);
    expect((await stateOf(t, ownershipId)).ownership.removed_at).toBe(firstRemovedAt);
  });

  it("brings the same car back, history and mileage included, when the VIN is re-added", async () => {
    const t = makeT();
    const { userId, ownershipId } = await seed(t, null);
    await remove(t, userId);
    const revivedId = await t.mutation(api.vehicles.addOwner, {
      vin: VIN, userId, nickname: "2018 Ford Mustang",
    } as never);
    expect(revivedId).toBe(ownershipId);
    const state = await stateOf(t, ownershipId);
    expect(state.ownership.status).toBe("active");
    expect(state.ownership.removed_at).toBeUndefined();
    expect(state.ownership.mileage).toBe(42000);
    // It was the only car, so it takes primary back.
    expect(state.ownership.is_primary).toBe(true);
    expect(state.records).toBe(1);
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
    expect((await stateOf(t, ownershipId)).ownership.status).toBe("removed");
  });
});

describe("the id-based path is guarded too", () => {
  // Two removal paths exist and the Cars tab can reach either. Guarding only
  // the one in the report would leave the bug alive by another route.
  it("refuses removeOwnerById during an active job", async () => {
    const t = makeT();
    const { ownershipId } = await seed(t, "in_progress");
    await expect(
      t.mutation(api.vehicles.removeOwnerById, { vehicleOwnerId: ownershipId } as never),
    ).rejects.toThrow(/at the shop right now/);
  });

  it("refuses removeOwnerById while a booking is upcoming", async () => {
    const t = makeT();
    const { ownershipId } = await seed(t, "confirmed");
    const err = await refusal(
      t.mutation(api.vehicles.removeOwnerById, { vehicleOwnerId: ownershipId } as never),
    );
    expect(err.data.code).toBe("VEHICLE_HAS_UPCOMING_BOOKING");
  });

  it("soft-deletes through removeOwnerById as well", async () => {
    const t = makeT();
    const { ownershipId } = await seed(t, null);
    await t.mutation(api.vehicles.removeOwnerById, { vehicleOwnerId: ownershipId } as never);
    const state = await stateOf(t, ownershipId);
    expect(state.ownership.status).toBe("removed");
    expect(state.records).toBe(1);
  });
});
