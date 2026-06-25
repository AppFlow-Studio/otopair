import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));

function read(relativePath: string): string {
  return readFileSync(join(currentDir, relativePath), "utf8");
}

const selectServices = read("../../app/(booking-flow)/select-services.tsx");
const categoryDetail = read("../../app/(booking-flow)/category/[tab].tsx");
const chooseMechanic = read("../../app/(booking-flow)/choose-mechanic.tsx");
const selectedServices = read("./SelectedServicesSheet.tsx");
const vehicleSwitcher = read("./VehicleSwitcherSheet.tsx");
const serviceInfo = read("./ServiceInfoSheet.tsx");
const monthPicker = read("./MonthPickerSheet.tsx");

test("booking-flow sheets derive viewport-dependent geometry reactively", () => {
  for (const source of [
    selectServices,
    categoryDetail,
    chooseMechanic,
    selectedServices,
    vehicleSwitcher,
    serviceInfo,
    monthPicker,
  ]) {
    assert.equal(source.includes("useWindowDimensions"), true);
  }
});

test("booking-flow sheets do not keep module-level screen dimensions", () => {
  for (const source of [
    selectServices,
    categoryDetail,
    chooseMechanic,
    selectedServices,
    vehicleSwitcher,
    serviceInfo,
  ]) {
    assert.equal(source.includes('Dimensions.get("window")'), false);
  }
});

test("custom booking sheets and capped list sheets provide vertical scrolling", () => {
  assert.match(selectServices, /ScrollView/);
  assert.match(categoryDetail, /ScrollView/);
  assert.match(selectedServices, /ScrollView/);
  assert.match(vehicleSwitcher, /ScrollView/);
  assert.match(serviceInfo, /ScrollView/);
  assert.match(monthPicker, /ScrollView/);
});

test("responsive booking sheets share CTA and safe-area clearance calculations", () => {
  assert.match(categoryDetail, /getOverlayClearance/);
  assert.match(chooseMechanic, /getOverlayClearance/);
  assert.match(selectedServices, /getOverlayClearance/);
});
