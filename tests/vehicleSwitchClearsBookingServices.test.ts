import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const root = process.cwd();
const bookingStore = readFileSync(join(root, "stores/useBookingStore.ts"), "utf8");
const vehicleStore = readFileSync(join(root, "stores/useVehicleStore.ts"), "utf8");

describe("vehicle switch clears booking service state", () => {
  test("clearSelectedServices clears selected services, options, and diagnostic state", () => {
    expect(bookingStore).toMatch(/clearSelectedServices:\s*\(\)\s*=>\s*\n\s*set\(\{\s*selectedServiceIds:\s*\[\],\s*selectedVehicleVin:\s*null,\s*selectedServiceOptions:\s*\{\},\s*selectedDiagnosticSystem:\s*null,\s*customerNotes:\s*""/s);
  });

  test("selectVehicle clears booking services only when the vehicle changes", () => {
    expect(vehicleStore).toMatch(/if\s*\(previousVehicleId !== vehicleId\)\s*\{\s*useBookingStore\.getState\(\)\.clearSelectedServices\(\);\s*\}/s);
  });

  test("clearSelectedServices also clears quoteAcceptContext", () => {
    expect(bookingStore).toMatch(/clearSelectedServices:\s*\(\)\s*=>\s*\n\s*set\(\{[\s\S]*?quoteAcceptContext:\s*null,?\s*\n\s*\}\)/);
  });

  test("resetBookingFlow also clears quoteAcceptContext", () => {
    expect(bookingStore).toMatch(/resetBookingFlow:\s*\(\)\s*=>\s*\n\s*set\(\{[\s\S]*?quoteAcceptContext:\s*null,?\s*\n[\s\S]*?\}\)/);
  });
});
