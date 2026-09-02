/**
 * The class table, wired end to end through computeMaintenanceStatus.
 *
 * This is where the first real behaviour change lands: the class table sits
 * ABOVE the per-make overrides, so a Toyota's oil interval moves from 5,000 to
 * 7,500 miles. Without the class supplied nothing changes at all, which is why
 * the existing suite needed no re-baselining.
 */
import { describe, expect, it } from "vitest";
import { computeMaintenanceStatus } from "@/utils/maintenanceStatus";

const NOW = new Date("2026-08-30T00:00:00Z").getTime();
const MONTHS_AGO = (n: number) => NOW - n * 30.44 * 24 * 60 * 60 * 1000;

/** Oil serviced at 100,000 mi / 2 months ago — time is never the binding axis. */
const oilRecord = { type: "oil", lastServiceMileage: 100_000, lastServiceDate: MONTHS_AGO(2) };

const statusAt = (
  odometer: number,
  opts: { make?: string; classCtx?: unknown; conditions?: string } = {},
) =>
  computeMaintenanceStatus(
    oilRecord as never,
    odometer,
    opts.make ?? "Toyota",
    NOW,
    opts.conditions,
    "average",
    [],
    2020,
    undefined,
    opts.classCtx as never,
  );

const CLASS_A = { vehicleClass: "A" as const };
const CLASS_B = { vehicleClass: "B" as const };

describe("class table sits above the make overrides", () => {
  it("without a class, a Toyota keeps its 5,000-mile make override", () => {
    // 6,000 miles since service. Old behaviour: 6000/5000 = 1.2 → overdue.
    expect(statusAt(106_000).status).toBe("overdue");
  });

  it("with Class A, the same car reads 7,500 and is only due soon", () => {
    // 6000/7500 = 0.80 → exactly the due-soon cutoff. This is the single
    // largest score movement in the change, and it is the point of adopting
    // the table: Toyota's own schedule is 7,500, not 5,000.
    const r = statusAt(106_000, { classCtx: CLASS_A });
    expect(r.status).toBe("due_soon");
    expect(r.intervalSource).toBe("class_default");
  });

  it("Class B reads 10,000, so the same car is on time", () => {
    expect(statusAt(106_000, { make: "Audi", classCtx: CLASS_B }).status).toBe("on_time");
  });

  it("reports where the interval came from", () => {
    expect(statusAt(106_000).intervalSource).toBe("legacy_default");
    expect(statusAt(106_000, { classCtx: CLASS_A }).intervalSource).toBe("class_default");
  });
});

describe("driving conditions apply to our numbers, not the manufacturer's", () => {
  it("shortens a class default for city driving", () => {
    // Ahmad signed this off: 7,500 x 0.8 = 6,000 for a city-driven car.
    // At 6,000 miles that is ratio 1.0 — overdue — where the un-adjusted
    // class interval put it exactly at due-soon.
    expect(statusAt(106_000, { classCtx: CLASS_A }).status).toBe("due_soon");
    expect(statusAt(106_000, { classCtx: CLASS_A, conditions: "city" }).status).toBe("overdue");
  });

  it("leaves an OEM interval alone", () => {
    // A factory severe-service schedule already accounts for city driving;
    // discounting it again would be double-counting.
    const oem = { oil_change: { interval_miles: 10_000, interval_months: 12 } };
    const withOem = (conditions?: string) =>
      computeMaintenanceStatus(
        oilRecord as never,
        108_000,
        "Toyota",
        NOW,
        conditions,
        "average",
        [],
        2020,
        oem as never,
        CLASS_A as never,
      );
    // 8,000 / 10,000 = 0.8 either way — the multiplier must not move it.
    expect(withOem().intervalSource).toBe("oem");
    expect(withOem("city").status).toBe(withOem().status);
  });
});

describe("bands and the hold, through the real calculator", () => {
  it("bands an item and reports the applied factor", () => {
    const onTime = statusAt(101_000, { classCtx: CLASS_A }); // 1k/7.5k = 0.13
    expect(onTime.bandStatus).toBe("on_time");
    expect(onTime.factorApplied).toBe(1);

    const dueSoon = statusAt(106_000, { classCtx: CLASS_A }); // 0.80
    expect(dueSoon.bandStatus).toBe("due_soon");

    const severe = statusAt(120_000, { classCtx: CLASS_A }); // 20k/7.5k = 2.67
    expect(severe.bandStatus).toBe("severely_overdue");
  });

  it("holds a class default at due soon and overdue — recommendation, no deduction", () => {
    const dueSoon = statusAt(106_000, { classCtx: CLASS_A });
    expect(dueSoon.status).toBe("due_soon"); // still surfaces on the tracker
    expect(dueSoon.factorApplied).toBe(1); // but costs nothing

    const overdue = statusAt(109_000, { classCtx: CLASS_A }); // 9k/7.5k = 1.2
    expect(overdue.status).toBe("overdue");
    expect(overdue.factorApplied).toBe(1);
  });

  it("stops holding at 1.5x", () => {
    // Past this the guess is no longer why the car looks bad.
    const severe = statusAt(120_000, { classCtx: CLASS_A });
    expect(severe.factorApplied).toBe(0.1);
  });

  it("never holds an OEM interval", () => {
    const oem = { oil_change: { interval_miles: 5_000, interval_months: 6 } };
    const r = computeMaintenanceStatus(
      oilRecord as never, 106_000, "Toyota", NOW, undefined, "average", [], 2020,
      oem as never, CLASS_A as never,
    );
    expect(r.intervalSource).toBe("oem");
    // 6000/5000 = 1.2 → overdue, and it deducts, because the manufacturer's
    // number is not a guess.
    expect(r.factorApplied).toBe(0.35);
  });

  it("releases the hold when enrichment lands late", () => {
    // The "eventually, manually" path: same car, same mileage, the only
    // change being that an OEM row now exists.
    const held = statusAt(109_000, { classCtx: CLASS_A });
    const released = computeMaintenanceStatus(
      oilRecord as never, 109_000, "Toyota", NOW, undefined, "average", [], 2020,
      { oil_change: { interval_miles: 7_500, interval_months: 12 } } as never,
      CLASS_A as never,
    );
    expect(held.factorApplied).toBe(1);
    expect(released.factorApplied).toBe(0.35);
    expect(released.bandStatus).toBe(held.bandStatus);
  });
});
