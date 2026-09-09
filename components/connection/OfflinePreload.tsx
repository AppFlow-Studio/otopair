/**
 * OfflinePreload
 *
 * Headless, read-only warm-up for the Bookings + Cars tabs. Subscribes to
 * the SAME `api.*` queries (identical arg shape) those pages render from,
 * so Convex's (query, args) cache dedupe collapses this into ONE shared
 * subscription per query that stays warm across tab switches. If the user
 * drops offline mid-session, each query's last-delivered value is held in
 * memory — so navigating back to Bookings/Cars renders view-only instead
 * of showing nothing (or tripping `useOfflineGuard`'s "can't load" modal).
 *
 * Mounted as a sibling to `HydrateBookingData` in
 * app/(main-tabs)/_layout.tsx. That component hydrates Zustand stores;
 * this one intentionally does not.
 *
 * STRICT rules:
 *  - Read-only. Only `useQuery(...)` calls — no mutations, no `useEffect`
 *    that writes, no Zustand store hydration.
 *  - Does NOT call `useMergedMaintenance` / `useMaintenanceRecords` /
 *    `useUrgencyRankedItems` / any store-hydrating wrapper hook.
 *    `useUrgencyRankedItems` in particular WRITES tier-change events to
 *    Convex as a side effect of being computed — something a background
 *    warmer must never trigger (N times, on every capped vehicle). We
 *    subscribe to the raw `api.*` queries directly instead.
 *  - Deduped by construction: every query below uses the exact `api.*`
 *    function + arg shape the live pages use. Per vehicle that's THREE light
 *    reads — maintenance records, driver-visible recommendations, and OEM
 *    service intervals via the SINGULAR `useOemServiceIntervals` hook (the
 *    same per-active-car read the Cars page issues, so it dedupes; no batch).
 *  - Capped + primary-first: at most `MAX_PRELOADED_VEHICLES` vehicles get
 *    their per-vehicle queries warmed, primary vehicle first. Overflow is
 *    logged, never silently dropped.
 */
import React, { useEffect, useMemo } from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { useOemServiceIntervals } from "@/hooks/useOemServiceIntervals";

/** Hard cap on how many vehicles' per-vehicle queries this preloads. */
const MAX_PRELOADED_VEHICLES = 15;

interface PreloadVehicleKey {
  vin: string;
  vehicleOwnerId: Id<"vehicle_owners">;
  vehicleConfigId: Id<"vehicle_configs"> | undefined;
  isPrimary: boolean;
}

/**
 * Row shape returned by `api.vehicles.listVehiclesByUser`. Declared
 * explicitly (mirrors `useVehicleOwnershipFromConvex.ts`'s
 * `VehicleOwnershipRow`) because the query result resolves loosely through
 * `useQuery` in this codebase, so the `.map()` callback below needs an
 * annotation to avoid an implicit `any`.
 */
type VehicleListRow = {
  vin: string;
  vehicle: { vehicle_config_id?: Id<"vehicle_configs"> } | null;
  ownership: { _id: Id<"vehicle_owners">; is_primary?: boolean };
};

export function OfflinePreload() {
  const { userId } = useUserFromConvex();

  // The 4 userId-keyed queries Bookings + Cars render from (see
  // useMyBookingsWithDetails, app/settings/past-service via reviews, and
  // the Cars HP-buffer + carousel queries). Fire-and-forget: we only need
  // Convex to hold each one's cache entry warm, not the resolved value.
  useQuery(api.bookings.getByUserIdWithDetails, userId ? { userId } : "skip");
  useQuery(api.reviews.listReviewedBookingIdsForUser, userId ? { userId } : "skip");
  useQuery(api.healthPoints.getPointsForUser, userId ? { userId } : "skip");
  // This one's value IS needed — it's the source of the per-vehicle keys below.
  const vehiclesList = useQuery(api.vehicles.listVehiclesByUser, userId ? { userId } : "skip");

  const { preloadVehicles, skippedCount } = useMemo(() => {
    if (!vehiclesList || vehiclesList.length === 0) {
      return { preloadVehicles: [] as PreloadVehicleKey[], skippedCount: 0 };
    }
    const keyed: PreloadVehicleKey[] = vehiclesList.map((r: VehicleListRow) => ({
      vin: r.vin,
      vehicleOwnerId: r.ownership._id,
      vehicleConfigId: r.vehicle?.vehicle_config_id ?? undefined,
      isPrimary: r.ownership.is_primary ?? false,
    }));
    // Primary first, then stable VIN order — mirrors the Cars carousel sort
    // (app/(main-tabs)/cars/index.tsx) so the vehicle most likely to be
    // viewed offline is guaranteed to be warm under the cap.
    keyed.sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
      return a.vin.localeCompare(b.vin);
    });
    return {
      preloadVehicles: keyed.slice(0, MAX_PRELOADED_VEHICLES),
      skippedCount: Math.max(0, keyed.length - MAX_PRELOADED_VEHICLES),
    };
  }, [vehiclesList]);

  useEffect(() => {
    if (skippedCount > 0) {
      console.log(
        `[OfflinePreload] ${skippedCount} vehicle(s) beyond the ${MAX_PRELOADED_VEHICLES}-vehicle cap were not preloaded.`,
      );
    }
  }, [skippedCount]);

  // OEM intervals are warmed per-vehicle inside VehiclePreloadRow via the
  // SINGULAR useOemServiceIntervals hook — the same (query + args) the Cars
  // page uses for its active car — so each car's OEM read dedupes with the
  // page instead of a batch query the page never issues. See the row below.

  return (
    <>
      {preloadVehicles.map((v) => (
        <VehiclePreloadRow
          key={v.vin}
          vehicleOwnerId={v.vehicleOwnerId}
          vin={v.vin}
          vehicleConfigId={v.vehicleConfigId}
        />
      ))}
    </>
  );
}

interface VehiclePreloadRowProps {
  vehicleOwnerId: Id<"vehicle_owners"> | undefined;
  vin: string | undefined;
  vehicleConfigId: Id<"vehicle_configs"> | undefined;
}

/**
 * One instance per preloaded vehicle. Fanning the per-vehicle queries out
 * to a child component (rather than looping useQuery calls in the parent)
 * is what keeps this Rules-of-Hooks-safe for a variable-length vehicle list.
 *
 * Three light read-only subscriptions per vehicle — records, driver-visible
 * recommendations, and OEM service intervals — each a byte-for-byte match
 * with the Cars page's real call sites, so Convex shares one subscription
 * per (query + args) rather than double-fetching.
 */
function VehiclePreloadRow({ vehicleOwnerId, vin, vehicleConfigId }: VehiclePreloadRowProps) {
  useQuery(api.maintenance.getRecordsByVehicle, vehicleOwnerId ? { vehicleOwnerId } : "skip");
  useQuery(api.jobRecommendations.getDriverVisibleRecsForVehicle, vin ? { vin } : "skip");
  // Singular OEM-intervals read — same (query + args) the Cars page issues
  // for its ACTIVE car, so this dedupes with the page and warms every car's
  // OEM intervals for offline. Read-only hook; the return value is ignored
  // on purpose — the point is the live subscription, not the map.
  useOemServiceIntervals(vehicleConfigId ?? null);
  return null;
}
