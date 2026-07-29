import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(currentDirectory, "../../components/onboarding/steps/ConfirmPhoneNumberStep.tsx"),
  "utf8",
);

test("confirm phone number incorrect-code sheet asks the user to try again", () => {
  assert.match(source, /Incorrect code entered/);
  assert.match(source, /Please try again\./);
});
