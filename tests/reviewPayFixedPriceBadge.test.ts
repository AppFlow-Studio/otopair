import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Review & Pay fixed-price presentation", () => {
  test("does not render fixed-price pills in either Review & Pay surface", () => {
    for (const path of [
      "components/booking/sheets/ReviewPayContent.tsx",
      "app/booking/mechanic/[id]/payment.tsx",
    ]) {
      expect(read(path)).not.toContain("FixedPriceBadge");
    }
  });

  test("uses the labor-only explanation instead of inline Labor only pills", () => {
    const payment = read("app/booking/mechanic/[id]/payment.tsx");

    expect(payment).toContain("Labor only — parts not yet included.");
    expect(payment).not.toContain('label="Labor only"');
  });
});
