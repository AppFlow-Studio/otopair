import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = join(currentDirectory, "..");
const appJson = JSON.parse(readFileSync(join(rootDirectory, "app.json"), "utf8"));

test("app.json registers the debug updates-disabled plugin", () => {
  assert.ok(
    appJson.expo.plugins.includes("./plugins/with-debug-updates-disabled"),
  );
});

test("plugin disables expo-updates only in the debug manifest via a merge override", () => {
  const pluginSource = readFileSync(
    join(currentDirectory, "with-debug-updates-disabled.js"),
    "utf8",
  );

  // Debug source set only — must NOT touch src/main / release.
  assert.match(pluginSource, /src[\\/]+debug[\\/]+AndroidManifest\.xml|"debug"/);
  assert.match(pluginSource, /expo\.modules\.updates\.ENABLED/);
  assert.match(pluginSource, /"android:value":\s*"false"/);
  // tools:replace is what wins the merge over main's ENABLED=true.
  assert.match(pluginSource, /"tools:replace":\s*"android:value"/);
  assert.match(pluginSource, /withDangerousMod/);
});
