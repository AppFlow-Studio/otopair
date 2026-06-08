/**
 * useBookingQuoteFallback
 *
 * Reactive wrapper around `api.quotes.previewForBookingQuery`. Returns the
 * Pricing v2 engine's confidence-weighted [low, high] band for the booking's
 * full service list, along with rolled-up per-quote flags (tier_estimate,
 * awd_surcharge_applied, ccb_absolute_pricing, fixed_price_override,
 * spread_exceeded). The Review & Pay sheet uses `flags.length > 0` (plus
 * `refused`) to decide whether to render the "Estimate — final price
 * confirmed at booking" pill.
 *
 * Skips the query (returns idle state) when any input is missing — same
 * pattern as useShopFixedPricesForServices — so the hook is safe to mount
 * before the user has selected a shop / vehicle.
 *
 * USED IN: components/booking/sheets/ReviewPayContent.tsx
 *          components/booking/BookingConfirmStatus.tsx
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/** Per-service engine projection. The Review & Pay screens use this to
 *  decide whether the AI-enriched parts price falls inside the engine band;
 *  when it doesn't, the engine band wins (display + Stripe hold + persisted
 *  booking) and we mark the line as engine-corrected.
 *
 *  Null engine numbers + `refused: true` means this specific service's
 *  Quote was refused (e.g. CCB without brake_system, no tier match) — the
 *  consumer falls back to the AI / default for that line but still surfaces
 *  tier_estimate via the booking-level Estimate pill. */
export type EnginePerService = {
  /** SERVICE TOTAL parts band (engine.parts.low/high — already scaled by
   *  unit_count server-side). Drives line totals + Stripe hold. */
  partsLow: number | null;
  partsHigh: number | null;
  /** Per-unit parts band — same number rendered on each per-OEM-part
   *  row when unitCount > 1 (front + rear axles, N plugs, N quarts). */
  perUnitLow: number | null;
  perUnitHigh: number | null;
  /** Resolved unit count for this vehicle. 2 for "both axles", 8 for V8
   *  spark plugs, N qts for oil change, 4 for tires, 1 for fixed kits. */
  unitCount: number;
  /** Camry baseline unit count (the spec row's
   *  `parts_baseline_unit_count`). Used by callers that want to display
   *  scaling ratio context. */
  baselineCount: number;
  /** Display label: "axle" | "cyl" | "qt" | "wheel" | "kit". */
  unitLabel: string | null;
  laborHours: number | null;
  laborCost: number | null;
  partsSource: string | null;
  flags: string[];
  refused: boolean;
};

export type UseBookingQuoteFallbackResult = {
  /** Engine band low in dollars. Null when the engine refused (vehicle not
   *  enrolled / tier unresolvable) or while loading. */
  fallbackLow: number | null;
  /** Engine band high in dollars. Null while loading or on refuse. */
  fallbackHigh: number | null;
  /** Per-quote engine flags rolled up across all services. Includes
   *  'fallback_only' / 'tier_estimate' when the engine refused at least
   *  one service. */
  flags: string[];
  /** True when the engine refused at least one service in the series. */
  refused: boolean;
  /** True while Convex is hydrating. False once a definitive answer has
   *  been received. */
  isLoading: boolean;
  /** Per-service engine projection keyed by stringified service_id. Empty
   *  when the query is skipped or still loading. Drives the per-line
   *  engine correction in payment.tsx / ReviewPayContent.tsx. */
  byService: Map<string, EnginePerService>;
};

const EMPTY_FLAGS: string[] = [];
const EMPTY_BY_SERVICE: Map<string, EnginePerService> = new Map();

export function useBookingQuoteFallback(
  shopId: string | null | undefined,
  vehicleOwnerId: string | null | undefined,
  serviceIds: string[],
  /** Per-service booking positions for per_axle services. Map keys are
   *  stringified service ids; values are 'front' | 'rear' | 'both'. The
   *  engine uses these to scale the per-axle band to the service total.
   *  Services not present default to 1 axle. */
  servicePositions?: Record<string, "front" | "rear" | "both">,
): UseBookingQuoteFallbackResult {
  const canQuery =
    !!shopId &&
    !!vehicleOwnerId &&
    serviceIds.length > 0 &&
    serviceIds.every((id) => !id.startsWith("svc_"));

  const result = useQuery(
    api.quotes.previewForBookingQuery,
    canQuery
      ? {
          shop_id: shopId as Id<"shops">,
          vehicle_owner_id: vehicleOwnerId as Id<"vehicle_owners">,
          service_ids: serviceIds as Id<"services">[],
          ...(servicePositions ? { service_positions: servicePositions } : {}),
        }
      : "skip",
  );

  return useMemo(() => {
    if (!canQuery || result === undefined) {
      return {
        fallbackLow: null,
        fallbackHigh: null,
        flags: EMPTY_FLAGS,
        refused: false,
        isLoading: canQuery,
        byService: EMPTY_BY_SERVICE,
      };
    }
    if (!result.ok) {
      // Whole-series refusal (vehicle not enrolled, tier unresolvable).
      // Tag every requested service as refused so the per-line consumers
      // can render their tier_estimate badge without re-deriving why.
      const byService = new Map<string, EnginePerService>();
      for (const sid of serviceIds) {
        byService.set(String(sid), {
          partsLow: null,
          partsHigh: null,
          perUnitLow: null,
          perUnitHigh: null,
          unitCount: 1,
          baselineCount: 1,
          unitLabel: null,
          laborHours: null,
          laborCost: null,
          partsSource: null,
          flags: ["fallback_only"],
          refused: true,
        });
      }
      return {
        fallbackLow: null,
        fallbackHigh: null,
        flags: ["fallback_only", "tier_estimate"],
        refused: true,
        isLoading: false,
        byService,
      };
    }
    const flagSet = new Set<string>();
    const byService = new Map<string, EnginePerService>();
    let anyPerServiceRefused = false;
    for (let i = 0; i < result.quotes.length; i++) {
      const q = result.quotes[i];
      const sid = String(serviceIds[i]);
      if (q.ok) {
        for (const f of q.flags) flagSet.add(f);
        byService.set(sid, {
          partsLow: q.parts.low,
          partsHigh: q.parts.high,
          perUnitLow: q.parts.per_unit_low,
          perUnitHigh: q.parts.per_unit_high,
          unitCount: q.parts.unit_count,
          baselineCount: q.parts.baseline_count,
          unitLabel: q.parts.unit_label,
          laborHours: q.labor.hours,
          laborCost: q.labor.cost,
          partsSource: q.parts.source,
          flags: [...q.flags],
          refused: false,
        });
      } else {
        // Individual service refused (e.g. CCB without brake_system, or
        // a vehicle that isn't classified in pricing_vehicle_assignments).
        // Surface 'fallback_only' at the top level so the booking-level
        // Estimate pill fires even when other services in the series
        // resolved cleanly — otherwise the customer sees no signal at all
        // for an unpriceable line.
        anyPerServiceRefused = true;
        byService.set(sid, {
          partsLow: null,
          partsHigh: null,
          perUnitLow: null,
          perUnitHigh: null,
          unitCount: 1,
          baselineCount: 1,
          unitLabel: null,
          laborHours: null,
          laborCost: null,
          partsSource: null,
          flags: ["fallback_only"],
          refused: true,
        });
      }
    }
    if (anyPerServiceRefused) {
      flagSet.add("fallback_only");
      flagSet.add("tier_estimate");
    }
    return {
      fallbackLow: result.total_low,
      fallbackHigh: result.total_high,
      flags: Array.from(flagSet),
      refused: false,
      isLoading: false,
      byService,
    };
  }, [canQuery, result, serviceIds]);
}
