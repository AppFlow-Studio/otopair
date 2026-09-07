/**
 * Velocity cross-check — Quick Check Spec v2 §2.
 *
 * The spec defines velocity as "the miles-per-year band, cross-checked against
 * calculated velocity (miles / age)". Only the band half shipped, which is
 * invisible on an ordinary car and badly wrong on the cars that need it most.
 *
 * Ahmad, 2026-09-07: a 2025 G-Class reading 200,000 miles, plugs reported done
 * March 2024. Band "light" = 500/mo, so we credited it with 15,062 miles over
 * thirty months and filed the plugs under HEALTHY with 44,938 miles of interval
 * remaining. That car does 200,000 miles in twenty months — about 10,000 a
 * month. Out by a factor of twenty, on a genuinely overdue service.
 *
 * Resolution rule (Ahmad, same day): the HIGHER of the two wins. A band is a
 * self-report and people round down; an odometer and a model year are facts.
 * Higher velocity can only move a service EARLIER in its interval, so an
 * understated band cannot hide wear.
 */
import { describe, expect, it } from "vitest";
import { resolveQuickCheckAnchor } from "@/utils/quickCheckAnchor";

const NOW = new Date(2026, 8, 7).getTime();
const WHEN = { answerType: "when" as const, month: 3, year: 2024 };

const anchor = (over: Record<string, unknown>) =>
  resolveQuickCheckAnchor({ answer: WHEN, now: NOW, ...over } as never);

describe("the reported G-Wagon", () => {
  const args = { currentOdometer: 200_000, avgMonthlyDriving: "light", vehicleYear: 2025 };

  it("no longer credits 200,000 miles of driving to a 500-mile-a-month band", () => {
    // Old behaviour anchored at 184,938 — i.e. only 15,062 miles used.
    expect(anchor(args).lastServiceMileage).toBe(0);
  });

  it("clamps to zero rather than going negative", () => {
    // Thirty months at the real velocity exceeds the whole odometer. Zero is
    // the floor: the anchor is a subtraction from a real number.
    expect(anchor(args).lastServiceMileage).toBeGreaterThanOrEqual(0);
  });

  it("keeps the date the driver actually gave", () => {
    expect(new Date(anchor(args).lastServiceDate!).getMonth()).toBe(2); // March
    expect(new Date(anchor(args).lastServiceDate!).getFullYear()).toBe(2024);
  });
});

describe("ordinary cars do not move", () => {
  it("leaves a car whose band matches its odometer alone", () => {
    // 2020 at 80,000 miles is 997 mi/month calculated against a 1,000 band.
    // This is the regression guard: the fix must be invisible here.
    expect(
      anchor({ currentOdometer: 80_000, avgMonthlyDriving: "average", vehicleYear: 2020 })
        .lastServiceMileage,
    ).toBe(49_778);
  });

  it("keeps the band when it is the higher of the two", () => {
    // A garage queen: 12,000 miles over eight years is 115 mi/month, well under
    // the 500 the driver claimed. We take the driver's word — higher wins.
    const withYear = anchor({ currentOdometer: 12_000, avgMonthlyDriving: "light", vehicleYear: 2018 });
    const withoutYear = anchor({ currentOdometer: 12_000, avgMonthlyDriving: "light" });
    expect(withYear.lastServiceMileage).toBe(withoutYear.lastServiceMileage);
  });
});

describe("when the cross-check cannot run", () => {
  it("falls back to the band with no model year", () => {
    expect(
      anchor({ currentOdometer: 200_000, avgMonthlyDriving: "light" }).lastServiceMileage,
    ).toBe(184_889);
  });

  it("falls back to the band with no odometer", () => {
    // Nothing to divide, and no mileage anchor to produce either.
    expect(
      anchor({ currentOdometer: null, avgMonthlyDriving: "light", vehicleYear: 2025 })
        .lastServiceMileage,
    ).toBeUndefined();
  });

  it("does not divide by a near-zero age", () => {
    // A car weeks old has an age near zero; dividing by it yields a velocity of
    // hundreds of thousands and an anchor of NaN or garbage. The guard returns
    // the band instead. (The result here is 0 because the 1,000/mo band already
    // exceeds this car's 98/mo — that clamp is pre-existing and unaffected;
    // what is asserted is that a real, finite number comes back.)
    const brandNew = anchor({
      currentOdometer: 800,
      avgMonthlyDriving: "average",
      vehicleYear: 2026,
      answer: { answerType: "when" as const, month: 8, year: 2026 },
    });
    expect(Number.isFinite(brandNew.lastServiceMileage!)).toBe(true);
    expect(brandNew.lastServiceMileage).toBeGreaterThanOrEqual(0);
  });
});

describe("the driver's own number still outranks every estimate", () => {
  it("uses stated miles verbatim, however the velocities compare", () => {
    expect(
      anchor({
        answer: { ...WHEN, miles: 190_000 },
        currentOdometer: 200_000,
        avgMonthlyDriving: "light",
        vehicleYear: 2025,
      }).lastServiceMileage,
    ).toBe(190_000);
  });
});
