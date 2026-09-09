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

import { useEffect, useMemo } from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type {
  OemServiceIntervalMap,
  VehicleFallbackProfile,
} from "@/convex/service_intervals_queries";
import {
  CONSERVATIVE_DEFAULTS_MI,
  SERVICE_INTERVAL_BOUNDS_MI,
  safeInterval,
} from "@/utils/serviceIntervalGuardrails";

const EMPTY_MAP: OemServiceIntervalMap = {};
const EMPTY_BATCH: Record<string, OemServiceIntervalMap> = {};

// Dev-only: dedupe enrichment logs so we print each vehicle_config once.
const LOGGED_CONFIGS = new Set<string>();

function logEnrichmentIntervals(
  vehicleConfigId: string,
  intervals: OemServiceIntervalMap,
) {
  if (!__DEV__) return;
  if (LOGGED_CONFIGS.has(vehicleConfigId)) return;
  const slugs = Object.keys(intervals);
  if (slugs.length === 0) {
    // Log once so we can distinguish "hook never mounted" from
    // "hook mounted, query returned empty (config-id mismatch or
    // enrichment hasn't written rows yet)". Don't add to dedupe set
    // so a later populated result still fires the full table.
    console.log(
      `[maintenance-enrichment] vehicle_config=${vehicleConfigId} — query returned EMPTY (no service_intervals rows for this config yet)`,
    );
    return;
  }
  LOGGED_CONFIGS.add(vehicleConfigId);

  const rows = slugs.sort().map((slug) => {
    const iv = intervals[slug] as {
      interval_miles?: number | null;
      interval_months?: number | null;
      confidence?: number | null;
      mechanic_verified?: boolean;
    };
    const bounds = SERVICE_INTERVAL_BOUNDS_MI[slug];
    const bounded = safeInterval({
      slug,
      interval_miles: iv.interval_miles ?? null,
      confidence: iv.confidence,
      mechanic_verified: iv.mechanic_verified,
    });
    let action = "pass-through";
    if (iv.interval_miles == null || iv.interval_miles <= 0) {
      action = CONSERVATIVE_DEFAULTS_MI[slug] != null
        ? `default-${CONSERVATIVE_DEFAULTS_MI[slug]}`
        : "anchorless";
    } else {
      const trusted =
        iv.mechanic_verified === true || (iv.confidence ?? 0) >= 0.75;
      if (!trusted) {
        action = bounds ? `low-conf → floor ${bounds[0]}` : "low-conf pass";
      } else if (bounds) {
        if (iv.interval_miles < bounds[0]) action = `clamp → floor ${bounds[0]}`;
        else if (iv.interval_miles > bounds[1]) action = `clamp → ceiling ${bounds[1]}`;
      }
    }
    return {
      slug,
      miles: iv.interval_miles ?? null,
      months: iv.interval_months ?? null,
      conf: iv.confidence ?? null,
      verified: iv.mechanic_verified ?? false,
      bounded,
      action,
    };
  });

  console.log(
    `[maintenance-enrichment] vehicle_config=${vehicleConfigId} — ${rows.length} service(s):`,
  );
  // Metro strips `console.table` — print each row as a plain string so it survives.
  for (const r of rows) {
    console.log(
      `  ${r.slug.padEnd(28)} miles=${String(r.miles).padEnd(8)} months=${String(r.months).padEnd(6)} conf=${String(r.conf).padEnd(5)} verified=${String(r.verified).padEnd(6)} bounded=${String(r.bounded).padEnd(8)} action=${r.action}`,
    );
  }
}

export function useOemServiceIntervals(
  vehicleConfigId: Id<"vehicle_configs"> | null | undefined,
): OemServiceIntervalMap {
  const result = useQuery(
    api.service_intervals_queries.getServiceIntervalsForVehicleConfig,
    vehicleConfigId ? { vehicle_config_id: vehicleConfigId } : "skip",
  );
  // The query now returns { intervals, profile } so the class data lands in
  // the same snapshot as the intervals — see VehicleIntervalEnvelope. This
  // hook's signature is unchanged on purpose: every existing caller wants the
  // map, and `useVehicleFallbackProfile` below reads the SAME (query, args)
  // pair, which Convex resolves to one shared subscription.
  const intervals = result?.intervals ?? EMPTY_MAP;

  useEffect(() => {
    if (!__DEV__) return;
    if (!vehicleConfigId) {
      console.log(
        "[maintenance-enrichment] hook mounted with NULL vehicleConfigId — active vehicle has no resolved vehicle_configs row yet (enrichment scheduled but pipeline hasn't landed).",
      );
      return;
    }
    if (result === undefined) {
      console.log(
        `[maintenance-enrichment] vehicle_config=${vehicleConfigId} — query LOADING…`,
      );
      return;
    }
    logEnrichmentIntervals(String(vehicleConfigId), intervals);
  }, [vehicleConfigId, result, intervals]);

  // `undefined` while loading; treat the same as "no enrichment yet"
  // so the maintenance calc falls back instead of flickering. The
  // Convex reactivity will re-run computeMaintenanceStatus once the
  // map lands.
  return intervals;
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
  const batch = useMemo<Record<string, OemServiceIntervalMap>>(() => {
    if (!result) return EMPTY_BATCH;
    const out: Record<string, OemServiceIntervalMap> = {};
    for (const [cfgId, envelope] of Object.entries(result)) {
      out[cfgId] = envelope.intervals;
    }
    return out;
  }, [result]);

  useEffect(() => {
    for (const configId of Object.keys(batch)) {
      logEnrichmentIntervals(configId, batch[configId]);
    }
  }, [batch]);

  return batch;
}

/**
 * The vehicle's interval-class profile — class, drivetrain, turbo, fuel.
 *
 * Reads the same query and args as `useOemServiceIntervals`, so Convex serves
 * both from one subscription: no extra round trip, and the class can never
 * arrive in a different render than the intervals it selects a column from.
 *
 * Returns null while loading or when the vehicle has no resolved config, which
 * callers should treat as "no class data" and fall back rather than guess.
 */
export function useVehicleFallbackProfile(
  vehicleConfigId: Id<"vehicle_configs"> | null | undefined,
): VehicleFallbackProfile | null {
  const result = useQuery(
    api.service_intervals_queries.getServiceIntervalsForVehicleConfig,
    vehicleConfigId ? { vehicle_config_id: vehicleConfigId } : "skip",
  );
  return result?.profile ?? null;
}
