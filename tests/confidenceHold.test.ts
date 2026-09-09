/**
 * The confidence hold, end to end through the real calculator.
 *
 * The unit tests in intervalBands cover the rule; these cover the thing that
 * actually matters — that a held item stays in the weighted denominator at
 * factor 1.00 rather than being excluded from it.
 *
 * That distinction is the whole reason `rawScore` is the lever and
 * `excludeFromScore` is not: computeVehicleHealthScore accumulates
 * `weightTotal += w` only for included items, so excluding one silently
 * redistributes its weight across every other item and changes THEIR shares.
 */
import { describe, expect, it } from "vitest";
import { computeHealthScoreFactors, computeVehicleHealthScore } from "@/utils/healthScore";

const base = (over: Record<string, unknown> = {}) => ({
  id: "oil",
  serviceName: "Oil change",
  status: "overdue" as const,
  ...over,
});

const score = (items: unknown[]) =>
  computeVehicleHealthScore({
    maintenanceItems: items as never,
    odometerMiles: 100_000,
    knownIssues: [],
  });

describe("a held item keeps its weight in the denominator", () => {
  const others = [
    base({ id: "brakes", serviceName: "Brakes", status: "on_time" }),
    base({ id: "tires", serviceName: "Tires", status: "on_time" }),
  ];

  it("scores as if on-time without changing anyone else's share", () => {
    // Held oil at factor 1.0 must be indistinguishable from a genuinely
    // on-time oil item — same denominator, same shares.
    const heldOil = base({ status: "overdue", rawScore: 1.0, factorApplied: 1 });
    const onTimeOil = base({ status: "on_time" });
    expect(score([heldOil, ...others])).toBe(score([onTimeOil, ...others]));
  });

  it("is NOT the same as excluding it, which redistributes weight", () => {
    // The trap: excluding drops oil's weight-20 from the denominator, so
    // brakes and tires each take a bigger share. Same headline here only
    // because everything else is on-time — so make one of them overdue.
    const withOverdueBrakes = [
      base({ id: "brakes", serviceName: "Brakes", status: "overdue" }),
      base({ id: "tires", serviceName: "Tires", status: "on_time" }),
    ];
    const held = score([
      base({ status: "overdue", rawScore: 1.0, factorApplied: 1 }),
      ...withOverdueBrakes,
    ]);
    const excluded = score([
      base({ status: "overdue", excludeFromScore: true }),
      ...withOverdueBrakes,
    ]);
    expect(held).not.toBe(excluded);
    // Excluding makes the car look WORSE — the overdue brakes now carry a
    // larger fraction of a smaller denominator.
    expect(excluded).toBeLessThan(held);
  });

  it("an unheld overdue item still costs what it always did", () => {
    const unheld = base({ status: "overdue", factorApplied: 0.35 });
    expect(score([unheld, ...others])).toBeLessThan(score([base({ status: "on_time" }), ...others]));
  });
});

describe("the breakdown", () => {
  const factors = (items: unknown[]) =>
    computeHealthScoreFactors({
      maintenanceItems: items as never,
      odometerMiles: 100_000,
      knownIssues: [],
    });

  it("lists a held item in neither bucket", () => {
    // It shows as Due on the tracker but costs nothing, so claiming it under
    // "what's hurting" would be a deduction we did not apply.
    const f = factors([
      base({ status: "overdue", rawScore: 1.0, factorApplied: 1 }),
      base({ id: "brakes", serviceName: "Brakes", status: "on_time" }),
    ]);
    expect(f.negatives.map((n) => n.label)).not.toContain("Overdue: Oil change");
    expect(f.positives.map((p) => p.label)).not.toContain("On-time: Oil change");
  });

  it("still lists an unheld overdue item", () => {
    const f = factors([
      base({ status: "overdue", factorApplied: 0.35 }),
      base({ id: "brakes", serviceName: "Brakes", status: "on_time" }),
    ]);
    expect(f.negatives.map((n) => n.label)).toContain("Overdue: Oil change");
  });

  it("does not swallow a genuinely on-time item", () => {
    // factorApplied === 1 is also true for on-time items; the guard must not
    // drop those from the positives.
    const f = factors([
      base({ id: "brakes", serviceName: "Brakes", status: "on_time", factorApplied: 1 }),
      base({ status: "overdue", factorApplied: 0.35 }),
    ]);
    expect(f.positives.map((p) => p.label)).toContain("On-time: Brakes");
  });
});
