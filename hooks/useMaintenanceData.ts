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
import type { MaintenanceItem, MaintenanceStatus } from "@/components/cars/MaintenanceTracker";
import {
  ALL_MAINTENANCE_TYPES,
  MAINTENANCE_LABELS,
  computeMaintenanceStatus,
  type MaintenanceType,
} from "@/utils/maintenanceStatus";

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
          confirmedHealthyAt: rec.confirmedHealthyAt ?? undefined,
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

  // Mechanic-recommended items already carry urgency/recommendation from the
  // post-job report — don't overwrite with generic copy.
  if (item.sourceRecommendationId) {
    return {
      ...item,
      impacts: item.impacts ?? [
        { label: "Vehicle health", severity: item.status === "overdue" ? "high" : "medium" },
      ],
    };
  }

  const type = item.id.replace(/^(unknown-|user-)/, "");
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
