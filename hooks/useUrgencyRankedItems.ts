/**
 * useUrgencyRankedItems — Yassin spec v1.1 §6 Change 4 selector.
 *
 * Pure-functional view of `MaintenanceItem[]` enriched with the Action
 * Engine's per-item urgency score + tier (`utils/urgency.ts`), sorted
 * urgency-desc with the friction tiebreaker (currently inert), and
 * grouped by tier for tier-aware UI.
 *
 * Side effect: logs a tier-entry event to Convex whenever an item's
 * computed tier differs from the last one this hook saw for it in the
 * current session. Lets us calibrate URGENCY_TIER_CUTOFFS post-launch
 * against real distribution data.
 *
 * The hook does NOT mutate `MaintenanceItem` — it returns a separate
 * `RankedMaintenanceItem` shape so the existing `MaintenanceItem.urgency`
 * (human-readable rec text from `utils/maintenanceEnrichment.ts`) keeps
 * its meaning.
 */

import { useMutation } from "convex/react";
import { useEffect, useMemo, useRef } from "react";

import { api } from "@/convex/_generated/api";
import type { MaintenanceItem, MaintenanceStatus } from "@/components/cars/MaintenanceTracker";
import { compareUrgency, computeUrgency, frictionScore, type UrgencyTier } from "@/utils/urgency";

export interface RankedMaintenanceItem {
  item: MaintenanceItem;
  urgencyScore: number;
  urgencyTier: UrgencyTier;
  /** Currently always 0 — frictionScore stub. Wire a real cost/distance
   *  signal post-launch to make the tiebreaker active. */
  friction: number;
}

export interface UrgencyRankedView {
  /** Urgency-desc sorted. Ties within URGENCY_TIEBREAKER_WINDOW currently
   *  fall back to insertion order (friction is inert). */
  ranked: RankedMaintenanceItem[];
  /** Same items grouped by their tier — handy for tier-aware UI sections
   *  (e.g. a "Now" header + cards, then a quiet "Resting" collapse). */
  byTier: Record<UrgencyTier, RankedMaintenanceItem[]>;
}

/**
 * Approximate percentUsed from status when an item doesn't carry the
 * real value (e.g. inferred fallback items in useMergedMaintenance that
 * never went through computeMaintenanceStatus). Keeps the urgency math
 * coherent at the tier boundaries without overstating proximity.
 */
function approximatePercentUsedFromStatus(status: MaintenanceStatus): number {
  switch (status) {
    case "on_time":
      return 20;
    case "unknown":
      return 0;
    case "due_soon":
      return 60;
    case "needs_attention":
      return 80;
    case "overdue":
      return 100;
  }
}

const EMPTY_BY_TIER: Record<UrgencyTier, RankedMaintenanceItem[]> = {
  now: [],
  soon: [],
  soonish: [],
  resting: [],
};

export function useUrgencyRankedItems(
  items: readonly MaintenanceItem[],
  vin: string | undefined,
): UrgencyRankedView {
  const recordTierEvent = useMutation(api.urgency.recordTierEvent);
  // Per-mount memory of the last tier we logged for each item. Drives
  // the "log on change" behavior — first observation per session always
  // logs, subsequent observations only log when the tier moves.
  const prevTiersRef = useRef<Map<string, UrgencyTier>>(new Map());

  const view = useMemo<UrgencyRankedView>(() => {
    if (items.length === 0) return { ranked: [], byTier: { ...EMPTY_BY_TIER } };

    const ranked: RankedMaintenanceItem[] = items.map((item) => {
      const urgencyInput = {
        id: item.id,
        status: item.status,
        percentUsed: item.percentUsed ?? approximatePercentUsedFromStatus(item.status),
      };
      const { score, tier } = computeUrgency(urgencyInput);
      return {
        item,
        urgencyScore: score,
        urgencyTier: tier,
        friction: frictionScore(urgencyInput),
      };
    });

    ranked.sort((a, b) =>
      compareUrgency(
        { urgency: a.urgencyScore, friction: a.friction },
        { urgency: b.urgencyScore, friction: b.friction },
      ),
    );

    const byTier: Record<UrgencyTier, RankedMaintenanceItem[]> = {
      now: [],
      soon: [],
      soonish: [],
      resting: [],
    };
    for (const r of ranked) byTier[r.urgencyTier].push(r);

    return { ranked, byTier };
  }, [items]);

  useEffect(() => {
    if (!vin) return;
    const prevTiers = prevTiersRef.current;
    for (const { item, urgencyScore, urgencyTier } of view.ranked) {
      const prevTier = prevTiers.get(item.id);
      if (prevTier === urgencyTier) continue;
      recordTierEvent({
        vin,
        item_id: item.id,
        from_tier: prevTier,
        to_tier: urgencyTier,
        urgency_score: urgencyScore,
      }).catch(() => {
        // Best-effort — calibration logging shouldn't block the UI.
      });
      prevTiers.set(item.id, urgencyTier);
    }
  }, [vin, view.ranked, recordTierEvent]);

  return view;
}
