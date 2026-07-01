import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const confirmingSource = readFileSync(
  join(process.cwd(), "app/booking/mechanic/[id]/confirming.tsx"),
  "utf8",
);
const bookingsSource = readFileSync(
  join(process.cwd(), "convex/bookings.ts"),
  "utf8",
);
const paymentStatusHistorySource = readFileSync(
  join(process.cwd(), "convex/payment_status_history.ts"),
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

test("booking creation stays the final fallible confirmation step before success", () => {
  const createBookingIndex = confirmingSource.indexOf("const bookingIds = await createBookingConvex(");
  const catchIndex = confirmingSource.indexOf("} catch (err) {", createBookingIndex);
  const successPathAfterCreateStarts = confirmingSource.slice(createBookingIndex, catchIndex);

  assert.ok(createBookingIndex > -1);
  assert.ok(catchIndex > createBookingIndex);
  assert.equal(
    successPathAfterCreateStarts.match(/\bawait\b/g)?.length ?? 0,
    1,
    "Do not add fallible async work after createBookingConvex; validate before it or rely on rollback.",
  );
  assert.match(successPathAfterCreateStarts, /router\.replace\(/);
});

test("booking confirmation rolls back a just-created booking if a later error occurs", () => {
  const createBookingIndex = confirmingSource.indexOf("createBookingConvex(");
  const rollbackIndex = confirmingSource.indexOf("rollbackFailedBookingCreation(");
  const catchIndex = confirmingSource.indexOf("} catch (err) {", createBookingIndex);

  assert.ok(createBookingIndex > -1);
  assert.ok(rollbackIndex > createBookingIndex);
  assert.ok(catchIndex > createBookingIndex);
  assert.ok(rollbackIndex > catchIndex);
  assert.match(bookingsSource, /export const rollbackFailedBookingCreation = mutation\(/);
  assert.match(bookingsSource, /ctx\.auth\.getUserIdentity\(\)/);
  assert.match(bookingsSource, /booking\.user_id !== user\._id/);
  assert.match(bookingsSource, /booking\.status !== "pending"/);
  assert.match(paymentStatusHistorySource, /const payment = await ctx\.db\.get\(args\.payment_id\)/);
  assert.match(paymentStatusHistorySource, /if \(!payment\) return/);
});
