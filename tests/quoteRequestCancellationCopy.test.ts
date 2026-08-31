import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

test("quote-request cancellation uses quote-specific success copy", () => {
  const screen = readFileSync(
    resolve(process.cwd(), "app/(main-tabs)/bookings/index.tsx"),
    "utf8",
  );

  expect(screen).toContain(
    "const cancelQuoteRequest = useMutationWithToast(api.bookings.cancelBooking, {",
  );
  expect(screen).toContain('success: "Quote request cancelled."');
  expect(screen).toContain("onCancel={handleCancelQuoteRequest}");
});
