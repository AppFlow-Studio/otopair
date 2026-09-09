import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(currentDir, "../../app/(booking-flow)/select-services.tsx"),
  "utf8",
);

test("select services matches the working category sheet bottom structure", () => {
  assert.doesNotMatch(source, /endFillColor=/);
  assert.doesNotMatch(source, /styles\.scrollFooter/);
  assert.match(source, /contentContainerStyle=\{\[\s*styles\.scrollContent,/);
});

test("select services disables the large category-card shadow on Android", () => {
  assert.match(
    source,
    /boxShadow:\s*Platform\.OS === "ios" \? CardShadow\.default : undefined/,
  );
});
