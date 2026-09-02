/**
 * Driving conditions × the class default table — Fallback v2, Ahmad's call
 * 2026-08-31.
 *
 * THE DECISION: the multipliers apply to a class default, and NOT to a
 * manufacturer's own interval.
 *
 * The alarming way to state the effect is that a city-driven Toyota's oil
 * interval went from 4,000 miles to 6,000 — 50% longer, on the highest
 * consequence interval we track. That framing is wrong, and the reason is the
 * whole justification for this rule:
 *
 *   v1 used 5,000 miles as Toyota's BASE interval. That is Toyota's own
 *   "special operating conditions" number — the severe schedule — applied to
 *   every driver regardless of how they drive. Multiplying it by 0.80 for city
 *   driving counted severity TWICE, and 4,000 was the result of that double
 *   count, not of caution.
 *
 * v2 starts from 7,500, a normal-usage baseline for the class, and applies
 * severity once. 6,000 is severity counted correctly.
 *
 * Why it does not apply to an OEM interval: a manufacturer's schedule already
 * accounts for city driving — that is what their severe-service column IS —
 * so discounting it again reintroduces exactly the double count above.
 *
 * The downside is bounded by the confidence hold: a class default raises a
 * recommendation at 1.0x but does not deduct until 1.5x. If 6,000 is slightly
 * generous for one particular car, that driver is told a little later; they
 * are not punished for it. And constant early nagging has its own cost — a
 * number that cries wolf stops being read.
 */
import { describe, expect, it } from "vitest";
import { computeMaintenanceStatus } from "@/utils/maintenanceStatus";

const NOW = new Date(2026, 5, 15).getTime();
const oilAt = (miles: number) => ({
  type: "oil",
  lastServiceDate: new Date(2025, 5, 15).getTime(),
  lastServiceMileage: 50_000,
  _driven: miles,
});

function remaining(cond: string | undefined, vehicleClass: string, driven: number) {
  const r = computeMaintenanceStatus(
    oilAt(driven) as never, 50_000 + driven, "toyota", NOW, cond, "average",
    undefined, 2020, undefined, { vehicleClass } as never,
  );
  return r.description;
}

describe("city driving shortens a class default", () => {
  it("reaches the Class A oil interval at 6,000 miles, not 7,500", () => {
    expect(remaining("city", "A", 5_900)).toContain("mi remaining");
    expect(remaining("city", "A", 6_000)).toContain("Mileage interval reached");
  });

  it("leaves a normal-usage driver on the full 7,500", () => {
    expect(remaining(undefined, "A", 6_000)).toContain("1,500 mi remaining");
  });

  it("is the same 0.80 the app already used — the BASE moved, not the multiplier", () => {
    // 7,500 x 0.80 = 6,000. v1 was 5,000 x 0.80 = 4,000, and that 5,000 was
    // Toyota's severe-schedule number, so severity was counted twice.
    const cityReached = 6_000;
    const normalInterval = 7_500;
    expect(cityReached / normalInterval).toBeCloseTo(0.8, 5);
  });
});

describe("a manufacturer's own interval is not discounted again", () => {
  it("ignores driving conditions when the interval came from enrichment", () => {
    // Trusted OEM row at 10,000 miles. City driving must NOT pull it to 8,000:
    // the manufacturer's severe-service column already covers city driving.
    const oem = { oil_change: { interval_miles: 10_000, confidence: 0.9 } };
    const withCity = computeMaintenanceStatus(
      { type: "oil", lastServiceDate: new Date(2025, 5, 15).getTime(), lastServiceMileage: 50_000 } as never,
      58_500, "toyota", NOW, "city", "average", undefined, 2020, oem as never,
      { vehicleClass: "A" } as never,
    );
    const withoutCity = computeMaintenanceStatus(
      { type: "oil", lastServiceDate: new Date(2025, 5, 15).getTime(), lastServiceMileage: 50_000 } as never,
      58_500, "toyota", NOW, undefined, "average", undefined, 2020, oem as never,
      { vehicleClass: "A" } as never,
    );
    expect(withCity.description).toBe(withoutCity.description);
  });
});
