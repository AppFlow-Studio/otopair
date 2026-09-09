import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const loginStepSource = readFileSync(join(currentDirectory, "LoginStep.tsx"), "utf8");

test("LoginStep suppresses signed-in auto redirect after explicit login navigation starts", () => {
  assert.match(loginStepSource, /explicitLoginNavigationStartedRef/);
  assert.match(
    loginStepSource,
    /loading !== null \|\| showForgotPasswordFlow \|\| explicitLoginNavigationStartedRef\.current/,
  );
  assert.match(loginStepSource, /explicitLoginNavigationStartedRef\.current = true/);
});

test("LoginStep keeps the signing-in screen visible during post-auth navigation", () => {
  assert.match(loginStepSource, /loading !== null \|\| explicitLoginNavigationStartedRef\.current/);
  assert.match(loginStepSource, /Signing you in/);
});
