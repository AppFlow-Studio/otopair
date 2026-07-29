import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDirectory, "../../app/(main-tabs)/home/index.tsx"), "utf8");

test("home preloads identity fields into the onboarding fallback store for settings overlay", () => {
  assert.match(source, /useOnboardingStore/);
  assert.match(source, /updateOnboardingData/);
  assert.match(source, /firstName:\s*me\.first_name/);
  assert.match(source, /lastName:\s*me\.last_name/);
  assert.match(source, /email:\s*me\.email/);
});
