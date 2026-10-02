/**
 * get_vehicle_health listed a bare "Temperature / overheating warning light",
 * and a turn later Oto told the user "earlier in this chat you mentioned a
 * temperature warning light" — a shop's inspection had flagged it, not the
 * user (2026-10-01 runs). Each light now says where it came from, read from
 * known_issue_events.
 */
import { describe, expect, it } from "vitest";
import { makeT } from "./helpers";
import { internal } from "../convex/_generated/api";
import { describeKnownIssues } from "../convex/oto/vehicleHealth";

// 3 PM and 10 PM in New York on Sep 27; the second is already Sep 28 in UTC.
const SEP_27_3PM = Date.UTC(2026, 8, 27, 19);
const SEP_27_10PM = Date.UTC(2026, 8, 28, 2);

describe("each warning light says where it came from", () => {
  it("names the source and the New York day of the latest change", () => {
    expect(
      describeKnownIssues(
        ["temperature", "tpms", "check_engine", "abs"],
        [
          // newest first
          { code: "check_engine", action: "cleared", source: "service_completion", source_detail: "bk_1", created_at: SEP_27_10PM },
          { code: "temperature", action: "added", source: "mechanic_inspection", source_detail: "Kareem-Shop", created_at: SEP_27_10PM },
          { code: "tire_pressure", action: "added", source: "check_in", source_detail: "chk_1", created_at: SEP_27_3PM },
          { code: "check_engine", action: "added", source: "oto", created_at: SEP_27_3PM },
        ],
      ),
    ).toEqual([
      "Temperature / overheating warning light — flagged at a mechanic inspection at Kareem-Shop on Sep 27",
      // tire_pressure is the old alias for tpms
      "Tire pressure (TPMS) warning light — reported by the driver in a check-in on Sep 27",
      // its latest event cleared it, so whatever put it back wasn't logged
      "Check engine light — on the car's record",
      "ABS / brake warning light — on the car's record",
    ]);
  });

  it("labels an Oto-logged light, and stays quiet with no lights", () => {
    expect(describeKnownIssues(["oil_pressure"], [{ code: "oil_pressure", action: "added", source: "oto", created_at: SEP_27_3PM }])).toEqual([
      "Oil pressure warning light — confirmed by the driver in an Oto chat on Sep 27",
    ]);
    expect(describeKnownIssues([], [])).toBeUndefined();
  });

  it("reads the events from the table, newest first", async () => {
    const t = makeT();
    const VIN = "OTOKISVIN000000001";
    const { userId, vehicleId } = await t.run(async (ctx: any) => {
      const userId = await ctx.db.insert("users", { clerkUserId: "clerk_kis", email: "kis@test.local", role: "user", createdAt: 1 });
      const vehicleId = await ctx.db.insert("vehicles", { vin: VIN, metadata: { make: "BMW" } } as any);
      const ownerId = await ctx.db.insert("vehicle_owners", {
        vin: VIN,
        user_id: userId,
        status: "active",
        mileage: 91000,
        knownIssues: ["temperature"],
        preOnboardingComplete: true,
      } as any);
      // An older check-in report, then the shop's inspection.
      await ctx.db.insert("known_issue_events", {
        vehicle_owner_id: ownerId, code: "temperature", action: "added", source: "check_in", source_detail: "chk_9", created_at: SEP_27_3PM - 86_400_000 * 10,
      });
      await ctx.db.insert("known_issue_events", {
        vehicle_owner_id: ownerId, code: "temperature", action: "added", source: "mechanic_inspection", source_detail: "Kareem-Shop", created_at: SEP_27_3PM,
      });
      return { userId, vehicleId };
    });
    const res: any = await t.query(internal.oto.vehicleHealth.getVehicleHealthForUser, {
      actingUserId: userId,
      vehicle_id: vehicleId,
    });
    expect(res.known_issues).toEqual([
      "Temperature / overheating warning light — flagged at a mechanic inspection at Kareem-Shop on Sep 27",
    ]);
  });
});
