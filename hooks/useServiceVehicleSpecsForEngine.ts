/**
 * useServiceVehicleSpecsForEngine
 *
 * Fetches car-specific (engine-specific) labor/parts specs for selected services.
 * Used for price formula: (labor_rate × labor_hours) + parts.
 * Falls back to services.default_labor_hours + service_options when no engine spec exists.
 *
 * USED IN: MechanicSelectionContent (when building selectedServicesForCard)
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function useServiceVehicleSpecsForEngine(
  engineId: string | undefined,
  serviceIds: string[],
) {
  const convexSpecs = useQuery(
    api.service_vehicle_specs.getSpecsForEngineAndServices,
    engineId && serviceIds.length > 0
      ? {
          engineId: engineId as Id<"engines">,
          serviceIds: serviceIds as Id<"services">[],
        }
      : "skip",
  );

  return useMemo(() => convexSpecs ?? {}, [convexSpecs]);
}
