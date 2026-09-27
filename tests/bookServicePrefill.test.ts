import { describe, expect, it } from "vitest";

import { matchCatalogService, resolvePrefill } from "@/lib/bookServicePrefill";

const CATALOG = [
  { id: "k1", slug: "filter_replacement", name: "Filter Replacement", description: "Engine + cabin air filters" },
  { id: "k2", slug: "oil_change", name: "Oil Change" },
  { id: "k3", slug: "wheel_alignment", name: "Wheel Alignment" },
  { id: "k4", slug: "brake_pad_replacement", name: "Brake Pad Replacement" },
];

describe("resolvePrefill", () => {
  it("THE BUG: Oto's \"filter_replacement\" pre-checks the filter row", () => {
    expect(resolvePrefill(["filter_replacement"], CATALOG).selectedIds).toEqual(["svc_air_filter"]);
  });

  it("maps the other renamed slugs onto their curated rows", () => {
    expect(
      resolvePrefill(["brake_pad_replacement", "brake_fluid_flush", "tire_balance"], CATALOG).selectedIds,
    ).toEqual(["svc_brake_pads", "svc_brake_fluid", "svc_tire_balance"]);
  });

  it("still understands the older ids saved conversations carry", () => {
    expect(resolvePrefill(["air_filter", "brake_pads"], CATALOG).selectedIds).toEqual([
      "svc_air_filter",
      "svc_brake_pads",
    ]);
  });

  it("adds a pre-picked service the curated list lacks, from the catalog", () => {
    const { selectedIds, catalogOnly } = resolvePrefill(["wheel_alignment"], CATALOG);
    expect(selectedIds).toEqual(["catalog:wheel_alignment"]);
    expect(catalogOnly).toEqual([{ ...CATALOG[2], cardId: "catalog:wheel_alignment" }]);
  });

  it("drops a slug that is in neither list instead of inventing a row", () => {
    expect(resolvePrefill(["not_a_service"], CATALOG)).toEqual({ selectedIds: [], catalogOnly: [] });
  });

  it("dedupes and tolerates a missing slug list", () => {
    expect(resolvePrefill(["oil_change", "oil_change"], CATALOG).selectedIds).toEqual(["svc_oil_change"]);
    expect(resolvePrefill(undefined, CATALOG)).toEqual({ selectedIds: [], catalogOnly: [] });
  });
});

describe("matchCatalogService", () => {
  it("THE BUG: \"Air Filter\" books as Filter Replacement via its slug", () => {
    expect(matchCatalogService({ slug: "filter_replacement", name: "Air Filter" }, CATALOG)?.id).toBe("k1");
  });

  it("falls back to the name for rows with no canonical slug", () => {
    expect(matchCatalogService({ name: " oil change " }, CATALOG)?.id).toBe("k2");
  });

  it("finds nothing for a row the catalog does not sell", () => {
    expect(matchCatalogService({ name: "TPMS Check" }, CATALOG)).toBeUndefined();
  });
});
