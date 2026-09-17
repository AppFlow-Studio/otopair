/**
 * Make + model, trim dropped.
 *
 * Ahmad, 2026-09-17: the redesigned booking card shows the vehicle as its
 * headline, and "Mercedes-Benz G-Class Amg G63" wrapped to two lines and
 * pushed the card ~26pt taller than the design. The trim is not what
 * identifies the car to its owner, so it comes off — matching the Cars tab.
 *
 * The cases below are the ones a naive "first two words" would get wrong.
 */
import { describe, expect, it } from "vitest";
import { vehicleMakeModel, vehicleYearMakeModel } from "../lib/vehicleName";

describe("the reported cases", () => {
  it("drops AMG G63", () => {
    expect(vehicleMakeModel("Mercedes-Benz G-Class Amg G63")).toBe(
      "Mercedes-Benz G-Class",
    );
  });

  it("drops Grand Touring", () => {
    expect(vehicleMakeModel("Mazda Cx-3 Grand Touring")).toBe("Mazda Cx-3");
  });
});

describe("models a naive slice would truncate", () => {
  it("keeps the number in Model 3", () => {
    // "Tesla Model" is not a car.
    expect(vehicleMakeModel("Tesla Model 3 Long Range")).toBe("Tesla Model 3");
    expect(vehicleMakeModel("Tesla Model Y Performance")).toBe("Tesla Model Y");
  });

  it("keeps Series on a numeric BMW line", () => {
    expect(vehicleMakeModel("BMW 7 Series 750i xDrive")).toBe("BMW 7 Series");
    expect(vehicleMakeModel("BMW 3 Series 330i")).toBe("BMW 3 Series");
  });

  it("does not invent Series for a numeric model that has none", () => {
    expect(vehicleMakeModel("Mazda 3 Select")).toBe("Mazda 3");
  });
});

describe("two-word makes", () => {
  it.each([
    ["Land Rover Range Rover Sport", "Land Rover Range Rover"],
    ["Alfa Romeo Giulia Quadrifoglio", "Alfa Romeo Giulia"],
    ["Aston Martin Vantage V8", "Aston Martin Vantage"],
  ])("splits %s after the make", (input, expected) => {
    expect(vehicleMakeModel(input)).toBe(expected);
  });

  it("is case-insensitive about recognising them", () => {
    expect(vehicleMakeModel("land rover defender 110")).toBe(
      "land rover defender",
    );
  });
});

describe("degenerate input", () => {
  it("returns a single token unchanged", () => {
    expect(vehicleMakeModel("Vehicle")).toBe("Vehicle");
  });

  it("survives empty and whitespace-only strings", () => {
    expect(vehicleMakeModel("")).toBe("");
    expect(vehicleMakeModel("   ")).toBe("");
  });

  it("collapses runs of whitespace", () => {
    expect(vehicleMakeModel("Honda   CR-V    SE")).toBe("Honda CR-V");
  });

  it("leaves an already-short name alone", () => {
    expect(vehicleMakeModel("Honda CR-V")).toBe("Honda CR-V");
  });
});

describe("with the year", () => {
  it("puts it in front", () => {
    expect(vehicleYearMakeModel("2025", "Mercedes-Benz G-Class Amg G63")).toBe(
      "2025 Mercedes-Benz G-Class",
    );
  });

  it("omits it cleanly when absent, rather than leaving a leading space", () => {
    expect(vehicleYearMakeModel(undefined, "Mazda Cx-3 Grand Touring")).toBe(
      "Mazda Cx-3",
    );
    expect(vehicleYearMakeModel("", "Mazda Cx-3 Grand Touring")).toBe("Mazda Cx-3");
  });
});
