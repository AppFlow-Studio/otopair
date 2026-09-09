import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDirectory, "SignupStep.tsx"), "utf8");

test("SignupStep exposes a development-only Android SMS hash action", () => {
  assert.match(source, /getAndroidSmsRetrieverHash/);
  assert.match(source, /__DEV__ && Platform\.OS === "android"/);
  assert.match(source, /Get Android SMS hash/);
  assert.match(source, /Clipboard\.setStringAsync/);
});
