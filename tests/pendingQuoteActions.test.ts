import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

test("pending quote cards show only the cancel-request action", () => {
  const card = readFileSync(
    resolve(process.cwd(), "components/bookings/PendingQuoteCard.tsx"),
    "utf8",
  );

  expect(card).toContain('const isPendingQuote = booking.status === "pending_quote";');
  expect(card).toContain("{isPendingQuote ? null : (");
});
