import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDirectory, "EmailVerificationStep.tsx"), "utf8");
const handleResend = source.slice(
  source.indexOf("const handleResend"),
  source.indexOf("const resendDisabled"),
);

test("EmailVerificationStep resend never fails silently", () => {
  assert.doesNotMatch(handleResend, /if \(!isLoaded \|\| !signUp\) return;/);
  assert.match(handleResend, /showError\("Couldn't resend code", clerkErrorMessage\(err/);
});

test("EmailVerificationStep resend confirms the send and starts a cooldown", () => {
  assert.match(handleResend, /setResendNotice\(`New code sent to \$\{signUp\.emailAddress\}/);
  assert.match(handleResend, /setResendTimer\(RESEND_COOLDOWN_SECONDS\)/);
  assert.match(source, /disabled=\{resendDisabled\}/);
  assert.match(source, /Sending code…/);
  assert.match(source, /\{resendNotice && \(/);
});
