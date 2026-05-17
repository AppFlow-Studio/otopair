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
import { useUserFromConvex } from "./useUserFromConvex";
import { useVehicleStore } from "@/stores/useVehicleStore";

type VehicleOwnershipRow = {
  vin: string;
  vehicle: unknown | null;
  ownership?: { is_primary?: boolean };
};

export function useVehicleOwnershipFromConvex() {
  const { userId, isLoading: isUserLoading } = useUserFromConvex();
  const listVehicles = useQuery(api.vehicles.listVehiclesByUser, userId ? { userId } : "skip");
  const setVehiclesFromConvex = useVehicleStore((s) => s.setVehiclesFromConvex);
  const clearVehicles = useVehicleStore((s) => s.clearVehicles);

  const primaryVin = useMemo(() => {
    if (!listVehicles || listVehicles.length === 0) return null;
    const primary = listVehicles.find((r: VehicleOwnershipRow) => r.ownership?.is_primary);
    return (primary ?? listVehicles[0]).vin;
  }, [listVehicles]);

  useEffect(() => {
    if (!userId) {
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
  }, [clearVehicles, isUserLoading, listVehicles, setVehiclesFromConvex, userId]);

  return {
    vehicles: listVehicles ?? [],
    primaryVin,
    isLoading: isUserLoading || (userId ? listVehicles === undefined : false),
    hasVehicles: (listVehicles?.length ?? 0) > 0,
  };
}
