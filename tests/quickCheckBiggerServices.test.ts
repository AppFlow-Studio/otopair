/**
 * Bigger Services candidates — Quick Check v2 §4/§6.
 *
 * Two properties carry the tile. It must not ask about a component the car
 * does not have, and it must not ask about a service that is nowhere near due
 * — v1's "why is it asking me this" failure, one level up.
 */
import { describe, expect, it } from "vitest";
import {
  BIGGER_SERVICE_POOL,
  biggerServiceCandidates,
} from "@/utils/quickCheckBiggerServices";
import { BAND_CUTOFFS } from "@/utils/intervalBands";

const A = (over = {}) => ({
  currentOdometer: 100_000,
  vehicleClass: "A" as const,
  ...over,
});

describe("the pool", () => {
  it("never overlaps the four square tiles", () => {
    // Oil (and both filters), tires, brakes and battery each have their own
    // tile. Asking twice is worse than not asking.
    for (const covered of [
      "oil_change", "filter_replacement", "tire_rotation", "tire_replacement",
      "brake_pad_replacement", "battery_replacement",
    ]) {
      expect(BIGGER_SERVICE_POOL).not.toContain(covered);
    }
  });

  it("stays short enough to be a question rather than a form", () => {
    expect(BIGGER_SERVICE_POOL.length).toBeLessThanOrEqual(6);
  });
});

describe("the fire rule", () => {
  it("is the same 0.80 the tracker calls due soon", () => {
    // Not a coincidence: worth mentioning = worth asking about.
    expect(BAND_CUTOFFS.dueSoon).toBe(0.8);
  });

  it("stays quiet on a young car", () => {
    // Class A spark plugs are 90,000 miles; nothing in the pool is close at
    // 8,000. An empty list is what hides the tile entirely.
    expect(biggerServiceCandidates(A({ currentOdometer: 8_000 }))).toEqual([]);
  });

  it("fires each row exactly at 80% of its own interval", () => {
    // Class A brake fluid is 30,000 miles → fires at 24,000, not at 23,999.
    const just_under = biggerServiceCandidates(A({ currentOdometer: 23_999 }))
      .map((c) => c.slug);
    const just_at = biggerServiceCandidates(A({ currentOdometer: 24_000 }))
      .map((c) => c.slug);
    expect(just_under).not.toContain("brake_fluid_flush");
    expect(just_at).toContain("brake_fluid_flush");
  });

  it("needs an odometer, and does not invent one", () => {
    expect(biggerServiceCandidates(A({ currentOdometer: null }))).toEqual([]);
    expect(biggerServiceCandidates(A({ currentOdometer: 0 }))).toEqual([]);
  });
});

describe("fitment", () => {
  it("drops a differential on a front-wheel-drive car", () => {
    // classInterval returns null for the component the car does not have. The
    // row must disappear, not render as on-time.
    const fwd = biggerServiceCandidates(
      A({ classOptions: { drivetrain: "fwd" as const } }),
    ).map((c) => c.slug);
    expect(fwd).not.toContain("differential_service");
  });

  it("keeps one on a rear-wheel-drive car", () => {
    const rwd = biggerServiceCandidates(
      A({ classOptions: { drivetrain: "rwd" as const } }),
    ).map((c) => c.slug);
    expect(rwd).toContain("differential_service");
  });

  it("honours the backend's applicability list over its own reasoning", () => {
    // convex/services.ts already runs lib/serviceApplicability. Re-deriving it
    // here is how the two drift apart.
    const only = biggerServiceCandidates(
      A({ applicableSlugs: new Set(["coolant_flush"]) }),
    );
    expect(only.map((c) => c.slug)).toEqual(["coolant_flush"]);
  });

  it("does not filter at all while the fitment query is still loading", () => {
    // Undefined means "not resolved yet". Treating it as an empty set would
    // flash an empty tile on first render.
    expect(biggerServiceCandidates(A({ applicableSlugs: undefined })).length)
      .toBeGreaterThan(0);
  });
});

describe("interval source", () => {
  it("prefers an OEM interval over the class default", () => {
    // Same precedence as getInterval. A third tier here would let the tile and
    // the tracker disagree about the same service on the same car.
    const withOem = biggerServiceCandidates(A({
      currentOdometer: 100_000,
      oemIntervals: { spark_plugs: { interval_miles: 50_000, confidence: 0.9 } },
    }));
    const plugs = withOem.find((c) => c.slug === "spark_plugs");
    expect(plugs?.intervalMiles).toBe(50_000);
  });

  it("still caps an OEM interval at the guardrail ceiling", () => {
    // The bounds are the backstop against bad enrichment data. 120,000 is
    // beyond the spark-plug ceiling and comes back as 100,000.
    const plugs = biggerServiceCandidates(A({
      currentOdometer: 100_000,
      oemIntervals: { spark_plugs: { interval_miles: 120_000, confidence: 0.9 } },
    })).find((c) => c.slug === "spark_plugs");
    expect(plugs?.intervalMiles).toBe(100_000);
  });

  it("does not put the class default through the trust gate", () => {
    // safeInterval snaps a value with no confidence score to the bounds FLOOR,
    // which would turn Class A spark plugs from 90,000 into 20,000 and ask
    // every driver about their plugs at 16,000 miles. The class table is our
    // own constant, not scraped data.
    const plugs = biggerServiceCandidates(A({ currentOdometer: 100_000 }))
      .find((c) => c.slug === "spark_plugs");
    expect(plugs?.intervalMiles).toBe(90_000);
    expect(plugs?.intervalMiles).not.toBe(20_000);
  });

  it("falls back to the class default with no enrichment at all", () => {
    // The whole point of the class table being the default rather than a
    // fallback: a car gets its bigger services at add-car time.
    const plugs = biggerServiceCandidates(A({ currentOdometer: 100_000 }))
      .find((c) => c.slug === "spark_plugs");
    expect(plugs?.intervalMiles).toBe(90_000);
  });

  it("shortens Class C spark plugs against Class A on the same odometer", () => {
    // 40,000 vs 90,000 — a performance car asks sooner, which is the reason
    // classes exist.
    const a = biggerServiceCandidates(A({ currentOdometer: 45_000 }))
      .find((c) => c.slug === "spark_plugs");
    const c = biggerServiceCandidates(A({ currentOdometer: 45_000, vehicleClass: "C" as const }))
      .find((c) => c.slug === "spark_plugs");
    expect(a).toBeUndefined();
    expect(c?.intervalMiles).toBe(40_000);
  });

  it("skips a service with no interval from either tier", () => {
    const none = biggerServiceCandidates(A({ vehicleClass: null }));
    expect(none).toEqual([]);
  });
});

describe("ordering and answers", () => {
  it("puts the worst-off service first", () => {
    const list = biggerServiceCandidates(A({ currentOdometer: 150_000 }));
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].ratio).toBeGreaterThanOrEqual(list[i].ratio);
    }
  });

  it("is stable when two services tie", () => {
    // Declaration order is not an ordering. Alphabetical is.
    const a = biggerServiceCandidates(A({ currentOdometer: 150_000 })).map((c) => c.slug);
    const b = biggerServiceCandidates(A({ currentOdometer: 150_000 })).map((c) => c.slug);
    expect(a).toEqual(b);
  });

  it("keeps an answered service in the list, marked", () => {
    // The row shows what the driver said rather than vanishing — vanishing
    // reads as "did I imagine answering that?".
    const list = biggerServiceCandidates(A({
      currentOdometer: 150_000,
      answeredSlugs: new Set(["coolant_flush"]),
    }));
    const coolant = list.find((c) => c.slug === "coolant_flush");
    expect(coolant?.answered).toBe(true);
    expect(list.filter((c) => c.answered).length).toBe(1);
  });
});

describe("the months axis", () => {
  const NOW = new Date(2026, 5, 15).getTime();

  it("fires a months-only service that has no mileage interval at all", () => {
    // Class B brake fluid is 24 months and no miles. Ratio on the mileage axis
    // alone is zero, so a mileage-only rule would silently drop the row from
    // a tile whose whole job is to surface it.
    const list = biggerServiceCandidates({
      currentOdometer: 1_000,
      modelYear: 2018,
      vehicleClass: "B",
      now: NOW,
    });
    const fluid = list.find((c) => c.slug === "brake_fluid_flush");
    expect(fluid).toBeDefined();
    expect(fluid?.intervalMiles).toBeNull();
    expect(fluid?.intervalMonths).toBe(24);
  });

  it("takes whichever axis is further along", () => {
    // A barely-driven but old car is due by age; a young but hammered one is
    // due by miles. Same rule as computeHybridStatus.
    const old_slow = biggerServiceCandidates({
      currentOdometer: 500, modelYear: 2010, vehicleClass: "B", now: NOW,
    });
    const young_fast = biggerServiceCandidates({
      currentOdometer: 200_000, modelYear: 2025, vehicleClass: "B", now: NOW,
    });
    expect(old_slow.length).toBeGreaterThan(0);
    expect(young_fast.length).toBeGreaterThan(0);
  });

  it("still needs at least one axis to measure", () => {
    expect(biggerServiceCandidates({
      currentOdometer: null, modelYear: null, vehicleClass: "B", now: NOW,
    })).toEqual([]);
  });

  it("does not fire a months-only service on a car that is still young", () => {
    const list = biggerServiceCandidates({
      currentOdometer: 500, modelYear: 2026, vehicleClass: "B", now: NOW,
    });
    expect(list.map((c) => c.slug)).not.toContain("brake_fluid_flush");
  });
});
