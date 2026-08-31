import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

test("dismissing an expired quote does not reuse the cancellation UI", () => {
  const card = readFileSync(
    resolve(process.cwd(), "components/bookings/PendingQuoteCard.tsx"),
    "utf8",
  );
  const screen = readFileSync(
    resolve(process.cwd(), "app/(main-tabs)/bookings/index.tsx"),
    "utf8",
  );

  expect(card).toContain("runDismiss(() => onDismiss?.(booking.id))");
  expect(card).not.toContain("runAction(() => onDismiss?.(booking.id))");
  expect(screen).toContain("dismissExpiredQuoteRequest: FunctionReference");
  expect(screen).toContain("useMutationWithToast(dismissExpiredQuoteRequest");
  expect(screen).not.toContain('success: "Quote dismissed."');
});
