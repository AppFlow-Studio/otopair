/**
 * useOemServiceIntervals — read-side hook for the OEM service
 * intervals produced by the v3 enrichment pipeline.
 *
 * Returns a slug-keyed map of `{ interval_miles, interval_months,
 * confidence, mechanic_verified }`. Callers pass this map into
 * `computeMaintenanceStatus` (via `buildMaintenanceItems` →
 * `useMergedMaintenance`) so the tracker can prefer per-vehicle OEM
 * cadences over the hardcoded `DEFAULT_INTERVALS` / `MAKE_OVERRIDES`
 * in `utils/maintenanceStatus.ts`.
 *
 * When `vehicle_config_id` is null/undefined (newly added cars in the
 * ~7-min enrichment window, or vehicles the pipeline hasn't covered),
 * the hook returns `{}` and the maintenance calculator transparently
 * falls back to its existing chain — no UI states to handle.
 *
 * Two variants:
 *  - `useOemServiceIntervals(vehicleConfigId)` for the active vehicle
 *    on the Cars tab.
 *  - `useOemServiceIntervalsBatch(vehicleConfigIds)` for Home's
 *    per-vehicle aggregation loop. Single network round-trip instead
 *    of one query per vehicle.
 */

import { useMemo } from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { OemServiceIntervalMap } from "@/convex/service_intervals_queries";

const EMPTY_MAP: OemServiceIntervalMap = {};
const EMPTY_BATCH: Record<string, OemServiceIntervalMap> = {};

export function useOemServiceIntervals(
  vehicleConfigId: Id<"vehicle_configs"> | null | undefined,
): OemServiceIntervalMap {
  const result = useQuery(
    api.service_intervals_queries.getServiceIntervalsForVehicleConfig,
    vehicleConfigId ? { vehicle_config_id: vehicleConfigId } : "skip",
  );
  // `undefined` while loading; treat the same as "no enrichment yet"
  // so the maintenance calc falls back instead of flickering. The
  // Convex reactivity will re-run computeMaintenanceStatus once the
  // map lands.
  return result ?? EMPTY_MAP;
}

export function useOemServiceIntervalsBatch(
  vehicleConfigIds: readonly Id<"vehicle_configs">[] | null | undefined,
): Record<string, OemServiceIntervalMap> {
  // Memoize the ids array so Convex doesn't re-fetch on every parent
  // render due to a fresh reference. The contents matter, not the
  // array identity.
  const idsKey = useMemo(
    () => (vehicleConfigIds ?? []).map(String).sort().join(","),
    [vehicleConfigIds],
  );
  const stableIds = useMemo<Id<"vehicle_configs">[]>(
    () => (vehicleConfigIds ?? []).slice(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idsKey],
  );

  const result = useQuery(
    api.service_intervals_queries.getServiceIntervalsForVehicleConfigs,
    stableIds.length > 0 ? { vehicle_config_ids: stableIds } : "skip",
  );
  return result ?? EMPTY_BATCH;
}
