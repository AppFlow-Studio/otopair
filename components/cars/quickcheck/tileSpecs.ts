/**
 * Quick Check tile descriptors — Spec v2 §5.
 *
 * Every service tile asks the same three questions in the same order, so the
 * pattern is learned once. What varies per tile is small and declarative:
 * the question, the wording of the "Never" row, whether a miles field makes
 * sense, and whether there is a symptom chip row. That is what lives here, so
 * there is one sheet component rather than five.
 *
 * The v1 recency buckets ("Recently", "A few months ago", "Over 6 months ago")
 * are gone. They carried almost no information — every answer collapsed to a
 * guessed date — where a month and year is a real anchor.
 */
import type { QuickCheckTileId } from "@/utils/quickCheckFiring";

export type QuickCheckAnswerType = "when" | "never" | "unsure";

/** The universal three rows. `never` flexes its wording per tile because
 *  "Never" alone is ambiguous on tires and battery — "still the originals" is
 *  a real and useful answer. `unsure` is worded identically everywhere on
 *  purpose: it is the row the diagnostic prompt hangs off. */
export interface TileSpec {
  /** A tile id for the five fixed tiles, or a taxonomy slug for a catalog
   *  service asked through the same sheet. Widened to `string` when Bigger
   *  Services and the tracker's UNKNOWN rows converged onto this component —
   *  one control, one vocabulary, three surfaces. */
  id: string;
  /** Sheet title. */
  question: string;
  /** Shown in Guided mode only. */
  subtitle: string;
  /** Row 1 label — "I know roughly when", or "Yes, roughly when" on battery
   *  where the question is phrased as a yes/no. */
  whenLabel: string;
  /** Row 2 label. */
  neverLabel: string;
  /** Battery has no miles field: a battery's age is what matters and asking
   *  for an odometer reading implies otherwise. */
  showMilesField: boolean;
  /** A follow-up toggle inside the "when" row: "and was X done too?".
   *  Oil asks about filters; brakes asks about the fluid flush. Both exist
   *  because the second service is nearly always done alongside the first,
   *  so asking it as its own tile is asking twice about one shop visit.
   *  `companionSlug` is the catalog row the answer writes to. */
  companion?: { label: string; slug: string };
  /** @deprecated Use `companion`. Kept so an in-flight draft still reads. */
  filtersToggle?: boolean;
  /** Always-visible chip row, separate from the three answer rows. History and
   *  symptom are different facts; v1 conflated them by letting "feels fine"
   *  mean ON TIME, which is untrue on a 60k car with no service history. */
  symptoms?: { id: string; label: string }[];
}

/** "Nothing" is the default on every symptom row — a driver who notices
 *  nothing should not have to say so explicitly. */
export const SYMPTOM_NONE = "none";

export type FixedTileId = Exclude<QuickCheckTileId, "biggerServices">;

export const TILE_SPECS: Record<FixedTileId, TileSpec> = {
  warningLights: {
    id: "warningLights",
    question: "Any lights on your dash right now?",
    subtitle: "The quickest honest read on your car.",
    whenLabel: "Yes, one or more",
    neverLabel: "All clear",
    showMilesField: false,
  },
  oil: {
    id: "oil",
    question: "When was your last oil change?",
    subtitle: "One answer covers oil, engine filter, and cabin filter.",
    whenLabel: "I know roughly when",
    neverLabel: "Never on this car",
    showMilesField: true,
    companion: { label: "Filters done with it?", slug: "filter_replacement" },
  },
  tires: {
    id: "tires",
    question: "When were your tires last replaced?",
    subtitle: "Replaced, original, or telling you something.",
    whenLabel: "I know roughly when",
    // "Never" is ambiguous here — original tires is a real answer, not an
    // absence of one.
    neverLabel: "Never — still the originals",
    showMilesField: true,
    symptoms: [
      { id: "losing_air", label: "Losing air" },
      { id: "vibration", label: "Vibration" },
      { id: SYMPTOM_NONE, label: "Nothing" },
    ],
  },
  brakes: {
    id: "brakes",
    question: "When were your brakes last serviced?",
    subtitle: "Noise and feel tell us more than dates.",
    whenLabel: "I know roughly when",
    neverLabel: "Never on this car",
    showMilesField: true,
    // Yassin: "if brakes are marked as done, it could also mean brake fluid
    // was flushed — combine those two questions into one." Same shape as oil
    // and its filters, and it takes brake fluid out of Bigger Services.
    companion: { label: "Fluid flushed too?", slug: "brake_fluid_flush" },
    symptoms: [
      { id: "noise", label: "Noise" },
      // Soft pedal is the one symptom that earns a calm follow-up rather than
      // just a flag — carried over from the Feb Quick Read spec.
      { id: "soft_pedal", label: "Soft pedal" },
      { id: SYMPTOM_NONE, label: "Nothing" },
    ],
  },
  battery: {
    id: "battery",
    // Phrased as a yes/no because "when was it last replaced" presumes it has
    // been. Fixes the v1 gap where "within 2 years" and "3+ years ago" left
    // year 2–3 unanswerable.
    question: "Has the battery ever been replaced?",
    subtitle: "Batteries age by years, not miles.",
    whenLabel: "Yes, roughly when",
    neverLabel: "No — original battery",
    showMilesField: false,
  },
};

/** Warning lights the driver can pick from (§5). Ids are the canonical
 *  vocabulary in `lib/warningLightVocab.ts`, so they score without
 *  translation. `not_sure_which` is "something's on but I can't tell what" —
 *  a CONFIRMED light, which is why it deducts, unlike skipping the tile. */
export const WARNING_LIGHT_OPTIONS: { id: string; label: string }[] = [
  { id: "check_engine", label: "Check engine" },
  { id: "oil_pressure", label: "Oil pressure" },
  { id: "temperature", label: "Temperature" },
  { id: "battery_charging", label: "Battery" },
  { id: "abs", label: "ABS / brakes" },
  { id: "tpms", label: "Tire pressure" },
  { id: "airbag_srs", label: "Airbag" },
  { id: "transmission", label: "Transmission" },
  { id: "not_sure_which", label: "Something else" },
];

/** What a completed sheet hands back. */
export interface QuickCheckAnswer {
  answerType: QuickCheckAnswerType;
  /** 1–12. Only set when `answerType === "when"`. */
  month?: number;
  /** Four-digit year. Only set when `answerType === "when"`. */
  year?: number;
  /** Odometer at the service, if the driver happened to know it. Optional by
   *  design — the velocity estimate covers its absence. */
  miles?: number;
  /** Was the companion service done at the same visit? Absent means the
   *  driver did not say. */
  companionDone?: boolean;
  /** @deprecated Read as `companionDone` on rehydrate. */
  filtersDone?: boolean;
  /** Symptom chip, when the tile has a row. `none` is the default. */
  symptom?: string;
  /** Warning lights only: the canonical light ids that are on. */
  lights?: string[];
}

/**
 * A spec for any catalog service, built from its taxonomy label.
 *
 * This is what replaced `ServiceRecencySheet`'s six recency buckets. Those
 * buckets were the v1 vocabulary — "Recently", "A few months ago", "Over 6
 * months ago" — and every one of them collapsed to a guessed date. Asking the
 * same question two different ways on two different screens is exactly what
 * the spec set out to remove, so Bigger Services and the tracker's UNKNOWN
 * rows now ask it the way the Quick Check does.
 *
 * No symptom row and no filters toggle: those are properties of the four fixed
 * tiles, not of a service in general.
 */
export function catalogTileSpec(slug: string, label: string): TileSpec {
  return {
    id: slug,
    // "When did you last have a brake fluid flush?" rather than "When was your
    // brake fluid flush last done?" — the labels are already noun phrases for
    // the work itself, so this is the phrasing that reads naturally across all
    // of them.
    question: `When did you last have a ${label.toLowerCase()}?`,
    subtitle: "Your answer replaces our estimate.",
    whenLabel: "I know roughly when",
    neverLabel: "Never on this car",
    showMilesField: true,
  };
}
