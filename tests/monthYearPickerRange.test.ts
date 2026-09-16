/**
 * Year range for "when was this last serviced?".
 *
 * Ahmad, 2026-09-14: a 2025 G-Class offered service years back to 2022 (and
 * would have gone to 2011 if the row scrolled). A car cannot have been
 * serviced before it was built, and offering a decade of impossible answers
 * invites one.
 *
 * The rule is ONE YEAR BEFORE THE MODEL YEAR, up to today — model years run
 * ahead of the calendar, so a 2025 car is genuinely on the road in 2024 and
 * its first service can legitimately fall there.
 *
 * The logic is inlined rather than imported because it lives inside a `useMemo`
 * in a React component. Kept byte-identical to `MonthYearPicker.tsx`; if that
 * changes and this does not, these tests stop meaning anything — which is why
 * the boundary cases below are spelled out rather than generated.
 */
import { describe, expect, it } from "vitest";

const YEARS_BACK = 15;

/** Mirror of the `years` memo in components/cars/quickcheck/MonthYearPicker.tsx */
function yearsFor(minYear: number | null | undefined, thisYear: number): number[] {
  const floor =
    minYear != null && Number.isFinite(minYear)
      ? Math.min(minYear - 1, thisYear)
      : thisYear - YEARS_BACK;
  const out: number[] = [];
  for (let y = thisYear; y >= floor; y--) out.push(y);
  return out;
}

const NOW = 2026;

describe("the reported case", () => {
  it("offers a 2025 car only 2026, 2025 and 2024", () => {
    expect(yearsFor(2025, NOW)).toEqual([2026, 2025, 2024]);
  });

  it("no longer reaches 2022", () => {
    expect(yearsFor(2025, NOW)).not.toContain(2022);
  });
});

describe("the model year is not the floor", () => {
  it("includes the year before it, because that is when the car went on sale", () => {
    // A 2025 model is on forecourts in 2024. Its first oil change can honestly
    // be a 2024 date, and excluding it would make a true answer unselectable.
    expect(yearsFor(2025, NOW)).toContain(2024);
  });

  it("excludes two years before, which it cannot be", () => {
    expect(yearsFor(2025, NOW)).not.toContain(2023);
  });
});

describe("older cars are not clipped", () => {
  it("lets a 2010 car say it was serviced in 2010", () => {
    // The old floor was `Math.max(minYear, thisYear - 15)`, which held at 2011
    // here and made the car's OWN year unselectable — wrong in the opposite
    // direction from the reported bug.
    const ys = yearsFor(2010, NOW);
    expect(ys).toContain(2010);
    expect(ys).toContain(2009);
    expect(ys[ys.length - 1]).toBe(2009);
  });

  it("still runs newest-first", () => {
    const ys = yearsFor(2010, NOW);
    expect(ys[0]).toBe(NOW);
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThan(ys[i - 1]);
  });
});

describe("edges", () => {
  it("never offers a future year", () => {
    // Model years run ahead: a 2027 car can exist in 2026. A service still
    // cannot have happened yet, so the row collapses to today.
    expect(yearsFor(2027, NOW)).toEqual([2026]);
    expect(yearsFor(2030, NOW)).toEqual([2026]);
  });

  it("falls back to a flat window when the model year is unknown", () => {
    // Manual-entry cars and anything the decode could not date.
    const ys = yearsFor(null, NOW);
    expect(ys[0]).toBe(2026);
    expect(ys[ys.length - 1]).toBe(2026 - YEARS_BACK);
  });

  it("treats undefined and a non-finite year as unknown rather than crashing", () => {
    expect(yearsFor(undefined, NOW)).toEqual(yearsFor(null, NOW));
    expect(yearsFor(Number.NaN, NOW)).toEqual(yearsFor(null, NOW));
  });

  it("always offers at least the current year", () => {
    for (const y of [null, 1990, 2020, 2026, 2027]) {
      expect(yearsFor(y as number | null, NOW).length).toBeGreaterThan(0);
      expect(yearsFor(y as number | null, NOW)[0]).toBe(NOW);
    }
  });
});
