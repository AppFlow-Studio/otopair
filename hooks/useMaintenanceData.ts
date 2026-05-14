/**
 * useMaintenanceData
 *
 * PURPOSE:
 * Merges Smartcar-derived maintenance items with user-provided maintenance records
 * into a unified MaintenanceItem[] array for the MaintenanceTracker UI.
 *
 * LOGIC:
 * 1. Fetch user-provided records from Convex (maintenance_records table)
 * 2. Get Smartcar-derived items from useSmartcarData
 * 3. For each of the 7 maintenance types:
 *    - If Smartcar provides it → use Smartcar item
 *    - Else if user has a record → compute status from record
 *    - Else → emit "unknown" item (prompts user to "Add Info")
 *
 * USED IN: app/(main-tabs)/cars/index.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MaintenanceItem } from "@/components/cars/MaintenanceTracker";
import {
  ALL_MAINTENANCE_TYPES,
  MAINTENANCE_LABELS,
  SMARTCAR_ID_TO_TYPE,
  type MaintenanceType,
} from "@/utils/maintenanceStatus";
import { buildMaintenanceItems, enrichUrgentItem } from "@/utils/maintenanceEnrichment";

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
  knownIssues?: string[]
) {
  const records = useQuery(
    api.maintenance.getRecordsByVehicle,
    vehicleOwnerId ? { vehicleOwnerId } : "skip"
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
    );
  }, [records, currentOdometer, make, drivingConditions, avgMonthlyDriving, knownIssues]);

  return { records, items };
}

// ============================================================================
// HOOK: useMergedMaintenance
// ============================================================================

/**
 * Main hook for the My Cars page. Merges Smartcar items + user records into
 * a single MaintenanceItem[] covering all 7 maintenance types.
 *
 * @param smartcarItems - Items derived from Smartcar data (from useSmartcarData)
 * @param vehicleOwnerId - The active vehicle's ownership ID
 * @param currentOdometer - Current odometer in miles (from Smartcar, if available)
 * @param make - Vehicle make (e.g. "Volkswagen") for per-make interval overrides
 * @param drivingConditions - "city" | "highway" | "mixed" — adjusts intervals
 */
export function useMergedMaintenance(
  smartcarItems: MaintenanceItem[],
  vehicleOwnerId: Id<"vehicle_owners"> | undefined,
  currentOdometer: number | null,
  make?: string,
  drivingConditions?: string,
  avgMonthlyDriving?: string,
  knownIssues?: string[],
  vehicleYear?: number
) {
  const { records, items: userItems } = useMaintenanceRecords(vehicleOwnerId, currentOdometer, make, drivingConditions, avgMonthlyDriving, knownIssues);

  // Build a lookup of Smartcar items by our type key
  const smartcarByType = useMemo(() => {
    const map = new Map<string, MaintenanceItem>();
    for (const item of smartcarItems) {
      const type = SMARTCAR_ID_TO_TYPE[item.id];
      if (type) map.set(type, item);
    }
    return map;
  }, [smartcarItems]);

  // Merge: Smartcar > user record > unknown
  const mergedItems = useMemo(() => {
    const result: MaintenanceItem[] = [];

    for (const type of ALL_MAINTENANCE_TYPES) {
      const smartcarItem = smartcarByType.get(type);
      const userItem = userItems.get(type);

      // If user recently reported service or confirmed healthy, their record wins
      // because Smartcar sensors may not have refreshed yet
      const userRecord = records?.find((r: MaintenanceRecord) => r.type === type);
      const userServicedRecently =
        userRecord?.lastServiceDate &&
        Date.now() - userRecord.lastServiceDate < 7 * 24 * 60 * 60 * 1000;
      const userConfirmedHealthy =
        userRecord?.confirmedHealthyAt &&
        Date.now() - userRecord.confirmedHealthyAt < 90 * 24 * 60 * 60 * 1000;

      // Priority 1: Recent user service report or confirmed healthy overrides Smartcar
      if ((userServicedRecently || userConfirmedHealthy) && userItem) {
        // Force on_time when user explicitly confirmed healthy in check-in
        if (userConfirmedHealthy && userItem.status !== "on_time") {
          result.push({
            ...userItem,
            status: "on_time",
            description: "Confirmed in good shape",
            detail: "On time",
          });
        } else {
          result.push(userItem);
        }
        continue;
      }

      // Priority 2: Smartcar data
      if (smartcarItem) {
        result.push(smartcarItem);
        continue;
      }

      // Priority 3: User-provided record
      if (userItem) {
        result.push(userItem);
        continue;
      }

      // Priority 3: No record — check for warning lights that should escalate
      const WARNING_LIGHT_FOR_TYPE: Partial<Record<MaintenanceType, { lightId: string; label: string }>> = {
        oil: { lightId: "oil_pressure", label: "Oil pressure warning light active — service urgently needed" },
        battery: { lightId: "battery_charging", label: "Battery/charging warning light active — have it tested soon" },
        brakes: { lightId: "abs", label: "ABS / brake warning light active — have brakes inspected soon" },
        tires: { lightId: "tpms", label: "Tire pressure (TPMS) warning light active — check tires soon" },
      };

      const lightInfo = WARNING_LIGHT_FOR_TYPE[type];
      if (lightInfo && knownIssues?.includes(lightInfo.lightId)) {
        result.push({
          id: `unknown-${type}`,
          serviceName: MAINTENANCE_LABELS[type] || type,
          description: lightInfo.label,
          detail: "Warning light",
          status: "needs_attention",
        });
        continue;
      }

      // Battery: infer healthy status for young vehicles
      if (type === "battery") {
        const vehicleAge = vehicleYear ? new Date().getFullYear() - vehicleYear : 0;
        if (vehicleAge < 3) {
          result.push({
            id: `unknown-${type}`,
            serviceName: MAINTENANCE_LABELS[type] || type,
            description: `Battery is ~${vehicleAge || "<1"} year${vehicleAge !== 1 ? "s" : ""} old — healthy`,
            detail: "On time",
            status: "on_time",
          });
          continue;
        }
      }

      const fallback: Record<string, { status: MaintenanceItem["status"]; description: string; detail: string }> = {
        oil:    { status: "due_soon",  description: "No oil change data — service recommended", detail: "Check soon" },
        brakes: { status: "on_time",   description: "No brake concerns reported",              detail: "On time" },
        tires:  { status: "on_time",   description: "No tire concerns reported",               detail: "On time" },
        battery:{ status: "on_time",   description: "No battery concerns reported",            detail: "On time" },
      };
      const fb = fallback[type] ?? { status: "on_time" as const, description: "No concerns reported", detail: "On time" };
      result.push({
        id: `unknown-${type}`,
        serviceName: MAINTENANCE_LABELS[type] || type,
        description: fb.description,
        detail: fb.detail,
        status: fb.status,
      });
    }

    // Append inspection records when they exist (inspection is excluded from the
    // default loop since the stepper doesn't ask about it)
    const inspectionItem = userItems.get("inspection");
    if (inspectionItem) {
      result.push(inspectionItem);
    }

    return result.map(enrichUrgentItem);
  }, [smartcarByType, userItems, records, knownIssues, vehicleYear]);

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
