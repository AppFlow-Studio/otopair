import { describe, it, expect } from "vitest";
import { makeT } from "./helpers";
import { api, internal } from "../convex/_generated/api";

describe("applyVehicleTruth", () => {
  async function seed(t: any) {
    return await t.run(async (ctx: any) => {
      const userId = await ctx.db.insert("users", { clerkUserId: "clerk_vt", email: "vt@test.local", role: "user", createdAt: 1 });
      const vehicleId = await ctx.db.insert("vehicles", { vin: "VTVIN0000000000001" } as any);
      const ownerId = await ctx.db.insert("vehicle_owners", {
        vin: "VTVIN0000000000001", user_id: userId, status: "active", mileage: 40000, preOnboardingComplete: true,
      } as any);
      const serviceId = await ctx.db.insert("services", { name: "Oil Change", slug: "oil_change" } as any);
      return { userId, vehicleId, ownerId, serviceId };
    });
  }
  const ident = { subject: "clerk_vt", tokenIdentifier: "clerk_vt" };

  it("writes a plausible mileage + provenance", async () => {
    const t = makeT(); const s = await seed(t);
    const res = await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, { vehicle_id: s.vehicleId, mileage: 46796 });
    expect(res.needsReconfirm).toBeFalsy();
    const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
    expect(owner.mileage).toBe(46796);
    expect(owner.mileage_source).toBe("chat_self_reported");
    expect(typeof owner.mileage_updated_at).toBe("number");
  });
  it("refuses a backward odometer (needsReconfirm), no write", async () => {
    const t = makeT(); const s = await seed(t);
    const res = await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, { vehicle_id: s.vehicleId, mileage: 30000 });
    expect(res.needsReconfirm).toBe(true);
    expect(res.reason).toBe("backward");
    const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
    expect(owner.mileage).toBe(40000);
  });
  // A COMPLETED-service report must CLEAR the flag + record the service done —
  // the opposite of a "due" claim. This is the inversion bug: "I did my brakes"
  // was flagging brakes as a problem and dropping the score.
  describe("completed service claim", () => {
    it("clears the warning code + records the service done (does NOT flag it)", async () => {
      const t = makeT(); const s = await seed(t);
      // Brake warning is currently flagged (e.g. from onboarding / a prior turn).
      await t.run((ctx: any) => ctx.db.patch(s.ownerId, { knownIssues: ["brake_warning"] }));

      const res = await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, {
        vehicle_id: s.vehicleId, mileage: 41000,
        service_claims: [{ service_slug: "brake_pad_replacement", kind: "completed" }],
      });
      expect(res.ok).toBe(true);
      expect(res.servicesCompleted).toContain("brake_pad_replacement");
      expect(res.servicesFlagged ?? []).not.toContain("brake_pad_replacement");

      const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
      expect((owner.knownIssues ?? []).includes("brake_warning")).toBe(false);

      const rec: any = await t.run((ctx: any) =>
        ctx.db.query("maintenance_records")
          .withIndex("by_vehicle_and_type", (q: any) => q.eq("vehicleOwnerId", s.ownerId).eq("type", "brakes"))
          .unique());
      expect(rec).not.toBeNull();
      expect(typeof rec.lastServiceDate).toBe("number");
      expect(rec.lastServiceMileage).toBe(41000);
    });

    it("a completed claim and a due claim in one card behave independently", async () => {
      const t = makeT(); const s = await seed(t);
      await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, {
        vehicle_id: s.vehicleId,
        service_claims: [
          { service_slug: "brake_pad_replacement", kind: "completed" },
          { service_slug: "oil_change", kind: "due" },
        ],
      });
      const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
      // oil flagged, brakes not.
      expect((owner.knownIssues ?? []).includes("oil_pressure")).toBe(true);
      expect((owner.knownIssues ?? []).includes("brake_warning")).toBe(false);
    });
  });

  // Past-dated completed service — "I did my oil at 89,000 (now at 90,000)" /
  // "a week ago". The record's anchor must land on the PAST mileage/date so the
  // maintenance pipeline projects next-due from THEN, not from now/current.
  describe("past-dated completed service (re-anchors the maintenance record)", () => {
    it("records the service at the stated PAST mileage, not the current odometer", async () => {
      const t = makeT(); const s = await seed(t); // current odometer 40000
      const res = await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, {
        vehicle_id: s.vehicleId,
        service_claims: [{ service_slug: "oil_change", kind: "completed", service_mileage: 35000 }],
      });
      expect(res.ok).toBe(true);
      // 35000 is BELOW current 40000 — must NOT be rejected as "backward" (that
      // guard is scoped to the current-odometer field only).
      expect(res.needsReconfirm).toBeFalsy();
      const rec: any = await t.run((ctx: any) =>
        ctx.db.query("maintenance_records")
          .withIndex("by_vehicle_and_type", (q: any) => q.eq("vehicleOwnerId", s.ownerId).eq("type", "oil"))
          .unique());
      expect(rec.lastServiceMileage).toBe(35000); // the PAST anchor, not 40000
      const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
      expect(owner.mileage).toBe(40000); // current odometer untouched
    });

    it("resolves service_age_days to lastServiceDate ≈ now − days", async () => {
      const t = makeT(); const s = await seed(t);
      const before = Date.now();
      await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, {
        vehicle_id: s.vehicleId,
        service_claims: [{ service_slug: "oil_change", kind: "completed", service_age_days: 7 }],
      });
      const rec: any = await t.run((ctx: any) =>
        ctx.db.query("maintenance_records")
          .withIndex("by_vehicle_and_type", (q: any) => q.eq("vehicleOwnerId", s.ownerId).eq("type", "oil"))
          .unique());
      const expected = before - 7 * 24 * 60 * 60 * 1000;
      expect(Math.abs(rec.lastServiceDate - expected)).toBeLessThan(60_000);
    });

    it("an absolute service_date wins over service_age_days", async () => {
      const t = makeT(); const s = await seed(t);
      const exact = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago, explicit
      await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, {
        vehicle_id: s.vehicleId,
        service_claims: [{ service_slug: "oil_change", kind: "completed", service_age_days: 7, service_date: exact }],
      });
      const rec: any = await t.run((ctx: any) =>
        ctx.db.query("maintenance_records")
          .withIndex("by_vehicle_and_type", (q: any) => q.eq("vehicleOwnerId", s.ownerId).eq("type", "oil"))
          .unique());
      expect(rec.lastServiceDate).toBe(exact);
    });

    it("falls back to current odometer + now when no past values are given", async () => {
      const t = makeT(); const s = await seed(t);
      const before = Date.now();
      await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, {
        vehicle_id: s.vehicleId, mileage: 41000,
        service_claims: [{ service_slug: "oil_change", kind: "completed" }],
      });
      const rec: any = await t.run((ctx: any) =>
        ctx.db.query("maintenance_records")
          .withIndex("by_vehicle_and_type", (q: any) => q.eq("vehicleOwnerId", s.ownerId).eq("type", "oil"))
          .unique());
      expect(rec.lastServiceMileage).toBe(41000); // current-odometer fallback
      expect(rec.lastServiceDate).toBeGreaterThanOrEqual(before - 1000); // ~now
    });

    it("ignores an implausible service_mileage above the current odometer", async () => {
      const t = makeT(); const s = await seed(t); // current 40000
      await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, {
        vehicle_id: s.vehicleId,
        service_claims: [{ service_slug: "oil_change", kind: "completed", service_mileage: 99999 }],
      });
      const rec: any = await t.run((ctx: any) =>
        ctx.db.query("maintenance_records")
          .withIndex("by_vehicle_and_type", (q: any) => q.eq("vehicleOwnerId", s.ownerId).eq("type", "oil"))
          .unique());
      // 99999 > current 40000 → rejected → fall back to current odometer.
      expect(rec.lastServiceMileage).toBe(40000);
    });
  });

  it("adds the service warning-light code to knownIssues from a maintenance-reminder claim", async () => {
    const t = makeT(); const s = await seed(t);
    await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, {
      vehicle_id: s.vehicleId, service_claims: [{ service_slug: "oil_change", kind: "light_on" }],
    });
    const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
    expect((owner.knownIssues ?? []).includes("oil_pressure")).toBe(true);
  });
  it("appends a fault light to knownIssues", async () => {
    const t = makeT(); const s = await seed(t);
    await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, { vehicle_id: s.vehicleId, fault_lights: ["check_engine"] });
    const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
    expect((owner.knownIssues ?? []).includes("check_engine")).toBe(true);
  });

  it("canonicalizes a non-canonical fault-light id before writing (tire_pressure -> tpms)", async () => {
    const t = makeT(); const s = await seed(t);
    const res = await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, { vehicle_id: s.vehicleId, fault_lights: ["tire_pressure"] });
    const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
    expect((owner.knownIssues ?? []).includes("tpms")).toBe(true);
    expect((owner.knownIssues ?? []).includes("tire_pressure")).toBe(false);
    expect(res.faultLightsAdded).toContain("tpms");
  });

  it("strips a stale no_all_clear sentinel when a light is logged (the corruption fix)", async () => {
    const t = makeT(); const s = await seed(t);
    await t.run((ctx: any) => ctx.db.patch(s.ownerId, { knownIssues: ["no_all_clear"] }));
    await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, { vehicle_id: s.vehicleId, fault_lights: ["oil_pressure"] });
    const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
    expect((owner.knownIssues ?? []).includes("oil_pressure")).toBe(true);
    expect((owner.knownIssues ?? []).includes("no_all_clear")).toBe(false);
  });

  // Director-path: the no-auth internal writer the Oto-Sim card-confirm goes
  // through (resolves user by id + vehicle by vin instead of Clerk identity).
  describe("applyVehicleTruthForDirectorMutation (sim card-confirm path)", () => {
    it("writes a plausible mileage for the resolved user + vin", async () => {
      const t = makeT(); const s = await seed(t);
      const res = await t.mutation(internal.vehicleTruth.applyVehicleTruthForDirectorMutation, {
        user_id: s.userId, vehicle_vin: "VTVIN0000000000001", mileage: 46796,
      });
      expect(res.ok).toBe(true);
      const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
      expect(owner.mileage).toBe(46796);
      expect(owner.mileage_source).toBe("chat_self_reported");
    });
    it("refuses a backward odometer (needsReconfirm), no write", async () => {
      const t = makeT(); const s = await seed(t);
      const res = await t.mutation(internal.vehicleTruth.applyVehicleTruthForDirectorMutation, {
        user_id: s.userId, vehicle_vin: "VTVIN0000000000001", mileage: 30000,
      });
      expect(res.needsReconfirm).toBe(true);
      const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
      expect(owner.mileage).toBe(40000);
    });
    it("flags a service claim into knownIssues", async () => {
      const t = makeT(); const s = await seed(t);
      await t.mutation(internal.vehicleTruth.applyVehicleTruthForDirectorMutation, {
        user_id: s.userId, vehicle_vin: "VTVIN0000000000001",
        service_claims: [{ service_slug: "oil_change", kind: "light_on" }],
      });
      const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
      expect((owner.knownIssues ?? []).includes("oil_pressure")).toBe(true);
    });
    it("throws on an unknown vin", async () => {
      const t = makeT(); const s = await seed(t);
      await expect(
        t.mutation(internal.vehicleTruth.applyVehicleTruthForDirectorMutation, {
          user_id: s.userId, vehicle_vin: "NOSUCHVIN000000000", mileage: 46796,
        }),
      ).rejects.toThrow();
    });
  });

  // Reconfirm path — an absurd_forward jump (seed 40000 + 25k floor = 65000
  // ceiling) is reconfirmable; backward / implausible are hard-invalid.
  describe("reconfirm override", () => {
    it("an absurd_forward rejection is flagged reconfirmable + carries current/maxAllowed", async () => {
      const t = makeT(); const s = await seed(t);
      const res = await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, {
        vehicle_id: s.vehicleId, mileage: 90000,
      });
      expect(res.ok).toBe(false);
      expect(res.needsReconfirm).toBe(true);
      expect(res.reason).toBe("absurd_forward");
      expect(res.reconfirmable).toBe(true);
      expect(res.current).toBe(40000);
      expect(res.maxAllowed).toBe(65000);
    });
    it("reconfirmed:true applies the absurd_forward mileage", async () => {
      const t = makeT(); const s = await seed(t);
      const res = await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, {
        vehicle_id: s.vehicleId, mileage: 90000, reconfirmed: true,
      });
      expect(res.ok).toBe(true);
      const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
      expect(owner.mileage).toBe(90000);
    });
    it("reconfirmed:true does NOT override a backward odometer", async () => {
      const t = makeT(); const s = await seed(t);
      const res = await t.withIdentity(ident).mutation(api.vehicleTruth.applyVehicleTruth, {
        vehicle_id: s.vehicleId, mileage: 30000, reconfirmed: true,
      });
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("backward");
      expect(res.reconfirmable).toBe(false);
      const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
      expect(owner.mileage).toBe(40000);
    });
    it("reconfirmed flows through the director path too", async () => {
      const t = makeT(); const s = await seed(t);
      const res = await t.mutation(internal.vehicleTruth.applyVehicleTruthForDirectorMutation, {
        user_id: s.userId, vehicle_vin: "VTVIN0000000000001", mileage: 90000, reconfirmed: true,
      });
      expect(res.ok).toBe(true);
      const owner: any = await t.run((ctx: any) => ctx.db.get(s.ownerId));
      expect(owner.mileage).toBe(90000);
    });
  });
});
