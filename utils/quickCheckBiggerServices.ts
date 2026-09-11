/**
 * Bigger Services candidates — Quick Check Spec v2 §4/§6.
 *
 * The tile assembles itself per vehicle rather than showing a fixed list. A
 * service earns a row only when all three are true:
 *
 *   1. the car actually has the component (fitment),
 *   2. we can put a number on its interval (OEM or the class default), and
 *   3. it is at least 80% through that interval.
 *
 * 0.8 is `BAND_CUTOFFS.dueSoon` on purpose, not a coincidence: the moment a
 * service becomes worth mentioning in the tracker is the moment it becomes
 * worth asking the driver about.
 *
 * Fitment is NOT re-derived here. `convex/services.ts` already omits
 * non-applicable services — timing belt on a chain engine, differential on a
 * FWD car — through `lib/serviceApplicability.ts`, and duplicating that rule
 * client-side is how the two drift apart. The caller passes what the backend
 * said.
 */
import { BAND_CUTOFFS } from "@/utils/intervalBands";
import { ageMonths } from "@/utils/quickCheckFiring";

const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;
import { classInterval, type ClassIntervalOptions } from "@/utils/classIntervals";
import type { VehicleClass } from "@/utils/vehicleClass";
import {
  clampClassIntervalToBounds,
  isTrustedInterval,
  safeInterval,
} from "@/utils/serviceIntervalGuardrails";
import { TAXONOMY } from "@/constants/serviceTaxonomy";

/**
 * The pool, and it is deliberately short.
 *
 * Everything the four square tiles already cover is excluded — oil and both
 * filters, tire rotation and replacement, brake pads, battery — because asking
 * twice is worse than not asking. State inspection is out too: it is a date on
 * a sticker, not an interval, and the spec defers the NY sticker-month rule.
 *
 * What is left is the set a driver plausibly knows the answer to and a shop
 * plausibly sells. Five rows is a question; fifteen is a form.
 */
export const BIGGER_SERVICE_POOL: readonly string[] = [
  // brake_fluid_flush is NOT here: the brakes tile asks about it as a
  // companion ("fluid flushed too?"), because a brake service and a fluid
  // flush are usually the same visit. See COMPANION_SLUG in quickCheckAnchor.
  "coolant_flush",
  "transmission_service",
  "spark_plugs",
  "differential_service",
];


export interface BiggerServiceCandidate {
  slug: string;
  label: string;
  /** Interval actually used, after the guardrail clamp. Null when this service
   *  is measured in months only — Class B brake fluid, for one. */
  intervalMiles: number | null;
  /** Months half of the interval, when it has one. */
  intervalMonths: number | null;
  /** How much of it is used up, on whichever axis is further along. Drives the
   *  ordering — worst first. */
  ratio: number;
  /** The driver has already answered this one; the row shows their answer
   *  rather than asking again. */
  answered: boolean;
}

export interface BiggerServicesInput {
  currentOdometer: number | null;
  /** Model year. With no record on file a months-based interval has been
   *  running since the car was new, so this is its anchor. */
  modelYear?: number | null;
  now?: number;
  vehicleClass: VehicleClass | null;
  /** Turbo / drivetrain / differential, straight from the vehicle profile. */
  classOptions?: ClassIntervalOptions;
  /** Slug-keyed OEM intervals from enrichment. Takes precedence over the
   *  class default, exactly as `getInterval` does. */
  oemIntervals?: Record<string, { interval_miles?: number | null; confidence?: number | null; mechanic_verified?: boolean }>;
  /** Slugs the backend says this vehicle can actually be sold. Undefined means
   *  the fitment query has not resolved yet — treated as "no filter" so the
   *  tile does not flicker empty on first render. */
  applicableSlugs?: Set<string> | null;
  /** Slugs the driver has already answered, from `catalog_<slug>` records. */
  answeredSlugs?: Set<string>;
  /** What is already on record per slug — a driver answer (`catalog_<slug>`)
   *  or a booking close-out (`minor_<slug>`). The ratio measures from here
   *  rather than from new, so a car serviced at 40,000 and now reading 45,000
   *  is 5,000 into its interval and does not get asked again. Measuring from
   *  zero is what made every service fire on a car that was already set up. */
  anchors?: Record<string, { lastServiceMileage?: number | null; lastServiceDate?: number | null }>;
  pool?: readonly string[];
}

/**
 * The ordered candidate list. Empty means the tile does not render at all —
 * which is the correct outcome for a young car and is why `firedTiles` takes
 * the count rather than a boolean.
 */
export function biggerServiceCandidates(
  input: BiggerServicesInput,
): BiggerServiceCandidate[] {
  const { currentOdometer, vehicleClass, oemIntervals, applicableSlugs, answeredSlugs } = input;

  // Age is the other axis, and the only one some services have. Measured from
  // the car being new, like the mileage side — with no record on file, that is
  // when the interval started.
  const ageMonthsNow = ageMonths(input.modelYear ?? null, input.now);

  // Nothing to measure against on either axis.
  const hasMiles = currentOdometer != null && currentOdometer > 0;
  if (!hasMiles && ageMonthsNow == null) return [];

  const out: BiggerServiceCandidate[] = [];

  for (const slug of input.pool ?? BIGGER_SERVICE_POOL) {
    const entry = TAXONOMY[slug];
    if (!entry) continue;
    if (applicableSlugs && !applicableSlugs.has(slug)) continue;

    // OEM first, class default second — the same two tiers `getInterval` uses.
    // A third tier here would mean the tile and the tracker could disagree
    // about the same service on the same car.
    const oem = oemIntervals?.[slug];
    const fromClass = vehicleClass
      ? classInterval(slug, vehicleClass, input.classOptions ?? {})
      : null;

    // `classInterval` returning null on a slug the table knows means the car
    // does not have the component — a FWD car has no differential — so the row
    // must disappear rather than fall through to a default.
    if (fromClass === null && !oem?.interval_miles) continue;

    // Enrichment wins only when it is trustworthy. An untrusted row gets
    // snapped to the bounds floor by `safeInterval`, and a floored guess is
    // worse than the class table — that is what produced "brake fluid every
    // 15,000 miles" (the floor) on a car whose class says 24 months.
    // Same rule as the tracker's catalog pass: prefer the class table over an
    // untrusted enrichment value, but only when there IS a class value. With
    // nothing to fall back to, a floored guess beats dropping the row.
    const useOem =
      !!oem?.interval_miles &&
      (isTrustedInterval(oem) || (fromClass?.miles ?? null) == null);
    const miles = useOem
      ? safeInterval({
          slug,
          interval_miles: oem!.interval_miles!,
          confidence: oem!.confidence,
          mechanic_verified: oem!.mechanic_verified,
        })
      : clampClassIntervalToBounds(slug, fromClass?.miles ?? null);
    const months = fromClass?.months ?? null;
    if ((miles == null || miles <= 0) && (months == null || months <= 0)) continue;

    // Measured from zero on both axes, like the tracker's catalog pass: with
    // no record, the interval has been running since the car was new. That is
    // an assumption, which is exactly why the answer is worth asking for.
    //
    // Whichever axis is further along wins, the same way `computeHybridStatus`
    // takes the worse of the two. Without this a months-only service — Class B
    // brake fluid is 24 months and no mileage at all — could never fire, and
    // would be silently dropped from a tile whose whole job is to surface it.
    // Both axes measure from the anchor when there is one. With none, they
    // measure from new — the interval has been running since the car was
    // built, which is exactly the case the tile exists to ask about.
    const anchor = input.anchors?.[slug];
    const anchorMiles =
      typeof anchor?.lastServiceMileage === "number" ? anchor.lastServiceMileage : 0;
    const milesSince = hasMiles ? Math.max(0, currentOdometer! - anchorMiles) : null;
    const monthsSince =
      typeof anchor?.lastServiceDate === "number"
        ? Math.max(0, ((input.now ?? Date.now()) - anchor.lastServiceDate) / MS_PER_MONTH)
        : ageMonthsNow;

    const milesRatio = milesSince != null && miles ? milesSince / miles : 0;
    const monthsRatio = monthsSince != null && months ? monthsSince / months : 0;
    const ratio = Math.max(milesRatio, monthsRatio);
    if (ratio < BAND_CUTOFFS.dueSoon) continue;

    out.push({
      slug,
      label: entry.label,
      intervalMiles: miles && miles > 0 ? miles : null,
      intervalMonths: months && months > 0 ? months : null,
      ratio,
      answered: answeredSlugs?.has(slug) ?? false,
    });
  }

  // Worst first, then alphabetically so the order is stable between renders
  // rather than depending on pool declaration order.
  return out.sort((a, b) => b.ratio - a.ratio || a.slug.localeCompare(b.slug));
}
