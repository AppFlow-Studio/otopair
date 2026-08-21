/**
 * useVehicleOwnershipFromConvex
 *
 * Fetches the current user's vehicles from Convex (vehicle_owners + vehicles)
 * and hydrates useVehicleStore for caching. Use primary vehicle's VIN for bookings.
 *
 * USED IN: Booking flow (to get VIN for Convex create), vehicle selection
 */

import { useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
import { api } from "@/convex/_generated/api";
import { useSessionCachedQuery } from "@/lib/offlineSessionCache";
import { useUserFromConvex } from "./useUserFromConvex";
import { useVehicleStore } from "@/stores/useVehicleStore";

type VehicleOwnershipRow = {
  vin: string;
  vehicle: unknown | null;
  ownership?: { is_primary?: boolean };
};

export function useVehicleOwnershipFromConvex() {
  const { userId, isLoading: isUserLoading } = useUserFromConvex();
  const liveList = useQuery(api.vehicles.listVehiclesByUser, userId ? { userId } : "skip");
  const setVehiclesFromConvex = useVehicleStore((s) => s.setVehiclesFromConvex);
  const clearVehicles = useVehicleStore((s) => s.clearVehicles);

  // Session-scoped offline cache. Offline, `useUserFromConvex` (a Convex
  // query) never resolves, so the live list stays undefined — the cache
  // serves the last online vehicles list while the saved Clerk session
  // is valid, which is what lets the Cars tab (and the per-vehicle
  // maintenance cache underneath it) work on an offline cold start.
  const { value: listVehicles, isFromCache } = useSessionCachedQuery(
    "vehicles_list",
    liveList,
  );

  const primaryVin = useMemo(() => {
    if (!listVehicles || listVehicles.length === 0) return null;
    const primary = listVehicles.find((r: VehicleOwnershipRow) => r.ownership?.is_primary);
    return (primary ?? listVehicles[0]).vin;
  }, [listVehicles]);

  useEffect(() => {
    if (!userId && !isFromCache) {
      // Signed-out (user load finished, no user) — clear. While the
      // user record is merely still loading, leave the store alone so
      // an offline cold start can hydrate from cache below.
      if (!isUserLoading) {
        clearVehicles();
      }
      return;
    }
    if (!listVehicles || listVehicles.length === 0) {
      if (listVehicles?.length === 0) {
        clearVehicles();
      }
      return;
    }
    const valid = listVehicles.filter((r: VehicleOwnershipRow) => r.vehicle != null);
    if (valid.length > 0) setVehiclesFromConvex(valid as Parameters<typeof setVehiclesFromConvex>[0]);
    else clearVehicles();
  }, [clearVehicles, isFromCache, isUserLoading, listVehicles, setVehiclesFromConvex, userId]);

  return {
    vehicles: listVehicles ?? [],
    primaryVin,
    // Serving cache ≠ loading: offline, the user query never settles, so
    // without this carve-out the Cars tab would spinner over cached data.
    isLoading:
      (isUserLoading || (userId ? listVehicles === undefined : false)) && !isFromCache,
    hasVehicles: (listVehicles?.length ?? 0) > 0,
    /** True when the list shown is the offline session cache, not live. */
    isFromCache,
  };
}
