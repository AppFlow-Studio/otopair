/**
 * Before the quick-read, no surface may print a health score.
 *
 * There are no service records at that point, and utils/mergedMaintenance.ts
 * fills the gap with assumed statuses — brakes/tires/battery "on time", oil
 * "due soon". That produced a fixed 93 for EVERY vehicle (the odometer is not
 * an input to the score at all), and it could only fall: the 2020 Q5 at
 * 300,000 mi went 93 → 24 once its owner answered honestly about original
 * tires and an unreplaced battery. The booking-flow gate was worse — a
 * hardcoded 83.
 *
 * Ahmad, 2026-08-27: show dashes and say we haven't scored it yet.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function code(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const CARS = code("app/(main-tabs)/cars/index.tsx");
const GATE = code("components/booking/QuickReadGateSheet.tsx");
const CAROUSEL = code("components/cars/CarCarousel.tsx");

describe("pre-onboarding shows no score", () => {
  it("the booking gate has no hardcoded baseline score", () => {
    expect(GATE).not.toContain("estimatedScore");
    expect(GATE).not.toMatch(/=\s*83\b/);
    expect(GATE).toContain("Not scored yet");
  });

  it("the Cars quick-read card derives no score to display", () => {
    // `estScore` was `health_score ?? computedHealthScore` printed in the ring.
    // Word-boundary: `latestScoreRef` legitimately contains this substring.
    expect(/\bestScore\b/.test(CARS)).toBe(false);
    expect(CARS).toContain("Not scored yet");
  });

  it("the health sheet withholds the number in estimated mode", () => {
    expect(CARS).toMatch(/healthSheetMode === 'estimated'\s*\n?\s*\?\s*"· · ·"/);
    expect(CARS).toContain('"not scored yet"');
  });

  it("the health modal ring withholds it too, and draws an empty arc", () => {
    expect(CAROUSEL).toContain("pending || isEstimated ? '· · ·'");
    expect(CAROUSEL).toContain("isEstimated ? 0 : overallPercentage");
  });

  it("no surface still offers an estimate of where the vehicle stands", () => {
    for (const [name, src] of Object.entries({ CARS, GATE })) {
      expect(src, `${name} still promises an estimate`).not.toContain(
        "an estimate of where",
      );
    }
  });
});
