import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDirectory, "ConfirmPhoneNumberStep.tsx"), "utf8");
const handleResend = source.slice(
  source.indexOf("const handleResendCode"),
  source.indexOf("const handleCloseErrorModal"),
);

test("ConfirmPhoneNumberStep resend never fails silently", () => {
  assert.match(handleResend, /setErrorTitle\("Couldn't resend code"\)/);
  assert.match(handleResend, /clerkErrorMessage\(err/);
  assert.match(handleResend, /setErrorMessage\(VERIFICATION_NOT_STARTED_MESSAGE\)/);
});

test("ConfirmPhoneNumberStep only restarts the cooldown after a successful send", () => {
  const sendIndex = handleResend.indexOf("prepareVerification()");
  const timerIndex = handleResend.indexOf("setTimeRemaining(RESEND_COOLDOWN_SECONDS)");
  assert.ok(sendIndex > 0 && timerIndex > sendIndex);
  assert.match(handleResend, /setResendNotice\(`New code sent to/);
  assert.match(source, /Sending code…/);
  assert.match(source, /\{resendNotice && /);
});
