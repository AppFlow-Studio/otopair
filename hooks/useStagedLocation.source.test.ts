import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, "./useStagedLocation.ts"), "utf8");

test("staged location uses cached, estimated, then precise fixes", () => {
  assert.match(source, /getLastKnownPositionAsync/);
  assert.match(source, /Location\.Accuracy\.Balanced/);
  assert.match(source, /Location\.Accuracy\.High/);
});
