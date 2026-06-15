import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const homeSource = readFileSync(
  join(currentDirectory, "../../app/(main-tabs)/home/index.tsx"),
  "utf8",
);
const moreServicesSource = readFileSync(
  join(currentDirectory, "MoreServicesSection.tsx"),
  "utf8",
);
const serviceBundlesSource = readFileSync(
  join(currentDirectory, "ServiceBundlesSection.tsx"),
  "utf8",
);
const providerTypesSource = readFileSync(
  join(currentDirectory, "ProviderTypesSection.tsx"),
  "utf8",
);

test("Home gates all booking entry points behind vehicle ownership", () => {
  assert.match(homeSource, /const openBookingFlow = useCallback\(\(\): boolean => \{/);
  assert.match(homeSource, /if \(vehiclesLoading\) return false;/);
  assert.match(homeSource, /if \(!hasVehicles\) \{\s*noVehicleSheetRef\.current\?\.open\(\);\s*return false;\s*\}/s);
  assert.match(homeSource, /<MoreServicesSection\s+onBeforeOpenBookingFlow=\{openBookingFlow\}\s*\/>/);
  assert.match(homeSource, /<ServiceBundlesSection\s+onBeforeOpenBookingFlow=\{openBookingFlow\}\s*\/>/);
  assert.match(homeSource, /<ProviderTypesSection\s+onBeforeOpenBookingFlow=\{openBookingFlow\}\s*\/>/);
});

test("Home service sections consult the vehicle gate before entering booking", () => {
  for (const source of [moreServicesSource, serviceBundlesSource, providerTypesSource]) {
    assert.match(source, /onBeforeOpenBookingFlow\?: \(\) => boolean;/);
    assert.match(source, /if \(onBeforeOpenBookingFlow\?\.\(\) === false\) \{\s*return;\s*\}/s);
  }
});
