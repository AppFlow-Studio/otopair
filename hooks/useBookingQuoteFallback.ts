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
};

const EMPTY_FLAGS: string[] = [];

export function useBookingQuoteFallback(
  shopId: string | null | undefined,
  vehicleOwnerId: string | null | undefined,
  serviceIds: string[],
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
      };
    }
    if (!result.ok) {
      return {
        fallbackLow: null,
        fallbackHigh: null,
        flags: ["fallback_only", "tier_estimate"],
        refused: true,
        isLoading: false,
      };
    }
    const flagSet = new Set<string>();
    for (const q of result.quotes) {
      if (!q.ok) continue;
      for (const f of q.flags) flagSet.add(f);
    }
    return {
      fallbackLow: result.total_low,
      fallbackHigh: result.total_high,
      flags: Array.from(flagSet),
      refused: false,
      isLoading: false,
    };
  }, [canQuery, result]);
}
