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
import {
  titleCaseVehicleName,
  vehicleMakeModel,
  vehicleYearMakeModel,
} from "../lib/vehicleName";

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

/**
 * Casing, per #259.
 *
 * Two implementations existed and disagreed: setup showed the raw
 * "MERCEDES-BENZ SL-Class", while Cars and Oto showed "Mercedes-benz
 * Sl-class". One split on spaces only (hyphen never started a word); the
 * other lowercased first (designators destroyed).
 */
describe("vehicle name casing", () => {
  it("fixes the reported string", () => {
    expect(titleCaseVehicleName("MERCEDES-BENZ SL-Class")).toBe("Mercedes-Benz SL-Class");
  });

  it("agrees whatever casing the source arrives in", () => {
    // The point of the ticket: every screen lands on the same string.
    const variants = [
      "MERCEDES-BENZ SL-CLASS",
      "mercedes-benz sl-class",
      "Mercedes-Benz SL-Class",
      "MERCEDES-BENZ SL-Class",
    ];
    for (const v of variants) {
      expect(titleCaseVehicleName(v)).toBe("Mercedes-Benz SL-Class");
    }
  });

  it("capitalises after a hyphen, which the Cars copy never did", () => {
    expect(titleCaseVehicleName("MERCEDES-BENZ")).toBe("Mercedes-Benz");
    expect(titleCaseVehicleName("mercedes-benz g-class")).toBe("Mercedes-Benz G-Class");
  });

  it("keeps designators the bookings copy flattened", () => {
    expect(titleCaseVehicleName("SL-Class")).toBe("SL-Class");
    expect(titleCaseVehicleName("Mazda CX-3")).toBe("Mazda CX-3");
    expect(titleCaseVehicleName("Toyota Camry XSE")).toBe("Toyota Camry XSE");
    expect(titleCaseVehicleName("Audi A6")).toBe("Audi A6");
    expect(titleCaseVehicleName("Ford F-150")).toBe("Ford F-150");
  });

  it("keeps brand acronyms whole", () => {
    expect(titleCaseVehicleName("BMW 7 Series")).toBe("BMW 7 Series");
    expect(titleCaseVehicleName("bmw x5")).toBe("BMW X5");
    expect(titleCaseVehicleName("GMC SIERRA")).toBe("GMC Sierra");
    expect(titleCaseVehicleName("ram 1500")).toBe("RAM 1500");
  });

  it("title-cases ordinary words", () => {
    expect(titleCaseVehicleName("TOYOTA CAMRY")).toBe("Toyota Camry");
    expect(titleCaseVehicleName("honda civic")).toBe("Honda Civic");
    expect(titleCaseVehicleName("VOLKSWAGEN TIGUAN")).toBe("Volkswagen Tiguan");
  });

  it("does not overrule a source that already mixed case", () => {
    // "Class" and "iM" are deliberate; flattening them was the old bug.
    expect(titleCaseVehicleName("Scion iM")).toBe("Scion iM");
    expect(titleCaseVehicleName("Land Rover Range Rover")).toBe("Land Rover Range Rover");
  });

  it("preserves every separator the source had", () => {
    expect(titleCaseVehicleName("MERCEDES-BENZ  SL-CLASS")).toBe("Mercedes-Benz  SL-Class");
    expect(titleCaseVehicleName("")).toBe("");
  });

  it("is idempotent — running it twice changes nothing", () => {
    for (const v of ["MERCEDES-BENZ SL-Class", "bmw x5", "Ford F-150", "TOYOTA CAMRY"]) {
      const once = titleCaseVehicleName(v);
      expect(titleCaseVehicleName(once)).toBe(once);
    }
  });
});
