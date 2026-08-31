/**
 * Quick Check anchors — Spec v2 §5/§7 step 6.
 *
 * The point of v2's month-and-year answer is that it produces a REAL anchor
 * where v1's buckets produced a guess. These tests pin the two properties that
 * makes true: the driver's own numbers are never overwritten by our estimate,
 * and nothing we cannot work out is filled in with a plausible-looking zero.
 */
import { describe, expect, it } from "vitest";
import { quickCheckRecordWrites, resolveQuickCheckAnchor } from "@/utils/quickCheckAnchor";

/** 15 June 2026, so "March 2026" is a clean three months ago. */
const NOW = new Date(2026, 5, 15).getTime();
const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;

describe('"not sure"', () => {
  it("produces no anchor at all", () => {
    // Neither field set is what computeHybridStatus reads as `unknown`, which
    // is what keeps the item out of the weighted average entirely (§08).
    expect(resolveQuickCheckAnchor({
      answer: { answerType: "unsure" },
      currentOdometer: 60_000,
      now: NOW,
    })).toEqual({});
  });

  it("does not fall back to today just because an odometer is available", () => {
    // The tempting bug: "we know the miles, so anchor it now". That would turn
    // "I don't know" into "serviced today" — the single most damaging thing
    // this module could do.
    const a = resolveQuickCheckAnchor({
      answer: { answerType: "unsure" },
      currentOdometer: 60_000,
      avgMonthlyDriving: "heavy",
      vehicleYear: 2018,
      now: NOW,
    });
    expect(a.lastServiceDate).toBeUndefined();
    expect(a.lastServiceMileage).toBeUndefined();
  });
});

describe('"never"', () => {
  it("anchors to the car being new", () => {
    const a = resolveQuickCheckAnchor({
      answer: { answerType: "never" },
      currentOdometer: 90_000,
      vehicleYear: 2018,
      now: NOW,
    });
    expect(a.lastServiceDate).toBe(new Date(2018, 0, 1).getTime());
    expect(a.lastServiceMileage).toBe(0);
  });

  it("zeroes the mileage here, and only here", () => {
    // Zero is a real statement on a "never" answer — the service has not
    // happened since the odometer read zero. It is a lie anywhere else, which
    // is why the "when" path leaves mileage undefined instead.
    const never = resolveQuickCheckAnchor({
      answer: { answerType: "never" },
      currentOdometer: null,
      vehicleYear: 2020,
      now: NOW,
    });
    expect(never.lastServiceMileage).toBe(0);

    const when = resolveQuickCheckAnchor({
      answer: { answerType: "when", month: 3, year: 2026 },
      currentOdometer: null,
      now: NOW,
    });
    expect(when.lastServiceMileage).toBeUndefined();
  });

  it("falls back to now when the model year is unknown", () => {
    const a = resolveQuickCheckAnchor({
      answer: { answerType: "never" },
      currentOdometer: 10_000,
      now: NOW,
    });
    expect(a.lastServiceDate).toBe(NOW);
  });
});

describe('"I know roughly when"', () => {
  it("anchors to the first of the picked month", () => {
    const a = resolveQuickCheckAnchor({
      answer: { answerType: "when", month: 3, year: 2026 },
      currentOdometer: 60_000,
      now: NOW,
    });
    expect(a.lastServiceDate).toBe(new Date(2026, 2, 1).getTime());
  });

  it("takes the driver's odometer over its own estimate", () => {
    // A remembered number beats a velocity guess every time, even when the
    // two disagree wildly — the driver was there.
    const a = resolveQuickCheckAnchor({
      answer: { answerType: "when", month: 3, year: 2026, miles: 12_345 },
      currentOdometer: 60_000,
      avgMonthlyDriving: "heavy",
      now: NOW,
    });
    expect(a.lastServiceMileage).toBe(12_345);
  });

  it("accepts a genuine zero from the driver", () => {
    // `miles: 0` is falsy — a truthiness check here would silently discard it
    // and substitute the estimate.
    const a = resolveQuickCheckAnchor({
      answer: { answerType: "when", month: 3, year: 2026, miles: 0 },
      currentOdometer: 60_000,
      now: NOW,
    });
    expect(a.lastServiceMileage).toBe(0);
  });

  it("estimates backwards from today at the driver's own stated pace", () => {
    // Three months at "light" (500/mo) = 1,500 miles ago.
    const a = resolveQuickCheckAnchor({
      answer: { answerType: "when", month: 3, year: 2026 },
      currentOdometer: 60_000,
      avgMonthlyDriving: "light",
      now: NOW,
    });
    const months = (NOW - new Date(2026, 2, 1).getTime()) / MS_PER_MONTH;
    expect(a.lastServiceMileage).toBe(Math.round(60_000 - months * 500));
    expect(a.lastServiceMileage).toBeGreaterThan(58_000);
    expect(a.lastServiceMileage).toBeLessThan(59_000);
  });

  it("uses the same driving-level numbers the status maths uses", () => {
    // Heavy is 3x light. If these ever diverge from getMonthlyMiles, an
    // anchor written at onboarding stops agreeing with the interval computed
    // against it.
    const light = resolveQuickCheckAnchor({
      answer: { answerType: "when", month: 6, year: 2025 },
      currentOdometer: 60_000, avgMonthlyDriving: "light", now: NOW,
    });
    const heavy = resolveQuickCheckAnchor({
      answer: { answerType: "when", month: 6, year: 2025 },
      currentOdometer: 60_000, avgMonthlyDriving: "heavy", now: NOW,
    });
    const lightBack = 60_000 - (light.lastServiceMileage ?? 0);
    const heavyBack = 60_000 - (heavy.lastServiceMileage ?? 0);
    expect(heavyBack / lightBack).toBeCloseTo(3, 1);
  });

  it("never estimates below zero on an old service and a young odometer", () => {
    // Five years back at heavy would subtract 90,000 from a 20,000-mile car.
    const a = resolveQuickCheckAnchor({
      answer: { answerType: "when", month: 6, year: 2021 },
      currentOdometer: 20_000,
      avgMonthlyDriving: "heavy",
      now: NOW,
    });
    expect(a.lastServiceMileage).toBe(0);
  });

  it("never estimates above today's reading", () => {
    const a = resolveQuickCheckAnchor({
      answer: { answerType: "when", month: 6, year: 2026 },
      currentOdometer: 1_000,
      now: NOW,
    });
    expect(a.lastServiceMileage).toBeLessThanOrEqual(1_000);
  });

  it("keeps the date and drops the mileage when there is no odometer", () => {
    // The months half of every interval still scores. Guessing a mileage from
    // nothing would be inventing the fact the whole module exists to avoid.
    const a = resolveQuickCheckAnchor({
      answer: { answerType: "when", month: 3, year: 2026 },
      currentOdometer: null,
      now: NOW,
    });
    expect(a.lastServiceDate).toBe(new Date(2026, 2, 1).getTime());
    expect(a.lastServiceMileage).toBeUndefined();
  });

  it("clamps a future date to today", () => {
    // The picker disables future months, but a rehydrated draft written
    // before a device clock change can still carry one, and a future anchor
    // reads as negative wear.
    const a = resolveQuickCheckAnchor({
      answer: { answerType: "when", month: 12, year: 2026 },
      currentOdometer: 60_000,
      now: NOW,
    });
    expect(a.lastServiceDate).toBe(NOW);
  });

  it("produces nothing when the month or year is missing", () => {
    // Save is gated on both being picked, so this is a corrupt-draft guard —
    // it must not silently anchor to today.
    expect(resolveQuickCheckAnchor({
      answer: { answerType: "when", year: 2026 },
      currentOdometer: 60_000, now: NOW,
    })).toEqual({});
    expect(resolveQuickCheckAnchor({
      answer: { answerType: "when", month: 3 },
      currentOdometer: 60_000, now: NOW,
    })).toEqual({});
  });
});

describe("answers → record writes", () => {
  const ctx = { currentOdometer: 60_000, avgMonthlyDriving: "average", vehicleYear: 2020, now: NOW };

  it("writes one record per tile, under the type the readers expect", () => {
    for (const [tile, type] of Object.entries({
      oil: "oil", tires: "tires", brakes: "brakes", battery: "battery",
    })) {
      const w = quickCheckRecordWrites(tile as any, { answerType: "unsure" }, ctx);
      expect(w[0].type).toBe(type);
    }
  });

  it("maps the soft-pedal chip onto the field the brake reader actually reads", () => {
    // The v2 chip id is `soft_pedal`; computeBrakeStatus tests for `soft_slow`.
    // Writing the chip id verbatim would silently drop the symptom.
    const w = quickCheckRecordWrites("brakes", { answerType: "unsure", symptom: "soft_pedal" }, ctx);
    expect(w[0].customInputs.brakeFeel).toBe("soft_slow");
  });

  it("maps noise, and normalises no-symptom to normal", () => {
    expect(quickCheckRecordWrites("brakes", { answerType: "unsure", symptom: "noise" }, ctx)[0]
      .customInputs.brakeFeel).toBe("noise");
    expect(quickCheckRecordWrites("brakes", { answerType: "unsure", symptom: "none" }, ctx)[0]
      .customInputs.brakeFeel).toBe("normal");
  });

  it("keeps the v1 tire and battery vocabularies alive", () => {
    // These fields are read by shared code the web repo has not ported yet.
    // Dropping them would change status on both surfaces, silently.
    expect(quickCheckRecordWrites("tires", { answerType: "never" }, ctx)[0]
      .customInputs.tireReplaced).toBe("original");
    expect(quickCheckRecordWrites("tires", { answerType: "unsure" }, ctx)[0]
      .customInputs.tireReplaced).toBe("dont_know");
    expect(quickCheckRecordWrites("battery", { answerType: "when", month: 3, year: 2026 }, ctx)[0]
      .customInputs.batteryReplaced).toBe("yes");
    expect(quickCheckRecordWrites("battery", { answerType: "unsure" }, ctx)[0]
      .customInputs.batteryReplaced).toBe("not_sure");
  });

  it("stamps provenance on every row", () => {
    const w = quickCheckRecordWrites("oil", { answerType: "when", month: 3, year: 2026 }, ctx);
    expect(w.every((r) => r.customInputs.source === "quick_check_v2")).toBe(true);
  });

  it("still writes an unanchored row for a not-sure answer", () => {
    // "We asked and they did not know" is a different state from "we never
    // asked", and only the first should stop the diagnostic-scan prompt
    // counting the item. Neither anchor field set reads as `unknown`.
    const w = quickCheckRecordWrites("oil", { answerType: "unsure" }, ctx);
    expect(w).toHaveLength(1);
    expect(w[0].lastServiceDate).toBeUndefined();
    expect(w[0].lastServiceMileage).toBeUndefined();
    expect(w[0].customInputs.answerType).toBe("unsure");
  });

  it("writes the filter row alongside oil, sharing the anchor on a yes", () => {
    // One taxonomy slug covers engine air AND cabin, so the spec's two types
    // collapse to `catalog_filter_replacement`.
    const w = quickCheckRecordWrites(
      "oil", { answerType: "when", month: 3, year: 2026, filtersDone: true }, ctx,
    );
    expect(w.map((r) => r.type)).toEqual(["oil", "catalog_filter_replacement"]);
    expect(w[1].lastServiceDate).toBe(w[0].lastServiceDate);
    expect(w[1].lastServiceMileage).toBe(w[0].lastServiceMileage);
  });

  it("leaves the filter row unanchored on a no", () => {
    // "The filters were NOT done at that service" tells us the oil date is the
    // wrong anchor for them — not that we know the right one.
    const w = quickCheckRecordWrites(
      "oil", { answerType: "when", month: 3, year: 2026, filtersDone: false }, ctx,
    );
    expect(w).toHaveLength(2);
    expect(w[1].lastServiceDate).toBeUndefined();
    expect(w[1].customInputs.answerType).toBe("unsure");
    expect(w[1].customInputs.doneWithOilChange).toBe(false);
  });

  it("writes no filter row at all when the driver did not say", () => {
    const w = quickCheckRecordWrites("oil", { answerType: "when", month: 3, year: 2026 }, ctx);
    expect(w).toHaveLength(1);
  });

  it("carries the tire symptom through, since the reader now acts on it", () => {
    const w = quickCheckRecordWrites("tires", { answerType: "unsure", symptom: "losing_air" }, ctx);
    expect(w[0].customInputs.symptom).toBe("losing_air");
  });
});
