/**
 * mergedMaintenance — the single, shared vehicle-item merge used by BOTH the
 * Cars-page health ring (hooks/useMaintenanceData.ts useMergedMaintenance) and
 * Oto's server-side get_vehicle_health score (convex/oto/vehicleHealth.ts).
 *
 * Extracted verbatim from useMergedMaintenance so the two consumers compute the
 * SAME MaintenanceItem[] from the same inputs — which is what lets Oto's stated
 * health score converge with the ring the user sees, with zero drift. It is a
 * pure function (takes an already-built per-type userItems map + records + the
 * per-vehicle signals); no React, no Convex, no `@/` value imports beyond the
 * pure builders it composes.
 *
 * The no-record fallbacks here are the ring's OPTIMISTIC ones (oil -> due_soon,
 * others -> on_time). Oto keeps its own conservative "unknown" fallback for the
 * items it REPORTS to the user (the F1 anti-fabrication behavior); this shared
 * merge is used only to compute the score that must match the ring.
 */

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
import { enrichUrgentItem } from "@/utils/maintenanceEnrichment";
import { buildWarningLightItem } from "@/lib/warningLightItems";
import { canonicalWarningLights } from "@/lib/warningLightVocab";
import { safeInterval } from "@/utils/serviceIntervalGuardrails";
import { TAXONOMY } from "@/constants/serviceTaxonomy";
import { formatMileage } from "@/lib/vehicle-passport";

/** Minimal shape of a driver-visible mechanic recommendation, mirrored from
 *  api.jobRecommendations.getDriverVisibleRecsForVehicle. */
export interface DriverRecommendationLike {
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

export function recUrgencyToStatus(
  urgency: DriverRecommendationLike["urgency"],
): MaintenanceItem["status"] {
  if (urgency === "soon") return "overdue";
  if (urgency === "next_visit") return "due_soon";
  return "needs_attention";
}

export function recUrgencyDetail(
  urgency: DriverRecommendationLike["urgency"],
): string {
  if (urgency === "soon") return "Service soon";
  if (urgency === "next_visit") return "Next visit";
  return "Within 3 months";
}

/** Paired maintenance type → canonical light id that escalates it to Now tier. */
const PAIRED_LIGHT_BY_TYPE: Partial<Record<MaintenanceType, string>> = {
  oil: "oil_pressure",
  battery: "battery_charging",
  brakes: "abs",
  tires: "tpms",
};

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
  record: MergeRecordLike,
  type: MaintenanceType,
  currentOdometer: number | null | undefined,
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

/** Minimal record shape the merge reads — type (to match a user item), the
 *  confirmed-healthy timestamp (the 90-day on_time override), and the two
 *  service anchors that drive the signal pills. */
export interface MergeRecordLike {
  type: string;
  confirmedHealthyAt?: number;
  lastServiceDate?: number;
  lastServiceMileage?: number;
}

export interface BuildMergedMaintenanceInput {
  /** Per-type items already computed from the user's maintenance_records
   *  (buildMaintenanceItems output). */
  userItems: Map<MaintenanceType, MaintenanceItem>;
  /** Raw records — only `type` + `confirmedHealthyAt` are read. */
  records: readonly MergeRecordLike[] | undefined;
  knownIssues?: string[];
  vehicleYear?: number;
  driverRecommendations?: readonly DriverRecommendationLike[];
  /** Id appended to the consolidated warning item so multiple vehicles produce
   *  distinct items. Pass the vehicle_owner id (or VIN). When undefined, the
   *  consolidated card is skipped (matches useMergedMaintenance's guard). */
  scopeId?: string;
  /** Injectable clock for the confirmed-healthy TTL; defaults to Date.now(). */
  now?: number;
  /** Current odometer in miles. Enables the anchored mileage signal pill and,
   *  together with `oemIntervals`, the from-odometer catalog coverage pass.
   *  Omit (as Oto's server-side score does) to keep the anchored-only merge. */
  currentOdometer?: number | null;
  /** Slug-keyed OEM intervals from the v3 enrichment pipeline. Drives the
   *  interval signal pill and the catalog coverage pass (Behaviors #6/#7). */
  oemIntervals?: OemServiceIntervalsInput;
}

/**
 * Build the full merged MaintenanceItem[] the Cars ring renders / scores from:
 * per-type items (record > warning-light fallback > young-battery inference >
 * optimistic default), then appended inspection + mechanic driver recs, the
 * paired-light overdue escalation, enrichment, and the consolidated
 * unpaired-light card.
 */
export function buildMergedMaintenanceItems(
  input: BuildMergedMaintenanceInput,
): MaintenanceItem[] {
  const { userItems, records, knownIssues, vehicleYear, driverRecommendations, scopeId } = input;
  const { currentOdometer, oemIntervals } = input;
  const now = input.now ?? Date.now();
  const result: MaintenanceItem[] = [];

  // Canonical dashboard lights present, folding both knownIssues shapes + the
  // symptom-code vocabulary so a light logged in ANY vocabulary escalates.
  const activeLights = canonicalWarningLights(knownIssues) as readonly string[];

  for (const type of ALL_MAINTENANCE_TYPES) {
    const userItem = userItems.get(type);

    // Recently confirmed-healthy → force on_time so a stale calculated status
    // doesn't override the user's direct input.
    const userRecord = records?.find((r) => r.type === type);
    const userConfirmedHealthy =
      userRecord?.confirmedHealthyAt &&
      now - userRecord.confirmedHealthyAt < 90 * 24 * 60 * 60 * 1000;

    if (userItem && userRecord) {
      const derived = deriveAnchoredSignals(
        userRecord,
        type,
        currentOdometer,
        oemIntervals,
        now,
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

    // Fallback: no record but the anchored slot expects an entry.
    if (userItem) {
      result.push(userItem);
      continue;
    }

    // No record — a paired warning light escalates the tile to the Now tier.
    const WARNING_LIGHT_FOR_TYPE: Partial<Record<MaintenanceType, { lightId: string; label: string }>> = {
      oil: { lightId: "oil_pressure", label: "Oil pressure warning light active — service urgently needed" },
      battery: { lightId: "battery_charging", label: "Battery/charging warning light active — have it tested soon" },
      brakes: { lightId: "abs", label: "ABS / brake warning light active — have brakes inspected soon" },
      tires: { lightId: "tpms", label: "Tire pressure (TPMS) warning light active — check tires soon" },
    };
    const lightInfo = WARNING_LIGHT_FOR_TYPE[type];
    if (lightInfo && activeLights.includes(lightInfo.lightId)) {
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

    // Battery: infer healthy for young vehicles.
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

  // Inspection record (excluded from the default loop).
  const inspectionItem = userItems.get("inspection");
  if (inspectionItem) result.push(inspectionItem);

  // ── Catalog coverage via from-odometer inference (Behavior #7) ──
  // Only runs for callers that supply both an odometer and OEM intervals;
  // Oto's server-side score passes neither and keeps the anchored-only set.
  if (oemIntervals && currentOdometer != null && currentOdometer > 0) {
    for (const [slug, interval] of Object.entries(oemIntervals)) {
      if (CATALOG_SLUGS_TO_SKIP.has(slug)) continue;
      const entry = TAXONOMY[slug];
      if (!entry) continue;

      // Runtime data from `useOemServiceIntervals` carries the guardrail
      // fields (`confidence`, `mechanic_verified`) beyond what the narrow
      // `OemServiceIntervalsInput` type surfaces; cast for the guardrail
      // call rather than leaking those fields into the general type.
      const enrichedInterval = interval as OemServiceIntervalsInput[string] & {
        confidence?: number | null;
        mechanic_verified?: boolean;
      };
      const bounded = safeInterval({
        slug,
        interval_miles: enrichedInterval.interval_miles,
        confidence: enrichedInterval.confidence,
        mechanic_verified: enrichedInterval.mechanic_verified,
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

  // Mechanic-submitted job recommendations as urgent cards.
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

  // Force any paired item up to overdue when its light is on (record-based or not).
  const escalated = result.map((item) => {
    const itemType = item.id.replace(/^(unknown-|user-|smartcar-)/, "");
    const lightId = PAIRED_LIGHT_BY_TYPE[itemType as MaintenanceType];
    if (!lightId || !activeLights.includes(lightId)) return item;
    if (item.status === "overdue") return item;
    return { ...item, status: "overdue" as const, percentUsed: 100 };
  });

  const enriched = escalated.map(enrichUrgentItem);

  // Consolidated unpaired-light item — appended AFTER enrichment so its
  // hand-tuned copy isn't clobbered by the generic URGENT_DETAILS fallback.
  if (scopeId) {
    const warningItem = buildWarningLightItem({ knownIssues, scopeId });
    if (warningItem) enriched.push(warningItem);
  }

  return enriched;
}
