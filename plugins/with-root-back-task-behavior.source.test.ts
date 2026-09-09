import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const rootDirectory = join(currentDirectory, "..");
const appJson = JSON.parse(readFileSync(join(rootDirectory, "app.json"), "utf8"));

test("app.json registers the Android root back behavior plugin", () => {
  assert.ok(
    appJson.expo.plugins.includes("./plugins/with-root-back-task-behavior"),
  );
});

test("root back behavior plugin patches MainActivity to move root tasks to the background", () => {
  const pluginSource = readFileSync(
    join(currentDirectory, "with-root-back-task-behavior.js"),
    "utf8",
  );

  assert.match(pluginSource, /withMainActivity/);
  assert.match(pluginSource, /moveTaskToBack\(false\)/);
  assert.doesNotMatch(pluginSource, /Build\.VERSION\.SDK_INT <= Build\.VERSION_CODES\.R/);
});
