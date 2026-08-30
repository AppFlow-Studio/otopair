import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

test("expired quotes use the quote card with its dismiss-only action", () => {
  const bookingsScreen = readFileSync(
    resolve(process.cwd(), "app/(main-tabs)/bookings/index.tsx"),
    "utf8",
  );
  const quoteCard = readFileSync(
    resolve(process.cwd(), "components/bookings/PendingQuoteCard.tsx"),
    "utf8",
  );

  expect(bookingsScreen).toContain('booking.status === "quote_expired"');
  expect(quoteCard).toContain("isExpired ? (");
  expect(quoteCard).toContain("Dismiss expired quote request");
});
