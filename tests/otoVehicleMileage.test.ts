/**
 * #425 (Kareem/Anesa, Sep 27): asked "How many miles are on my car?", Oto said
 * "I don't have your current mileage on file" while the Cars page showed the
 * number. Reproduced 2026-09-28: the per-turn <vehicle> block carried no
 * mileage and no tool call was made. A second path, onboarding's mileage
 * write, skipped `mileage_updated_at`, so any older shop-passport reading beat
 * the garage value and Oto could quote a stale number.
 */
import { describe, expect, it } from "vitest";
import { api, internal } from "../convex/_generated/api";
import { buildEnvelope } from "../convex/oto/envelope";
import { makeT } from "./helpers";

const VIN = "WBSJF0C03LCD42488";

const envelopeFor = (mileage: number | null | undefined) =>
  buildEnvelope({
    userFirstName: "Waleed",
    vehicle: { id: "veh_m5", display: "2020 BMW M5", vin: VIN, mileage },
    history: [],
    userMessage: "How many miles are on my car?",
  });

describe("the <vehicle> block carries the garage mileage", () => {
  it("includes the current mileage", () => {
    expect(envelopeFor(91000)).toContain("current_mileage: 91,000 mi");
  });

  it("omits the line when there is no mileage", () => {
    expect(envelopeFor(null)).not.toContain("current_mileage");
    expect(envelopeFor(undefined)).not.toContain("current_mileage");
  });
});

async function seedCar(t: ReturnType<typeof makeT>) {
  return await t.run(async (ctx: any) => {
    const userId = await ctx.db.insert("users", {
      clerkUserId: "user_mileage", onboardingCompleted: true, createdAt: Date.now(),
    });
    const ownershipId = await ctx.db.insert("vehicle_owners", {
      vin: VIN, user_id: userId, status: "active", is_primary: true, added_at: Date.now(),
    });
    // A shop reported 40,000 a while back.
    await ctx.db.insert("vehicle_passports", {
      vin: VIN, mileage: 40000, last_reported_at: Date.now() - 86_400_000,
    } as any);
    return { userId, ownershipId };
  });
}

describe("the mileage Oto reads matches the one the driver entered", () => {
  it("prefers mileage entered during car setup over an older shop reading", async () => {
    const t = makeT();
    const { ownershipId } = await seedCar(t);
    await t.mutation(api.vehicles.saveOnboardingField, {
      vehicleOwnerId: ownershipId, field: "mileage", value: 91000,
    } as never);
    const mileage = await t.query(internal.oto.vehicleFacts.getActiveVehicleMileage, {
      ownershipId,
    } as never);
    expect(mileage).toBe(91000);
  });

  it("returns nothing for a removed car", async () => {
    const t = makeT();
    const { ownershipId } = await seedCar(t);
    await t.run(async (ctx: any) => ctx.db.patch(ownershipId, { status: "removed" }));
    const mileage = await t.query(internal.oto.vehicleFacts.getActiveVehicleMileage, {
      ownershipId,
    } as never);
    expect(mileage).toBeNull();
  });
});
