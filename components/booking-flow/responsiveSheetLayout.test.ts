import { describe, expect, it } from "vitest";

import {
  BOOKING_FLOW_CTA_HEIGHT,
  clampSheetHeight,
  getCappedSheetHeight,
  getCustomSheetBounds,
  getOverlayClearance,
} from "./responsiveSheetLayout";

describe("responsive booking-flow sheet layout", () => {
  it.each([
    [667, 153.41, 613.64],
    [852, 195.96, 783.84],
    [932, 214.36, 857.44],
  ])(
    "derives custom sheet bounds from a %d point viewport",
    (viewportHeight, expectedMinimum, expectedInitial) => {
      expect(getCustomSheetBounds(viewportHeight)).toEqual({
        minimum: expectedMinimum,
        initial: expectedInitial,
        maximum: viewportHeight,
      });
    },
  );

  it("clamps an existing custom sheet height after a viewport resize", () => {
    const bounds = getCustomSheetBounds(667);

    expect(clampSheetHeight(900, bounds)).toBe(667);
    expect(clampSheetHeight(100, bounds)).toBe(bounds.minimum);
    expect(clampSheetHeight(480, bounds)).toBe(480);
  });

  it("adds safe area, CTA height, and extra spacing for overlay clearance", () => {
    expect(
      getOverlayClearance({
        safeAreaBottom: 34,
        overlayHeight: BOOKING_FLOW_CTA_HEIGHT,
        extraSpacing: 16,
      }),
    ).toBe(114);
  });

  it("caps content-driven sheet heights by viewport ratio and absolute maximum", () => {
    expect(
      getCappedSheetHeight({
        viewportHeight: 667,
        desiredHeight: 900,
        minimumHeight: 260,
        maximumRatio: 0.76,
        absoluteMaximum: 640,
      }),
    ).toBeCloseTo(506.92);

    expect(
      getCappedSheetHeight({
        viewportHeight: 932,
        desiredHeight: 900,
        minimumHeight: 260,
        maximumRatio: 0.76,
        absoluteMaximum: 640,
      }),
    ).toBe(640);

    expect(
      getCappedSheetHeight({
        viewportHeight: 667,
        desiredHeight: 120,
        minimumHeight: 260,
        maximumRatio: 0.76,
        absoluteMaximum: 640,
      }),
    ).toBe(260);
  });
});
