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
import { formatServiceDisplayName } from "@/utils/serviceDisplayName";

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
    // `service_name` is resolved server-side off the `services` table, which
    // still reads "Timing Belt". See utils/serviceDisplayName.ts.
    // Spread, don't re-type: the server returns fields this interface never
    // declared (`selected_service_option`, `tire_specs`), and callers cast to
    // their own shapes to read them. Narrowing here would drop them.
    recommendations: (recommendations ?? []).map((r) => ({
      ...r,
      service_name: formatServiceDisplayName(
        (r as { service_name?: string }).service_name,
      ),
    })),
    isLoading: vin != null && recommendations === undefined,
  };
}
