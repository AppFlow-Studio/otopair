/**
 * The driver can answer "when was this last done?" on an unknown row.
 *
 * Unknown catalog rows say "No service record on file — a scan can confirm".
 * A scan is not the only way to find out: the driver often just knows. Same
 * question onboarding asks (recently / a few months / over 6 months / a
 * specific date / never / not sure), asked on the card. Ahmad, 2026-08-30.
 *
 * The answer anchors the interval, so the row gets a real status and leaves
 * the UNKNOWN section. It still does not SCORE: SCORING_TYPES is explicit
 * that catalog rows never score without a mechanic behind them. "Not sure"
 * is not an answer — the row stays unknown, per §08.
 */
import { describe, expect, it } from "vitest";
import {
  buildMergedMaintenanceItems,
  catalogRecordType,
} from "@/utils/mergedMaintenance";
import { estimateServiceAnchorFromRecency } from "@/utils/maintenanceStatus";
import { isScorableMaintenanceItem } from "@/utils/healthScore";

const NOW = new Date("2026-08-30T00:00:00Z").getTime();
const ODO = 100_000;
const SLUG = "coolant_flush";
const OEM = { [SLUG]: { interval_miles: 60_000 } };

function merge(records: any[]) {
  return buildMergedMaintenanceItems({
    userItems: new Map(),
    records,
    knownIssues: [],
    vehicleYear: 2018,
    driverRecommendations: [],
    scopeId: "vin",
    now: NOW,
    currentOdometer: ODO,
    oemIntervals: OEM,
  } as any);
}
const coolant = (records: any[]) =>
  merge(records).find((i) => i.id === `catalog-${SLUG}`);

describe("recency answer → anchor", () => {
  const base = { currentOdometer: ODO, avgMonthlyDriving: "average", now: NOW, vehicleYear: 2018 };

  it("time answers convert to an odometer reading via the driver's own mileage", () => {
    // "average" = 1000 mi/month, so ~30 days ago ≈ 1,000 miles back.
    const recent = estimateServiceAnchorFromRecency({ ...base, recency: "recently" });
    expect(recent!.lastServiceMileage).toBeCloseTo(ODO - 1_000, -3);
    const older = estimateServiceAnchorFromRecency({ ...base, recency: "over_6mo" });
    expect(older!.lastServiceMileage).toBeCloseTo(ODO - 7_000, -3);
    // Further back must mean fewer miles remaining on the interval.
    expect(older!.lastServiceMileage).toBeLessThan(recent!.lastServiceMileage);
  });

  it("'never' anchors at zero miles — the interval runs from new", () => {
    const r = estimateServiceAnchorFromRecency({ ...base, recency: "never" });
    expect(r!.lastServiceMileage).toBe(0);
  });

  it("'not sure' is not an answer", () => {
    expect(estimateServiceAnchorFromRecency({ ...base, recency: "not_sure" })).toBeNull();
  });

  it("never returns a negative or future-dated odometer", () => {
    const lowMiles = estimateServiceAnchorFromRecency({
      ...base, recency: "over_6mo", currentOdometer: 100,
    });
    expect(lowMiles!.lastServiceMileage).toBe(0);
    expect(lowMiles!.lastServiceMileage).toBeLessThanOrEqual(100);
  });
});

describe("an answered catalog row", () => {
  it("is unknown and unscored until answered", () => {
    const item = coolant([]);
    expect(item?.status).toBe("unknown");
    expect(isScorableMaintenanceItem(item as any)).toBe(false);
  });

  it("becomes a real status once answered, and scores", () => {
    // Serviced at 95,000 on a 60,000-mile interval → only 5,000 used.
    const item = coolant([
      { type: catalogRecordType(SLUG), lastServiceMileage: 95_000, customInputs: { recency: "recently" } },
    ]);
    expect(item?.status).toBe("on_time");
    // Deliberately still unscored: SCORING_TYPES says catalog rows never score
    // without a mechanic behind them, and a self-report is not a mechanic.
    expect(isScorableMaintenanceItem(item as any)).toBe(false);
  });

  it("reports overdue when the answer says the interval is blown", () => {
    const item = coolant([
      { type: catalogRecordType(SLUG), lastServiceMileage: 20_000, customInputs: { recency: "over_6mo" } },
    ]);
    expect(item?.status).toBe("overdue");
    expect(isScorableMaintenanceItem(item as any)).toBe(false);
  });

  it("stays unknown when the record carries no mileage ('not sure')", () => {
    const item = coolant([
      { type: catalogRecordType(SLUG), customInputs: { recency: "not_sure" } },
    ]);
    expect(item?.status).toBe("unknown");
    expect(isScorableMaintenanceItem(item as any)).toBe(false);
  });

  it("carries the slug so the card can write back and book", () => {
    expect(coolant([])?.serviceSlug).toBe(SLUG);
  });

  it("record type cannot collide with core or minor rows", () => {
    expect(catalogRecordType("oil")).toBe("catalog_oil");
    expect(catalogRecordType(SLUG)).not.toBe(SLUG);
  });
});
