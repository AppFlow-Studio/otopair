/**
 * steps.ts — the first-run tutorial's content, as data.
 *
 * The tour is four teaching steps and a closing card. Keeping that shape here
 * rather than as JSX means the overlay renders a list instead of a switch, and
 * the copy can be handed to AB without touching the animation code it sits
 * inside.
 *
 * WHY THE FIRST FOUR ARE THE ONLY "STEPS": the progress dots count teaching
 * steps, not screens. A closing card with a filled progress bar is telling the
 * driver something they can already see.
 *
 * Ahmad, 2026-09-15: the tour used to open on a "Your car, sorted. / Take the
 * tour / Skip for now" card. It is gone — the tour now opens straight on the
 * first teaching step. Everything below is derived from the array, so removing
 * it needed no changes here; the one thing it did need was the header Skip
 * appearing on index 0, which that card used to cover with its own secondary
 * action. See TutorialOverlay.
 *
 * DESIGN: Figma `kI9Em7mHSzkgAwDCtCNJYi` → T0…T5 · Tutorial, plus the
 * "Tutorial — Interaction Notes" board beside them.
 *
 * OWNER: Ahmad Hamoudeh
 */

/**
 * The shop shown inside the mock screens.
 *
 * Deliberately generic. It was "Chelala Service Center" — a colleague's
 * surname, which reads to a new driver as a specific real business we are
 * recommending before they have seen a single shop.
 *
 * Shared because the name appears in two crops that had already drifted apart
 * (one title-case, one hand-uppercased); the casing is now a style, not a
 * second copy of the string.
 */
export const SAMPLE_SHOP_NAME = "Main Street Auto";

/** Which crop renders inside the phone. `null` on the cards that have none. */
export type TutorialCrop = "home" | "cars" | "bookings" | "oto";

export interface TutorialStep {
  id: string;
  /** Large line. Kept short enough to hold one line at default type scale. */
  headline: string;
  /** One sentence. The reason to care, not a description of the tab. */
  body: string;
  /** Null on the closing card — it carries its own art. */
  crop: TutorialCrop | null;
  /** The closing card sits outside the counted steps. See the note above. */
  counted: boolean;
  primaryCta: string;
  /** Rendered under the primary CTA. Null where the header "Skip" is enough. */
  secondaryCta: string | null;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: "home",
    headline: "Find a shop you can trust",
    body: "Real shops near you, with real prices up front. No calling around for quotes.",
    crop: "home",
    counted: true,
    primaryCta: "Next",
    secondaryCta: null,
  },
  {
    id: "cars",
    headline: "Know what your car needs",
    body: "A live health score, and exactly what's due — before it turns into a repair.",
    crop: "cars",
    counted: true,
    primaryCta: "Next",
    secondaryCta: null,
  },
  {
    id: "bookings",
    headline: "Watch it happen",
    body: "Live updates straight from the shop, so you're never left wondering.",
    crop: "bookings",
    counted: true,
    primaryCta: "Next",
    secondaryCta: null,
  },
  {
    id: "oto",
    headline: "Ask Oto anything",
    body: "Describe a noise, a light, a smell — and get a straight answer before you pay for one.",
    crop: "oto",
    counted: true,
    primaryCta: "Next",
    secondaryCta: null,
  },
  {
    id: "ready",
    headline: "That's the tour",
    body: "Add your car and Otopair starts tracking it straight away. Takes about a minute.",
    crop: null,
    counted: false,
    primaryCta: "Add my car",
    secondaryCta: "I'll do it later",
  },
] as const;

export const TUTORIAL_STEP_COUNT = TUTORIAL_STEPS.length;

/** How many dots to draw. Derived, so adding a step cannot desync the two. */
export const COUNTED_STEP_COUNT = TUTORIAL_STEPS.filter((s) => s.counted).length;

/**
 * Position of `index` among the counted steps, or -1 when it is a card.
 *
 * Drives both the dots and the "Step 2 of 4" a11y announcement, so the thing
 * a sighted user sees and the thing a screen reader hears cannot disagree.
 */
export function countedIndexOf(index: number): number {
  if (index < 0 || index >= TUTORIAL_STEPS.length) return -1;
  if (!TUTORIAL_STEPS[index].counted) return -1;
  let n = 0;
  for (let i = 0; i < index; i++) if (TUTORIAL_STEPS[i].counted) n++;
  return n;
}

/** Screen-reader label for the progress row. Null where no dots render. */
export function progressLabel(index: number): string | null {
  const c = countedIndexOf(index);
  if (c < 0) return null;
  return `Step ${c + 1} of ${COUNTED_STEP_COUNT}`;
}

export function isLastStep(index: number): boolean {
  return index === TUTORIAL_STEPS.length - 1;
}
