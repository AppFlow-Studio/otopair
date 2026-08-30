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
import { healthySectionChip, splitQuietItems } from "@/utils/healthySection";
import {
  extractMaintenanceType,
  MAINTENANCE_TYPE_TO_SLUG,
} from "@/lib/maintenanceServiceMapping";
import {
  computeFromOdometerStatus,
  computeMaintenanceStatus,
} from "@/utils/maintenanceStatus";
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

describe("the two quiet sections", () => {
  // HEALTHY and UNKNOWN are separate sections now, not one mixed list with a
  // compound label. "Healthy" is a claim we can back; an item with no record
  // on file is not evidence of it, so they never share a heading or a count.
  it("labels each section for what it is", () => {
    expect(healthySectionChip("healthy", 3)).toBe("HEALTHY · 3");
    expect(healthySectionChip("unknown", 4)).toBe("UNKNOWN · 4");
  });

  it("never labels unknowns as healthy", () => {
    expect(healthySectionChip("unknown", 4)).not.toContain("HEALTHY");
  });

  it("splits a mixed tier into the two sections", () => {
    const { healthy, unknown } = splitQuietItems([
      { status: "on_time" },
      { status: "unknown" },
      { status: "unknown" },
    ]);
    expect(healthy).toHaveLength(1);
    expect(unknown).toHaveLength(2);
  });

  it("puts nothing in the healthy bucket when every row is a blank", () => {
    const { healthy, unknown } = splitQuietItems([
      { status: "unknown" }, { status: "unknown" },
      { status: "unknown" }, { status: "unknown" },
    ]);
    expect(healthy).toEqual([]);
    expect(unknown).toHaveLength(4);
  });
});

describe('"I\'m not sure" never becomes a finding', () => {
  // The stepper's tire question stores "I'm not sure" as tireReplaced:
  // "dont_know". It used to return due_soon / "Tire condition uncertain —
  // inspection recommended", which cost 26 points for admitting ignorance.
  // The battery path took this same fix on 2026-05-18; tires was missed.
  const NOW = new Date("2026-08-27T00:00:00Z").getTime();

  const statusFor = (type: string, customInputs: Record<string, string>) =>
    computeMaintenanceStatus(
      { type, customInputs } as any,
      300_000, "Audi", NOW, "city", "light", [], 2020,
    );

  it("tires: unsure when replaced scores nothing", () => {
    const r = statusFor("tires", { recency: "not_sure", tireOriginal: "not_sure", tireReplaced: "dont_know" });
    expect(r.status).toBe("unknown");
    expect(r.percentUsed).toBe(0);
    expect(r.description).not.toMatch(/inspection recommended|uncertain/i);
  });

  it("battery: unsure when replaced scores nothing (the 2026-05-18 precedent)", () => {
    expect(statusFor("battery", { batteryReplaced: "not_sure", recency: "not_sure" }).status).toBe("unknown");
  });

  it("still reports what the driver DID tell us — original tires are a real signal", () => {
    // "Are these the original tires? → Yes" is information, not an absence of
    // it, so age-from-model-year still applies and still scores.
    const r = statusFor("tires", { tireOriginal: "yes", tireReplaced: "original" });
    expect(r.status).not.toBe("unknown");
  });
});

describe("catalog-inferred rows claim nothing", () => {
  // The odometer pass walks every OEM interval and measures usage from
  // lastServiceMileage ?? 0 — as though the service had never been done. On a
  // 300,000-mile car every interval "expires", which put brake fluid, filters,
  // spark plugs and transmission fluid under SOON with Book Service buttons
  // for work that may well have been done twice. Ahmad, 2026-08-27: "it's
  // weird that it says due soon if we actually have no clue if it's due."
  it("no record on file -> unknown, at any mileage", () => {
    for (const currentOdometer of [5_000, 60_000, 150_000, 300_000]) {
      const r = computeFromOdometerStatus({
        interval_miles: 40_000,
        currentOdometer,
        serviceName: "Brake fluid flush",
      });
      expect(r.status, `at ${currentOdometer} mi`).toBe("unknown");
      // Forced to 0 so urgency ranking can't float an inference above a
      // finding that has real evidence behind it.
      expect(r.percentUsed).toBe(0);
      expect(r.description).not.toMatch(/due|overdue/i);
    }
  });

  it("a stored last-service mileage is real evidence and still scores", () => {
    const at = (currentOdometer: number) =>
      computeFromOdometerStatus({
        interval_miles: 40_000,
        currentOdometer,
        lastServiceMileage: 100_000,
        serviceName: "Brake fluid flush",
      }).status;
    expect(at(110_000)).toBe("on_time");
    expect(at(139_000)).toBe("due_soon");
    expect(at(160_000)).toBe("overdue");
  });

  it("the section CTA id routes to a diagnostic scan", () => {
    // HealthySection passes this to onBookNow; cars/index.tsx runs it through
    // extractMaintenanceType → MAINTENANCE_TYPE_TO_SLUG with no special case.
    const type = extractMaintenanceType("warning-unknown-scan");
    expect(MAINTENANCE_TYPE_TO_SLUG[type]).toBe("diagnostic_scan");
  });
});
