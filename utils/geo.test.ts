import { describe, expect, it } from "vitest";

import {
  formatProximityDistanceFromKm,
  formatProximityDistanceFromMiles,
  kmToMiles,
  milesToKm,
  normalizeDistanceUnit,
} from "./geo";

describe("proximity distance formatting", () => {
  it("formats miles in miles by default", () => {
    expect(formatProximityDistanceFromMiles(2.14)).toBe("2.1 mi");
  });

  it("formats miles as kilometers when requested", () => {
    expect(formatProximityDistanceFromMiles(2, "km")).toBe("3.2 km");
  });

  it("formats kilometers as miles when requested", () => {
    expect(formatProximityDistanceFromKm(5, "mi")).toBe("3.1 mi");
  });

  it("uses compact labels for very short proximity distances", () => {
    expect(formatProximityDistanceFromMiles(0.04, "mi")).toBe("< 0.1 mi");
    expect(formatProximityDistanceFromKm(0.04, "km")).toBe("< 0.1 km");
  });

  it("normalizes unsupported unit values to miles", () => {
    expect(normalizeDistanceUnit("km")).toBe("km");
    expect(normalizeDistanceUnit("meters")).toBe("mi");
    expect(normalizeDistanceUnit(null)).toBe("mi");
  });

  it("converts miles and kilometers with stable constants", () => {
    expect(milesToKm(1)).toBeCloseTo(1.609344);
    expect(kmToMiles(1)).toBeCloseTo(0.621371);
  });
});
