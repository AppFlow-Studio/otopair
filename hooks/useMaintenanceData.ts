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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MaintenanceItem } from "@/components/cars/MaintenanceTracker";
import {
  ALL_MAINTENANCE_TYPES,
  MAINTENANCE_LABELS,
  type MaintenanceType,
} from "@/utils/maintenanceStatus";
import { buildMaintenanceItems, enrichUrgentItem } from "@/utils/maintenanceEnrichment";

// ============================================================================
// RECOMMENDATION TYPES (driver-visible mechanic recs)
// ============================================================================

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
}

/** Heuristic map from rec.service_name → existing MaintenanceType so we
 *  can dedupe mechanic recs against algorithmic items (mechanic wins). */
function inferMaintenanceTypeFromServiceName(name: string): MaintenanceType | null {
  const n = name.toLowerCase();
  if (n.includes("oil")) return "oil";
  if (n.includes("brake")) return "brakes";
  if (n.includes("tire")) return "tires";
  if (n.includes("batter")) return "battery";
  if (n.includes("inspection")) return "inspection";
  return null;
}

function recUrgencyToStatus(urgency: DriverRecommendation["urgency"]): MaintenanceStatus {
  return urgency === "next_visit" ? "overdue" : "due_soon";
}

function recUrgencyToLabel(urgency: DriverRecommendation["urgency"]): string {
  switch (urgency) {
    case "next_visit":
      return "Service on next visit";
    case "within_3_months":
      return "Service within 3 months";
    case "soon":
    default:
      return "Service recommended soon";
  }
}

function recToMaintenanceItem(rec: DriverRecommendation): MaintenanceItem {
  const status = recUrgencyToStatus(rec.urgency);
  const urgencyLabel = recUrgencyToLabel(rec.urgency);
  const mechanicName = rec.mechanic_name ?? "your mechanic";
  return {
    id: `rec-${rec._id}`,
    serviceName: rec.service_name,
    description: rec.reason ?? "Recommended by your mechanic",
    detail: status === "overdue" ? "Recommended" : "Due soon",
    status,
    sourceRecommendationId: rec.source_recommendation_id,
    serviceId: rec.service_id,
    recUrgency: rec.urgency,
    scheduledAt: rec.scheduled_at ?? null,
    scheduledMechanicName: rec.scheduled_mechanic_name ?? null,
    mechanicProvenance: {
      shopName: rec.shop_name,
      mechanicName: rec.mechanic_name,
    },
    urgency: urgencyLabel,
    recommendation:
      rec.reason ??
      `${mechanicName} recommended this service${
        rec.urgency === "within_3_months"
          ? " within the next 3 months"
          : rec.urgency === "next_visit"
            ? " on your next visit"
            : " soon"
      }.`,
  };
}

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
  recommendations: DriverRecommendation[] = []
) {
  const { records, items: userItems } = useMaintenanceRecords(vehicleOwnerId, currentOdometer, make, drivingConditions, avgMonthlyDriving, knownIssues);

  // Bucket recs by inferred maintenance type (mechanic-wins dedupe target).
  // Recs that don't map to a known type are appended as their own cards.
  const recsByType = useMemo(() => {
    const map = new Map<MaintenanceType, DriverRecommendation>();
    for (const rec of recommendations) {
      const type = inferMaintenanceTypeFromServiceName(rec.service_name);
      if (type && !map.has(type)) map.set(type, rec);
    }
    return map;
  }, [recommendations]);

  const unmappedRecs = useMemo(
    () =>
      recommendations.filter(
        (rec) => inferMaintenanceTypeFromServiceName(rec.service_name) == null,
      ),
    [recommendations],
  );

  // Merge: mechanic rec > user record > unknown
  const mergedItems = useMemo(() => {
    const result: MaintenanceItem[] = [];

    for (const type of ALL_MAINTENANCE_TYPES) {
      // Priority 0: mechanic recommendation wins on service_id match.
      const rec = recsByType.get(type);
      if (rec) {
        result.push(recToMaintenanceItem(rec));
        continue;
      }

      const userItem = userItems.get(type);

      // If user recently reported service or confirmed healthy, force
      // on_time so a stale calculated status doesn't override their
      // direct input.
      const userRecord = records?.find((r: MaintenanceRecord) => r.type === type);
      const userConfirmedHealthy =
        userRecord?.confirmedHealthyAt &&
        Date.now() - userRecord.confirmedHealthyAt < 90 * 24 * 60 * 60 * 1000;

      if (userConfirmedHealthy && userItem) {
        if (userItem.status !== "on_time") {
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

      // User-provided record
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
    // default loop since the stepper doesn't ask about it). Mechanic rec wins
    // here too if one targets inspection.
    const inspectionRec = recsByType.get("inspection");
    if (inspectionRec) {
      result.push(recToMaintenanceItem(inspectionRec));
    } else {
      const inspectionItem = userItems.get("inspection");
      if (inspectionItem) {
        result.push(inspectionItem);
      }
    }

    // Append unmapped recs (services that don't fit the 5 known maintenance
    // types — e.g. coolant flush, alignment) as their own cards.
    for (const rec of unmappedRecs) {
      result.push(recToMaintenanceItem(rec));
    }

    return result.map(enrichUrgentItem);
  }, [userItems, records, knownIssues, vehicleYear, recsByType, unmappedRecs]);

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
