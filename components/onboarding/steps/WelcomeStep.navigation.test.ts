import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const welcomeStepSource = readFileSync(join(currentDirectory, "WelcomeStep.tsx"), "utf8");

test("WelcomeStep does not mutate onboarding step history after replacing to Home", () => {
  const signedInLoginBlock = welcomeStepSource.match(/if \(isSignedIn\) \{[\s\S]*?\n    \}/)?.[0] ?? "";

  assert.match(signedInLoginBlock, /router\.replace\("\/\(main-tabs\)\/home"\)/);
  assert.doesNotMatch(signedInLoginBlock, /onBack\(\)/);
});
