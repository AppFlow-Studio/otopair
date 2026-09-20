import { describe, expect, it } from "vitest";

import {
  formatServiceDisplayName,
  formatServiceDisplayNames,
} from "../utils/serviceDisplayName";

/**
 * These cases are the strings the deployments actually hold — `services.name`
 * and `services.description` read "Timing Belt" / "Timing belt kit
 * replacement…" on dev, preview and production — plus the casings web's
 * version handles. If mobile and web ever disagree, the same booking reads
 * differently on the dashboard and in the app, so this locks the contract.
 */
describe("formatServiceDisplayName", () => {
  it("renames the catalog name the deployments hold", () => {
    expect(formatServiceDisplayName("Timing Belt")).toBe("Drive Belt");
  });

  it("renames the name inside the catalog description, keeping the sentence", () => {
    expect(
      formatServiceDisplayName(
        "Timing belt kit replacement including tensioner and idler pulleys",
      ),
    ).toBe("Drive belt kit replacement including tensioner and idler pulleys");
  });

  it("preserves casing", () => {
    expect(formatServiceDisplayName("timing belt")).toBe("drive belt");
    expect(formatServiceDisplayName("Timing belt")).toBe("Drive belt");
    expect(formatServiceDisplayName("Timing Belt Replacement")).toBe(
      "Drive Belt Replacement",
    );
  });

  it("handles the slug form and plurals", () => {
    expect(formatServiceDisplayName("timing_belt")).toBe("Drive Belt");
    expect(formatServiceDisplayName("timing belts")).toBe("drive belts");
  });

  it("leaves everything else alone", () => {
    expect(formatServiceDisplayName("Oil Change")).toBe("Oil Change");
    expect(formatServiceDisplayName("Serpentine Belt")).toBe("Serpentine Belt");
    // Not a word boundary match — must not be rewritten.
    expect(formatServiceDisplayName("retiming belt")).toBe("retiming belt");
  });

  it("is safe on empty input", () => {
    expect(formatServiceDisplayName(null)).toBe("");
    expect(formatServiceDisplayName(undefined)).toBe("");
    expect(formatServiceDisplayName("")).toBe("");
  });

  it("maps a list in order", () => {
    expect(
      formatServiceDisplayNames(["Oil Change", "Timing Belt", "Tire Rotation"]),
    ).toEqual(["Oil Change", "Drive Belt", "Tire Rotation"]);
    expect(formatServiceDisplayNames(undefined)).toEqual([]);
  });
});
