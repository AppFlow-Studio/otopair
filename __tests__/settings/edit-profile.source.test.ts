import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDirectory, "../../app/settings/edit-profile.tsx"), "utf8");

test("edit profile preflights changed phone numbers before routing to verification", () => {
  assert.match(source, /isIdentifierAlreadyTakenError/);
  assert.match(source, /prepareProfilePhoneVerification/);
  assert.match(source, /await prepareProfilePhoneVerification\(nextPhoneNumber\)/);
  assert.match(source, /pendingPhoneVerificationId/);
});

test("edit profile shows the onboarding-style error sheet for taken phone numbers", () => {
  assert.match(source, /showContactErrorSheet/);
  assert.match(source, /That phone number is already associated with another account\./);
  assert.match(source, /errorModalBackdrop/);
  assert.match(source, /errorModalHandle/);
  assert.match(source, /Incorrect code entered|Phone number already in use/);
});

test("edit profile preflights changed email addresses before routing to verification", () => {
  assert.match(source, /prepareProfileEmailVerification/);
  assert.match(source, /await prepareProfileEmailVerification\(nextEmail\)/);
  assert.match(source, /pendingEmailVerificationId/);
  assert.match(source, /Email already in use/);
});

test("edit profile only enables save for changed text fields with valid changed contact fields", () => {
  assert.match(source, /isTextFieldChanged/);
  assert.match(source, /isPhoneValidForSave/);
  assert.match(source, /isEmailValidForSave/);
  assert.match(source, /const canSave = !isSaving && isTextFieldChanged && isPhoneValidForSave && isEmailValidForSave/);
});
