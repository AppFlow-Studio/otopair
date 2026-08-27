/**
 * No record on file must read as "we don't know", never as "it's fine".
 *
 * For a vehicle with no maintenance records, buildMergedMaintenanceItems used
 * to invent statuses: brakes/tires/battery `on_time` ("No brake concerns
 * reported") and oil `due_soon`. Two consequences, both bad.
 *
 * The user saw safety claims the app had no basis for — a 300,000-mile Q5 was
 * told its brakes, tires and battery were in good order.
 *
 * And they scored. §08 excludes `unknown` items from the health average, but
 * these never arrived as unknown, so they averaged to a fixed 93 for EVERY
 * record-less vehicle, which then fell to 24 the moment the owner answered
 * honestly. Reporting `unknown` puts them back under §08's rule.
 *
 * Consistency note: when a record EXISTS but carries no date,
 * maintenanceStatus.ts already returns `unknown` with this same "not on file"
 * wording. Holding no record at all must not read as better news.
 */
import { describe, expect, it } from "vitest";
import { healthySectionChip } from "@/utils/healthySection";
import { buildMergedMaintenanceItems } from "@/utils/mergedMaintenance";
import { computeVehicleHealthScore } from "@/utils/healthScore";

function itemsForBareVehicle() {
  return buildMergedMaintenanceItems({
    userItems: new Map(),
    records: [],
    knownIssues: [],
    vehicleYear: 2020,
    driverRecommendations: [],
    scopeId: "test-vin",
    currentOdometer: 300_000,
    now: new Date("2026-08-27T00:00:00Z").getTime(),
  } as any);
}

describe("a vehicle with no records", () => {
  const items = itemsForBareVehicle();
  const core = items.filter((i) => /^unknown-(oil|brakes|tires|battery)$/.test(i.id));

  it("produces a row for each core type", () => {
    expect(core.map((i) => i.id).sort()).toEqual([
      "unknown-battery",
      "unknown-brakes",
      "unknown-oil",
      "unknown-tires",
    ]);
  });

  it("reports every one as unknown, not on_time or due_soon", () => {
    for (const item of core) {
      expect(item.status, `${item.id} should be unknown`).toBe("unknown");
    }
  });

  it("never claims an absence of concerns", () => {
    for (const item of items) {
      expect(item.description ?? "", item.id).not.toMatch(/no .* concerns reported/i);
    }
  });

  it("says plainly that nothing is on file", () => {
    for (const item of core) {
      expect(item.description ?? "", item.id).toMatch(/not on file|no .*history on file/i);
      expect(item.detail).toBe("Not on file");
    }
  });

  it("scores nothing, so §08 governs uniformly", () => {
    // Every core row is unknown → excluded → no maintenance evidence either
    // way. The pre-onboarding UI shows "· · ·" rather than this number.
    const score = computeVehicleHealthScore({
      maintenanceItems: items as any,
      odometerMiles: 300_000,
      knownIssues: [],
    });
    expect(score).toBe(100);
  });
});

describe("the quiet section's chip", () => {
  const chip = (statuses: string[]) =>
    healthySectionChip(statuses.map((status) => ({ status })) as any).label;

  it("counts only observed-healthy items as healthy", () => {
    expect(chip(["on_time", "on_time", "on_time"])).toBe("HEALTHY · 3");
  });

  it("does not fold unknowns into the healthy count", () => {
    expect(chip(["on_time", "unknown", "unknown"])).toBe("HEALTHY · 1 · 2 NOT ON FILE");
  });

  it("claims nothing when every row is a blank", () => {
    // The record-less vehicle case: four core types, nothing known about any.
    expect(chip(["unknown", "unknown", "unknown", "unknown"])).toBe("NOT ON FILE · 4");
  });

  it("never labels a section of pure unknowns as healthy", () => {
    expect(chip(["unknown"])).not.toContain("HEALTHY");
  });
});
