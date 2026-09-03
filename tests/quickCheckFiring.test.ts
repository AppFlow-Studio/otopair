/**
 * Quick Check firing rules — Spec v2 §4.
 *
 * The rules exist to stop the app asking questions that cannot have a useful
 * answer yet. Every one is miles OR months, whichever comes first: a
 * 2,000-mile-a-year car would otherwise never reach an oil interval by
 * distance while being years past it by time.
 */
import { describe, expect, it } from "vitest";
import {
  ageMonths,
  firedTiles,
  tileFires,
  QUICK_CHECK_THRESHOLDS,
  type FiringInput,
} from "@/utils/quickCheckFiring";

// Aug 30 2026, the date on the spec's worked example.
const NOW = new Date("2026-08-30T00:00:00Z").getTime();

const car = (over: Partial<FiringInput> = {}): FiringInput => ({
  currentMiles: 0,
  modelYear: 2026,
  now: NOW,
  ...over,
});

describe("age", () => {
  it("counts from Jan 1 of the model year", () => {
    // The spec's own example: a 2023 model in Aug 2026 is 44 months.
    expect(Math.round(ageMonths(2023, NOW)!)).toBe(44);
  });

  it("is null when the model year is unknown, rather than zero", () => {
    // Zero would silently mean "brand new" and suppress every age-based tile.
    expect(ageMonths(null, NOW)).toBeNull();
  });

  it("never goes negative for a next-model-year car", () => {
    expect(ageMonths(2027, NOW)).toBe(0);
  });
});

describe("warning lights", () => {
  it("always fires — it is the only live-malfunction signal we have", () => {
    expect(tileFires("warningLights", car())).toBe(true);
    expect(tileFires("warningLights", car({ currentMiles: null, modelYear: null }))).toBe(true);
  });
});

describe("miles OR months, whichever first", () => {
  it("fires oil on miles alone, before 12 months have passed", () => {
    expect(tileFires("oil", car({ currentMiles: 7_500, modelYear: 2026 }))).toBe(true);
  });

  it("fires oil on age alone, on a car that will never reach 7,500 miles", () => {
    // The spec's exotic: 2,000 mi/yr, so distance never triggers it.
    expect(tileFires("oil", car({ currentMiles: 2_300, modelYear: 2024 }))).toBe(true);
  });

  it("holds every service tile on a genuinely new car", () => {
    const brandNew = car({ currentMiles: 400, modelYear: 2026 });
    expect(tileFires("oil", brandNew)).toBe(false);
    expect(tileFires("tires", brandNew)).toBe(false);
    expect(tileFires("brakes", brandNew)).toBe(false);
    expect(tileFires("battery", brandNew)).toBe(false);
  });
});

describe("thresholds fire at the boundary, not past it", () => {
  const cases: [Exclude<keyof typeof QUICK_CHECK_THRESHOLDS, never>, number][] = [
    ["oil", 7_500],
    ["tires", 20_000],
    ["brakes", 25_000],
  ];

  for (const [tile, miles] of cases) {
    it(`${tile} fires exactly at ${miles.toLocaleString()} mi`, () => {
      const young = { modelYear: 2026 }; // age arm cannot fire
      expect(tileFires(tile, car({ ...young, currentMiles: miles - 1 }))).toBe(false);
      expect(tileFires(tile, car({ ...young, currentMiles: miles }))).toBe(true);
    });
  }

  it("tires and brakes both fire at exactly 36 months", () => {
    // 2023 → 44 months at NOW, which is past. 2024 → 32, which is not.
    for (const tile of ["tires", "brakes"] as const) {
      expect(tileFires(tile, car({ currentMiles: 0, modelYear: 2024 }))).toBe(false);
      expect(tileFires(tile, car({ currentMiles: 0, modelYear: 2023 }))).toBe(true);
    }
  });
});

describe("battery ignores mileage entirely", () => {
  it("does not fire on a high-mileage young car", () => {
    // Batteries age by years. 150k miles on a one-year-old car says nothing.
    expect(tileFires("battery", car({ currentMiles: 150_000, modelYear: 2026 }))).toBe(false);
  });

  it("fires on an old car with almost no miles", () => {
    expect(tileFires("battery", car({ currentMiles: 500, modelYear: 2022 }))).toBe(true);
  });

  it("has no miles axis at all", () => {
    expect(QUICK_CHECK_THRESHOLDS.battery.miles).toBeNull();
  });
});

describe("missing data degrades one axis, never both", () => {
  it("unknown mileage still lets the age arm fire", () => {
    expect(tileFires("oil", car({ currentMiles: null, modelYear: 2020 }))).toBe(true);
  });

  it("unknown model year still lets the miles arm fire", () => {
    expect(tileFires("oil", car({ currentMiles: 50_000, modelYear: null }))).toBe(true);
  });

  it("knowing nothing fires nothing but warning lights", () => {
    // Degrade to the honest minimum rather than asking everything.
    expect(firedTiles(car({ currentMiles: null, modelYear: null }))).toEqual(["warningLights"]);
  });
});

describe("bigger services", () => {
  it("is hidden when no item qualifies", () => {
    expect(firedTiles(car({ currentMiles: 150_000, modelYear: 2023 }))).not.toContain(
      "biggerServices",
    );
  });

  it("appears once at least one item does", () => {
    const tiles = firedTiles(
      car({ currentMiles: 150_000, modelYear: 2023, biggerServiceCandidates: 4 }),
    );
    expect(tiles).toContain("biggerServices");
  });
});

describe("the set as a whole", () => {
  it("a brand-new car asks exactly one question", () => {
    expect(firedTiles(car({ currentMiles: 400, modelYear: 2026 }))).toEqual(["warningLights"]);
  });

  it("the spec's 150,000-mile 2023 Camry fires everything", () => {
    expect(
      firedTiles(car({ currentMiles: 150_000, modelYear: 2023, biggerServiceCandidates: 4 })),
    ).toEqual(["warningLights", "oil", "tires", "brakes", "battery", "biggerServices"]);
  });

  it("keeps spec render order regardless of which tiles fire", () => {
    // Warning Lights leads, Bigger Services closes — the squares sit between.
    const tiles = firedTiles(
      car({ currentMiles: 30_000, modelYear: 2026, biggerServiceCandidates: 1 }),
    );
    expect(tiles[0]).toBe("warningLights");
    expect(tiles[tiles.length - 1]).toBe("biggerServices");
  });

  it("a 3-year-old low-mileage car is asked about age, not distance", () => {
    // 2023 at 5,000 mi: too few miles for oil/tires/brakes by distance, but
    // 44 months old — so oil, tires and brakes all fire on time, battery too.
    expect(firedTiles(car({ currentMiles: 5_000, modelYear: 2023 }))).toEqual([
      "warningLights",
      "oil",
      "tires",
      "brakes",
      "battery",
    ]);
  });
});
