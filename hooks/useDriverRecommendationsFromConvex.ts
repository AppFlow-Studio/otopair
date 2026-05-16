/**
 * useDriverRecommendationsFromConvex
 *
 * Wraps api.jobRecommendations.getDriverVisibleRecsForVehicle to surface
 * mechanic-submitted job recommendations (cross-shop deduped) for the
 * active vehicle. Consumed by the Cars tab MaintenanceTracker.
 *
 * USED IN: app/(main-tabs)/cars/index.tsx
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useDriverRecommendationsFromConvex(vin: string | null | undefined) {
  const recommendations = useQuery(
    api.jobRecommendations.getDriverVisibleRecsForVehicle,
    vin ? { vin } : "skip",
  );

  return {
    recommendations: recommendations ?? [],
    isLoading: vin != null && recommendations === undefined,
  };
}
