import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const confirmingSource = readFileSync(
  join(process.cwd(), "app/booking/mechanic/[id]/confirming.tsx"),
  "utf8",
);

test("booking confirmation authorizes payment before creating the booking", () => {
  const preauthorizeIndex = confirmingSource.indexOf("preauthorizePayment(");
  const createBookingIndex = confirmingSource.indexOf("createBookingConvex(");

  assert.ok(preauthorizeIndex > -1);
  assert.ok(createBookingIndex > -1);
  assert.ok(preauthorizeIndex < createBookingIndex);
  assert.doesNotMatch(confirmingSource, /createPaymentIntentForBooking/);
});
