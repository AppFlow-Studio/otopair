import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDirectory, "../../app/settings/verify-contact-update.tsx"), "utf8");

test("verify contact update auto-submits once a six digit code is entered", () => {
  assert.match(source, /useEffect\(\(\) => \{/);
  assert.match(source, /const fullCode = code\.join\(""\)/);
  assert.match(source, /fullCode\.length === 6/);
  assert.match(source, /handleSubmitCode\(fullCode\)/);
});

test("verify contact update uses the onboarding-style error sheet for failed codes", () => {
  assert.match(source, /showErrorModal/);
  assert.match(source, /Animated\.spring\(slideAnim/);
  assert.match(source, /Incorrect code entered/);
  assert.match(source, /errorModalBackdrop/);
  assert.match(source, /errorModalHandle/);
});

test("verify contact update accepts a prepared phone verification resource from edit profile", () => {
  assert.match(source, /pendingPhoneVerificationId/);
  assert.match(source, /find\(.*phoneNumber\.id === pendingPhoneVerificationId/s);
});

test("verify contact update accepts a prepared email verification resource from edit profile", () => {
  assert.match(source, /pendingEmailVerificationId/);
  assert.match(source, /find\(.*emailAddress\.id === pendingEmailVerificationId/s);
});

test("verify contact update clears the first code before moving to the next contact method", () => {
  assert.match(
    source,
    /if \(stepIndex < steps\.length - 1\) \{\s*setCode\(\["", "", "", "", "", ""\]\);\s*setFocusedIndex\(0\);\s*setStepIndex\(\(prev\) => prev \+ 1\);/s,
  );
});

test("verify contact update refocuses the first code input after changing verification steps", () => {
  assert.match(
    source,
    /useEffect\(\(\) => \{[\s\S]*setCode\(\["", "", "", "", "", ""\]\);[\s\S]*setFocusedIndex\(0\);[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*inputRefs\.current\[0\]\?\.focus\(\);[\s\S]*\}\);[\s\S]*prepareVerificationForCurrentStep\(\);/s,
  );
});

test("verify contact update routes to the conditional settings success screen after all verification steps", () => {
  assert.match(source, /contact_both/);
  assert.match(source, /contact_phone/);
  assert.match(source, /contact_email/);
  assert.match(source, /pathname:\s*"\/settings\/success"/);
  assert.match(source, /params:\s*\{\s*type:\s*successType\s*\}/s);
});
