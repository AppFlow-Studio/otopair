import { describe, expect, it } from "vitest";

import { api } from "../convex/_generated/api";
import { identityFor, makeT } from "./helpers";

const CLERK_ID = "clerk_pre_onboarding_progress";

async function seedOwner(t: ReturnType<typeof makeT>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkUserId: CLERK_ID,
      email: "progress@test.local",
      role: "user",
      createdAt: Date.now(),
    });
    return await ctx.db.insert("vehicle_owners", {
      vin: "1HGCM82633A004352",
      user_id: userId,
      status: "active",
    });
  });
}

describe("saveVehiclePreOnboardingProgress", () => {
  it("persists partial answers without completing pre-onboarding", async () => {
    const t = makeT();
    const vehicleOwnerId = await seedOwner(t);
    const saveProgress = api.vehicles.saveVehiclePreOnboardingProgress;

    await t.withIdentity(identityFor(CLERK_ID)).mutation(saveProgress, {
      vehicleOwnerId,
      ownershipType: "owned",
      ownedSinceNew: false,
    });
    await t.withIdentity(identityFor(CLERK_ID)).mutation(saveProgress, {
      vehicleOwnerId,
      mileageAtPurchaseNotSure: true,
    });

    await t.run(async (ctx) => {
      const owner = await ctx.db.get(vehicleOwnerId);
      expect(owner?.ownershipType).toBe("owned");
      expect(owner?.ownedSinceNew).toBe(false);
      expect(owner?.mileageAtPurchaseNotSure).toBe(true);
      expect(owner?.preOnboardingComplete).not.toBe(true);
    });
  });

  it("refuses to modify another user's vehicle", async () => {
    const t = makeT();
    const vehicleOwnerId = await seedOwner(t);
    const saveProgress = api.vehicles.saveVehiclePreOnboardingProgress;
    const attackerClerkId = "clerk_pre_onboarding_attacker";
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkUserId: attackerClerkId,
        email: "attacker@test.local",
        role: "user",
        createdAt: Date.now(),
      });
    });

    await expect(
      t.withIdentity(identityFor(attackerClerkId)).mutation(saveProgress, {
        vehicleOwnerId,
        ownershipType: "leased",
      }),
    ).rejects.toThrow("Not authorized for this vehicle");

    await t.run(async (ctx) => {
      const owner = await ctx.db.get(vehicleOwnerId);
      expect(owner?.ownershipType).toBeUndefined();
    });
  });
});
