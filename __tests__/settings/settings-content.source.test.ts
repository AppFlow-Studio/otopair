import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDirectory, "../../components/settings/SettingsContent.tsx"), "utf8");

test("settings content does not show the John Doe placeholder while identity data loads", () => {
  assert.doesNotMatch(source, /John Doe/);
  assert.match(source, /LoadingEllipsisText/);
  assert.match(source, /withRepeat\(withTiming/);
  assert.match(source, /fullName \?/);
  assert.match(source, /handle \?/);
});
