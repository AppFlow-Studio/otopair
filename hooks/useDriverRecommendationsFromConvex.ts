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

/** Shape returned by api.jobRecommendations.getDriverVisibleRecsForVehicle. */
export interface DriverRecommendation {
  _id: string;
  service_id: string | null;
  service_name: string;
  urgency: "next_visit" | "within_3_months" | "soon";
  reason: string | null;
  shop_id: string;
  shop_name: string | null;
  mechanic_id: string;
  mechanic_name: string | null;
  created_at: number;
  source_recommendation_id: string;
  target_mileage?: number | null;
  scheduled_at?: number | null;
  scheduled_mechanic_id?: string | null;
  scheduled_mechanic_name?: string | null;

  /** Advisory fields. The server has always returned these; the interface
   *  simply didn't declare them, so they were dropped on the floor and every
   *  advisory rendered as if it were a bookable catalog service. */
  kind?: "advisory" | "canonical";
  bookable?: boolean;
  disclaimer?: string | null;
  author_label?: string | null;
  aged?: boolean;
}

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
