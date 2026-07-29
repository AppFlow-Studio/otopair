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
const bookingFlowLayoutSource = readFileSync(
  join(currentDirectory, "../../app/(booking-flow)/_layout.tsx"),
  "utf8",
);
const addVehicleRequiredSheetSource = readFileSync(
  join(currentDirectory, "AddVehicleRequiredSheet.tsx"),
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

test("Home and booking flow share the same add-vehicle-required sheet", () => {
  assert.match(homeSource, /import \{ AddVehicleRequiredSheet \} from "@\/components\/home\/AddVehicleRequiredSheet";/);
  assert.match(bookingFlowLayoutSource, /import \{ AddVehicleRequiredSheet \} from "@\/components\/home\/AddVehicleRequiredSheet";/);
  assert.match(homeSource, /<AddVehicleRequiredSheet\s+ref=\{noVehicleSheetRef\}/);
  assert.match(bookingFlowLayoutSource, /<AddVehicleRequiredSheet\s+ref=\{sheetRef\}/);
  assert.doesNotMatch(bookingFlowLayoutSource, /<Button/);
  assert.doesNotMatch(bookingFlowLayoutSource, /styles\.primaryButton/);
});

test("global booking-flow lock returns to the previous screen when the sheet closes", () => {
  assert.match(addVehicleRequiredSheetSource, /onClose\?: \(\) => void;/);
  assert.match(addVehicleRequiredSheetSource, /onClose=\{onClose\}/);
  assert.match(bookingFlowLayoutSource, /const suppressCloseNavigationRef = useRef\(false\);/);
  assert.match(bookingFlowLayoutSource, /const returnToPreviousScreen = useCallback\(\(\) => \{/);
  assert.match(bookingFlowLayoutSource, /if \(router\.canGoBack\(\)\) \{/);
  assert.match(bookingFlowLayoutSource, /router\.back\(\);/);
  assert.match(bookingFlowLayoutSource, /router\.replace\("\/\(main-tabs\)\/home"\);/);
  assert.match(bookingFlowLayoutSource, /onClose=\{returnToPreviousScreen\}/);
  assert.match(bookingFlowLayoutSource, /suppressCloseNavigationRef\.current = true;\s*sheetRef\.current\?\.close\(\);\s*router\.replace\("\/add-vehicle"\);/s);
});

test("shared add-vehicle-required sheet preserves the Home button shape", () => {
  assert.match(addVehicleRequiredSheetSource, /borderRadius: 28/);
  assert.match(addVehicleRequiredSheetSource, /height: 56/);
  assert.match(addVehicleRequiredSheetSource, /backgroundColor: BrandColors\.secondary/);
  assert.match(addVehicleRequiredSheetSource, /style=\{\(\{ pressed \}\) => \[styles\.sheetPrimaryButton, pressed && styles\.sheetPressed\]\}/);
});

test("Home service sections consult the vehicle gate before entering booking", () => {
  for (const source of [moreServicesSource, serviceBundlesSource, providerTypesSource]) {
    assert.match(source, /onBeforeOpenBookingFlow\?: \(\) => boolean;/);
    assert.match(source, /if \(onBeforeOpenBookingFlow\?\.\(\) === false\) \{\s*return;\s*\}/s);
  }
});

test("booking flow layout blocks every booking-flow route when the user has no vehicle", () => {
  assert.match(bookingFlowLayoutSource, /useVehicleOwnershipFromConvex\(\)/);
  assert.match(bookingFlowLayoutSource, /if \(isLoading\) \{/);
  assert.match(bookingFlowLayoutSource, /if \(!hasVehicles\) \{/);
  assert.match(bookingFlowLayoutSource, /<AddVehicleRequiredSheet/);
  assert.match(addVehicleRequiredSheetSource, /Add a vehicle first/);
  assert.match(bookingFlowLayoutSource, /<BookingFlowMapProvider>/);
  assert.ok(
    bookingFlowLayoutSource.indexOf("if (!hasVehicles)") <
      bookingFlowLayoutSource.indexOf("<BookingFlowMapProvider>"),
  );
});
