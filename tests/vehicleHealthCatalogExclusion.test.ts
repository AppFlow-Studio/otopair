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
  it("scores 100 with catalog rows excluded", () => {
    const score = computeVehicleHealthScore(
      { maintenanceItems: items, odometerMiles: 145_000, knownIssues: [] } as any,
    );
    // Was 91 while a missing record was scored from a mileage curve. Since
    // the §08 decision (mileage alone must never deduct) the absent
    // state-inspection record no longer costs anything, so this is 100.
    expect(score).toBe(100);
  });

  it("catalog rows are now blocked twice over — flag AND type", () => {
    // This used to assert 70: clearing excludeFromScore reproduced the
    // original bug. It no longer can. SCORING_TYPES also rejects the
    // `catalog` type, so clearing the flag alone changes nothing. Two
    // independent guards, which is what we want for a rule that has been
    // violated once already.
    const flagCleared = items.map((i) => ({ ...i, excludeFromScore: false }));
    expect(
      computeVehicleHealthScore(
        { maintenanceItems: flagCleared, odometerMiles: 145_000, knownIssues: [] } as any,
      ),
    ).toBe(100);
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

  it("mileage never moves the score, with or without a missing record (§08)", () => {
    // Ahmad's call, 2026-08-27: "mileage alone should never bring the score
    // down... we don't wanna penalize the user just for having high milage."
    // Previously this same fixture scored 91 at 145k and 97 at 40k, purely
    // because the absent inspection record was guessed at from the odometer.
    const at145 = computeVehicleHealthScore(
      { maintenanceItems: items, odometerMiles: 145_000, knownIssues: [] } as any,
    );
    const at40 = computeVehicleHealthScore(
      { maintenanceItems: items, odometerMiles: 40_000, knownIssues: [] } as any,
    );
    expect(at145).toBe(100);
    expect(at40).toBe(100);
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

describe("§12 regression guards — what must NOT have been broken", () => {
  it("mechanic-graded minor items still score at weight 10", () => {
    // The weight-10 path is the whole point of the Consolidated model: a
    // minor item earns its deduction when a mechanic grades it yellow/red.
    // §04 must exclude catalog-inference rows without touching this.
    const minor = {
      id: "user-minor_bf_condition",
      serviceName: "Brake Fluid Condition",
      description: "",
      detail: "",
      status: "overdue" as const,
    };
    const withoutMinor = computeVehicleHealthScore(
      { maintenanceItems: items, odometerMiles: 145_000, knownIssues: [] } as any,
    );
    const withMinor = computeVehicleHealthScore(
      { maintenanceItems: [...items, minor], odometerMiles: 145_000, knownIssues: [] } as any,
    );
    expect(withMinor).toBeLessThan(withoutMinor);
  });

  it("recommendation cards still never score", () => {
    const rec = {
      id: "rec-abc", serviceName: "Rec", description: "", detail: "",
      status: "overdue" as const, sourceRecommendationId: "abc",
    };
    const base = computeVehicleHealthScore(
      { maintenanceItems: items, odometerMiles: 145_000, knownIssues: [] } as any,
    );
    const withRec = computeVehicleHealthScore(
      { maintenanceItems: [...items, rec], odometerMiles: 145_000, knownIssues: [] } as any,
    );
    expect(withRec).toBe(base);
  });

  it("warning lights drain the reserve and floor at 0, never below", () => {
    const clean = computeVehicleHealthScore(
      { maintenanceItems: items, odometerMiles: 145_000, knownIssues: [] } as any,
    );
    // oil_pressure 15 + temperature 15 = 30, capped at 25, reserve floors at 0
    const swamped = computeVehicleHealthScore(
      {
        maintenanceItems: items,
        odometerMiles: 145_000,
        knownIssues: ["oil_pressure", "temperature", "check_engine"],
      } as any,
    );
    expect(swamped).toBe(clean - 15); // the whole 15-pt reserve, no more
  });

  it("the open-recs penalty is capped at 15", () => {
    const base = computeVehicleHealthScore(
      { maintenanceItems: items, odometerMiles: 145_000, knownIssues: [] } as any,
    );
    const huge = computeVehicleHealthScore(
      { maintenanceItems: items, odometerMiles: 145_000, knownIssues: [], recPenalty: 999 } as any,
    );
    expect(huge).toBe(base - 15);
  });
});
