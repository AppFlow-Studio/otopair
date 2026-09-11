/**
 * Cross-repo parity: mobile's utils/healthScore.ts vs otopair-web's copy.
 *
 * The scoring model is duplicated, not shared — the two repos keep their own
 * file and ports are done by hand from a written spec. That is exactly the
 * setup where "I applied the same change" can be true in intent and false in
 * behaviour, and where the failure is invisible: Oto reads web's copy, the
 * health ring reads ours, and a drifted constant just quietly quotes two
 * different numbers for the same car.
 *
 * So this asserts behaviour, not text. It runs both implementations over a
 * fixture grid and requires identical output, including deep equality on the
 * full factors arrays (labels and copy, not just the headline number).
 *
 * SOUNDNESS: web's copy resolves its own "@/" imports through THIS repo's
 * aliases. That is only valid while its two runtime dependencies are
 * byte-identical across the repos — the test checks that first and fails
 * loudly if they ever drift, because at that point a green result here would
 * be meaningless.
 *
 * Skips when the web repo isn't checked out beside this one (CI, fresh clones,
 * anyone not working cross-repo). Point OTOPAIR_WEB_DIR elsewhere to override.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import * as mobile from "@/utils/healthScore";

const WEB_DIR =
  process.env.OTOPAIR_WEB_DIR ?? resolve(__dirname, "..", "..", "otopair-web");
const WEB_HEALTH = resolve(WEB_DIR, "utils/healthScore.ts");
const SHARED_DEPS = ["lib/maintenanceServiceMapping.ts", "lib/warningLightVocab.ts"];

const available = existsSync(WEB_HEALTH);

type Impl = typeof mobile;

const TYPES = ["oil", "brakes", "tires", "battery", "inspection", "minor_wiper"];
const STATUSES = ["on_time", "due_soon", "needs_attention", "overdue", "unknown"] as const;
const MILEAGES = [0, 5_000, 15_000, 45_000, 100_000, 145_000, 200_000, 310_000];
const LIGHTS = [[], ["check_engine"], ["check_engine", "abs"], ["tpms", "oil_pressure", "abs"]];
const WEIGHTS = [
  undefined,
  { upkeepWeight: 70 },
  { upkeepWeight: 95 },
  { upkeepWeight: 85, openIssuePenaltyMax: 25 },
];

function buildFixtures() {
  const out: any[] = [];
  for (const t of TYPES)
    for (const status of STATUSES)
      for (const odometerMiles of MILEAGES)
        for (const knownIssues of LIGHTS)
          out.push({ maintenanceItems: [{ id: t, status }], odometerMiles, knownIssues });

  for (const odometerMiles of MILEAGES)
    for (const knownIssues of LIGHTS) {
      // The branch §08 actually changed: nothing on file at all.
      out.push({ maintenanceItems: [], odometerMiles, knownIssues });
      out.push({
        maintenanceItems: TYPES.map((id) => ({ id, status: "unknown" })),
        odometerMiles,
        knownIssues,
      });
      out.push({
        maintenanceItems: TYPES.map((id, i) => ({ id, status: STATUSES[i % STATUSES.length] })),
        odometerMiles,
        knownIssues,
      });
      // Partial-unknown: the mix that exposes a wrong denominator.
      out.push({
        maintenanceItems: [
          { id: "oil", status: "on_time" },
          { id: "brakes", status: "unknown" },
          { id: "tires", status: "overdue" },
          { id: "inspection", status: "unknown" },
        ],
        odometerMiles,
        knownIssues,
      });
      // Catalog rows, both gated states. Added 2026-09-02 when a driver's
      // answer on a bigger service started scoring: the grid had no
      // `catalog-*` id at all, so the whole path was outside parity coverage
      // and a divergence between the repos would not have shown up here.
      out.push({
        maintenanceItems: [
          { id: "catalog-spark_plugs", status: "overdue", excludeFromScore: false },
          { id: "catalog-transmission_service", status: "due_soon", excludeFromScore: false },
          { id: "catalog-coolant_flush", status: "unknown", excludeFromScore: true },
          { id: "oil", status: "on_time" },
        ],
        odometerMiles,
        knownIssues,
      });
      // rawScore + both exclusion paths.
      out.push({
        maintenanceItems: [
          { id: "brakes", status: "needs_attention", rawScore: 0.42 },
          { id: "oil", status: "unknown", excludeFromScore: true },
          { id: "tires", status: "overdue", sourceRecommendationId: "rec1" },
        ],
        odometerMiles,
        knownIssues,
      });
    }
  return out;
}

const FIXTURES = buildFixtures();

describe.skipIf(!available)("mobile ↔ web healthScore parity", () => {
  let web: Impl;

  beforeAll(async () => {
    web = (await import(/* @vite-ignore */ WEB_HEALTH)) as Impl;
  });

  it("the shared runtime deps are byte-identical (soundness precondition)", () => {
    const drifted = SHARED_DEPS.filter(
      (f) =>
        readFileSync(resolve(__dirname, "..", f), "utf8") !==
        readFileSync(resolve(WEB_DIR, f), "utf8"),
    );
    // If this fires, the rest of this file proves nothing — web's copy is
    // being fed our versions of these modules. Fix the drift, don't skip.
    expect(drifted).toEqual([]);
  });

  it("computeVehicleHealthScore agrees on every fixture and weight set", () => {
    const mismatches: unknown[] = [];
    for (const w of WEIGHTS) {
      for (const f of FIXTURES) {
        const a = mobile.computeVehicleHealthScore(f, w as any);
        const b = web.computeVehicleHealthScore(f, w as any);
        if (a !== b) mismatches.push({ weights: w, fixture: f, mobile: a, web: b });
      }
    }
    expect(mismatches.slice(0, 8)).toEqual([]);
  });

  it("computeHealthScoreFactors agrees, labels and points included", () => {
    const mismatches: unknown[] = [];
    for (const f of FIXTURES) {
      const a = mobile.computeHealthScoreFactors(f);
      const b = web.computeHealthScoreFactors(f);
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        mismatches.push({ fixture: f, mobile: a, web: b });
      }
    }
    expect(mismatches.slice(0, 4)).toEqual([]);
  });
});
