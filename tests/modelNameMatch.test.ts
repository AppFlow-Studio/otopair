/**
 * Catalog model-name matching — the Mercedes GL bug.
 *
 * Yassin, 2026-09-03: a GLE VIN decoded correctly as "Mercedes-Benz
 * GLE-Class", then offered "Base E 450 2dr Rear-Wheel Drive" in the trim
 * picker, and the saved car came back an E-Class.
 *
 * Cause: both `carApiResolveModel` and `fetchYmmTrimsFromProviders` matched
 * model names by stripping every separator and testing raw substring
 * containment in BOTH directions. "GLE-Class" and "E-Class" flatten to
 * `gleclass` and `eclass`, and `"gleclass".includes("eclass")` is true. The
 * same collapse hit GLC→C, GLS→S, GLA→A and GLB→B. Only G-Class escaped,
 * because it matched exactly — which is why the G-wagon screenshots looked
 * fine and made this read as "does VDB not have G wagons?".
 */
import { describe, expect, it } from "vitest";
import { modelNamesMatch } from "@/convex/lib/carApi";

/** Mercedes sedans, i.e. a catalog that does NOT carry the GL family names. */
const SEDANS = ["A-Class", "B-Class", "C-Class", "E-Class", "S-Class", "G-Class"];

describe("no SUV resolves to a sedan", () => {
  it.each([
    ["GLE-Class", "E-Class"],
    ["GLC-Class", "C-Class"],
    ["GLS-Class", "S-Class"],
    ["GLA-Class", "A-Class"],
    ["GLB-Class", "B-Class"],
  ])("%s does not match %s", (suv, sedan) => {
    expect(modelNamesMatch(sedan, suv)).toBe(false);
  });

  it("finds nothing at all in a sedan-only catalog", () => {
    // Falling through to null is correct: the caller then expands the family
    // token into the real GLE variants. Matching the wrong model is the only
    // outcome that produces a wrong car.
    for (const suv of ["GLE-Class", "GLC-Class", "GLS-Class"]) {
      expect(SEDANS.find((m) => modelNamesMatch(m, suv))).toBeUndefined();
    }
  });

  it("still matches G-Class, which was never broken", () => {
    expect(SEDANS.find((m) => modelNamesMatch(m, "G-Class"))).toBe("G-Class");
  });
});

describe("what the loose match exists for still works", () => {
  it("ignores a trailing body-style word", () => {
    expect(modelNamesMatch("3 Series", "3 Series Sedan")).toBe(true);
    expect(modelNamesMatch("4 Series", "4 Series Gran Coupe")).toBe(true);
  });

  it("matches a family name against its bare token", () => {
    expect(modelNamesMatch("GLE-Class", "GLE")).toBe(true);
  });

  it("is separator- and case-insensitive", () => {
    expect(modelNamesMatch("e class", "E-Class")).toBe(true);
    expect(modelNamesMatch("MODEL 3", "Model 3")).toBe(true);
  });

  it("does not match across a word boundary", () => {
    // The whole point: containment has to land on token edges.
    expect(modelNamesMatch("Series", "3 Series")).toBe(true);   // real run
    expect(modelNamesMatch("S-Class", "GLS-Class")).toBe(false); // mid-token
  });

  it("rejects empty input rather than matching everything", () => {
    expect(modelNamesMatch("", "E-Class")).toBe(false);
    expect(modelNamesMatch("E-Class", "")).toBe(false);
  });
});
