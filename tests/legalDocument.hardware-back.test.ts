import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const legalDocumentSource = readFileSync(
  join(process.cwd(), "components", "legal", "LegalDocument.tsx"),
  "utf8",
);

test("LegalDocument returns to the prior screen on Android hardware back", () => {
  expect(legalDocumentSource).toMatch(/BackHandler\.addEventListener\(\s*["']hardwareBackPress["']/);
  expect(legalDocumentSource).toMatch(/router\.back\(\)/);
  expect(legalDocumentSource).toMatch(/return true/);
});
