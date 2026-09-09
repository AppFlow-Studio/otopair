import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const rootLayoutSource = readFileSync(join(currentDirectory, "../app/_layout.tsx"), "utf8");

test("root layout error boundary renders a fallback instead of a blank screen", () => {
  assert.match(rootLayoutSource, /function RootErrorBoundary/);
  assert.match(rootLayoutSource, /ErrorOccurredModal/);
  assert.match(rootLayoutSource, /BackHandler\.exitApp\(\)/);
});
