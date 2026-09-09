import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, "./useBookingStore.ts"), "utf8");

test("booking store starts without a fake user location", () => {
  assert.doesNotMatch(source, /San Francisco, CA/);
  assert.match(source, /userLocation:\s*null/);
});
