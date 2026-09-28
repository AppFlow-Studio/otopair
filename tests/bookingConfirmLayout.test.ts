/**
 * Loading-screen layout: the copy must clear the pin, and clear the sheet.
 *
 * Bug #243 — "the logo renders BEHIND the text". The copy used to be a
 * hand-tuned percentage per device bucket (19/22/29/34/37%) while the pin was
 * nudged by an offset in POINTS. Two different units meant the gap between
 * them was re-guessed for every bucket, and on at least one it went negative:
 * at 393x667 the copy started at 147 while the pin ended near 179, so the text
 * was drawn over the logo.
 *
 * These assert the relationship rather than the numbers, so a future tweak to
 * a bucket cannot silently put the text back on the pin.
 *
 * NOTE: lib/bookingConfirmSheet.test.ts predates this and is NOT run by the
 * suite — vitest's include is `tests/**`, so anything beside the source is
 * invisible. That is why this file lives here.
 */
import { describe, expect, it } from "vitest";
import { calculateBookingConfirmLayout } from "../lib/bookingConfirmSheet";

/** Mirrors PIN_BOTTOM_FRACTION in the source (measured on device). */
const PIN_BOTTOM_FRACTION = 0.31;
const COPY_BLOCK_HEIGHT = 44;

/** Real and near-real portrait sizes, plus the bucket boundaries. */
const SIZES: [number, number, string][] = [
  [320, 568, "iPhone SE 1st gen"],
  [360, 640, "small Android"],
  [360, 827, "narrow tall"],
  [375, 667, "iPhone SE 2/3"],
  [375, 812, "iPhone X/11 Pro"],
  [390, 844, "iPhone 14/15"],
  [393, 667, "wide + very compact (the reported bucket)"],
  [393, 852, "iPhone 15 Pro"],
  [402, 874, "iPhone 17 Pro"],
  [430, 932, "iPhone 15 Pro Max"],
  [440, 956, "iPhone 17 Pro Max"],
  [379, 759, "just under both bucket edges"],
  [380, 760, "exactly on both bucket edges"],
];

describe("the copy never lands on the pin", () => {
  it.each(SIZES)("clears the logo at %ix%i (%s)", (width, height) => {
    const { copyTop, lottieTranslateY } = calculateBookingConfirmLayout({ width, height });
    const pinBottom = Math.round(height * PIN_BOTTOM_FRACTION) + lottieTranslateY;
    expect(copyTop).toBeGreaterThanOrEqual(pinBottom);
  });

  it("puts real clearance under the pin wherever there is room", () => {
    // The squeeze only applies on short screens; a normal phone gets the full gap.
    const { copyTop, lottieTranslateY } = calculateBookingConfirmLayout({
      width: 402,
      height: 874,
    });
    const pinBottom = Math.round(874 * PIN_BOTTOM_FRACTION) + lottieTranslateY;
    expect(copyTop - pinBottom).toBe(38);
  });

  it("fixes the reported bucket rather than moving the problem", () => {
    // 393x667 is the fixture the old lib-side test pinned at copyTop 22% = 147,
    // against a pin ending near 179. It must now sit below the pin.
    const { copyTop, lottieTranslateY } = calculateBookingConfirmLayout({
      width: 393,
      height: 667,
    });
    const pinBottom = Math.round(667 * PIN_BOTTOM_FRACTION) + lottieTranslateY;
    expect(copyTop).toBeGreaterThanOrEqual(pinBottom);
    expect(copyTop).toBeGreaterThan(147);
  });
});

describe("the copy never slides under the sheet", () => {
  it.each(SIZES)("stays above the sheet at %ix%i (%s)", (width, height) => {
    const { copyTop, sheetHeight } = calculateBookingConfirmLayout({ width, height });
    expect(copyTop + COPY_BLOCK_HEIGHT).toBeLessThanOrEqual(height - sheetHeight);
  });
});

describe("the tuned values the rest of the screen depends on are untouched", () => {
  it("keeps the per-bucket sheet heights and pin offsets", () => {
    expect(calculateBookingConfirmLayout({ width: 393, height: 667 })).toMatchObject({
      lottieTranslateY: -28,
      sheetHeight: 420,
    });
    expect(calculateBookingConfirmLayout({ width: 360, height: 827 })).toMatchObject({
      lottieTranslateY: -66,
      sheetHeight: 468,
    });
    expect(calculateBookingConfirmLayout({ width: 402, height: 874 })).toMatchObject({
      lottieTranslateY: -12,
    });
  });
});
