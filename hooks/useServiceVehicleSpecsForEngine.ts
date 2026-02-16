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

/**
 * Convex document IDs are alphanumeric strings (e.g. "j57abc…").
 * Mock/slug IDs like "svc_oil_change" contain underscores and are NOT valid.
 * Skip the query when any serviceId looks like a mock slug to avoid
 * ArgumentValidationError from the Convex validator.
 */
function areConvexIds(ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => !id.startsWith("svc_"));
}

export function useServiceVehicleSpecsForEngine(engineId: string | undefined, serviceIds: string[]) {
  const shouldQuery = !!engineId && areConvexIds(serviceIds);

  const convexSpecs = useQuery(
    api.service_vehicle_specs.getSpecsForEngineAndServices,
    shouldQuery
      ? {
          engineId: engineId as Id<"engines">,
          serviceIds: serviceIds as Id<"services">[],
        }
      : "skip",
  );

  return useMemo(() => convexSpecs ?? {}, [convexSpecs]);
}
