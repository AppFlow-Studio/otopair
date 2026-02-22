/**
 * healthScore.ts — Vehicle Health Score Computation
 *
 * Single source of truth for the health ring score shown in
 * CarCarousel and MaintenanceTracker. Handles both Smartcar-connected
 * and non-connected (onboarding-only) vehicles.
 *
 * SCORING MODEL (0–100):
 *   Maintenance component  — weighted average of per-item graduated scores
 *   Usage component        — mileage-based diminishing curve
 *   Warning-light penalty  — direct deduction for active dashboard warnings
 *   Smartcar live bonus    — blended in when real-time sensor data exists
 *
 * USED IN: app/(main-tabs)/cars/index.tsx
 */

import type { MaintenanceItem, MaintenanceStatus } from "@/components/cars/MaintenanceTracker";

// ============================================================================
// STATUS → SCORE (graduated, not binary)
// ============================================================================

const STATUS_SCORE: Record<MaintenanceStatus, number> = {
  on_time: 1.0,
  due_soon: 0.7,
  needs_attention: 0.35,
  overdue: 0.1,
  unknown: -1, // sentinel — excluded from average
};

// ============================================================================
// MILEAGE CURVE (piecewise linear)
// ============================================================================

function mileageScore(miles: number): number {
  if (miles <= 0) return 100;
  if (miles <= 30_000) return 100;
  if (miles <= 60_000) return 100 - ((miles - 30_000) / 30_000) * 10;   // 100→90
  if (miles <= 100_000) return 90 - ((miles - 60_000) / 40_000) * 15;   // 90→75
  if (miles <= 150_000) return 75 - ((miles - 100_000) / 50_000) * 20;  // 75→55
  return Math.max(30, 55 - ((miles - 150_000) / 50_000) * 15);          // 55→40→30 floor
}

// ============================================================================
// UNKNOWN-ITEM SCORE BY MILEAGE
// ============================================================================

/**
 * When a maintenance item has no data ("unknown"), its implied health
 * depends on how far the car has been driven.
 *
 *   ≤15k mi  → 0.95  (brand new, no service expected yet)
 *   ≤30k mi  → 0.85  (still early, most items haven't come due)
 *   ≤60k mi  → 0.55  (some service should have happened by now)
 *   ≤100k mi → 0.35  (missing records is a yellow flag)
 *   >100k mi → 0.20  (high mileage + no records is concerning)
 */
function unknownScoreForMileage(miles: number): number {
  if (miles <= 15_000) return 0.95;
  if (miles <= 30_000) return 0.95 - ((miles - 15_000) / 15_000) * 0.10;  // 0.95→0.85
  if (miles <= 60_000) return 0.85 - ((miles - 30_000) / 30_000) * 0.30;  // 0.85→0.55
  if (miles <= 100_000) return 0.55 - ((miles - 60_000) / 40_000) * 0.20; // 0.55→0.35
  return Math.max(0.15, 0.35 - ((miles - 100_000) / 50_000) * 0.15);     // 0.35→0.20→0.15 floor
}

// ============================================================================
// WARNING-LIGHT PENALTY
// ============================================================================

const LIGHT_PENALTY: Record<string, number> = {
  oil_pressure: 15,
  temperature: 15,
  check_engine: 12,
  battery_charging: 10,
  transmission: 10,
  abs: 8,
  airbag_srs: 7,
  tpms: 5,
  not_sure_which: 6,
};

/**
 * Compute penalty from knownIssues array.
 * knownIssues[0] = top-level answer (no_all_clear | check_engine | different_light | not_sure)
 * knownIssues[1..n] = specific light type ids (when answer was "different_light")
 */
function warningLightPenalty(knownIssues?: string[]): number {
  if (!knownIssues || knownIssues.length === 0) return 0;

  const status = knownIssues[0];
  if (status === "no_all_clear") return 0;
  if (status === "not_sure") return 5;
  if (status === "check_engine") return LIGHT_PENALTY.check_engine;

  // "different_light" — sum individual penalties (capped)
  let penalty = 0;
  for (let i = 1; i < knownIssues.length; i++) {
    penalty += LIGHT_PENALTY[knownIssues[i]] ?? 6;
  }
  return Math.min(penalty, 25);
}

// ============================================================================
// SMARTCAR LIVE-SENSOR SCORE (0–1)
// ============================================================================

interface SmartcarSignals {
  oilLife?: number | null;       // 0–1
  tirePressure?: { frontLeft: number; frontRight: number; backLeft: number; backRight: number } | null;
  fuelPercent?: number | null;   // 0–1
}

function smartcarLiveScore(signals: SmartcarSignals): number | null {
  let totalWeight = 0;
  let weightedSum = 0;

  if (signals.oilLife != null) {
    weightedSum += signals.oilLife * 0.45;
    totalWeight += 0.45;
  }

  if (signals.tirePressure) {
    const tires = [
      signals.tirePressure.frontLeft,
      signals.tirePressure.frontRight,
      signals.tirePressure.backLeft,
      signals.tirePressure.backRight,
    ];
    const score = tires.reduce((sum, psi) => {
      if (psi >= 30 && psi <= 36) return sum + 1;
      if (psi >= 26 && psi < 30) return sum + 0.5;
      return sum + 0.2;
    }, 0) / 4;
    weightedSum += score * 0.35;
    totalWeight += 0.35;
  }

  if (signals.fuelPercent != null) {
    weightedSum += signals.fuelPercent * 0.20;
    totalWeight += 0.20;
  }

  if (totalWeight === 0) return null;
  return (weightedSum / totalWeight) * 100;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export interface HealthScoreInput {
  maintenanceItems: MaintenanceItem[];
  odometerMiles: number;
  knownIssues?: string[];
  smartcar?: SmartcarSignals;
}

/**
 * Compute the overall 0–100 vehicle health score.
 *
 * Without Smartcar:
 *   score = maintenance(60%) + mileage(25%) + warningLightReserve(15%) − penalties
 *
 * With Smartcar:
 *   score = maintenance(40%) + smartcarLive(30%) + mileage(15%) + warningLightReserve(15%) − penalties
 */
export function computeVehicleHealthScore(input: HealthScoreInput): number {
  const { maintenanceItems, odometerMiles, knownIssues, smartcar } = input;

  // ── Maintenance component (graduated) ─────────────────────────
  // Unknown items get a mileage-aware inferred score instead of being
  // dropped. A brand-new car with no service history is healthy — the
  // absence of records only becomes concerning at higher mileage.
  const unknownInferredScore = unknownScoreForMileage(odometerMiles);

  const scoredItems = maintenanceItems.map((item) =>
    item.status === "unknown" ? unknownInferredScore : STATUS_SCORE[item.status]
  );

  const maintenanceAvg = scoredItems.length > 0
    ? scoredItems.reduce((a, b) => a + b, 0) / scoredItems.length
    : unknownInferredScore;

  const maintenancePct = maintenanceAvg * 100;

  // ── Usage component ───────────────────────────────────────────
  const usagePct = mileageScore(odometerMiles);

  // ── Smartcar live component ───────────────────────────────────
  const livePct = smartcar ? smartcarLiveScore(smartcar) : null;

  // ── Warning-light penalty ─────────────────────────────────────
  const penalty = warningLightPenalty(knownIssues);

  // ── Warning-light reserve (15 pts) ────────────────────────────
  // Full 15 if no issues, 0 if severe warning lights
  const warningReserve = Math.max(0, 15 - penalty);

  // ── Blend ─────────────────────────────────────────────────────
  let raw: number;
  if (livePct != null) {
    // Connected: maintenance 40% + live 30% + mileage 15% + warningReserve (up to 15%)
    raw = (maintenancePct * 0.40) + (livePct * 0.30) + (usagePct * 0.15) + warningReserve;
  } else {
    // Non-connected: maintenance 60% + mileage 25% + warningReserve (up to 15%)
    raw = (maintenancePct * 0.60) + (usagePct * 0.25) + warningReserve;
  }

  return Math.max(0, Math.min(100, Math.round(raw)));
}
