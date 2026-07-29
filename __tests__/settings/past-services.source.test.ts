import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const transactionsSource = readFileSync(
  join(currentDirectory, "../../app/settings/transactions.tsx"),
  "utf8",
);
const pastServiceDetailSource = readFileSync(
  join(currentDirectory, "../../app/settings/past-service/[bookingId].tsx"),
  "utf8",
);

test("past services screens gate AppleZoom components behind optional iOS-only lookups", () => {
  for (const source of [transactionsSource, pastServiceDetailSource]) {
    assert.doesNotMatch(source, /<Link\.AppleZoom/);
    assert.match(source, /Platform\.OS === "ios"/);
    assert.match(source, /type AppleZoomRouterLink = typeof Link &/);
  }

  assert.match(transactionsSource, /const AppleZoom =/);
  assert.match(transactionsSource, /AppleZoom \?/);
  assert.match(transactionsSource, /<AppleZoom>/);

  assert.match(pastServiceDetailSource, /const AppleZoomTarget =/);
  assert.match(pastServiceDetailSource, /AppleZoomTarget \?/);
  assert.match(pastServiceDetailSource, /<AppleZoomTarget>/);
});

test("past services screens never render AppleZoom on Android", () => {
  for (const source of [transactionsSource, pastServiceDetailSource]) {
    assert.doesNotMatch(source, /Platform\.OS !== "android"/);
    assert.doesNotMatch(source, /Platform\.select/);
  }
});
