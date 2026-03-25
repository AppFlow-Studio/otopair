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
import type { MaintenanceItem, MaintenanceStatus } from "@/components/cars/MaintenanceTracker";
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
  avgMonthlyDriving?: string,
  knownIssues?: string[]
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
        avgMonthlyDriving,
        knownIssues
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
  }, [records, currentOdometer, make, drivingConditions, avgMonthlyDriving, knownIssues]);

  return { records, items };
}

// ============================================================================
// URGENT ITEM ENRICHMENT
// ============================================================================

type DetailFields = Pick<MaintenanceItem, 'lastService' | 'urgency' | 'impacts' | 'recommendation'>;

const URGENT_DETAILS: Record<string, Partial<Record<MaintenanceStatus, DetailFields>>> = {
  oil: {
    overdue: {
      lastService: "~14 months ago",
      urgency: "Immediate oil change recommended",
      impacts: [
        { label: "Engine wear", severity: "high" },
        { label: "Fuel efficiency", severity: "medium" },
        { label: "Engine overheating risk", severity: "medium" },
      ],
      recommendation: "Oil degrades over time and loses its ability to protect engine internals. Schedule an oil change as soon as possible to prevent long-term damage.",
    },
    due_soon: {
      lastService: "~5 months ago",
      urgency: "Service within 2 weeks",
      impacts: [
        { label: "Engine lubrication", severity: "medium" },
        { label: "Fuel efficiency", severity: "low" },
      ],
      recommendation: "Your oil is approaching the end of its service life. Plan an oil change soon to keep your engine running smoothly.",
    },
    needs_attention: {
      lastService: "Unknown",
      urgency: "Check oil level and condition",
      impacts: [
        { label: "Engine protection", severity: "medium" },
        { label: "Oil contamination", severity: "medium" },
      ],
      recommendation: "There are signs your oil may need attention. Have a technician check oil level and condition at your earliest convenience.",
    },
  },
  brakes: {
    overdue: {
      lastService: "~18 months ago",
      urgency: "Immediate inspection needed",
      impacts: [
        { label: "Stopping distance", severity: "high" },
        { label: "Rotor damage", severity: "high" },
        { label: "Safety risk", severity: "high" },
      ],
      recommendation: "Worn brake pads significantly increase stopping distance and can damage rotors. Have your brakes inspected immediately for your safety.",
    },
    due_soon: {
      lastService: "~10 months ago",
      urgency: "Inspection within 2 weeks",
      impacts: [
        { label: "Stopping distance", severity: "medium" },
        { label: "Rotor damage", severity: "medium" },
      ],
      recommendation: "Brake pads wear down with use and reduced pad thickness increases stopping distance. Have a technician inspect pad thickness and rotor condition.",
    },
    needs_attention: {
      lastService: "Unknown",
      urgency: "Have brakes checked soon",
      impacts: [
        { label: "Braking performance", severity: "medium" },
        { label: "Rotor wear", severity: "low" },
      ],
      recommendation: "Your brakes may need attention based on available data. A quick inspection can confirm whether pads or rotors need servicing.",
    },
  },
  tires: {
    overdue: {
      lastService: "~24 months ago",
      urgency: "Replace or rotate immediately",
      impacts: [
        { label: "Traction & grip", severity: "high" },
        { label: "Blowout risk", severity: "high" },
        { label: "Fuel efficiency", severity: "medium" },
      ],
      recommendation: "Worn tires lose grip on wet and dry surfaces and are at higher risk of blowout. Replace or rotate your tires as soon as possible.",
    },
    due_soon: {
      lastService: "~8 months ago",
      urgency: "Rotation or inspection within 1 month",
      impacts: [
        { label: "Uneven tread wear", severity: "medium" },
        { label: "Handling", severity: "low" },
      ],
      recommendation: "Regular tire rotation extends tire life and ensures even tread wear. Schedule a rotation or have tread depth checked soon.",
    },
    needs_attention: {
      lastService: "Unknown",
      urgency: "Check tire pressure and tread",
      impacts: [
        { label: "Tire pressure", severity: "medium" },
        { label: "Tread depth", severity: "medium" },
      ],
      recommendation: "Your tires may need attention. Check tire pressure and inspect tread depth to ensure safe driving conditions.",
    },
  },
  battery: {
    overdue: {
      lastService: "~4 years ago",
      urgency: "Test or replace battery now",
      impacts: [
        { label: "Starting reliability", severity: "high" },
        { label: "Electrical system", severity: "medium" },
        { label: "Stranding risk", severity: "high" },
      ],
      recommendation: "Car batteries typically last 3–5 years. An aging battery can leave you stranded without warning. Have it tested or replaced promptly.",
    },
    due_soon: {
      lastService: "~3 years ago",
      urgency: "Test within 2 weeks",
      impacts: [
        { label: "Starting reliability", severity: "medium" },
        { label: "Cold-weather performance", severity: "medium" },
      ],
      recommendation: "Your battery is approaching the end of its expected lifespan. A quick load test can determine if it still holds a full charge.",
    },
    needs_attention: {
      lastService: "Unknown",
      urgency: "Have battery tested",
      impacts: [
        { label: "Charge capacity", severity: "medium" },
        { label: "Starting reliability", severity: "low" },
      ],
      recommendation: "There are indications your battery may need attention. A load test at any auto shop takes minutes and can prevent unexpected breakdowns.",
    },
  },
};

function enrichUrgentItem(item: MaintenanceItem): MaintenanceItem {
  const isUrgent = item.status === "overdue" || item.status === "due_soon" || item.status === "needs_attention";
  if (!isUrgent) return item;

  const type = item.id.replace(/^(unknown-|user-|smartcar-)/, "");
  const details = URGENT_DETAILS[type]?.[item.status];
  if (!details) {
    return {
      ...item,
      urgency: item.status === "overdue" ? "Service overdue" : "Service recommended soon",
      impacts: [{ label: "Vehicle health", severity: item.status === "overdue" ? "high" : "medium" }],
      recommendation: "Schedule a service appointment to address this maintenance item.",
    };
  }
  return { ...item, ...details };
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
  }, [smartcarByType, userItems, knownIssues, vehicleYear]);

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
