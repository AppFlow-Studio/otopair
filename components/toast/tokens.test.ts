import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readDefaultDurations(): Record<string, number> {
  const source = readFileSync(resolve(__dirname, "tokens.ts"), "utf8");
  const match = source.match(/export const DEFAULT_DURATION_MS[\s\S]*?= \{([\s\S]*?)\};/);
  assert.ok(match, "DEFAULT_DURATION_MS block should exist");
  return Object.fromEntries(
    Array.from(match[1].matchAll(/(\w+):\s*(\d+)/g)).map((entry) => [
      entry[1],
      Number(entry[2]),
    ]),
  );
}

test("default toast durations last 1.5 seconds longer than the original timings", () => {
  const durations = readDefaultDurations();

  assert.equal(durations.success, 5000);
  assert.equal(durations.info, 4500);
  assert.equal(durations.warning, 6000);
  assert.equal(durations.error, 6500);
  assert.equal(durations.trust, 6000);
});
