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
