import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDirectory, "../../app/settings/success.tsx"), "utf8");

test("settings success screen supports conditional contact update messages", () => {
  assert.match(source, /contact_phone/);
  assert.match(source, /contact_email/);
  assert.match(source, /contact_both/);
  assert.match(source, /Phone number updated/);
  assert.match(source, /Email updated/);
  assert.match(source, /Contact info updated/);
});

test("settings success screen keeps the checkmark animation", () => {
  assert.match(source, /M25 52 L45 72 L80 34/);
  assert.match(source, /strokeDashoffset/);
});

test("settings success title stays on one line and scales down to fit", () => {
  assert.match(source, /numberOfLines=\{1\}/);
  assert.match(source, /adjustsFontSizeToFit/);
  assert.match(source, /minimumFontScale=\{0\.7\}/);
});
