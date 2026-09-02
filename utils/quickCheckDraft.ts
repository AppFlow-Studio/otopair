/**
 * Rehydrating a saved Quick Check — Spec v2 §7 step 10.
 *
 * `vehicle_owners.serviceHistoryDraft` is `v.any()` and outlives the code that
 * wrote it. Two kinds of stale draft exist in the wild right now:
 *
 *   - v1 drafts, whose `answers` are a per-question map (`{ oilRecency:
 *     "few_months" }`) rather than the single `QuickCheckAnswer` v2 saves;
 *   - drafts listing tiles that no longer fire for this car, because the
 *     firing rules are per-vehicle now and a car's mileage moves.
 *
 * Trusting either is worse than dropping it. A v1 answer rehydrates as a
 * completed tile that writes NOTHING on save — `persistAnswers` skips anything
 * without an `answerType` — so the driver sees five ticks, taps Complete, and
 * silently records nothing. And a stale tile inflates the "N of M" counter past
 * its own total.
 *
 * So the draft is evidence, not state: every entry has to prove it is a v2
 * answer for a tile this car is actually being asked about.
 */

/** The one tile whose completion is not evidenced by an answer. */
const BIGGER_SERVICES_ID = "biggerServices";

/** Shape stored under `vehicle_owners.serviceHistoryDraft`. Everything is
 *  optional because the value is `v.any()` and may predate any given field. */
export interface ServiceHistoryDraftRaw {
  answers?: Record<string, unknown> | null;
  /** v1 only — there is no question index in v2. Read and ignored. */
  questionIndex?: Record<string, number> | null;
  progress?: Record<string, number> | null;
  completed?: string[] | null;
}

export interface HydratedDraft<TId extends string> {
  answers: Partial<Record<TId, Record<string, unknown>>>;
  progress: Partial<Record<TId, number>>;
  completed: TId[];
}

/** A v2 answer, minimally. `answerType` is the discriminator every v1 shape
 *  lacks, and the one `persistAnswers` requires to write anything. */
function isV2Answer(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const t = (value as { answerType?: unknown }).answerType;
  return t === "when" || t === "never" || t === "unsure";
}

/**
 * Keep only what is still true.
 *
 * `firedIds` is the tile set this car is being asked about right now — the
 * same list the grid renders and the counter counts.
 *
 * Completion is DERIVED from the surviving answers rather than taken from the
 * draft's own `completed` array. The two could disagree, and when they do the
 * answers are the ones that write records, so they are the ones that decide
 * what counts as answered.
 */
export function hydrateServiceHistoryDraft<TId extends string>(
  raw: ServiceHistoryDraftRaw | null | undefined,
  firedIds: readonly TId[],
): HydratedDraft<TId> {
  const empty: HydratedDraft<TId> = { answers: {}, progress: {}, completed: [] };
  if (!raw || typeof raw !== "object") return empty;

  const fired = new Set<string>(firedIds);
  const answers: Partial<Record<TId, Record<string, unknown>>> = {};
  const progress: Partial<Record<TId, number>> = {};
  const completed: TId[] = [];

  for (const [id, value] of Object.entries(raw.answers ?? {})) {
    if (!fired.has(id)) continue;
    if (!isV2Answer(value)) continue;
    const tileId = id as TId;
    answers[tileId] = value;
    progress[tileId] = 1;
    completed.push(tileId);
  }

  // Bigger Services is the one tile that stores no answer of its own — its
  // rows write catalog records directly — so "the driver looked at it" can
  // only come from the draft's own completed list. Every other tile has to
  // show its working.
  if (
    fired.has(BIGGER_SERVICES_ID) &&
    (raw.completed ?? []).includes(BIGGER_SERVICES_ID) &&
    // The loop above may already have claimed it if a draft somehow carries
    // an answer for it too — listing it twice would double-count "N of M".
    !completed.includes(BIGGER_SERVICES_ID as TId)
  ) {
    completed.push(BIGGER_SERVICES_ID as TId);
    progress[BIGGER_SERVICES_ID as TId] = 1;
  }

  return { answers, progress, completed };
}
