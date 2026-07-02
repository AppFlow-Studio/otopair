/**
 * useVehicleEnrichmentStatus
 *
 * Thin wrapper around `api.vehicles.getEnrichmentStatusByVin`. Returns the
 * server's already-computed status + ETA so the caller doesn't have to
 * know the in-progress status set or the 7-minute baseline.
 *
 * Reactive — when the v3 pipeline writes a new enrichment_status, this
 * hook re-fires automatically (standard Convex `useQuery` semantics).
 *
 * USED IN: app/(booking-flow)/select-services.tsx (in-progress toast)
 */

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";

export interface EnrichmentStatus {
  /** Raw vehicle_configs.enrichment_status value, or null when no config yet. */
  status: string | null;
  /** True iff status ∈ {"enriching", "scraping", "batch1", "batch2", "started"}. */
  isInProgress: boolean;
  /** Best-effort minutes until enrichment finishes (server-computed off the
   *  ~7-min baseline). Capped at min 1. Null when not in-progress. */
  etaMinutes: number | null;
  /** Ms since the pipeline launched. Null when not in-progress. */
  elapsedMs: number | null;
}

/**
 * Returns the enrichment status for a VIN, or `null` while loading / when
 * the VIN doesn't resolve to a vehicle. Pass `null` to skip the query
 * entirely (e.g. before the user has a selected vehicle).
 */
export function useVehicleEnrichmentStatus(
  vin: string | null | undefined,
): EnrichmentStatus | null {
  const result = useQuery(
    api.vehicles.getEnrichmentStatusByVin,
    vin ? { vin } : "skip",
  );
  return (result ?? null) as EnrichmentStatus | null;
}
