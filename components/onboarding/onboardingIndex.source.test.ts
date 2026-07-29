import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const onboardingIndexSource = readFileSync(
  join(currentDir, "../../app/(onboarding)/index.tsx"),
  "utf8",
);

test("onboarding index redirects completed or auto-resumed essential-complete users home before rendering onboarding", () => {
  assert.equal(onboardingIndexSource.includes("shouldRedirectCompletedOnboardingToHome"), true);
  assert.equal(onboardingIndexSource.includes("isAutoResume,"), true);
  assert.equal(onboardingIndexSource.includes("router.replace('/(main-tabs)/home')"), true);
  assert.equal(onboardingIndexSource.includes("if (shouldRedirectHome || !autoResumeReady)"), true);
});

test("onboarding index does not auto-resume completed users while the home redirect is pending", () => {
  assert.equal(onboardingIndexSource.includes("if (shouldRedirectHome) return;"), true);
});
