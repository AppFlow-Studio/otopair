import { describe, expect, test } from "vitest";

import {
  resolveCardHeight,
  resolveVehicleCardImageUri,
  selectHomeVehicleRows,
} from "../lib/homeVehicleCards";

describe("selectHomeVehicleRows", () => {
  test("drops ownership rows whose vehicles doc is missing so they never mint a card or a page dot", () => {
    const rows = [
      { vin: "MANUAL-1789741185214", vehicle: { make: "Chrysler" } },
      { vin: "WP0AB2A96TS220001", vehicle: null },
      { vin: "3VV2B7AX0KM000002", vehicle: { make: "Volkswagen" } },
    ];

    expect(selectHomeVehicleRows(rows).map((r) => r.vin)).toEqual([
      "MANUAL-1789741185214",
      "3VV2B7AX0KM000002",
    ]);
  });

  test("dedupes VINs that differ only by case or surrounding whitespace, keeping the first row untouched", () => {
    const rows = [
      { vin: "WP0AB2A96TS220001", vehicle: {} },
      { vin: " wp0ab2a96ts220001 ", vehicle: {} },
    ];

    const selected = selectHomeVehicleRows(rows);
    expect(selected).toHaveLength(1);
    expect(selected[0].vin).toBe("WP0AB2A96TS220001");
  });

  test("drops rows with no VIN — there is no stable key for height, image or Cars hand-off", () => {
    expect(
      selectHomeVehicleRows([
        { vin: "", vehicle: {} },
        { vin: null, vehicle: {} },
        { vehicle: {} },
        { vin: "3VV2B7AX0KM000002", vehicle: {} },
      ]),
    ).toHaveLength(1);
  });

  test("returns an empty list for empty, null and undefined input", () => {
    expect(selectHomeVehicleRows([])).toEqual([]);
    expect(selectHomeVehicleRows(null)).toEqual([]);
    expect(selectHomeVehicleRows(undefined)).toEqual([]);
  });
});

describe("resolveVehicleCardImageUri", () => {
  test("prefers the freshly fetched URL over the cached one", () => {
    expect(resolveVehicleCardImageUri("https://cdn/fresh.png", "https://cdn/cached.png", {})).toBe(
      "https://cdn/fresh.png",
    );
  });

  test("falls through blank and whitespace-only candidates to the cached URL", () => {
    expect(resolveVehicleCardImageUri("   ", "https://cdn/cached.png", {})).toBe(
      "https://cdn/cached.png",
    );
    expect(resolveVehicleCardImageUri(undefined, "https://cdn/cached.png", {})).toBe(
      "https://cdn/cached.png",
    );
  });

  test("returns null when the vehicle has no usable URL at all, so the card can show the placeholder", () => {
    expect(resolveVehicleCardImageUri("", "", {})).toBeNull();
    expect(resolveVehicleCardImageUri(null, undefined, {})).toBeNull();
  });

  test("skips a URL that already failed to load but still tries the next candidate", () => {
    const failed = { "https://cdn/fresh.png": true } as const;
    expect(resolveVehicleCardImageUri("https://cdn/fresh.png", "https://cdn/cached.png", failed)).toBe(
      "https://cdn/cached.png",
    );
    expect(resolveVehicleCardImageUri("https://cdn/fresh.png", "", failed)).toBeNull();
  });
});

describe("resolveCardHeight", () => {
  const heights = { porsche: 210, pacifica: 320, tiguan: 320 };
  const ids = ["pacifica", "porsche", "tiguan"];

  test("uses the height of the vehicle whose card is on screen", () => {
    expect(resolveCardHeight(heights, "porsche", ids)).toBe(210);
  });

  test("falls back to the tallest CURRENT vehicle while the visible one is unmeasured", () => {
    expect(resolveCardHeight(heights, "newly-added", ids)).toBe(320);
    expect(resolveCardHeight(heights, undefined, ids)).toBe(320);
  });

  test("ignores measurements left behind by vehicles that are no longer in the list", () => {
    expect(resolveCardHeight({ ...heights, removed: 900 }, "newly-added", ids)).toBe(320);
  });

  test("returns undefined rather than collapsing the slot when nothing is measured yet", () => {
    expect(resolveCardHeight({}, "porsche", ids)).toBeUndefined();
    expect(resolveCardHeight({ porsche: 0 }, "porsche", ids)).toBeUndefined();
  });
});
