import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, "./BookingFlowMap.tsx"), "utf8");

test("booking flow syncs resolved device location into booking store", () => {
  assert.match(source, /useBookingStore/);
  assert.match(source, /useStagedLocation/);
  assert.match(source, /setBookingUserLocation\(resolvedLocation\)/);
});
