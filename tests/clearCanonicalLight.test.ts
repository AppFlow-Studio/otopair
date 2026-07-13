import { describe, it, expect } from "vitest";
import { makeT } from "./helpers";
import { api } from "../convex/_generated/api";

// A fault light is stored CANONICALLY (e.g. "abs"), but the clear-path removes the
// SYMPTOM code ("brake_warning"). Completing the service must clear the light in
// EITHER vocabulary — otherwise "I did my brakes" left the ABS light active.
const VIN = "CLRCANON0000000001";

async function seed(t: any, knownIssues: string[]) {
  return await t.run(async (ctx: any) => {
    const userId = await ctx.db.insert("users", { clerkUserId: "c_cc", email: "cc@t.local", role: "user", createdAt: 1 });
    const vehicleId = await ctx.db.insert("vehicles", { vin: VIN } as any);
    const ownerId = await ctx.db.insert("vehicle_owners", {
      vin: VIN, user_id: userId, status: "active", mileage: 40000, preOnboardingComplete: true, knownIssues,
    } as any);
    return { userId, vehicleId, ownerId };
  });
}
const ident = { subject: "c_cc", tokenIdentifier: "c_cc" };

describe("completing a service clears the canonically-stored warning light", () => {
  it("applyVehicleTruth: completing brakes clears an 'abs' light (not just 'brake_warning')", async () => {
    const t = makeT();
    const s = await seed(t, ["abs"]);
    await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, {
      vehicle_id: s.vehicleId,
      service_claims: [{ service_slug: "brake_pad_replacement", kind: "completed" }],
    });
    const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
    expect((owner.knownIssues ?? []).includes("abs")).toBe(false); // the fix
  });

  it("upsertRecord: recording brakes done clears an 'abs' light", async () => {
    const t = makeT();
    const s = await seed(t, ["abs", "check_engine"]);
    await t.run((ctx: any) => ctx.db.insert("maintenance_records", { vehicleOwnerId: s.ownerId, type: "brakes", createdAt: 1, updatedAt: 1 } as any));
    await t.mutation(api.maintenance.upsertRecord, { vehicleOwnerId: s.ownerId, type: "brakes", lastServiceMileage: 40000 });
    const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
    expect((owner.knownIssues ?? []).includes("abs")).toBe(false);        // cleared
    expect((owner.knownIssues ?? []).includes("check_engine")).toBe(true); // untouched
  });

  it("applyVehicleTruth: completing battery clears a 'battery_charging' light", async () => {
    const t = makeT();
    const s = await seed(t, ["battery_charging"]);
    await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, {
      vehicle_id: s.vehicleId,
      service_claims: [{ service_slug: "battery_replacement", kind: "completed" }],
    });
    const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
    expect((owner.knownIssues ?? []).includes("battery_charging")).toBe(false);
  });
});

// Every routine dashboard light clears when ITS corresponding service is logged
// as completed — the "all diagnostic lights clear with their service" contract.
describe("each warning light clears when its corresponding service is completed", () => {
  const CASES: Array<[string, string]> = [
    ["oil_change", "oil_pressure"],
    ["brake_pad_replacement", "abs"],
    ["rotor_replacement", "abs"],
    ["brake_fluid_flush", "abs"],
    ["battery_replacement", "battery_charging"],
    ["battery_test", "battery_charging"],
    ["coolant_flush", "temperature"],
    ["transmission_service", "transmission"],
    ["tire_rotation", "tpms"],
    ["tire_balance", "tpms"],
    ["wheel_alignment", "tpms"],
  ];
  for (const [slug, light] of CASES) {
    it(`${slug} clears the ${light} light`, async () => {
      const t = makeT();
      // Seed the target light + an unrelated one that must survive.
      const s = await seed(t, [light, "check_engine"]);
      await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, {
        vehicle_id: s.vehicleId,
        service_claims: [{ service_slug: slug, kind: "completed" }],
      });
      const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
      expect((owner.knownIssues ?? []).includes(light)).toBe(false); // cleared
      expect((owner.knownIssues ?? []).includes("check_engine")).toBe(true); // untouched
    });
  }
});
