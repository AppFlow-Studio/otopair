import { describe, expect, it } from "vitest";

import { isVinInGarage } from "@/lib/garageDuplicate";

const GARAGE = [
  { vin: "WBS1J3C05L7H33327" },
  { vin: "MANUAL-1726000000000-abc12345" },
];

describe("isVinInGarage", () => {
  it("THE BUG: a VIN already in the garage is caught before it is re-added", () => {
    expect(isVinInGarage("WBS1J3C05L7H33327", GARAGE)).toBe(true);
  });

  it("matches regardless of case and stray whitespace", () => {
    expect(isVinInGarage("  wbs1j3c05l7h33327 ", GARAGE)).toBe(true);
  });

  it("lets a new VIN through", () => {
    expect(isVinInGarage("5YJSA1E26HF000316", GARAGE)).toBe(false);
  });

  it("lets everything through while the garage has not loaded", () => {
    expect(isVinInGarage("WBS1J3C05L7H33327", undefined)).toBe(false);
    expect(isVinInGarage("WBS1J3C05L7H33327", null)).toBe(false);
    expect(isVinInGarage("WBS1J3C05L7H33327", [])).toBe(false);
  });

  it("never matches an empty VIN", () => {
    expect(isVinInGarage("   ", GARAGE)).toBe(false);
  });
});
