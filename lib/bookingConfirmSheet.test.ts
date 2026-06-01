import test from "node:test";
import assert from "node:assert/strict";

import { calculateBookingConfirmSheetHeight } from "./bookingConfirmSheet.ts";

test("booking confirmation sheet gives compact phones enough height for actions", () => {
  assert.equal(calculateBookingConfirmSheetHeight(827), 468);
});

test("booking confirmation sheet scales up on very compact phones without taking the whole screen", () => {
  assert.equal(calculateBookingConfirmSheetHeight(667), 480);
});

test("booking confirmation sheet keeps a usable minimum on taller phones", () => {
  assert.equal(calculateBookingConfirmSheetHeight(900), 504);
});
