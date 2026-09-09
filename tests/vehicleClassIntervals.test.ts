/**
 * Interval class + class default table — Tiered Interval Fallback v2 §3/§4.
 *
 * The class decides which column of the default table a car reads. It is
 * derived from the pricing tier we already compute, with three exceptions the
 * spec's one-line mapping does not survive contact with:
 *
 *   1. Lexus F / RC F / LC and Acura Type S are T3a — genuinely Class C — so a
 *      blanket make override would put an LC 500 on mainstream oil intervals.
 *   2. Volvo is T2a (→ A by the tier map) but the spec places it in Class B.
 *   3. Infiniti has no pricing rule at all, so the resolver cannot depend on a
 *      tier existing.
 */
import { describe, expect, it } from "vitest";
import { VEHICLE_TIERS } from "@/convex/lib/vehicleTiers";
import {
  TIER_TO_CLASS,
  classifyFuelType,
  isTurbocharged,
  normalizeDrivetrain,
  resolveVehicleClass,
} from "@/utils/vehicleClass";
import { CLASS_INTERVALS, classInterval } from "@/utils/classIntervals";

describe("tier → class", () => {
  it("covers every tier, so a new one fails loudly instead of defaulting to A", () => {
    expect(Object.keys(TIER_TO_CLASS).sort()).toEqual([...VEHICLE_TIERS].sort());
  });

  it("maps the plain cases", () => {
    expect(resolveVehicleClass({ pricingTier: "T1", make: "Toyota" }).vehicleClass).toBe("A");
    expect(resolveVehicleClass({ pricingTier: "T2b", make: "Audi" }).vehicleClass).toBe("B");
    expect(resolveVehicleClass({ pricingTier: "T2c", make: "BMW" }).vehicleClass).toBe("B");
    expect(resolveVehicleClass({ pricingTier: "T4", make: "Ferrari" }).vehicleClass).toBe("C");
  });
});

describe("the three exceptions", () => {
  it("a performance tier is never dragged into A by its make", () => {
    // Lexus LC is T3a. Under a blanket make override it would read a
    // 7,500-mile mainstream oil interval, which is the bug this ordering exists
    // to prevent.
    const lc = resolveVehicleClass({ pricingTier: "T3a", make: "Lexus" });
    expect(lc.vehicleClass).toBe("C");
    expect(lc.source).toBe("performance_tier");

    expect(resolveVehicleClass({ pricingTier: "T3a", make: "Acura" }).vehicleClass).toBe("C");
  });

  it("pulls the value-premium Japanese makes into A", () => {
    for (const make of ["Lexus", "Acura", "Infiniti", "Genesis"]) {
      const r = resolveVehicleClass({ pricingTier: "T2a", make });
      expect(r.vehicleClass, make).toBe("A");
      expect(r.source, make).toBe("make_override");
    }
  });

  it("pushes Volvo out of A, even though its tier says A", () => {
    expect(TIER_TO_CLASS.T2a).toBe("A");
    const volvo = resolveVehicleClass({ pricingTier: "T2a", make: "Volvo" });
    expect(volvo.vehicleClass).toBe("B");
    expect(volvo.source).toBe("make_override");
  });

  it("classifies Infiniti with no pricing tier at all", () => {
    // Infiniti has no rule in ASSIGNMENT_RULES, so the resolver must not
    // depend on a tier being present.
    const r = resolveVehicleClass({ pricingTier: null, make: "Infiniti" });
    expect(r.vehicleClass).toBe("A");
    expect(r.source).toBe("make_override");
  });

  it("is case- and whitespace-insensitive on make", () => {
    expect(resolveVehicleClass({ pricingTier: "T2a", make: "  vOLvO " }).vehicleClass).toBe("B");
  });

  it("defaults to A, visibly, when nothing is known", () => {
    const r = resolveVehicleClass({});
    expect(r.vehicleClass).toBe("A");
    expect(r.source).toBe("default");
  });
});

describe("classifying without a pricing tier", () => {
  // Most vehicle_configs rows carry no pricing_tier until the seeder reaches
  // them — the real Audi Q5 in dev has none. Without a make fallback it
  // resolved to Class A and would have read a 7,500-mile oil interval.
  it("puts a European make in B on make alone", () => {
    for (const make of ["Audi", "BMW", "Mercedes-Benz", "Volkswagen", "Porsche", "MINI"]) {
      const r = resolveVehicleClass({ pricingTier: null, make });
      expect(r.vehicleClass, make).toBe("B");
    }
  });

  it("leaves a mainstream make on A", () => {
    for (const make of ["Toyota", "Honda", "Ford", "Hyundai"]) {
      expect(resolveVehicleClass({ pricingTier: null, make }).vehicleClass, make).toBe("A");
    }
  });

  it("never guesses C from a badge", () => {
    // A base Macan is Class B. Guessing "Porsche → C" would put it on
    // 40,000-mile coolant. Performance has to come from tier or trim.
    expect(resolveVehicleClass({ pricingTier: null, make: "Porsche" }).vehicleClass).toBe("B");
    expect(resolveVehicleClass({ pricingTier: "T3b", make: "Porsche" }).vehicleClass).toBe("C");
  });

  it("still lets a real tier win over the make fallback", () => {
    // The fallback is for the no-tier case only; it must not shadow T3a.
    expect(resolveVehicleClass({ pricingTier: "T3a", make: "BMW" }).vehicleClass).toBe("C");
  });
});

describe("powertrain", () => {
  it("detects a BEV, which is out of scope entirely", () => {
    expect(classifyFuelType("Electric")).toBe("bev");
    expect(classifyFuelType("BEV")).toBe("bev");
  });

  it("treats a hybrid as a gas car — it uses its class table in full", () => {
    // "Plug-In Hybrid" contains "hybrid"; order matters. And a hybrid's primary
    // fuel is often bare "Gasoline", which is combustion either way.
    expect(classifyFuelType("Hybrid")).toBe("hybrid");
    expect(classifyFuelType("Plug-In Hybrid")).toBe("hybrid");
    expect(classifyFuelType("Gasoline")).toBe("combustion");
  });

  it("treats unknown fuel as combustion — the safe direction", () => {
    // A false BEV silently stops asking a real car about its oil.
    expect(classifyFuelType(null)).toBe("combustion");
    expect(classifyFuelType("Flex Fuel")).toBe("combustion");
  });

  it("normalizes drivetrain and turbo strings", () => {
    expect(normalizeDrivetrain("AWD")).toBe("awd");
    expect(normalizeDrivetrain("Front Wheel Drive")).toBe("fwd");
    expect(normalizeDrivetrain("4x4")).toBe("4wd");
    expect(normalizeDrivetrain("nonsense")).toBeNull();
    expect(isTurbocharged("Twin Turbo")).toBe(true);
    expect(isTurbocharged("Naturally Aspirated")).toBe(false);
  });
});

describe("the default table", () => {
  it("matches the spec for oil across all three classes", () => {
    expect(classInterval("oil_change", "A")).toEqual({ miles: 7_500, months: 12 });
    expect(classInterval("oil_change", "B")).toEqual({ miles: 10_000, months: 12 });
    expect(classInterval("oil_change", "C")).toEqual({ miles: 7_500, months: 12 });
  });

  it("gives Euro brake fluid a time axis and no mileage axis", () => {
    expect(classInterval("brake_fluid_flush", "A")).toEqual({ miles: 30_000, months: 36 });
    expect(classInterval("brake_fluid_flush", "B")).toEqual({ miles: null, months: 24 });
  });

  it("keeps brake pads miles-only and battery months-only", () => {
    expect(classInterval("brake_pad_replacement", "A")?.months).toBeNull();
    expect(classInterval("battery_replacement", "A")?.miles).toBeNull();
    expect(classInterval("battery_replacement", "C")).toEqual({ miles: null, months: 36 });
  });

  it("returns null for a slug it does not cover", () => {
    expect(classInterval("timing_belt", "A")).toBeNull();
  });
});

describe("turbo modifier", () => {
  it("shortens Class A spark plugs and leaves oil alone", () => {
    // v1 said "use Class B values", but Class B oil is LONGER — backwards for
    // an engine under more thermal stress.
    expect(classInterval("spark_plugs", "A")?.miles).toBe(90_000);
    expect(classInterval("spark_plugs", "A", { turbo: true })?.miles).toBe(60_000);
    expect(classInterval("oil_change", "A", { turbo: true })).toEqual({ miles: 7_500, months: 12 });
  });

  it("leaves Class B alone — that table already assumes turbo", () => {
    expect(classInterval("spark_plugs", "B", { turbo: true })?.miles).toBe(60_000);
  });
});

describe("drivetrain gate on the differential", () => {
  it("disappears entirely on a FWD car, rather than reading on-time", () => {
    expect(classInterval("differential_service", "A", { drivetrain: "fwd" })).toBeNull();
  });

  it("applies on RWD and AWD", () => {
    expect(classInterval("differential_service", "A", { drivetrain: "rwd" })?.miles).toBe(60_000);
    expect(classInterval("differential_service", "A", { drivetrain: "awd" })?.miles).toBe(60_000);
    expect(classInterval("differential_service", "C", { drivetrain: "awd" })?.miles).toBe(40_000);
  });

  it("needs positive confirmation on 4WD and on unknown drivetrain", () => {
    // The spec says rwd/awd only. The app's existing applicability rule is
    // looser and hands a 4WD car a differential; don't inherit that here.
    expect(classInterval("differential_service", "A", { drivetrain: "4wd" })).toBeNull();
    expect(
      classInterval("differential_service", "A", { drivetrain: "4wd", hasDifferential: true })
        ?.miles,
    ).toBe(60_000);
    expect(classInterval("differential_service", "A", { drivetrain: null })).toBeNull();
  });

  it("honours a hard false even on AWD", () => {
    expect(
      classInterval("differential_service", "A", { drivetrain: "awd", hasDifferential: false }),
    ).toBeNull();
  });
});

describe("the two non-constant rows", () => {
  it("coolant is longer on the first change than afterwards", () => {
    // The v1 bug that motivated the confidence hold: 60k was too short, so the
    // 1.5x deduction landed at 90k on a Camry whose maker says 100k.
    expect(classInterval("coolant_flush", "A")).toEqual({ miles: 100_000, months: 72 });
    expect(classInterval("coolant_flush", "A", { hasCoolantServiceOnRecord: true })).toEqual({
      miles: 50_000,
      months: 36,
    });
    expect(classInterval("coolant_flush", "C", { hasCoolantServiceOnRecord: true })).toEqual({
      miles: 30_000,
      months: 24,
    });
  });

  it("tire rotation follows whatever oil resolved to, not a copy of the class value", () => {
    // The point of the reference: if enrichment gives this car a 9,000-mile oil
    // interval, rotation inherits 9,000 — not the class default.
    const resolveFollows = (slug: string) =>
      slug === "oil_change" ? { miles: 9_000, months: 12 } : null;
    expect(classInterval("tire_rotation", "A", { resolveFollows })).toEqual({
      miles: 9_000,
      months: 12,
    });
  });

  it("yields null rather than a wrong number when the reference cannot resolve", () => {
    expect(classInterval("tire_rotation", "A")).toBeNull();
  });
});

describe("table shape", () => {
  it("defines all three classes for every slug", () => {
    for (const [slug, row] of Object.entries(CLASS_INTERVALS)) {
      for (const cls of ["A", "B", "C"] as const) {
        expect(row[cls], `${slug}.${cls}`).toBeDefined();
      }
    }
  });

  it("never carries an interval with neither axis set", () => {
    for (const slug of Object.keys(CLASS_INTERVALS)) {
      for (const cls of ["A", "B", "C"] as const) {
        const resolved = classInterval(slug, cls, {
          drivetrain: "awd",
          resolveFollows: () => ({ miles: 7_500, months: 12 }),
        });
        if (resolved) {
          expect(resolved.miles != null || resolved.months != null, `${slug}.${cls}`).toBe(true);
        }
      }
    }
  });
});
