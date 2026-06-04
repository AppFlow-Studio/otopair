/**
 * useServicesFromConvex
 *
 * Fetches services from Convex (api.services.list, optional api.service_categories.list),
 * maps to store Service[] with id as string (Convex _id), and hydrates useBookingStore.
 * Price: parts only (no labor rate without shop). Labor is computed with shop.labor_rate where shop is known.
 *
 * USED IN: Layout or home entry to hydrate availableServices; gates MOCK_SERVICES when Convex data is present.
 */

import { useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ServiceCategory } from "@/stores/types/store.types";
import type { Service } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";

/** Map Convex category name to app ServiceCategory */
function mapCategoryNameToKey(name: string | undefined): ServiceCategory {
  if (!name) return "basic_maintenance";
  const n = name.toLowerCase();
  if (n.includes("tire") || n.includes("wheel")) return "tires_wheels";
  if (n.includes("brake") || n.includes("suspension")) return "brakes_suspension";
  if (n.includes("diagnostic") || n.includes("system")) return "system_diagnostics";
  return "basic_maintenance";
}

/**
 * Map a Convex service doc (with serviceCategory, default_parts_estimate) to store Service.
 * No fallbacks: use DB default_labor_hours and default_parts_estimate as-is.
 * price = parts only (for display where labor is computed separately).
 */
function mapConvexServiceToStore(doc: {
  _id: Id<"services">;
  name: string;
  slug?: string;
  description: string;
  default_labor_hours: number;
  default_parts_estimate?: number;
  has_options?: boolean;
  serviceCategory?: { name?: string } | null;
}): Service {
  const category = mapCategoryNameToKey(doc.serviceCategory?.name);
  const default_parts_estimate = doc.default_parts_estimate;
  return {
    id: doc._id,
    slug: doc.slug,
    name: doc.name,
    description: doc.description,
    price: default_parts_estimate ?? 0,
    category,
    default_labor_hours: doc.default_labor_hours,
    default_parts_estimate,
    has_options: doc.has_options,
  };
}

/**
 * Fetches services from Convex and hydrates the booking store.
 * When Convex data is loaded, setAvailableServices is called (replacing/gating MOCK_SERVICES).
 */
export function useServicesFromConvex() {
  const convexServices = useQuery(api.services.list);
  const setAvailableServices = useBookingStore((s) => s.setAvailableServices);

  const services: Service[] = useMemo(() => {
    if (!convexServices || !Array.isArray(convexServices)) return [];
    return convexServices.map((doc) =>
      mapConvexServiceToStore(
        doc as {
          _id: Id<"services">;
          name: string;
          slug?: string;
          description: string;
          default_labor_hours: number;
          default_parts_estimate?: number;
          has_options?: boolean;
          serviceCategory?: { name?: string } | null;
        },
      ),
    );
  }, [convexServices]);

  useEffect(() => {
    if (services.length > 0) {
      setAvailableServices(services);
    }
  }, [services, setAvailableServices]);

  return {
    services,
    isLoading: convexServices === undefined,
    error: convexServices === null ? "Failed to load services" : null,
  };
}
