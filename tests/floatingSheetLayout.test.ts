/**
 * The Delete Account reason sheet cut its Submit button off the bottom edge of
 * the screen, with no way to scroll it into view (Kareem, Android).
 *
 * The sheet is `detached` + `enableDynamicSizing` and also carried a
 * `snapPoints={["70%"]}` detent. In @gorhom/bottom-sheet v5 those fight each
 * other: `useAnimatedDetents` adds a second detent measured from the content,
 * the sheet RESTS at whichever detent is shorter (70%), but
 * `animatedSheetHeight` — and therefore the scroll viewport — is sized from the
 * TALLEST detent (the content one). A detached sheet also renders with
 * `overflow: "visible"`, so the surplus was neither clipped nor scrollable: it
 * was simply drawn past the bottom of the screen.
 *
 * The fix drops the percentage detent and caps the dynamic growth at the safe
 * area instead, which both keeps the sheet on screen and leaves the scroll view
 * a real scroll range. These tests pin that geometry.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  FLOATING_SHEET_GAP,
  calculateFloatingSheetLayout,
} from "@/lib/floatingSheetLayout";

/** Android, edge-to-edge: status bar 24dp, 3-button nav 48dp, gesture nav 24dp. */
const DEVICES = {
  /** Small/budget Android 9 panel, 720x1280 @2x. */
  smallThreeButton: { windowHeight: 640, safeAreaTop: 24, safeAreaBottom: 48 },
  /** Budget Android 9 panel, 720x1560 @2x — the geometry in Kareem's report. */
  tallThreeButton: { windowHeight: 780, safeAreaTop: 24, safeAreaBottom: 48 },
  /** Pixel API 34, gesture navigation. */
  pixelGesture: { windowHeight: 891, safeAreaTop: 24, safeAreaBottom: 24 },
} as const;

describe("calculateFloatingSheetLayout", () => {
  it("lifts the sheet a visible gap clear of the system navigation bar", () => {
    // 3-button nav is the tall one; the gap above it must not depend on mode.
    expect(calculateFloatingSheetLayout(DEVICES.smallThreeButton).bottomInset)
      .toBe(48 + FLOATING_SHEET_GAP);
    expect(calculateFloatingSheetLayout(DEVICES.pixelGesture).bottomInset)
      .toBe(24 + FLOATING_SHEET_GAP);
  });

  it("still leaves a gap on devices that report no bottom inset", () => {
    const { bottomInset } = calculateFloatingSheetLayout({
      windowHeight: 640,
      safeAreaTop: 24,
      safeAreaBottom: 0,
    });
    expect(bottomInset).toBe(FLOATING_SHEET_GAP);
  });

  it("caps growth so the sheet's top edge stops below the status bar", () => {
    // The sheet's bottom edge rests at `windowHeight - bottomInset`, so this
    // is the property that keeps the whole sheet on screen.
    for (const device of Object.values(DEVICES)) {
      const { bottomInset, maxHeight } = calculateFloatingSheetLayout(device);
      expect(maxHeight).toBeDefined();
      expect(device.windowHeight - (maxHeight as number) - bottomInset).toBe(
        device.safeAreaTop + FLOATING_SHEET_GAP,
      );
    }
  });

  it("never lets the sheet grow over a system bar", () => {
    for (const device of Object.values(DEVICES)) {
      const { maxHeight } = calculateFloatingSheetLayout(device);
      expect(maxHeight as number).toBeLessThan(
        device.windowHeight - device.safeAreaTop - device.safeAreaBottom,
      );
    }
  });

  it("gives the short screens a smaller box than the tall ones", () => {
    // Content taller than the cap gets a scroll range by construction; this is
    // what makes Submit reachable on the small panel instead of off-screen.
    expect(calculateFloatingSheetLayout(DEVICES.smallThreeButton).maxHeight)
      .toBe(544);
    expect(calculateFloatingSheetLayout(DEVICES.tallThreeButton).maxHeight)
      .toBe(684);
    expect(calculateFloatingSheetLayout(DEVICES.pixelGesture).maxHeight)
      .toBe(819);
  });

  it("clamps nonsense insets rather than pushing the sheet off screen", () => {
    const { bottomInset, maxHeight } = calculateFloatingSheetLayout({
      windowHeight: 640,
      safeAreaTop: -10,
      safeAreaBottom: Number.NaN,
    });
    expect(bottomInset).toBe(FLOATING_SHEET_GAP);
    expect(maxHeight).toBe(640 - FLOATING_SHEET_GAP * 2);
  });

  it("falls back to the library default when the window is not measured yet", () => {
    // `undefined` leaves `maxDynamicContentSize` unset, i.e. the container
    // height. A zero or negative cap would collapse the sheet instead.
    for (const windowHeight of [0, 30, Number.NaN]) {
      expect(
        calculateFloatingSheetLayout({
          windowHeight,
          safeAreaTop: 24,
          safeAreaBottom: 48,
        }).maxHeight,
      ).toBeUndefined();
    }
  });
});

/**
 * Source guards: the arithmetic above is only half the fix — the rest is which
 * props the sheet passes. These keep the fought-over combination from coming
 * back.
 */
describe("delete-account reason sheet props", () => {
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "app",
      "settings",
      "delete-account.tsx",
    ),
    "utf8",
  );
  /** Strip comments so the notes explaining the old bug don't trip the checks. */
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

  it("does not pair a percentage detent with dynamic sizing", () => {
    expect(code).not.toMatch(/snapPoints/);
  });

  it("caps dynamic growth with the safe-area layout", () => {
    expect(code).toMatch(/maxDynamicContentSize=\{sheetLayout\.maxHeight\}/);
    expect(code).toMatch(/bottomInset=\{sheetLayout\.bottomInset\}/);
  });

  it("leaves the sheet's scroll view scrollable", () => {
    expect(code).not.toMatch(/scrollEnabled=\{false\}/);
  });
});
