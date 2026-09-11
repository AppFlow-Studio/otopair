/**
 * Interval bands + the confidence hold — Quick Check v2 §7 step 4,
 * Fallback v2 §5.
 *
 * Two things are being pinned here. First, the band cutoffs, because the old
 * `ratioToStatus` fired "due soon" at 0.75 and the spec says 0.8 — items in
 * that gap change status. Second, the hold: a class default may raise a
 * recommendation at 1.0x but must not deduct until 1.5x, because deducting off
 * a generalisation punishes a car that is fine. That is v1's coolant bug — a
 * 60,000-mile default put the deduction at 90,000 on a Camry whose maker says
 * 100,000.
 */
import { describe, expect, it } from "vitest";
import {
  BAND_CUTOFFS,
  BAND_FACTOR,
  BAND_TO_STATUS,
  appliedFactor,
  isHeld,
  ratioToBand,
  type IntervalBand,
} from "@/utils/intervalBands";

describe("band cutoffs", () => {
  it("places each band exactly where the spec says", () => {
    expect(ratioToBand(0)).toBe("on_time");
    expect(ratioToBand(0.79)).toBe("on_time");
    expect(ratioToBand(0.8)).toBe("due_soon");
    expect(ratioToBand(0.99)).toBe("due_soon");
    expect(ratioToBand(1.0)).toBe("overdue");
    expect(ratioToBand(1.49)).toBe("overdue");
    expect(ratioToBand(1.5)).toBe("severely_overdue");
    expect(ratioToBand(20)).toBe("severely_overdue");
  });

  it("moves the due-soon line from 0.75 to 0.80", () => {
    // The old ratioToStatus fired at >= 0.75. Anything in [0.75, 0.80) is
    // on-time under the spec and gains back 0.3 of its share.
    expect(ratioToBand(0.75)).toBe("on_time");
    expect(ratioToBand(0.79)).toBe("on_time");
  });

  it("degrades a non-finite ratio to on_time rather than throwing", () => {
    // A zero-length interval would otherwise produce Infinity and read as
    // severely overdue on a car we know nothing about.
    expect(ratioToBand(Number.NaN)).toBe("on_time");
    expect(ratioToBand(Number.POSITIVE_INFINITY)).toBe("on_time");
  });

  it("keeps the 0.8 cutoff equal to the Bigger Services fire rule", () => {
    // Same number on purpose: worth asking about = worth mentioning.
    expect(BAND_CUTOFFS.dueSoon).toBe(0.8);
  });
});

describe("factors", () => {
  it("are the four numbers the calculator already uses", () => {
    // STATUS_SCORE in healthScore.ts is on_time 1.0 / due_soon 0.7 /
    // needs_attention 0.35 / overdue 0.1. Matching it is why this change
    // needs no edit to the calculator.
    expect(BAND_FACTOR).toEqual({
      on_time: 1.0,
      due_soon: 0.7,
      overdue: 0.35,
      severely_overdue: 0.1,
    });
  });

  it("gets worse monotonically as the ratio climbs", () => {
    const order: IntervalBand[] = ["on_time", "due_soon", "overdue", "severely_overdue"];
    for (let i = 1; i < order.length; i++) {
      expect(BAND_FACTOR[order[i]]).toBeLessThan(BAND_FACTOR[order[i - 1]]);
    }
  });
});

describe("band → display status", () => {
  /**
   * Re-baselined 2026-09-04. This block used to pin the opposite rule — both
   * overdue bands collapsed onto `overdue`, and `needs_attention` was reserved
   * for "a human graded this yellow". Ahmad reversed it so Yassin's four bands
   * and our tiers line up one-to-one, accepting that interval-overdue and a
   * mechanic's yellow now share a tier.
   */
  it("gives each band its own status", () => {
    expect(BAND_TO_STATUS.on_time).toBe("on_time");
    expect(BAND_TO_STATUS.due_soon).toBe("due_soon");
    expect(BAND_TO_STATUS.overdue).toBe("needs_attention");
    expect(BAND_TO_STATUS.severely_overdue).toBe("overdue");
  });

  it("maps every band to a distinct status", () => {
    // The point of the change: four bands in, four tiers out. A collapse
    // anywhere here means two different findings read identically.
    const statuses = Object.values(BAND_TO_STATUS);
    expect(new Set(statuses).size).toBe(statuses.length);
  });

  it("keeps severely overdue as the loudest tier", () => {
    expect(BAND_TO_STATUS[ratioToBand(1.6)]).toBe("overdue");
    expect(BAND_TO_STATUS[ratioToBand(1.2)]).toBe("needs_attention");
  });
});

describe("the factor column reaches the score", () => {
  it("agrees with STATUS_SCORE at every band", () => {
    // This is what the remap bought, and it is worth pinning: before it,
    // `overdue` carried both the 1.0-1.5 and the >=1.5 bands, and
    // STATUS_SCORE.overdue is 0.10 — so the spec's 0.35 tier could never be
    // reached through a status lookup. If these two tables ever disagree
    // again, a band's factor silently stops being what the score uses.
    const STATUS_SCORE = { on_time: 1.0, due_soon: 0.7, needs_attention: 0.35, overdue: 0.1 };
    for (const band of Object.keys(BAND_FACTOR) as IntervalBand[]) {
      expect(STATUS_SCORE[BAND_TO_STATUS[band] as keyof typeof STATUS_SCORE])
        .toBe(BAND_FACTOR[band]);
    }
  });
});

describe("the confidence hold", () => {
  const held = (over: Partial<Parameters<typeof isHeld>[0]> = {}) =>
    isHeld({ band: "overdue", intervalSource: "class_default", ...over });

  it("holds a class default at due soon and overdue", () => {
    expect(held({ band: "due_soon" })).toBe(true);
    expect(held({ band: "overdue" })).toBe(true);
  });

  it("never holds at severely overdue", () => {
    // 1.5x is far enough past any plausible real interval that the guess is
    // no longer the reason the car looks bad.
    expect(held({ band: "severely_overdue" })).toBe(false);
  });

  it("never holds an on-time item — there is nothing to hold back", () => {
    expect(held({ band: "on_time" })).toBe(false);
  });

  it("never holds a manufacturer interval", () => {
    // The whole justification is that OUR number is a guess. An OEM schedule
    // is not, so it deducts normally.
    expect(held({ intervalSource: "oem" })).toBe(false);
    expect(held({ intervalSource: "oem", band: "due_soon" })).toBe(false);
  });

  it("releases on confirmation", () => {
    // A "Never had it done" answer or a mechanic's grade is the driver or a
    // professional telling us the service is genuinely outstanding — the
    // interval's confidence stops mattering.
    expect(held({ confirmed: true })).toBe(false);
    expect(held({ band: "due_soon", confirmed: true })).toBe(false);
  });
});

describe("applied factor", () => {
  it("is 1.00 while held — recommendation shows, no deduction", () => {
    expect(appliedFactor({ band: "overdue", intervalSource: "class_default" })).toBe(1.0);
    expect(appliedFactor({ band: "due_soon", intervalSource: "class_default" })).toBe(1.0);
  });

  it("is the band factor once the hold does not apply", () => {
    // Enrichment landing is the third release path, and needs no machinery:
    // the source flips to "oem" and the next recompute deducts.
    expect(appliedFactor({ band: "overdue", intervalSource: "oem" })).toBe(0.35);
    expect(appliedFactor({ band: "overdue", intervalSource: "class_default", confirmed: true })).toBe(0.35);
    expect(appliedFactor({ band: "severely_overdue", intervalSource: "class_default" })).toBe(0.1);
  });

  it("a held item is never scored better than on-time", () => {
    // 1.00 is the ceiling, not a bonus — the hold suppresses a deduction, it
    // does not award points.
    for (const band of ["on_time", "due_soon", "overdue", "severely_overdue"] as IntervalBand[]) {
      expect(appliedFactor({ band, intervalSource: "class_default" })).toBeLessThanOrEqual(1.0);
    }
  });

  it("the Camry coolant case: recommendation at 1.0x, deduction only at 1.5x", () => {
    // 100,000-mile real interval, 60,000-mile guess. At 90,000 miles the old
    // rule deducted; under the hold it recommends and costs nothing.
    const ratioAt90k = 90_000 / 60_000; // 1.5 — the spec's own worked failure
    const ratioAt80k = 80_000 / 60_000; // 1.33
    expect(appliedFactor({ band: ratioToBand(ratioAt80k), intervalSource: "class_default" })).toBe(1.0);
    // At exactly 1.5 the hold lifts by design — that is the ceiling on how
    // long a guess gets the benefit of the doubt.
    expect(appliedFactor({ band: ratioToBand(ratioAt90k), intervalSource: "class_default" })).toBe(0.1);
  });
});
