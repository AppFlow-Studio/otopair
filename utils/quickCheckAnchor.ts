/**
 * Quick Check answers → the anchor a maintenance record needs.
 *
 * A record is anchored by two facts: when the service last happened and at
 * what odometer reading. The Quick Check asks for a month and year, because
 * that is what a driver actually remembers, and offers the odometer as an
 * optional extra. This module fills the gap.
 *
 * Deliberately NOT `estimateServiceAnchorFromRecency`. That helper speaks the
 * v1 bucket vocabulary ("recently", "few_months", "over_6mo"), which is the
 * exact thing v2 replaces — a bucket collapses to a guessed date, where a
 * month and year is a real one. Its behaviour is pinned by
 * `tests/catalogRecencyAnswer.test.ts` and stays as it is for the tracker's
 * own recency prompt.
 *
 * The one thing shared with it is `getMonthlyMiles`, imported rather than
 * copied: two tables of driving-level constants would drift.
 */
import { getMonthlyMiles } from "@/utils/maintenanceStatus";

const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;

/** The subset of a Quick Check answer this module reads. Typed structurally
 *  rather than importing `QuickCheckAnswer` from the sheet — utils must not
 *  depend on components. */
export interface QuickCheckAnchorAnswer {
  answerType: "when" | "never" | "unsure";
  /** 1-12. Only meaningful when `answerType` is "when". */
  month?: number;
  /** Four-digit year. Only meaningful when `answerType` is "when". */
  year?: number;
  /** Odometer at the service, if the driver happened to know it. */
  miles?: number;
}

export interface QuickCheckAnchorInput {
  answer: QuickCheckAnchorAnswer;
  /** Today's odometer. Null when we genuinely do not have it. */
  currentOdometer: number | null;
  /** "light" | "average" | "heavy" — the driver's own stated level. */
  avgMonthlyDriving?: string | null;
  /** Model year, used to date a "never" answer from the car being new. */
  vehicleYear?: number | null;
  now?: number;
}

export interface QuickCheckAnchor {
  lastServiceDate?: number;
  /** Left undefined rather than zeroed when it cannot be worked out. Zero is
   *  not "unknown" — it says the service happened at delivery, which on a
   *  200,000-mile car reads as an interval consumed many times over. */
  lastServiceMileage?: number;
}

/**
 * Resolve an answer to an anchor.
 *
 * Returns an EMPTY anchor for "not sure" rather than null. The record is still
 * written — with neither field set, which `computeHybridStatus` reads as
 * `unknown`, so the item leaves the weighted average entirely per §08. The
 * distinction that matters: "we asked and they did not know" is a different
 * state from "we never asked", and only the former should stop us asking
 * again or count towards the diagnostic-scan prompt.
 */
export function resolveQuickCheckAnchor(input: QuickCheckAnchorInput): QuickCheckAnchor {
  const now = input.now ?? Date.now();
  const { answer } = input;

  if (answer.answerType === "unsure") return {};

  // "Never on this car" / "still the originals" — the interval runs from the
  // car being new. The driver has told us this, so unlike an assumed default
  // it is a fact and is allowed to score.
  if (answer.answerType === "never") {
    return {
      lastServiceDate: input.vehicleYear
        ? new Date(input.vehicleYear, 0, 1).getTime()
        : now,
      lastServiceMileage: 0,
    };
  }

  if (answer.month == null || answer.year == null) return {};

  // Month precision only — the first of the month. The spec asks for "roughly
  // when" and a day field would imply accuracy the answer does not have.
  // Clamped to today because a future anchor would read as negative wear; the
  // picker disables future months, but nothing stops a stale draft.
  const picked = new Date(answer.year, answer.month - 1, 1).getTime();
  const lastServiceDate = Math.min(picked, now);

  // The driver's own number always wins over our estimate.
  if (typeof answer.miles === "number" && Number.isFinite(answer.miles) && answer.miles >= 0) {
    return { lastServiceDate, lastServiceMileage: answer.miles };
  }

  // No odometer to work back from — keep the date and leave mileage unset.
  // The months half of the interval still scores; the miles half sits out.
  if (input.currentOdometer == null || !Number.isFinite(input.currentOdometer)) {
    return { lastServiceDate };
  }

  const monthsAgo = Math.max(0, (now - lastServiceDate) / MS_PER_MONTH);
  const travelled = monthsAgo * getMonthlyMiles(input.avgMonthlyDriving ?? undefined);
  // Never below zero and never above today's reading — the estimate is a
  // subtraction from a real number, so both ends are hard facts.
  const estimated = Math.round(
    Math.min(input.currentOdometer, Math.max(0, input.currentOdometer - travelled)),
  );

  return { lastServiceDate, lastServiceMileage: estimated };
}

// ============================================================================
// ANSWERS → RECORD WRITES
// ============================================================================

/** Tile id → the `maintenance_records.type` it writes. */
export const TILE_RECORD_TYPE = {
  oil: "oil",
  tires: "tires",
  brakes: "brakes",
  battery: "battery",
} as const;

export type QuickCheckServiceTile = keyof typeof TILE_RECORD_TYPE;

/**
 * The catalog service each tile also covers.
 *
 * Both pairings exist because the second service is nearly always done in the
 * same visit as the first, so asking about it separately asks twice about one
 * shop trip. Anything listed here is deliberately absent from
 * `BIGGER_SERVICE_POOL`.
 */
export const COMPANION_SLUG: Partial<Record<QuickCheckServiceTile, string>> = {
  oil: "filter_replacement",
  brakes: "brake_fluid_flush",
};

/** One `api.maintenance.upsertRecord` call. */
export interface QuickCheckRecordWrite {
  type: string;
  lastServiceDate?: number;
  lastServiceMileage?: number;
  customInputs: Record<string, unknown>;
}

export interface QuickCheckWriteAnswer extends QuickCheckAnchorAnswer {
  /** Was the companion service done at the same visit? Absent = not said. */
  companionDone?: boolean;
  /** @deprecated Older drafts wrote this. Read as `companionDone`. */
  filtersDone?: boolean;
  /** Tiles with a symptom row. `none` is the default. */
  symptom?: string;
}

/**
 * Compatibility fields for the v1 readers in `utils/maintenanceStatus.ts`.
 *
 * Those readers key off `tireReplaced`, `brakeFeel` and `batteryReplaced`, and
 * they are shared with the web repo. Writing only the v2 shape would silently
 * drop brake symptom detection and the original-tires inference, so each
 * answer is written in BOTH vocabularies until web has ported the v2 reader.
 *
 * `soft_pedal` → `soft_slow` is the one non-obvious mapping: the v2 chip id
 * and the v1 field value are different spellings of the same symptom, and the
 * reader only recognises the v1 one.
 */
function legacyFields(
  tile: QuickCheckServiceTile,
  answer: QuickCheckWriteAnswer,
): Record<string, unknown> {
  switch (tile) {
    case "tires":
      return {
        tireReplaced:
          answer.answerType === "when" ? "yes"
            : answer.answerType === "never" ? "original"
              : "dont_know",
      };
    case "brakes":
      return {
        brakeFeel:
          answer.symptom === "soft_pedal" ? "soft_slow"
            : answer.symptom === "noise" ? "noise"
              : "normal",
      };
    case "battery":
      return {
        batteryReplaced:
          answer.answerType === "when" ? "yes"
            : answer.answerType === "never" ? "no"
              : "not_sure",
      };
    default:
      return {};
  }
}

/**
 * Every record one answered tile should write, in the order it should write
 * them.
 *
 * Oil produces two: the oil change itself, and the filter row — because the
 * spec's separate `engine_air_filter` and `cabin_filter` types do not exist in
 * the taxonomy (`filter_replacement` is one slug covering both). The filter
 * row is only ANCHORED when the driver said yes; a "no" records that we asked
 * and the filters were not done, which leaves the row genuinely unknown rather
 * than claiming a date it does not have.
 */
export function quickCheckRecordWrites(
  tile: QuickCheckServiceTile,
  answer: QuickCheckWriteAnswer,
  anchorInput: Omit<QuickCheckAnchorInput, "answer">,
): QuickCheckRecordWrite[] {
  const anchor = resolveQuickCheckAnchor({ ...anchorInput, answer });

  const base: Record<string, unknown> = {
    // Marks the row as coming from the driver's own Quick Check answer rather
    // than a shop visit or the enrichment pipeline. `maintenance_records` is
    // one row per (vehicle, type), so provenance has to live in the row — an
    // append-only history needs a sibling event table (see known_issue_events).
    source: "quick_check_v2",
    answerType: answer.answerType,
    ...(answer.month != null ? { answerMonth: answer.month } : {}),
    ...(answer.year != null ? { answerYear: answer.year } : {}),
    ...(answer.miles != null ? { answerMiles: answer.miles } : {}),
    ...(answer.symptom ? { symptom: answer.symptom } : {}),
    ...legacyFields(tile, answer),
  };

  const writes: QuickCheckRecordWrite[] = [
    { type: TILE_RECORD_TYPE[tile], ...anchor, customInputs: base },
  ];

  // The companion row: filters with an oil change, brake fluid with a brake
  // service. Anchored to the same visit only on a definite yes — a "no" says
  // the work was not done then, which is not the same as knowing when it was.
  const companionSlug = COMPANION_SLUG[tile];
  const companionDone = answer.companionDone ?? answer.filtersDone;
  if (companionSlug && companionDone != null) {
    writes.push({
      type: `catalog_${companionSlug}`,
      ...(companionDone ? anchor : {}),
      customInputs: {
        source: "quick_check_v2",
        answerType: companionDone ? answer.answerType : "unsure",
        doneWithParentService: companionDone,
      },
    });
  }

  return writes;
}
