/**
 * useMaintenanceData
 *
 * PURPOSE:
 * Builds a MaintenanceItem[] array for the MaintenanceTracker UI from
 * user-provided maintenance records in Convex.
 *
 * LOGIC:
 * 1. Fetch user-provided records from Convex (maintenance_records table)
 * 2. For each of the 7 maintenance types:
 *    - If user has a record → compute status from record
 *    - Else → emit "unknown" item (prompts user to "Add Info")
 *
 * USED IN: app/(main-tabs)/cars/index.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";

import { useBookingStore } from "@/stores/useBookingStore";
import type { VehicleFallbackProfile } from "@/convex/service_intervals_queries";
import type { IntervalClassContext } from "@/utils/maintenanceStatus";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSessionCachedQuery } from "@/lib/offlineSessionCache";
import type {
  MaintenanceItem,
  MaintenanceTriggerAxis,
} from "@/components/cars/MaintenanceTracker";
import {
  type MaintenanceType,
  type OemServiceIntervalsInput,
} from "@/utils/maintenanceStatus";
import { buildMaintenanceItems } from "@/utils/maintenanceEnrichment";
import {
  buildMergedMaintenanceItems,
  type DriverRecommendationLike,
} from "@/utils/mergedMaintenance";


// ============================================================================
// TYPES
// ============================================================================

interface MaintenanceRecord {
  _id: Id<"maintenance_records">;
  type: string;
  lastServiceDate?: number;
  lastServiceMileage?: number;
  customInputs?: Record<string, unknown>;
  confirmedHealthyAt?: number;
}

// ============================================================================
// HOOK: useMaintenanceRecords
// ============================================================================

/**
 * Fetches all maintenance_records for a vehicle and converts each to a MaintenanceItem
 * using the status calculation logic.
 */
export function useMaintenanceRecords(
  vehicleOwnerId: Id<"vehicle_owners"> | undefined,
  currentOdometer: number | null,
  make?: string,
  drivingConditions?: string,
  avgMonthlyDriving?: string,
  knownIssues?: string[],
  vehicleYear?: number,
  // Slug-keyed OEM intervals from the v3 enrichment pipeline (see
  // `useOemServiceIntervals`). Forwarded through buildMaintenanceItems
  // so the maintenance status calc can prefer per-vehicle OEM cadences
  // over the hardcoded fallback chain.
  oemIntervals?: OemServiceIntervalsInput,
  /** Interval class + drivetrain / turbo, from `useVehicleFallbackProfile`.
   *  Omitted → the class table is skipped and the old tier order applies. */
  classCtx?: IntervalClassContext,
) {
  const liveRecords = useQuery(
    api.maintenance.getRecordsByVehicle,
    vehicleOwnerId ? { vehicleOwnerId } : "skip"
  );

  // Session-scoped offline cache, keyed per vehicle — lets the car
  // health ring render on an offline cold start while the saved Clerk
  // session is still valid (see lib/offlineSessionCache.ts).
  const { value: records } = useSessionCachedQuery(
    vehicleOwnerId ? `maintenance_records:${String(vehicleOwnerId)}` : null,
    liveRecords,
  );

  const items = useMemo(() => {
    if (!records) return new Map<MaintenanceType, MaintenanceItem>();
    return buildMaintenanceItems(
      records.map((rec) => ({
        type: rec.type,
        lastServiceDate: rec.lastServiceDate ?? undefined,
        lastServiceMileage: rec.lastServiceMileage ?? undefined,
        customInputs: rec.customInputs as Record<string, unknown> | undefined,
        confirmedHealthyAt: rec.confirmedHealthyAt ?? undefined,
      })),
      currentOdometer,
      make,
      drivingConditions,
      avgMonthlyDriving,
      knownIssues,
      vehicleYear,
      oemIntervals,
      classCtx,
    );
  }, [records, currentOdometer, make, drivingConditions, avgMonthlyDriving, knownIssues, vehicleYear, oemIntervals, classCtx]);

  return { records, items };
}

// ============================================================================
// HOOK: useMergedMaintenance
// ============================================================================

/**
 * Main hook for the My Cars page. Builds a MaintenanceItem[] covering
 * all 7 maintenance types from user-provided records, falling back to
 * "unknown" entries when no record exists.
 *
 * @param vehicleOwnerId - The active vehicle's ownership ID
 * @param currentOdometer - Current odometer in miles
 * @param make - Vehicle make (e.g. "Volkswagen") for per-make interval overrides
 * @param drivingConditions - "city" | "highway" | "mixed" — adjusts intervals
 */
export function useMergedMaintenance(
  vehicleOwnerId: Id<"vehicle_owners"> | undefined,
  currentOdometer: number | null,
  make?: string,
  drivingConditions?: string,
  avgMonthlyDriving?: string,
  knownIssues?: string[],
  vehicleYear?: number,
  driverRecommendations?: DriverRecommendationLike[],
  // OEM intervals from `useOemServiceIntervals(activeOwnership?.vehicle_config_id)`.
  // Forwarded into useMaintenanceRecords → buildMaintenanceItems →
  // computeMaintenanceStatus → getInterval. Optional; falls back to
  // MAKE_OVERRIDES / DEFAULT_INTERVALS when undefined or empty.
  oemIntervals?: OemServiceIntervalsInput,
  /** Per-config class profile — see `useVehicleFallbackProfile`. */
  fallbackProfile?: VehicleFallbackProfile | null,
) {
  // A BEV is out of scope entirely (Fallback v2 §2): with no class the class
  // table never runs for one, and the old tier order applies untouched.
  const classCtx = useMemo<IntervalClassContext | undefined>(() => {
    if (!fallbackProfile || fallbackProfile.fuelClass === "bev") return undefined;
    return {
      vehicleClass: fallbackProfile.vehicleClass,
      drivetrain: fallbackProfile.drivetrain,
      hasDifferential: fallbackProfile.hasDifferential,
      turbo: fallbackProfile.turbo,
    };
  }, [fallbackProfile]);

  // Resolves a rec's service_id to its taxonomy slug so the merge can tell
  // when a recommendation and an eye-check tile are the same finding. Reads
  // the catalog the booking flow already loads; identity is stable per
  // catalog so the memo below doesn't thrash.
  const availableServices = useBookingStore((st) => st.availableServices);
  const serviceSlugById = useMemo(() => {
    const bySlug = new Map<string, string>();
    for (const svc of availableServices) {
      if (svc.id && svc.slug) bySlug.set(String(svc.id), String(svc.slug));
    }
    return (serviceId: string) => bySlug.get(serviceId);
  }, [availableServices]);

  const { records, items: userItems } = useMaintenanceRecords(vehicleOwnerId, currentOdometer, make, drivingConditions, avgMonthlyDriving, knownIssues, vehicleYear, oemIntervals, classCtx);

  // Merge via the single shared builder — the SAME function Oto's
  // get_vehicle_health uses to compute the score it quotes, so the number Oto
  // states matches this ring with zero drift (utils/mergedMaintenance.ts).
  const mergedItems = useMemo(
    () =>
      buildMergedMaintenanceItems({
        userItems,
        records: records ?? undefined,
        knownIssues,
        vehicleYear,
        driverRecommendations,
        scopeId: vehicleOwnerId ? String(vehicleOwnerId) : undefined,
        // Proposal Behaviors #6/#7 — anchored signal pills plus the
        // from-odometer catalog coverage pass. Oto's server-side score
        // omits both and keeps the anchored-only item set.
        currentOdometer,
        oemIntervals,
        serviceSlugById,
      }),
    [
      userItems,
      records,
      knownIssues,
      vehicleYear,
      serviceSlugById,
      driverRecommendations,
      vehicleOwnerId,
      currentOdometer,
      oemIntervals,
    ],
  );

  // Expose raw records so the modal can pre-fill from existing data
  const recordsByType = useMemo(() => {
    const map = new Map<string, MaintenanceRecord>();
    if (records) {
      for (const rec of records) {
        map.set(rec.type, rec as MaintenanceRecord);
      }
    }
    return map;
  }, [records]);

  return { mergedItems, recordsByType };
}
