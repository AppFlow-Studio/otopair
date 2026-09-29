// NOTE: this file is NOT run by the suite — vitest's include is `tests/**`, so
// a test sitting beside its source is invisible. The layout assertions that do
// run live in tests/bookingConfirmLayout.test.ts. Kept in sync so it is not a
// trap for whoever eventually wires it up.
import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateBookingConfirmLayout,
  calculateBookingConfirmSheetHeight,
} from "./bookingConfirmSheet.ts";

test("booking confirmation sheet gives compact phones enough height for actions", () => {
  assert.equal(calculateBookingConfirmSheetHeight(827), 468);
});

test("booking confirmation sheet scales up on very compact phones without taking the whole screen", () => {
  assert.equal(calculateBookingConfirmSheetHeight(667), 480);
});

test("booking confirmation sheet keeps a usable minimum on taller phones", () => {
  assert.equal(calculateBookingConfirmSheetHeight(900), 504);
});

test("booking confirmation layout shortens the sheet on wider compact devices", () => {
  const layout = calculateBookingConfirmLayout({ width: 393, height: 667 });
  assert.equal(layout.lottieTranslateY, -28);
  assert.equal(layout.sheetHeight, 420);
  // The copy is derived from the pin now, not a fixed percentage.
  assert.ok(layout.copyTop >= Math.round(667 * 0.31) + layout.lottieTranslateY);
});

test("booking confirmation layout preserves the tighter narrow phone staging", () => {
  const layout = calculateBookingConfirmLayout({ width: 360, height: 827 });
  assert.equal(layout.lottieTranslateY, -66);
  assert.equal(layout.sheetHeight, 468);
  assert.ok(layout.copyTop >= Math.round(827 * 0.31) + layout.lottieTranslateY);
});
