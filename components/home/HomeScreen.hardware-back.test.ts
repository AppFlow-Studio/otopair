import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const homeSource = readFileSync(join(currentDirectory, "../../app/(main-tabs)/home/index.tsx"), "utf8");

test("HomeScreen exits the app on Android hardware back instead of popping startup routes", () => {
  assert.match(homeSource, /BackHandler\.addEventListener\(\s*["']hardwareBackPress["']/);
  assert.match(homeSource, /BackHandler\.exitApp\(\)/);
  assert.match(homeSource, /return true/);
});
