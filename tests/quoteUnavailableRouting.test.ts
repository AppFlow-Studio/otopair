import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

test("unavailable tire and rotor quotes close their option sheet and notify the Quotes screen", () => {
  const tireSheet = readFileSync(
    resolve(process.cwd(), "components/bookings/QuoteListSheet.tsx"),
    "utf8",
  );
  const rotorSheet = readFileSync(
    resolve(process.cwd(), "components/bookings/RotorQuoteListSheet.tsx"),
    "utf8",
  );
  const bookings = readFileSync(
    resolve(process.cwd(), "app/(main-tabs)/bookings/index.tsx"),
    "utf8",
  );

  for (const sheet of [tireSheet, rotorSheet]) {
    expect(sheet).toContain("onQuoteUnavailable?: (reason: QuoteUnavailableReason) => void;");
    expect(sheet).toContain("onQuoteUnavailable?.(reason);");
    expect(sheet).not.toContain("renderInModal={false}");
  }
  expect(bookings).toContain("setActiveTab(\"quotes\");");
  expect(bookings).toContain("onQuoteUnavailable={handleQuoteUnavailable}");
});
