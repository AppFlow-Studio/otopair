/**
 * useServicesFromConvex
 *
 * Fetches services from Convex (api.services.list, optional api.service_categories.list),
 * maps to store Service[] with id as string (Convex _id), and hydrates useBookingStore.
 * Price estimate: (default_labor_hours × defaultLaborRate) + defaultParts + tax + fees.
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

const DEFAULT_LABOR_RATE = 80;
const DEFAULT_PARTS = 0;
const TAX_AND_FEES = 0;

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
 * id = doc._id as string, price = labor estimate + parts + fees.
 */
function mapConvexServiceToStore(doc: {
  _id: Id<"services">;
  name: string;
  description: string;
  default_labor_hours: number;
  default_parts_estimate?: number;
  serviceCategory?: { name?: string } | null;
}): Service {
  const category = mapCategoryNameToKey(doc.serviceCategory?.name);
  const parts = doc.default_parts_estimate ?? DEFAULT_PARTS;
  const laborCost = doc.default_labor_hours * DEFAULT_LABOR_RATE;
  const price = laborCost + parts + TAX_AND_FEES;
  return {
    id: doc._id,
    name: doc.name,
    description: doc.description,
    price,
    category,
    default_labor_hours: doc.default_labor_hours,
    default_parts_estimate: parts,
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
          description: string;
          default_labor_hours: number;
          default_parts_estimate?: number;
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
