import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const forgotPasswordSource = readFileSync(join(currentDirectory, "ForgotPasswordFlow.tsx"), "utf8");

test("ForgotPasswordFlow phone input uses the PhoneNumberStep input structure", () => {
  assert.match(forgotPasswordSource, /style=\{styles\.inputContainer\}/);
  assert.match(forgotPasswordSource, /style=\{styles\.countryCodeContainer\}/);
  assert.match(forgotPasswordSource, /style=\{styles\.flagContainer\}/);
  assert.match(forgotPasswordSource, /style=\{styles\.countryCodeNumber\}/);
  assert.match(forgotPasswordSource, /importantForAutofill="no"/);
  assert.match(forgotPasswordSource, /textContentType="none"/);
});

test("ForgotPasswordFlow keeps phone reset visible", () => {
  assert.match(forgotPasswordSource, />Phone number</);
  assert.match(forgotPasswordSource, /sendResetCode\("phone", getFormattedPhoneIdentifier\(\)\)/);
});

test("ForgotPasswordFlow code inputs expose iOS and Android OTP autofill hints", () => {
  assert.match(
    forgotPasswordSource,
    /textContentType=\{Platform\.OS === "ios" \? "oneTimeCode" : "none"\}/
  );
  assert.match(
    forgotPasswordSource,
    /autoComplete=\{Platform\.OS === "android" \? "sms-otp" : "one-time-code"\}/
  );
  assert.match(forgotPasswordSource, /importantForAutofill="yes"/);
});

test("ForgotPasswordFlow hides native pasted OTP text and renders one digit per box", () => {
  assert.match(forgotPasswordSource, /styles\.hiddenCodeInputText/);
  assert.match(forgotPasswordSource, /styles\.codeDigitText/);
  assert.match(forgotPasswordSource, /\{digit ?\? \(/);
});

test("ForgotPasswordFlow derives resend timer from an absolute deadline", () => {
  assert.match(forgotPasswordSource, /AppState\.addEventListener\("change"/);
  assert.match(forgotPasswordSource, /resendAvailableAt/);
  assert.match(forgotPasswordSource, /getPasswordResetTimeRemaining/);
});

test("ForgotPasswordFlow resends through the active Clerk reset factor", () => {
  assert.match(forgotPasswordSource, /signIn\.prepareFirstFactor\(resetFactor\)/);
  assert.match(forgotPasswordSource, /getResetPasswordFactorForMethod/);
});

test("ForgotPasswordFlow matches change password color for Good strength", () => {
  assert.match(
    forgotPasswordSource,
    /case 3:\s*return SemanticColors\.warningAmberLightOnDark;/s
  );
});

test("ForgotPasswordFlow success still delegates to LoginStep navigation", () => {
  assert.match(forgotPasswordSource, /await onAuthenticated\(\)/);
  assert.doesNotMatch(forgotPasswordSource, /router\.replace\("\/\(main-tabs\)\/home"\)/);
});
