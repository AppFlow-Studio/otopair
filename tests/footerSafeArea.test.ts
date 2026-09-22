import { describe, it, expect } from "vitest";
import { footerPaddingBottom } from "../lib/footerSafeArea";

// The values CarInfoStepper passes, unscaled (scale() is a screen-width ratio
// and needs react-native's Dimensions; the rule under test is the pure part).
const BASE = 20;
const GAP = 8;

const pad = (isAndroid: boolean, bottomInset: number) =>
  footerPaddingBottom({ isAndroid, bottomInset, base: BASE, gap: GAP });

describe("footerPaddingBottom", () => {
  it("leaves iOS on the hand-tuned base, home indicator or not", () => {
    // iPhone with a home indicator reports ~34dp. Adding it would float the
    // footer ~34dp higher than the value Ahmad signed off on.
    expect(pad(false, 34)).toBe(BASE);
    // Touch-ID era iPhone / iPad: no bottom inset, same result.
    expect(pad(false, 0)).toBe(BASE);
  });

  it("clears the Android 3-button navigation bar (ticket #284)", () => {
    // ~48dp of opaque system bar that eats every touch. The old flat base put
    // "Finish for now" inside it.
    expect(pad(true, 48)).toBe(56);
    expect(pad(true, 48)).toBeGreaterThan(48);
  });

  it("clears the Android gesture bar", () => {
    expect(pad(true, 16)).toBe(24);
    expect(pad(true, 24)).toBe(32);
    expect(pad(true, 16)).toBeGreaterThan(16);
    expect(pad(true, 24)).toBeGreaterThan(24);
  });

  it("falls back to the base when Android reports no inset", () => {
    // Not edge-to-edge, or the inset hasn't measured yet: base + gap would be
    // tighter than the designed spacing, so the base wins.
    expect(pad(true, 0)).toBe(BASE);
  });
});
