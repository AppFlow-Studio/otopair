/**
 * Catalog rows measure time as well as mileage.
 *
 * Ahmad, 2026-09-04: added a 2022 GLE with 1,000 miles, was asked about the
 * coolant flush, answered "never done" — and the tracker filed it under
 * HEALTHY with "79,000 mi of interval remaining".
 *
 * Both surfaces were reading the same class interval (Class B coolant,
 * 80,000 miles / 60 months) and disagreeing about it, because
 * `computeFromOdometerStatus` had no months parameter at all. The Bigger
 * Services tile takes the worse of the two axes and fired at 56/60 = 0.93;
 * the tracker divided 1,000 by 80,000 and called it healthy. A coolant flush
 * that has never been done on a five-year-old car is not healthy.
 *
 * The second half of the same gap is quieter and worse: brake fluid on a
 * Class B or C car is `{miles: null, months: 24}`. With no mileage side to
 * offer, the tracker got `null` back and filed the row under "not enough info
 * to say" — on every Mercedes, BMW, Audi and Porsche in the app, permanently,
 * for a service we have a perfectly good interval for.
 */
import { describe, expect, it } from "vitest";
import { computeFromOdometerStatus } from "@/utils/maintenanceStatus";

const NOW = new Date(2026, 8, 4).getTime();
const BUILT_2022 = new Date(2022, 0, 1).getTime();
/** Jan 1 2022 → Sep 4 2026. 93% of a 60-month interval. */
const AGE = (NOW - BUILT_2022) / (30.44 * 24 * 60 * 60 * 1000);

/** The reported case: Class B coolant, answered "never done". */
const coolant = (over: Record<string, unknown> = {}) =>
  computeFromOdometerStatus({
    interval_miles: 80_000,
    interval_months: 60,
    currentOdometer: 1_000,
    lastServiceMileage: 0,
    lastServiceDate: BUILT_2022,
    ageMonths: AGE,
    now: NOW,
    serviceName: "Coolant flush",
    ...over,
  });

describe("the reported GLE", () => {
  it("is not healthy at 56 months into a 60-month interval", () => {
    expect(coolant().status).toBe("due_soon");
  });

  it("says so on the axis it actually measured", () => {
    // "79,000 mi of interval remaining" under a card that went yellow on age
    // reads as a bug even when the status is right.
    const r = coolant();
    expect(r.description).not.toMatch(/mi/);
    expect(r.detail).toMatch(/month/);
  });

  it("agrees with the tile that asked the question", () => {
    // The tile fires at BAND_CUTOFFS.dueSoon; the tracker's band ladder uses
    // the same cutoff. Same ratio in, same verdict out — that is the whole
    // point, and the two drifting apart is what produced the report.
    expect(coolant().percentUsed).toBeCloseTo((AGE / 60) * 100, 1);
  });
});

describe("which axis wins", () => {
  it("takes the worse of the two, like every other status path", () => {
    // 90,000 of an 80,000-mile interval is 1.13; 56 of 60 months is 0.93.
    const r = coolant({ currentOdometer: 90_000, lastServiceMileage: 0 });
    expect(r.status).toBe("overdue");
    expect(r.description).toMatch(/mi past interval/);
  });

  it("leaves a mileage-only service exactly as it was", () => {
    // Spark plugs, transmission and differential have no months side. This is
    // the regression guard for the change: they must not move at all.
    const r = computeFromOdometerStatus({
      interval_miles: 60_000,
      interval_months: null,
      currentOdometer: 50_000,
      lastServiceMileage: 0,
      lastServiceDate: BUILT_2022,
      now: NOW,
      serviceName: "Spark plugs",
    });
    expect(r.status).toBe("due_soon");
    expect(r.description).toBe("About 10,000 mi until due");
    expect(r.monthsRemaining).toBeUndefined();
  });

  it("resets on both axes when the service is actually done", () => {
    const r = coolant({
      lastServiceMileage: 800,
      lastServiceDate: NOW - 6 * 30.44 * 864e5,
    });
    expect(r.status).toBe("on_time");
    expect(r.detail).toBe("6 months since last service");
  });
});

describe("months-only intervals", () => {
  it("produce a real status instead of no row at all", () => {
    // Class B brake fluid. Before this the caller saw a null mileage interval
    // and pushed an "unknown / No data" row.
    const r = computeFromOdometerStatus({
      interval_miles: null,
      interval_months: 24,
      currentOdometer: 1_000,
      lastServiceMileage: 0,
      lastServiceDate: BUILT_2022,
      ageMonths: AGE,
      now: NOW,
      serviceName: "Brake fluid flush",
    });
    expect(r.status).toBe("overdue");
    expect(r.milesRemaining).toBeUndefined();
  });

  it("still say nothing when there is nothing to measure", () => {
    const r = computeFromOdometerStatus({
      interval_miles: null,
      interval_months: 24,
      currentOdometer: 1_000,
      lastServiceMileage: 0,
      now: NOW,
    });
    expect(r.status).toBe("unknown");
  });
});

describe("what must not change", () => {
  it("still reports unknown when neither axis has an anchor", () => {
    // The rule Ahmad set on 2026-08-27 — "it's weird that it says due soon if
    // we actually have no clue if it's due or not". A time anchor is an anchor,
    // but the absence of both is still an absence.
    const r = coolant({ lastServiceMileage: undefined, lastServiceDate: undefined });
    expect(r.status).toBe("unknown");
    expect(r.percentUsed).toBe(0);
  });

  it("counts a date-only anchor as a real measurement", () => {
    const r = coolant({ lastServiceMileage: undefined });
    expect(r.status).toBe("due_soon");
  });

  it("does not write '1 months'", () => {
    const r = coolant({ lastServiceDate: NOW - 59 * 30.44 * 864e5 });
    expect(r.description).toBe("Due within about 1 month");
  });
});
