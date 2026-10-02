import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(currentDir, "CarCarousel.tsx"), "utf8");
const rotateToIndex = source.slice(
  source.indexOf("const rotateToIndex = useCallback("),
  source.indexOf("// Two-way bridge between carousel and `useVehicleStore`."),
);

// #399: Android tabs freezeOnBlur, so a store write deferred to the end of the
// spin (finishAnimation -> Effect B) never lands if the user leaves Cars
// mid-spin — Home, booking and Oto keep the previous car.
test("a thumbnail tap commits the car to the store before the spin starts", () => {
  const commitAt = rotateToIndex.indexOf("useVehicleStore.getState().selectVehicle(");
  const spinAt = rotateToIndex.indexOf("withTiming(");
  assert.ok(commitAt >= 0, "rotateToIndex must write useVehicleStore directly");
  assert.ok(spinAt >= 0, "rotateToIndex must still animate the rotation");
  assert.ok(commitAt < spinAt, "the store write must happen before the rotation animation starts");
});

test("the tap commit marks the write as the carousel's own so Effect A doesn't rotate again", () => {
  const markAt = rotateToIndex.indexOf("prevStoreVinRef.current =");
  const commitAt = rotateToIndex.indexOf("useVehicleStore.getState().selectVehicle(");
  assert.ok(markAt >= 0 && markAt < commitAt, "prevStoreVinRef must be set before the store write");
});
