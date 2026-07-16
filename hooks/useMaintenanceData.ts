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
import type {
  MaintenanceItem,
  MaintenanceTriggerAxis,
} from "@/components/cars/MaintenanceTracker";
import {
  ALL_MAINTENANCE_TYPES,
  MAINTENANCE_LABELS,
  computeFromOdometerStatus,
  type MaintenanceType,
  type OemServiceIntervalsInput,
} from "@/utils/maintenanceStatus";
import { buildMaintenanceItems, enrichUrgentItem } from "@/utils/maintenanceEnrichment";
import { buildWarningLightItem } from "@/lib/warningLightItems";
import { safeInterval } from "@/utils/serviceIntervalGuardrails";
import { TAXONOMY } from "@/constants/serviceTaxonomy";
import { formatMileage } from "@/lib/vehicle-passport";

/** Catalog slugs whose cadence is already covered by one of the five
 *  anchored `maintenance_records` types. Everything else falls into
 *  the from-odometer inference path (proposal Behavior #7). */
const CATALOG_SLUGS_TO_SKIP: ReadonlySet<string> = new Set([
  "oil_change",
  "brake_pad_replacement",
  "tire_rotation",
  "tire_balance",
  "tire_replacement",
  "wheel_alignment",
  "battery_replacement",
  "battery_test",
  "state_inspection",
  "emissions_test",
  "check_engine_light",
  "diagnostic_scan",
  "pre_purchase_inspection",
]);

/** Anchored type → the taxonomy slug whose OEM interval represents
 *  its cadence. Kept separate from `lib/maintenanceServiceMapping.
 *  MAINTENANCE_TYPE_TO_SLUG` which resolves to booking-flow variants
 *  (`brake_system_inspection`, `battery_test`, etc.) — this map is
 *  for the interval-lookup on the tracker's signal-pill row. */
const ANCHOR_TYPE_TO_SLUG: Partial<Record<MaintenanceType, string>> = {
  oil: "oil_change",
  brakes: "brake_pad_replacement",
  tires: "tire_rotation",
  battery: "battery_replacement",
  inspection: "state_inspection",
};

const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;

interface DerivedSignals {
  signals: { time?: string; mileage?: string; interval?: string };
  triggeredBy: MaintenanceTriggerAxis;
}

function pickAnchorAxis(hasDate: boolean, hasMileage: boolean): MaintenanceTriggerAxis {
  if (hasDate && hasMileage) return "both";
  if (hasDate) return "time";
  if (hasMileage) return "mileage";
  return "none";
}

/** Derive signal-pill copy for an anchored record. Callers should
 *  skip invocation when the record is missing — the "none" result is
 *  reserved for records that exist but carry neither anchor. */
function deriveAnchoredSignals(
  record: MaintenanceRecord,
  type: MaintenanceType,
  currentOdometer: number | null,
  oemIntervals: OemServiceIntervalsInput | undefined,
  now: number,
): DerivedSignals {
  const signals: DerivedSignals["signals"] = {};
  const hasDate = record.lastServiceDate != null;
  const hasMileage = record.lastServiceMileage != null;

  if (record.lastServiceDate != null) {
    const months = Math.max(0, Math.round((now - record.lastServiceDate) / MS_PER_MONTH));
    signals.time = `${months} mo since last service`;
  }
  if (record.lastServiceMileage != null && currentOdometer != null && currentOdometer > 0) {
    const miles = Math.max(0, currentOdometer - record.lastServiceMileage);
    signals.mileage = `${formatMileage(miles)} since last service`;
  }

  const slug = ANCHOR_TYPE_TO_SLUG[type];
  const interval = slug ? oemIntervals?.[slug] : undefined;
  if (interval) {
    const parts: string[] = [];
    if (interval.interval_months) parts.push(`${interval.interval_months} mo`);
    if (interval.interval_miles) parts.push(formatMileage(interval.interval_miles));
    if (parts.length > 0) signals.interval = parts.join(" / ");
  }

  return { signals, triggeredBy: pickAnchorAxis(hasDate, hasMileage) };
}

/** Non-mutating merge — attach signals to an anchored item without
 *  spreading the same three keys at every push site. */
function withSignals(item: MaintenanceItem, derived: DerivedSignals): MaintenanceItem {
  return { ...item, signals: derived.signals, triggeredBy: derived.triggeredBy };
}

/** Paired maintenance type → light id that should escalate it to Now
 *  tier. Mirrors WARNING_LIGHT_FOR_TYPE inside the merge loop below;
 *  exposed at module scope so the post-process pass can hoist any
 *  paired item (record-based or fallback) up to `overdue` status when
 *  the light is on. Lets paired-light prompts surface on Home alongside
 *  the consolidated unpaired card. */
const PAIRED_LIGHT_BY_TYPE: Partial<Record<MaintenanceType, string>> = {
  oil: "oil_pressure",
  battery: "battery_charging",
  brakes: "abs",
  tires: "tpms",
};

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
      vehicleYear,
      oemIntervals,
    );
  }, [records, currentOdometer, make, drivingConditions, avgMonthlyDriving, knownIssues, vehicleYear, oemIntervals]);

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
/** Minimal shape of a driver-visible mechanic recommendation, mirrored from
 *  api.jobRecommendations.getDriverVisibleRecsForVehicle. Kept local to
 *  avoid a circular import with useDriverRecommendationsFromConvex. */
interface DriverRecommendationLike {
  _id: string;
  service_id: string | null;
  service_name: string;
  urgency: "next_visit" | "within_3_months" | "soon";
  reason: string | null;
  shop_name: string | null;
  mechanic_name: string | null;
  target_mileage?: number | null;
  scheduled_at?: number | null;
  scheduled_mechanic_name?: string | null;
}

function recUrgencyToStatus(
  urgency: DriverRecommendationLike["urgency"],
): MaintenanceItem["status"] {
  if (urgency === "soon") return "overdue";
  if (urgency === "next_visit") return "due_soon";
  return "needs_attention";
}

function recUrgencyDetail(
  urgency: DriverRecommendationLike["urgency"],
): string {
  if (urgency === "soon") return "Service soon";
  if (urgency === "next_visit") return "Next visit";
  return "Within 3 months";
}

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
) {
  const { records, items: userItems } = useMaintenanceRecords(vehicleOwnerId, currentOdometer, make, drivingConditions, avgMonthlyDriving, knownIssues, vehicleYear, oemIntervals);

  // Merge: user record > unknown.
  const mergedItems = useMemo(() => {
    const result: MaintenanceItem[] = [];

    for (const type of ALL_MAINTENANCE_TYPES) {
      const userItem = userItems.get(type);

      // If user recently reported service or confirmed healthy, force
      // on_time so a stale calculated status doesn't override their
      // direct input.
      const userRecord = records?.find((r: MaintenanceRecord) => r.type === type);
      const userConfirmedHealthy =
        userRecord?.confirmedHealthyAt &&
        Date.now() - userRecord.confirmedHealthyAt < 90 * 24 * 60 * 60 * 1000;

      if (userItem && userRecord) {
        const derived = deriveAnchoredSignals(
          userRecord,
          type,
          currentOdometer,
          oemIntervals,
          Date.now(),
        );
        const base: MaintenanceItem =
          userConfirmedHealthy && userItem.status !== "on_time"
            ? {
                ...userItem,
                status: "on_time",
                description: "Confirmed in good shape",
                detail: "On time",
              }
            : userItem;
        result.push(withSignals(base, derived));
        continue;
      }

      // Fallback: no record but the anchored slot expects an entry
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
        // Paired-light fallback (no maintenance record yet, but the
        // light is on). Status is `overdue` so the urgency model puts
        // this in the Now tier — surfaces on Home + the Cars tracker
        // exactly like every other now-tier item. Bumped from the
        // legacy `needs_attention` because that previously landed at
        // "soon" tier and Ahmad's gripe was warning lights never
        // showed up on Home.
        result.push({
          id: `unknown-${type}`,
          serviceName: MAINTENANCE_LABELS[type] || type,
          description: lightInfo.label,
          detail: "Warning light",
          status: "overdue",
          percentUsed: 100,
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

    // ── Catalog coverage via from-odometer inference (Behavior #7) ──
    if (oemIntervals && currentOdometer != null && currentOdometer > 0) {
      for (const [slug, interval] of Object.entries(oemIntervals)) {
        if (CATALOG_SLUGS_TO_SKIP.has(slug)) continue;
        const entry = TAXONOMY[slug];
        if (!entry) continue;

        // Runtime data from `useOemServiceIntervals` carries the guardrail
        // fields (`confidence`, `mechanic_verified`) beyond what the narrow
        // `OemServiceIntervalsInput` type surfaces; cast for the guardrail
        // call rather than leaking those fields into the general type.
        const enriched = interval as OemServiceIntervalsInput[string] & {
          confidence?: number | null;
          mechanic_verified?: boolean;
        };
        const bounded = safeInterval({
          slug,
          interval_miles: enriched.interval_miles,
          confidence: enriched.confidence,
          mechanic_verified: enriched.mechanic_verified,
        });

        // Anchorless — no stored interval AND no conservative default.
        // Row surfaces soft with the diagnostic-scan CTA (Behavior #6).
        if (bounded == null) {
          result.push({
            id: `catalog-${slug}`,
            serviceName: entry.label,
            description:
              "Not enough info to say — book a diagnostic scan to firm this up.",
            detail: "No data",
            status: "on_time",
            triggeredBy: "none",
          });
          continue;
        }

        const status = computeFromOdometerStatus({
          interval_miles: bounded,
          currentOdometer,
          serviceName: entry.label,
        });

        result.push({
          id: `catalog-${slug}`,
          serviceName: entry.label,
          description: status.description,
          detail: status.detail,
          status: status.status,
          percentUsed: status.percentUsed,
          triggeredBy: "inference",
          signals: {
            mileage: `${formatMileage(currentOdometer)} (current)`,
            interval: `${formatMileage(bounded)} (OEM)`,
          },
        });
      }
    }

    // Append mechanic-submitted job recommendations as urgent cards. Each
    // rec carries its source id so the tracker shows the "Take Action" CTA
    // and routes to /recommendation/[recId].
    if (driverRecommendations && driverRecommendations.length > 0) {
      for (const rec of driverRecommendations) {
        result.push({
          id: `rec-${rec._id}`,
          serviceName: rec.service_name,
          description: rec.reason ?? "Recommended by your mechanic",
          detail: recUrgencyDetail(rec.urgency),
          status: recUrgencyToStatus(rec.urgency),
          sourceRecommendationId: rec._id,
          mechanicProvenance: {
            shopName: rec.shop_name,
            mechanicName: rec.mechanic_name,
          },
          recUrgency: rec.urgency,
          scheduledAt: rec.scheduled_at ?? null,
          scheduledMechanicName: rec.scheduled_mechanic_name ?? null,
          serviceId: rec.service_id ?? null,
        });
      }
    }

    // Post-process: when a paired warning light is active, force the
    // matching item up to `overdue` regardless of record state. The
    // computeMaintenanceStatus pipeline only escalates to
    // `needs_attention` (lands at "soon" tier in utils/urgency.ts),
    // which is why warning lights weren't surfacing on Home before
    // — they need `overdue` to clear the Now-tier cutoff.
    const escalated = result.map((item) => {
      const itemType = item.id.replace(/^(unknown-|user-|smartcar-)/, "");
      const lightId = PAIRED_LIGHT_BY_TYPE[itemType as MaintenanceType];
      if (!lightId || !knownIssues?.includes(lightId)) return item;
      if (item.status === "overdue") return item; // already there
      return { ...item, status: "overdue" as const, percentUsed: 100 };
    });

    const enriched = escalated.map(enrichUrgentItem);

    // Consolidated unpaired-light item — appended AFTER enrichment so
    // its hand-tuned description/urgency copy doesn't get clobbered by
    // the generic URGENT_DETAILS fallback in enrichUrgentItem. Scope
    // the id to `vehicleOwnerId` so multiple vehicles aggregated on
    // Home produce distinct items. Returns null when no unpaired
    // light is on — see `lib/warningLightItems.ts` for the rules.
    if (vehicleOwnerId) {
      const warningItem = buildWarningLightItem({
        knownIssues,
        scopeId: String(vehicleOwnerId),
      });
      if (warningItem) enriched.push(warningItem);
    }

    return enriched;
  }, [userItems, records, knownIssues, vehicleYear, driverRecommendations, vehicleOwnerId, oemIntervals, currentOdometer]);

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
