import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const loginStepSource = readFileSync(join(currentDirectory, "LoginStep.tsx"), "utf8");

test("LoginStep handles Android hardware back with its onboarding back action", () => {
  assert.match(loginStepSource, /BackHandler\.addEventListener\(\s*["']hardwareBackPress["']/);
  assert.match(loginStepSource, /onBack\(\)/);
  assert.match(loginStepSource, /return true/);
});
