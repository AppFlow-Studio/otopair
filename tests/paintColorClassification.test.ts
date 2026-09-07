/**
 * Background tint must match the car.
 *
 * Ahmad, 2026-09-07: a white Silverado and a dark grey Audi A6 both rendered
 * on a pink background. Neither is anywhere near pink.
 *
 * Cause: `pickPaintFamilyFromSwatches` took the most saturated swatch ANYWHERE
 * in the candidate list, on the reasoning that a vivid body should beat neutral
 * wheels and glass. That holds for a red car and inverts for a neutral one — a
 * white, silver, grey or black body has almost no saturation, so any coloured
 * accent outranks it. The warmest pixel on both cars was an indicator or
 * reflector lens, which `classifyColorFamily` buckets as `red` (h <= 18), and
 * COLOR_GRADIENTS.red is that pink.
 *
 * Prominence is what separates a body from an accent, and the old rule threw
 * the ordering away. These tests pin both halves: accents can no longer win,
 * and genuinely coloured cars still classify correctly.
 */
import { describe, expect, it } from "vitest";
import {
  classifyColorFamily,
  colorFamilyFromImageUrl,
  pickPaintFamilyFromSwatches,
} from "@/utils/vehicleImage";

// Prominence-ordered, as the sampler returns them: body first, trim last.
const WHITE_TRUCK_WITH_AMBER_LIGHTS = ["#E8E9EB", "#3A3D42", "#C8761E", "#B3271E"];
const DARK_GREY_SEDAN_WITH_TAILLIGHT = ["#3C4448", "#8C9296", "#C0342B"];
const GENUINELY_RED_CAR = ["#B3271E", "#2B2B2B", "#D8D8D8"];
const BLACK_CAR_ON_WHITE_BACKDROP = ["#141414", "#2A2A2A", "#F4F4F4"];

describe("the two cars that were wrong", () => {
  it("calls a white truck white, not red", () => {
    expect(pickPaintFamilyFromSwatches(WHITE_TRUCK_WITH_AMBER_LIGHTS)).toBe("white");
  });

  it("calls a dark grey sedan grey, not red", () => {
    const family = pickPaintFamilyFromSwatches(DARK_GREY_SEDAN_WITH_TAILLIGHT);
    expect(["gray", "black", "silver"]).toContain(family);
  });

  it("ignores an accent however saturated it is", () => {
    // The accent here is fully saturated and the body is pure neutral — the
    // worst case for the old rule, and the one that produced the screenshots.
    expect(pickPaintFamilyFromSwatches(["#EDEDED", "#333333", "#FF0000"])).toBe("white");
  });
});

describe("coloured cars still work", () => {
  it("keeps a red car red", () => {
    expect(pickPaintFamilyFromSwatches(GENUINELY_RED_CAR)).toBe("red");
  });

  it("takes the most prominent swatch, not the most colourful one", () => {
    // A grey body with a blue accent is a GREY car. The old rule called this
    // blue, which is the same mistake that made the Silverado pink.
    expect(pickPaintFamilyFromSwatches(["#6B7075", "#1D4ED8", "#C0342B"])).toBe("silver");
  });

  it("keeps a black car black on a white backdrop", () => {
    expect(pickPaintFamilyFromSwatches(BLACK_CAR_ON_WHITE_BACKDROP)).toBe("black");
  });
});

describe("the colour named by the image URL", () => {
  it("reads a VDB per-colour render", () => {
    expect(colorFamilyFromImageUrl(
      "https://vhr.nyc3.cdn.digitaloceanspaces.com/vehiclemedia/transparent/colors/2023/mercedes-benz/amg-gle-63/s-amg-gle-63-coupe/black.jpg",
    )).toBe("black");
  });

  it("reads a multi-word paint name", () => {
    expect(colorFamilyFromImageUrl(".../colors/2024/chevrolet/silverado/summit-white.jpg")).toBe("white");
  });

  it("returns null for a generic gallery shot", () => {
    // The exact URL the Silverado had. No colour in the filename, so the
    // caller has to fall through rather than invent one.
    expect(colorFamilyFromImageUrl(
      "https://vhr.nyc3.cdn.digitaloceanspaces.com/vehiclemedia/transparent/gallery/2024/chevrolet/silverado-3500hd/work-truck-4x4-regular-cab-8-ft.-box-142-in.-wb-drw-automatic/ext-3231303031.jpg",
    )).toBeNull();
  });

  it("never reads a colour out of the path", () => {
    // Model and trim wording lives in the path. "Redline" or "Sea Green
    // Edition" as a TRIM name must not paint the background.
    expect(colorFamilyFromImageUrl(
      "https://cdn/colors/2024/chevrolet/silverado-redline-edition/ext-99.jpg",
    )).toBeNull();
  });

  it("survives a query string and a missing url", () => {
    expect(colorFamilyFromImageUrl(".../colors/black.jpg?w=800")).toBe("black");
    expect(colorFamilyFromImageUrl(null)).toBeNull();
    expect(colorFamilyFromImageUrl("")).toBeNull();
  });
});

describe("classifyColorFamily itself is unchanged", () => {
  it("still buckets neutrals by lightness", () => {
    expect(classifyColorFamily("#0A0A0A")).toBe("black");
    expect(classifyColorFamily("#FFFFFF")).toBe("white");
  });

  it("still buckets a warm accent as red — which is why prominence matters", () => {
    // Not a bug in the classifier: a red lens IS red. The fix is upstream, in
    // never letting that lens stand for the car.
    expect(classifyColorFamily("#B3271E")).toBe("red");
  });
});

/**
 * The exact swatches the Silverado produces.
 *
 * Measured from the render VDB serves for that VIN
 * (`.../silverado-3500hd/.../ext-3231303031.jpg`), which is 43.7% black
 * backdrop, a cool grey-white body, and 173 saturated pixels out of 90,000 —
 * the amber marker lights, the gold bowtie, and a five-pixel dark red cluster
 * at hue 13 that the old rule elected as the car's colour.
 */
describe("the Silverado, from its real pixels", () => {
  const BACKDROP = "#000000";      // 43.7% of the image
  const BODY = "#C8CCCF";          // the truck
  const AMBER_LIGHTS = "#BB6E34";  // 0.10% — hue 27
  const RED_SPECK = "#733F31";     // 0.006% — hue 13, and what turned the page pink

  it("is not red", () => {
    // iOS candidate order after the fix: primary, secondary, detail. The speck
    // can only ever reach `detail`, which is outside the body window.
    expect(pickPaintFamilyFromSwatches([BODY, "#3A3D42", RED_SPECK])).not.toBe("red");
  });

  it("reads as a light neutral", () => {
    expect(pickPaintFamilyFromSwatches([BODY, "#3A3D42", RED_SPECK])).toBe("white");
  });

  it("would still have been red under the old rule", () => {
    // Documents the regression rather than trusting memory: the speck is the
    // most saturated swatch present, which is exactly what the old code chose.
    const mostSaturatedWins = [BODY, "#3A3D42", RED_SPECK]
      .map((h) => ({ h, fam: classifyColorFamily(h) }))
      .find((x) => x.fam === "red");
    expect(mostSaturatedWins?.h).toBe(RED_SPECK);
  });

  it("skips the flat black backdrop and finds the truck behind it", () => {
    // 43.7% of the image is the JPEG's black background, and on some platforms
    // that is the most prominent swatch returned. Skipping only near-absolute
    // flats means the truck is found without misreading a real black car.
    expect(pickPaintFamilyFromSwatches([BACKDROP, BODY])).toBe("white");
    expect(pickPaintFamilyFromSwatches([BODY, AMBER_LIGHTS])).toBe("white");
  });

  it("still calls a genuinely black car black", () => {
    // The guard is deliberately narrow: #141414 is paint, #000000 is a
    // backdrop. Widening it would turn every black car silver.
    expect(pickPaintFamilyFromSwatches(["#141414", "#2A2A2A"])).toBe("black");
  });
});
