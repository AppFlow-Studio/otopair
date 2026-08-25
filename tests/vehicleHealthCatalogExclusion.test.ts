// Locks the Vehicle Health Score handoff §04 + §12: catalog-inference rows are
// shown to the driver but never scored. Numbers are the doc's worked example
// (Nissan Rogue, 145k mi, four core services recent, no state-inspection record).
import { describe, it, expect } from "vitest";
import {
  computeVehicleHealthScore,
  isScorableMaintenanceItem,
} from "@/utils/healthScore";

const core = (id: string, status: any) => ({
  id, serviceName: id, description: "", detail: "", status,
});
const catalogOverdue = (slug: string) => ({
  id: `catalog-${slug}`, serviceName: slug, description: "", detail: "",
  status: "overdue" as const, excludeFromScore: true,
});

// Nissan Rogue · 145,000 mi · 4 core recent · no state-inspection record
const items: any[] = [
  core("oil", "on_time"),
  core("brakes", "on_time"),
  core("tires", "on_time"),
  core("battery", "on_time"),
  core("inspection", "unknown"),
  catalogOverdue("brake_fluid_flush"),
  catalogOverdue("coolant_flush"),
  catalogOverdue("filter_replacement"),
  catalogOverdue("spark_plugs"),
];

describe("§04 catalog-inference items must not score", () => {
  it("scores 91 with catalog rows excluded", () => {
    const score = computeVehicleHealthScore(
      { maintenanceItems: items, odometerMiles: 145_000, knownIssues: [] } as any,
    );
    expect(score).toBe(91);
  });

  it("would score 70 if they were still counted", () => {
    const counted = items.map((i) => ({ ...i, excludeFromScore: false }));
    const score = computeVehicleHealthScore(
      { maintenanceItems: counted, odometerMiles: 145_000, knownIssues: [] } as any,
    );
    expect(score).toBe(70);
  });

  it("reaches 100 once a state-inspection record exists", () => {
    const withInspection = items.map((i) =>
      i.id === "inspection" ? core("inspection", "on_time") : i,
    );
    const score = computeVehicleHealthScore(
      { maintenanceItems: withInspection, odometerMiles: 145_000, knownIssues: [] } as any,
    );
    expect(score).toBe(100);
  });

  it("odometer alone does not move the score once every core tile has a record", () => {
    // The doc's verification step says changing the odometer must not move the
    // score. That holds only when nothing is unknown: a missing record is
    // scored by unknownScoreForMileage, which IS mileage-scaled by design
    // (§08). With the inspection record present there are no unknowns left.
    const complete = items.map((i) =>
      i.id === "inspection" ? core("inspection", "on_time") : i,
    );
    const at145 = computeVehicleHealthScore(
      { maintenanceItems: complete, odometerMiles: 145_000, knownIssues: [] } as any,
    );
    const at40 = computeVehicleHealthScore(
      { maintenanceItems: complete, odometerMiles: 40_000, knownIssues: [] } as any,
    );
    expect(at40).toBe(at145);
    expect(at40).toBe(100);
  });

  it("with a missing record, mileage still shapes the score via the unknown curve (§08)", () => {
    const at145 = computeVehicleHealthScore(
      { maintenanceItems: items, odometerMiles: 145_000, knownIssues: [] } as any,
    );
    const at40 = computeVehicleHealthScore(
      { maintenanceItems: items, odometerMiles: 40_000, knownIssues: [] } as any,
    );
    expect(at145).toBe(91);
    expect(at40).toBe(97);
  });
});

describe("§07 the x/y maintenance counter", () => {
  // Mirrors CarCarousel's counting rule exactly: scorable items only, then
  // drop unknowns, then count on_time.
  const ratio = (list: any[]) => {
    const known = list
      .filter(isScorableMaintenanceItem)
      .filter((i) => i.status !== "unknown");
    return `${known.filter((i) => i.status === "on_time").length}/${Math.max(known.length, 1)}`;
  };

  it("drops the four catalog rows from the denominator", () => {
    // Before the fix the same rule over the unfiltered list gave 4/8:
    // 4 core on_time + 4 catalog overdue are all "known".
    const unfiltered = items.filter((i) => i.status !== "unknown");
    expect(
      `${unfiltered.filter((i) => i.status === "on_time").length}/${unfiltered.length}`,
    ).toBe("4/8");
    expect(ratio(items)).toBe("4/4");
  });

  it("reads 4/5 only once the inspection tile has a known status", () => {
    // The handoff predicts 4/5. That holds when inspection is present-but-not
    // on_time; while it is `unknown` the counter's own rule excludes it, so
    // the honest reading is 4/4.
    const withOverdueInspection = items.map((i) =>
      i.id === "inspection" ? core("inspection", "overdue") : i,
    );
    expect(ratio(withOverdueInspection)).toBe("4/5");
  });
});
