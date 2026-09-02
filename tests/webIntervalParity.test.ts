/**
 * Cross-repo parity: mobile's interval resolution vs otopair-web's copy.
 *
 * `tests/webHealthScoreParity.test.ts` covers the CALCULATOR — but it feeds
 * `computeVehicleHealthScore` hand-built items whose statuses are already
 * decided. It never runs `computeMaintenanceStatus` or `getInterval`, so the
 * entire interval-resolution half of Tiered Interval Fallback v2 was shipping
 * across two repos with no automated parity coverage at all: a drifted class
 * cell, a missing turbo modifier or a differently-ordered tier would quote two
 * different due-dates for the same car and nothing would notice.
 *
 * This closes that. Same shape as its sibling — behaviour over a fixture grid,
 * not text — but the grid is the one that matters for intervals: make × class
 * × drivetrain × turbo × odometer × age × driving conditions.
 *
 * It is ALSO the port harness. Web's `utils/maintenanceStatus.ts` is the last
 * unported piece (§4), so until that lands this file is expected to fail, and
 * the mismatch list it prints is the to-do: port until it goes quiet. That is
 * more useful than porting by hand and eyeballing the result, which is how the
 * two copies drifted 579 lines in the first place.
 *
 * SOUNDNESS: web's copy resolves its own "@/" imports through THIS repo's
 * aliases, so it is only a fair test while every module it pulls in is
 * byte-identical across the repos. Checked first, and a drift there fails
 * loudly — a green result underneath one would be meaningless.
 *
 * Skips when the web repo isn't checked out beside this one. Point
 * OTOPAIR_WEB_DIR elsewhere to override.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import * as mobile from "@/utils/maintenanceStatus";

const WEB_DIR =
  process.env.OTOPAIR_WEB_DIR ?? resolve(__dirname, "..", "..", "otopair-web");
const WEB_STATUS = resolve(WEB_DIR, "utils/maintenanceStatus.ts");

/** Everything web's maintenanceStatus.ts reaches at runtime. If any of these
 *  drift, web's copy is being fed OUR version of them and the comparison
 *  proves nothing. */
const SHARED_DEPS = [
  "utils/intervalBands.ts",
  "utils/vehicleClass.ts",
  "utils/classIntervals.ts",
  "utils/serviceIntervalGuardrails.ts",
  "lib/warningLightVocab.ts",
];

const available = existsSync(WEB_STATUS);
type Impl = typeof mobile;

// ── The grid ────────────────────────────────────────────────────────────────
// Makes chosen for what they exercise, not for coverage theatre: Toyota is the
// v1 make-override that the class table has to beat (5,000 vs 7,500 oil),
// Volvo is the tier→class exception, Lexus is the make override INTO class A,
// and an unknown make has to fall through cleanly.
const MAKES = [undefined, "toyota", "bmw", "volvo", "lexus", "porsche", "wuling"];
const CLASSES = [undefined, null, "A", "B", "C"] as const;
const DRIVETRAINS = [undefined, null, "fwd", "rwd", "awd", "4wd"] as const;
const TURBO = [undefined, false, true];
const ODOMETERS = [null, 0, 1_000, 24_000, 45_000, 90_000, 145_000, 300_000];
const CONDITIONS = [undefined, "city", "highway", "mixed"];
const DRIVING = [undefined, "light", "average", "heavy"];
const YEARS = [undefined, 2018, 2024, 2026];

/** Fixed clock. A `Date.now()` default would make this suite's own result
 *  depend on when it ran, which is the last thing a parity harness should do. */
const NOW = new Date(2026, 5, 15).getTime();

const TYPES = ["oil", "brakes", "tires", "battery", "inspection"] as const;

interface Case {
  record: Record<string, unknown>;
  odometer: number | null;
  make?: string;
  conditions?: string;
  driving?: string;
  year?: number;
  classCtx?: Record<string, unknown>;
}

function buildCases(): Case[] {
  const out: Case[] = [];

  // Anchored records across the full class × drivetrain × turbo space. One
  // type per combination keeps the grid honest without exploding it.
  for (const vehicleClass of CLASSES)
    for (const drivetrain of DRIVETRAINS)
      for (const turbo of TURBO)
        for (const odometer of ODOMETERS)
          for (const type of TYPES) {
            out.push({
              record: {
                type,
                lastServiceDate: new Date(2024, 2, 1).getTime(),
                lastServiceMileage: odometer == null ? undefined : Math.max(0, odometer - 20_000),
              },
              odometer,
              make: "bmw",
              year: 2020,
              classCtx: { vehicleClass, drivetrain, turbo },
            });
          }

  // Make × driving conditions. This is where the unsigned-off change lives:
  // restricting the multipliers to non-OEM tiers moves a city Toyota's oil
  // interval 4,000 → 6,000 miles, so any drift here is loud and deliberate.
  for (const make of MAKES)
    for (const conditions of CONDITIONS)
      for (const driving of DRIVING)
        for (const type of TYPES) {
          out.push({
            record: { type, lastServiceDate: new Date(2025, 0, 1).getTime(), lastServiceMileage: 40_000 },
            odometer: 60_000,
            make,
            conditions,
            driving,
            year: 2020,
            classCtx: { vehicleClass: "A" },
          });
        }

  // Unanchored and half-anchored records — the states that decide whether an
  // item scores at all, and where an off-by-one in the unknown branch hides.
  for (const odometer of ODOMETERS)
    for (const year of YEARS)
      for (const type of TYPES) {
        out.push({ record: { type }, odometer, year, classCtx: { vehicleClass: "B" } });
        out.push({
          record: { type, lastServiceMileage: 10_000 },
          odometer, year, classCtx: { vehicleClass: "B" },
        });
        out.push({
          record: { type, lastServiceDate: new Date(2023, 6, 1).getTime() },
          odometer, year, classCtx: { vehicleClass: "B" },
        });
      }

  return out;
}

const CASES = buildCases();

describe.skipIf(!available)("mobile ↔ web interval parity", () => {
  let web: Impl;

  beforeAll(async () => {
    web = (await import(/* @vite-ignore */ WEB_STATUS)) as Impl;
  });

  it("the shared runtime deps are byte-identical (soundness precondition)", () => {
    const drifted = SHARED_DEPS.filter((f) => {
      const a = resolve(__dirname, "..", f);
      const b = resolve(WEB_DIR, f);
      if (!existsSync(b)) return true;
      return readFileSync(a, "utf8") !== readFileSync(b, "utf8");
    });
    // If this fires the rest of the file proves nothing. Fix the drift.
    expect(drifted).toEqual([]);
  });

  it("computeMaintenanceStatus agrees across the class × drivetrain × turbo grid", () => {
    const mismatches: unknown[] = [];
    for (const c of CASES) {
      const args = [
        c.record, c.odometer, c.make, NOW, c.conditions, c.driving,
        undefined, c.year, undefined, c.classCtx,
      ] as unknown as Parameters<typeof mobile.computeMaintenanceStatus>;
      const a = mobile.computeMaintenanceStatus(...args);
      const b = web.computeMaintenanceStatus(...args);
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        mismatches.push({ case: c, mobile: a, web: b });
      }
    }
    // Truncated: the first few are enough to work from, and dumping thousands
    // of objects into a terminal helps nobody.
    expect(mismatches.slice(0, 5)).toEqual([]);
  });

  it("agrees on the driving-conditions interaction specifically", () => {
    // Called out on its own because it is the most user-visible number in the
    // whole change and the one Yassin has not signed off. If the two repos
    // ever disagree here, one of them is quoting a city driver an oil change
    // 2,000 miles early or late.
    const mismatches: unknown[] = [];
    for (const make of ["toyota", "honda", "bmw", "ford"])
      for (const conditions of ["city", "highway"])
        for (const vehicleClass of ["A", "B", "C"]) {
          const args = [
            { type: "oil", lastServiceDate: new Date(2025, 0, 1).getTime(), lastServiceMileage: 40_000 },
            60_000, make, NOW, conditions, "average",
            undefined, 2020, undefined, { vehicleClass },
          ] as unknown as Parameters<typeof mobile.computeMaintenanceStatus>;
          const a = mobile.computeMaintenanceStatus(...args);
          const b = web.computeMaintenanceStatus(...args);
          if (JSON.stringify(a) !== JSON.stringify(b)) {
            mismatches.push({ make, conditions, vehicleClass, mobile: a, web: b });
          }
        }
    expect(mismatches.slice(0, 5)).toEqual([]);
  });

  it("agrees on which tier won, not just on the resulting status", () => {
    // Two implementations can land on the same status from different tiers —
    // an OEM value and a class default that happen to bracket the same band.
    // `intervalSource` is what the confidence hold keys off, so a divergence
    // here means one repo deducts points where the other holds.
    const mismatches: unknown[] = [];
    for (const vehicleClass of ["A", "B", "C"])
      for (const odometer of ODOMETERS)
        for (const type of TYPES) {
          const args = [
            { type, lastServiceDate: new Date(2024, 0, 1).getTime(), lastServiceMileage: 10_000 },
            odometer, "toyota", NOW, undefined, undefined,
            undefined, 2020, undefined, { vehicleClass },
          ] as unknown as Parameters<typeof mobile.computeMaintenanceStatus>;
          const a = mobile.computeMaintenanceStatus(...args) as unknown as Record<string, unknown>;
          const b = web.computeMaintenanceStatus(...args) as unknown as Record<string, unknown>;
          if (a.intervalSource !== b.intervalSource || a.factorApplied !== b.factorApplied) {
            mismatches.push({
              vehicleClass, odometer, type,
              mobile: { source: a.intervalSource, factor: a.factorApplied },
              web: { source: b.intervalSource, factor: b.factorApplied },
            });
          }
        }
    expect(mismatches.slice(0, 5)).toEqual([]);
  });
});
