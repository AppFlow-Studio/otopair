/**
 * urgency.ts — Action Engine urgency computation (Yassin spec v1.1 §3)
 *
 * Layer 2 of the v1 model: while healthScore.ts answers "how protected
 * is my car right now" (truth), this layer answers "what should I do
 * next, and how urgent is it" (motivation). They share inputs but never
 * contaminate — urgency reads no health-score state and cannot regress
 * the score.
 *
 *   urgency = severity(50%) + proximity(35%) + frictionTiebreaker
 *
 *   severity   — STATUS_SEVERITY[status] × (categoryWeight / 25). Brakes
 *                (weight 25) keep the literal status number; lighter
 *                categories drop proportionally so an overdue inspection
 *                ranks below an overdue brake.
 *   proximity  — percentUsed (0–100) from maintenanceStatus.ts. Same
 *                v0 mileage-distance ramp Yassin's spec references.
 *   friction   — STUB. Higher = easier to book; ties (within
 *                URGENCY_TIEBREAKER_WINDOW) break in favor of higher
 *                friction. No v0 signal exists for cost/distance yet,
 *                so frictionScore returns 0 and the tiebreaker is inert
 *                until a real signal lands post-launch.
 *
 * Tier cutoffs (URGENCY_TIER_CUTOFFS in healthScore.ts) are config
 * constants per spec §7 — tunable post-launch against the live urgency
 * distribution.
 */

import type { MaintenanceStatus } from "@/components/cars/MaintenanceTracker";
import { extractMaintenanceType } from "@/lib/maintenanceServiceMapping";
import {
  CATEGORY_WEIGHTS,
  URGENCY_TIEBREAKER_WINDOW,
  URGENCY_TIER_CUTOFFS,
  URGENCY_WEIGHTS,
} from "./healthScore";

export type UrgencyTier = "now" | "soon" | "soonish" | "resting";

/** Numeric severity per status — fills in the gap left by v0's
 *  SEVERITY_ORDER array (`maintenanceStatus.ts:367`), which provides
 *  ordering but not numbers. Calibrated so overdue at brakes weight
 *  hits Now tier (severity 100 × 1.00 × 0.50 = 50; needs ≥25 proximity
 *  contribution to clear the 75 cutoff — a brake item near-due will
 *  always be loud). */
const STATUS_SEVERITY: Record<MaintenanceStatus, number> = {
  on_time: 0,
  unknown: 20,
  due_soon: 50,
  needs_attention: 75,
  overdue: 100,
};

export interface UrgencyInput {
  /** Item id (slug-based; resolved to a CATEGORY_WEIGHTS bucket via
   *  extractMaintenanceType). */
  id: string;
  status: MaintenanceStatus;
  /** 0–100 percent of interval used (mileage- or time-based). Comes from
   *  maintenanceStatus.computeStatusForRecord — the same ramp v0 used. */
  percentUsed: number;
}

export interface UrgencyResult {
  /** 0–100 urgency score. Scale: severity weight (0.50) × 100 +
   *  proximity weight (0.35) × 100 = 85 max headroom. Cutoffs in
   *  URGENCY_TIER_CUTOFFS are calibrated to this range. */
  score: number;
  tier: UrgencyTier;
}

function categoryWeightForId(id: string): number {
  const type = extractMaintenanceType(id);
  if (type in CATEGORY_WEIGHTS) {
    return CATEGORY_WEIGHTS[type as keyof typeof CATEGORY_WEIGHTS];
  }
  return CATEGORY_WEIGHTS.other;
}

function bucketTier(score: number): UrgencyTier {
  if (score >= URGENCY_TIER_CUTOFFS.now) return "now";
  if (score >= URGENCY_TIER_CUTOFFS.soon) return "soon";
  if (score >= URGENCY_TIER_CUTOFFS.soonish) return "soonish";
  return "resting";
}

export function computeUrgency(input: UrgencyInput): UrgencyResult {
  const weight = categoryWeightForId(input.id);
  const severity = STATUS_SEVERITY[input.status] * (weight / CATEGORY_WEIGHTS.brakes);
  const proximity = Math.max(0, Math.min(100, input.percentUsed));
  const score =
    severity * URGENCY_WEIGHTS.severity +
    proximity * URGENCY_WEIGHTS.proximity;
  return { score, tier: bucketTier(score) };
}

/**
 * Friction tiebreaker — STUB. Spec §3.1 wants "easier to book first"
 * when urgency is within URGENCY_TIEBREAKER_WINDOW points. No v0 signal
 * for cost/distance/availability exists, so this returns 0 for every
 * item, making the tiebreaker inert (higher urgency just wins). Wire a
 * real signal post-launch when shop/mechanic data is uniformly available.
 */
export function frictionScore(_input: UrgencyInput): number {
  return 0;
}

/**
 * Sort comparator for an array of items with attached urgency + optional
 * friction. Higher urgency first. Within URGENCY_TIEBREAKER_WINDOW
 * points, higher friction wins (inert today via the stub above).
 *
 * Returns negative if `a` should come before `b`, positive otherwise —
 * standard Array.sort contract.
 */
export function compareUrgency(
  a: { urgency: number; friction?: number },
  b: { urgency: number; friction?: number },
): number {
  const delta = b.urgency - a.urgency;
  if (Math.abs(delta) >= URGENCY_TIEBREAKER_WINDOW) return delta;
  return (b.friction ?? 0) - (a.friction ?? 0);
}
