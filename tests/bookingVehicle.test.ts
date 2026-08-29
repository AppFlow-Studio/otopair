import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { resolveBasketVehicleVin, resolveBookingVehicleVin } from "../utils/bookingVehicle";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), "utf8");

describe("resolveBookingVehicleVin", () => {
  test("uses the original quote vehicle while accepting a quote", () => {
    expect(resolveBookingVehicleVin("HONDA-VIN", "MERCEDES-VIN")).toBe("HONDA-VIN");
  });

  test("uses the vehicle captured with a normal service basket", () => {
    expect(resolveBookingVehicleVin(null, "HONDA-VIN")).toBe("HONDA-VIN");
  });

  test("does not fall back to an unrelated live vehicle", () => {
    expect(resolveBookingVehicleVin(null, null)).toBeNull();
  });
});

describe("resolveBasketVehicleVin", () => {
  test("captures the active vehicle only when the first service is added", () => {
    expect(
      resolveBasketVehicleVin({
        previousServiceCount: 0,
        nextServiceCount: 1,
        basketVehicleVin: null,
        activeVehicleVin: "HONDA-VIN",
      }),
    ).toBe("HONDA-VIN");
  });

  test("does not attach a corrupted non-empty basket to the live vehicle", () => {
    expect(
      resolveBasketVehicleVin({
        previousServiceCount: 1,
        nextServiceCount: 2,
        basketVehicleVin: null,
        activeVehicleVin: "MERCEDES-VIN",
      }),
    ).toBeNull();
  });

  test("clears the attached vehicle when the basket empties", () => {
    expect(
      resolveBasketVehicleVin({
        previousServiceCount: 1,
        nextServiceCount: 0,
        basketVehicleVin: "HONDA-VIN",
        activeVehicleVin: "MERCEDES-VIN",
      }),
    ).toBeNull();
  });
});

describe("checkout vehicle enforcement", () => {
  test("checks the attached vehicle before either card or wallet authorization", () => {
    const payment = readFileSync(
      resolve(process.cwd(), "app/booking/mechanic/[id]/payment.tsx"),
      "utf8",
    );

    expect(payment).toMatch(
      /const handleAuthorize[\s\S]*?if \(!bookingVehicleVin \|\| !selectedVehicle\)[\s\S]*?handleApplePay\(\)/,
    );
  });

  test("normal booking creation rejects an unresolved attached vehicle", () => {
    const hook = readFileSync(
      resolve(process.cwd(), "hooks/useCreateBookingConvex.ts"),
      "utf8",
    );

    expect(hook).toContain("if (!vin || !bookingVehicle)");
  });

  test("appointment confirmation screens use the booking VIN instead of the live vehicle", () => {
    const confirmingStatus = read("components/booking/BookingConfirmStatus.tsx");
    const confirmation = read("app/booking/mechanic/[id]/confirmation.tsx");

    expect(confirmingStatus).toContain('import { resolveBookingVehicleVin } from "@/utils/bookingVehicle"');
    expect(confirmingStatus).toContain("selectedVehicleVin");
    expect(confirmation).toContain("bookingVehicleVin");
  });

  test("quote-request status and success screens receive a request VIN snapshot", () => {
    const tireRequesting = read("app/(tire-booking)/requesting.tsx");
    const rotorRequesting = read("app/(rotor-booking)/requesting.tsx");
    const requestConfirmation = read("components/bookings/QuoteRequestConfirmationSheet.tsx");

    expect(tireRequesting).toContain("requestVehicleVin");
    expect(rotorRequesting).toContain("requestVehicleVin");
    expect(requestConfirmation).toContain("vehicleVin: string | null");
  });
});
