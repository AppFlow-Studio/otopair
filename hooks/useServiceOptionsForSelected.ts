/**
 * useServiceOptionsForSelected
 *
 * Fetches service_options from Convex for the currently selected services
 * that have has_options: true. Skips the query when no services need options.
 *
 * USED IN: components/booking/sheets/ServiceOptionsContent.tsx
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useBookingStore } from "@/stores/useBookingStore";

export interface ServiceOptionItem {
  _id: string;
  service_id: string;
  option_type: string;
  option_label: string;
  labor_hours: number;
  parts_cost_low: number;
  parts_cost_high: number;
  display_order: number;
  state_fee?: number;
}

export interface ServiceWithOptions {
  serviceId: string;
  serviceName: string;
  options: ServiceOptionItem[];
}

export function useServiceOptionsForSelected() {
  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);
  const availableServices = useBookingStore((s) => s.availableServices);

  // Only query for services that have has_options: true
  const serviceIdsWithOptions = useMemo(() => {
    return selectedServiceIds.filter((id) => {
      const svc = availableServices.find((s) => s.id === id);
      return svc?.has_options === true;
    });
  }, [selectedServiceIds, availableServices]);

  const rawOptions = useQuery(
    api.service_options.getByServiceIds,
    serviceIdsWithOptions.length > 0
      ? { serviceIds: serviceIdsWithOptions as Id<"services">[] }
      : "skip",
  );

  const servicesWithOptions: ServiceWithOptions[] = useMemo(() => {
    if (!rawOptions) return [];
    return rawOptions.map((group) => {
      const svc = availableServices.find((s) => s.id === group.serviceId);
      return {
        serviceId: group.serviceId as string,
        serviceName: svc?.name ?? "Service",
        options: group.options as unknown as ServiceOptionItem[],
      };
    });
  }, [rawOptions, availableServices]);

  return {
    servicesWithOptions,
    isLoading: rawOptions === undefined && serviceIdsWithOptions.length > 0,
    hasOptions: serviceIdsWithOptions.length > 0,
  };
}
