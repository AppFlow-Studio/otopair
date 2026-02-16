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
import type { Id } from "@/convex/_generated/dataModel";
import { useUserFromConvex } from "./useUserFromConvex";
import { useVehicleStore } from "@/stores/useVehicleStore";

export function useVehicleOwnershipFromConvex() {
  const { userId } = useUserFromConvex();
  const listVehicles = useQuery(api.vehicles.listVehiclesByUser, userId ? { userId } : "skip");
  const setVehiclesFromConvex = useVehicleStore((s) => s.setVehiclesFromConvex);

  const primaryVin = useMemo(() => {
    if (!listVehicles || listVehicles.length === 0) return null;
    const primary = listVehicles.find((r) => r.ownership?.is_primary);
    return (primary ?? listVehicles[0]).vin;
  }, [listVehicles]);

  useEffect(() => {
    if (!listVehicles || listVehicles.length === 0) return;
    const valid = listVehicles.filter((r) => r.vehicle != null);
    if (valid.length > 0) setVehiclesFromConvex(valid as Parameters<typeof setVehiclesFromConvex>[0]);
  }, [listVehicles, setVehiclesFromConvex]);

  return {
    vehicles: listVehicles ?? [],
    primaryVin,
    isLoading: listVehicles === undefined,
    hasVehicles: (listVehicles?.length ?? 0) > 0,
    hasConnectedVehicle: (listVehicles ?? []).some((r) => r.connectionStatus === "connected"),
  };
}
