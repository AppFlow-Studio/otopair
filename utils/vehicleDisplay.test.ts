import { describe, expect, it } from "vitest";

import { formatEngineLiters } from "./vehicleDisplay";

describe("formatEngineLiters", () => {
  it("rounds engine displacement to one decimal place", () => {
    expect(formatEngineLiters("1.802577040")).toBe("1.8");
    expect(formatEngineLiters("3.649")).toBe("3.6");
    expect(formatEngineLiters("3.65")).toBe("3.7");
  });

  it("returns null for blank or invalid displacement values", () => {
    expect(formatEngineLiters("")).toBeNull();
    expect(formatEngineLiters(undefined)).toBeNull();
    expect(formatEngineLiters("unknown")).toBeNull();
  });
});
