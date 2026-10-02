/**
 * #395 follow-up: removing a car is a soft delete, so its `vehicle_owners` row
 * stays behind with status "removed". Readers that find a driver's car by
 * (vin, user) used to get nothing once the row was deleted; now they get the
 * parked row. These pin what a removed car means to each of them:
 *   - current state and writes (Oto's car tools, mileage, primary, role, the
 *     check-in cron, the director's primary swap): the car is not in the garage;
 *   - history (receipts): the owner still reads their own past jobs;
 *   - walk-in claims: the row still holds its (vin, user) slot, so a car that
 *     comes back through a shop is revived, never duplicated.
 */
import { describe, expect, it } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { makeT } from "./helpers";

type T = ReturnType<typeof makeT>;

const VIN = "5YJ3E1EA7JF000001";
const SECOND_VIN = "1FA6P8CF5J5170067";
const STUB_VIN = "1GC4YSEY4RF211250";
const CLERK = "user_softdelete";

const asOwner = (t: T) => t.withIdentity({ subject: CLERK });

/** One driver, one enriched EV in their garage, one overdue service on it. */
async function seed(t: T) {
  return await t.run(async (ctx: any) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      clerkUserId: CLERK, onboardingCompleted: true, createdAt: now,
    });
    const makeId = await ctx.db.insert("makes", { name: "Tesla" });
    const modelId = await ctx.db.insert("models", { make_id: makeId, name: "Model 3" });
    const engineId = await ctx.db.insert("engines", {
      engine_code: "TESLA_EM", make_id: makeId, fuel_type: "Electric",
    } as any);
    const configId = await ctx.db.insert("vehicle_configs", {
      config_key: "2022_tesla_model3", year: 2022, make_id: makeId, model_id: modelId,
      engine_id: engineId, trim_name: "RWD", enrichment_status: "complete", fill_rate: 90,
    });
    const vehicleId = await ctx.db.insert("vehicles", {
      vin: VIN, year: 2022, vehicle_config_id: configId,
    } as any);
    const ownershipId = await ctx.db.insert("vehicle_owners", {
      vin: VIN, user_id: userId, status: "active", is_primary: true, added_at: now, mileage: 42000,
    });
    // An EV-inapplicable service next to a universal one, so applicability
    // filtering is visible in the catalog Oto offers.
    await ctx.db.insert("services", {
      name: "Oil Change", slug: "oil_change", created_at: now, requires_ice_engine: true,
    } as any);
    const rotationId = await ctx.db.insert("services", {
      name: "Tire Rotation", slug: "tire_rotation", created_at: now,
    } as any);
    await ctx.db.insert("vehicle_service_states", {
      vehicle_owner_id: ownershipId, service_id: rotationId, urgency: "overdue",
    });
    await ctx.db.insert("maintenance_records", {
      vehicleOwnerId: ownershipId, type: "tires", lastServiceMileage: 30000,
    } as any);
    return { userId, vehicleId, ownershipId };
  });
}

const removeCar = (t: T, userId: unknown) =>
  t.mutation(api.vehicles.removeOwner, { vin: VIN, userId } as never);

const row = (t: T, id: unknown) => t.run(async (ctx: any) => await ctx.db.get(id));

const addSecondCar = (t: T, userId: unknown, extra: Record<string, unknown> = {}) =>
  t.run(async (ctx: any) =>
    await ctx.db.insert("vehicle_owners", {
      vin: SECOND_VIN, user_id: userId, status: "active", is_primary: true,
      added_at: Date.now(), ...extra,
    }),
  );

describe("Oto's car tools treat a removed car as not in the garage", () => {
  it("get_due_services", async () => {
    const t = makeT();
    const { userId, vehicleId } = await seed(t);
    const args = { actingUserId: userId, vehicle_id: vehicleId } as never;
    expect(await t.query(internal.oto.dueServices.getDueServicesForUser, args)).toHaveLength(1);
    await removeCar(t, userId);
    await expect(
      t.query(internal.oto.dueServices.getDueServicesForUser, args),
    ).rejects.toThrow(/vehicle_owner not found/);
  });

  it("get_vehicle_health", async () => {
    const t = makeT();
    const { userId, vehicleId } = await seed(t);
    const args = { actingUserId: userId, vehicle_id: vehicleId } as never;
    const before: any = await t.query(internal.oto.vehicleHealth.getVehicleHealthForUser, args);
    expect(typeof before.score).toBe("number");
    await removeCar(t, userId);
    await expect(
      t.query(internal.oto.vehicleHealth.getVehicleHealthForUser, args),
    ).rejects.toThrow(/vehicle_owner not found/);
  });

  it("get_vehicle_facts", async () => {
    const t = makeT();
    const { userId, vehicleId } = await seed(t);
    const args = { actingUserId: userId, vehicle_id: vehicleId } as never;
    await t.query(internal.oto.vehicleFacts.getVehicleFactsForUser, args);
    await removeCar(t, userId);
    await expect(
      t.query(internal.oto.vehicleFacts.getVehicleFactsForUser, args),
    ).rejects.toThrow(/not authorized/);
  });

  it("list_services_for_vehicle falls open to the full catalog", async () => {
    const t = makeT();
    const { userId, vehicleId } = await seed(t);
    const args = { actingUserId: userId, vehicle_id: vehicleId } as never;
    const owned = await t.query(internal.oto.applicableServices.listServicesForUserVehicle, args);
    expect(owned.map((s: any) => s.slug)).toEqual(["tire_rotation"]);
    await removeCar(t, userId);
    const removed = await t.query(internal.oto.applicableServices.listServicesForUserVehicle, args);
    expect(removed).toHaveLength(2);
  });

  it("the record-confirmation card", async () => {
    const t = makeT();
    const { userId, vehicleId } = await seed(t);
    const args = { vehicle_id: vehicleId, maintenance_type: "tires" } as never;
    const before = await asOwner(t).query(api.oto.recordConfirmation.getRecordForConfirmation, args);
    expect(before.record).not.toBeNull();
    await removeCar(t, userId);
    await expect(
      asOwner(t).query(api.oto.recordConfirmation.getRecordForConfirmation, args),
    ).rejects.toThrow(/vehicle_owner not found/);
  });

  it("a mileage update from chat writes nothing", async () => {
    const t = makeT();
    const { userId, vehicleId, ownershipId } = await seed(t);
    await removeCar(t, userId);
    await expect(
      asOwner(t).mutation(api.vehicleTruth.applyVehicleTruth, {
        vehicle_id: vehicleId, mileage: 43000,
      } as never),
    ).rejects.toThrow(/vehicle_owner not found/);
    expect((await row(t, ownershipId)).mileage).toBe(42000);
  });
});

describe("garage mutations refuse a removed car", () => {
  const calls: Array<[string, (t: T, userId: unknown) => Promise<unknown>]> = [
    ["updateMileage", (t, userId) =>
      t.mutation(api.vehicles.updateMileage, { vin: VIN, userId, mileage: 50000 } as never)],
    ["updateOwnershipPrimary", (t, userId) =>
      t.mutation(api.vehicles.updateOwnershipPrimary, { vin: VIN, userId, is_primary: true } as never)],
    ["setVehicleRole", (t, userId) =>
      t.mutation(api.vehicles.setVehicleRole, { vin: VIN, userId, role: "primary" } as never)],
  ];

  it.each(calls)("%s leaves the removed car and the car still in the garage alone", async (_name, call) => {
    const t = makeT();
    const { userId, ownershipId } = await seed(t);
    await removeCar(t, userId);
    const keptId = await addSecondCar(t, userId);
    await expect(call(t, userId)).rejects.toThrow(/isn't listed as an owner/);
    const removed = await row(t, ownershipId);
    expect(removed.mileage).toBe(42000);
    expect(removed.is_primary).toBe(false);
    expect(removed.garageRole).toBeUndefined();
    // Making the removed car primary used to take primary from this one.
    expect((await row(t, keptId)).is_primary).toBe(true);
  });
});

describe("the daily check-in cron", () => {
  it("marks an overdue car in the garage and leaves a removed one as it was", async () => {
    const t = makeT();
    const { userId, ownershipId } = await seed(t);
    const longOverdue = Date.now() - 90 * 86_400_000;
    await t.run(async (ctx: any) => ctx.db.patch(ownershipId, { next_checkin_due: longOverdue }));
    await removeCar(t, userId);
    const keptId = await addSecondCar(t, userId, { next_checkin_due: longOverdue });
    await t.mutation(internal.checkin.markEstimatedHealthScores, {});
    expect((await row(t, keptId)).health_score_is_estimated).toBe(true);
    expect((await row(t, ownershipId)).health_score_is_estimated).toBeUndefined();
  });
});

describe("the inspection's owner-profile fallback", () => {
  it("never borrows a removed car's answers", async () => {
    const t = makeT();
    const { userId, ownershipId } = await seed(t);
    await t.run(async (ctx: any) => ctx.db.patch(ownershipId, { garageRole: "weekend" }));
    await removeCar(t, userId);
    // The booking's VIN has no ownership row of its own, so the lookup falls
    // back to "any car of this driver".
    const bookingId = await t.run(async (ctx: any) => {
      const staffId = await ctx.db.insert("users", {
        clerkUserId: "user_staff", onboardingCompleted: true, createdAt: Date.now(),
      });
      const shopId = await ctx.db.insert("shops", { name: "Chelala", owner_user_id: staffId } as any);
      return await ctx.db.insert("bookings", {
        user_id: userId, shop_id: shopId, status: "in_progress", vin: SECOND_VIN, service_ids: [],
        scheduled_date: "2026-10-01", scheduled_time: "09:00", created_at: Date.now(),
      } as any);
    });
    const profile = await t
      .withIdentity({ subject: "user_staff" })
      .query(api.inspections.getOwnerProfileForBooking, { bookingId } as never);
    expect(profile).toEqual({});
  });
});

describe("the director's primary-owner swap", () => {
  it("refuses a driver who removed the car and keeps the current primary", async () => {
    const t = makeT();
    const { userId, vehicleId } = await seed(t);
    await removeCar(t, userId);
    const currentId = await t.run(async (ctx: any) => {
      const nextOwner = await ctx.db.insert("users", {
        clerkUserId: "user_next_owner", onboardingCompleted: true, createdAt: Date.now(),
      });
      return await ctx.db.insert("vehicle_owners", {
        vin: VIN, user_id: nextOwner, status: "active", is_primary: true, added_at: Date.now(),
      });
    });
    const res = await t.mutation(api.directorVehicleActions.reassignPrimaryOwner, {
      vehicleId, newOwnerUserId: userId, actorName: "Test Director",
    } as never);
    expect(res).toEqual({ ok: false, reason: "user_is_not_owner" });
    expect((await row(t, currentId)).is_primary).toBe(true);
  });
});

describe("claiming a walk-in", () => {
  async function seedStub(t: T, vin: string, status: string) {
    return await t.run(async (ctx: any) => {
      const stubId = await ctx.db.insert("users", {
        clerkUserId: `shop-created-${Date.now()}-softdelete`, phone: "+19175550100",
        onboardingCompleted: false, createdAt: Date.now(),
        claim_token: "tok_softdelete", claim_token_expires_at: Date.now() + 86_400_000,
      });
      const stubOwnershipId = await ctx.db.insert("vehicle_owners", {
        vin, user_id: stubId, status, is_primary: true, added_at: Date.now(),
      });
      return { stubId, stubOwnershipId };
    });
  }

  const claim = (t: T) =>
    asOwner(t).mutation(api.walkin_claims.claimByToken, { token: "tok_softdelete" });
  const garage = (t: T, userId: unknown) =>
    t.query(api.vehicles.listVehiclesByUser, { userId } as never);
  const rowsFor = (t: T, vin: string, userId: unknown) =>
    t.run(async (ctx: any) =>
      await ctx.db
        .query("vehicle_owners")
        .withIndex("by_vin_user", (q: any) => q.eq("vin", vin).eq("user_id", userId))
        .collect(),
    );

  it("brings back a car the driver removed when it comes in with them, as the same row", async () => {
    const t = makeT();
    const { userId, ownershipId } = await seed(t);
    await removeCar(t, userId);
    const { stubOwnershipId } = await seedStub(t, VIN, "active");
    await claim(t);
    const cars = await garage(t, userId);
    expect(cars.map((c: any) => c.vin)).toEqual([VIN]);
    expect(cars[0].ownership._id).toBe(ownershipId);
    expect(cars[0].ownership.is_primary).toBe(true);
    expect(await rowsFor(t, VIN, userId)).toHaveLength(1);
    expect((await row(t, stubOwnershipId)).status).toBe("inactive");
  });

  it("does not move a car the walk-in's garage no longer has", async () => {
    const t = makeT();
    await seed(t);
    const { stubId, stubOwnershipId } = await seedStub(t, STUB_VIN, "removed");
    const res: any = await claim(t);
    expect(res.vehiclesMoved).toBe(0);
    expect((await row(t, stubOwnershipId)).user_id).toBe(stubId);
  });

  it("a repeat claim does not revive a car the driver removed after the first one", async () => {
    const t = makeT();
    const { userId, ownershipId } = await seed(t);
    // First claim: the driver already has this car, so the stub's row retires.
    const { stubId } = await seedStub(t, VIN, "active");
    await claim(t);
    await removeCar(t, userId);
    // A later walk-in for another car lands on the same stub, with a new link.
    await t.run(async (ctx: any) => {
      await ctx.db.patch(stubId, {
        claim_token: "tok_softdelete", claim_token_expires_at: Date.now() + 86_400_000,
      });
      await ctx.db.insert("vehicle_owners", {
        vin: STUB_VIN, user_id: stubId, status: "active", is_primary: true, added_at: Date.now(),
      });
    });
    await claim(t);
    expect((await row(t, ownershipId)).status).toBe("removed");
    expect((await garage(t, userId)).map((c: any) => c.vin)).toEqual([STUB_VIN]);
  });
});

describe("history survives the removal", () => {
  it("the owner still reads the receipt for a past job on a removed car", async () => {
    const t = makeT();
    const { userId } = await seed(t);
    const bookingId = await t.run(async (ctx: any) => {
      const shopId = await ctx.db.insert("shops", { name: "Chelala Service Center" } as any);
      return await ctx.db.insert("bookings", {
        user_id: userId, shop_id: shopId, status: "completed", vin: VIN, service_ids: [],
        scheduled_date: "2026-09-14", scheduled_time: "17:20", created_at: Date.now(),
      } as any);
    });
    await removeCar(t, userId);
    const receipt: any = await asOwner(t).query(api.bookings.getReceipt, { bookingId } as never);
    expect(receipt?.shop?.name).toBe("Chelala Service Center");
    expect(receipt?.vehicle.vin_last4).toBe(VIN.slice(-4));
    expect(receipt?.vehicle.year).toBe(2022);
  });
});
