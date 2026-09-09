import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const categoryListRowSource = readFileSync(
  join(currentDir, "CategoryListRow.tsx"),
  "utf8",
);
const categoryDetailSource = readFileSync(
  join(currentDir, "../../app/(booking-flow)/category/[tab].tsx"),
  "utf8",
);

test("booking category modules do not use unsupported Reanimated SharedTransition APIs", () => {
  for (const source of [categoryListRowSource, categoryDetailSource]) {
    assert.equal(source.includes("SharedTransition"), false);
    assert.equal(source.includes("sharedTransitionTag"), false);
    assert.equal(source.includes("sharedTransitionStyle"), false);
  }
});
