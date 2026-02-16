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
  computeMaintenanceStatus,
  type MaintenanceType,
} from "@/utils/maintenanceStatus";

// ============================================================================
// TYPES
// ============================================================================

interface MaintenanceRecord {
  _id: Id<"maintenance_records">;
  type: string;
  lastServiceDate?: number;
  lastServiceMileage?: number;
  customInputs?: Record<string, unknown>;
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
  avgMonthlyDriving?: string
) {
  const records = useQuery(
    api.maintenance.getRecordsByVehicle,
    vehicleOwnerId ? { vehicleOwnerId } : "skip"
  );

  const items = useMemo(() => {
    if (!records) return new Map<string, MaintenanceItem>();

    const map = new Map<string, MaintenanceItem>();

    for (const rec of records) {
      const type = rec.type as MaintenanceType;
      const result = computeMaintenanceStatus(
        {
          type: rec.type,
          lastServiceDate: rec.lastServiceDate ?? undefined,
          lastServiceMileage: rec.lastServiceMileage ?? undefined,
          customInputs: rec.customInputs as Record<string, unknown> | undefined,
        },
        currentOdometer,
        make,
        undefined,
        drivingConditions,
        avgMonthlyDriving
      );

      map.set(type, {
        id: `user-${type}`,
        serviceName: MAINTENANCE_LABELS[type] || type,
        description: result.description,
        detail: result.detail,
        status: result.status,
      });
    }

    return map;
  }, [records, currentOdometer, make, drivingConditions, avgMonthlyDriving]);

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
  avgMonthlyDriving?: string
) {
  const { records, items: userItems } = useMaintenanceRecords(vehicleOwnerId, currentOdometer, make, drivingConditions, avgMonthlyDriving);

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
      // Priority 1: Smartcar data
      const smartcarItem = smartcarByType.get(type);
      if (smartcarItem) {
        result.push(smartcarItem);
        continue;
      }

      // Priority 2: User-provided record
      const userItem = userItems.get(type);
      if (userItem) {
        result.push(userItem);
        continue;
      }

      // Priority 3: Unknown — prompt user to add info
      result.push({
        id: `unknown-${type}`,
        serviceName: MAINTENANCE_LABELS[type] || type,
        description: "No data available",
        detail: "Unknown",
        status: "unknown",
      });
    }

    return result;
  }, [smartcarByType, userItems]);

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
