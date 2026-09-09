import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const chooseMechanicSource = readFileSync(
  join(currentDirectory, "../../app/(booking-flow)/choose-mechanic.tsx"),
  "utf8",
);
const shopPageSource = readFileSync(
  join(currentDirectory, "../../components/booking-flow/ShopPage.tsx"),
  "utf8",
);
const mechanicCarouselSource = readFileSync(
  join(currentDirectory, "../../components/booking-flow/MechanicCarousel.tsx"),
  "utf8",
);

test("mechanic booking bottom-sheet horizontal lists use gesture-handler primitives on Android", () => {
  assert.match(chooseMechanicSource, /import\s+\{\s*ScrollView\s*\}\s+from\s+["']react-native-gesture-handler["']/);
  assert.match(mechanicCarouselSource, /import\s+\{\s*ScrollView\s*\}\s+from\s+["']react-native-gesture-handler["']/);
});

test("mechanic carousel interaction temporarily disables the parent shop pager", () => {
  assert.match(chooseMechanicSource, /isMechanicCarouselInteracting/);
  assert.match(chooseMechanicSource, /scrollEnabled=\{!isMechanicCarouselInteracting\}/);
  assert.match(shopPageSource, /onMechanicCarouselInteractionChange/);
  assert.match(mechanicCarouselSource, /onInteractionChange/);
});
