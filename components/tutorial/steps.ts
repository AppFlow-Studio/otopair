/**
 * steps.ts — the first-run tutorial's content, as data.
 *
 * The tour is a title card, four teaching steps, and a closing card. Keeping
 * that shape here rather than as JSX means the overlay renders a list instead
 * of a switch, and the copy can be handed to AB without touching the animation
 * code it sits inside.
 *
 * WHY THE MIDDLE FOUR ARE THE ONLY "STEPS": the progress dots count teaching
 * steps, not screens. A title card with "1 of 6" under it promises a longer
 * sit than it delivers, and a closing card with a filled progress bar is
 * telling the driver something they can already see.
 *
 * DESIGN: Figma `kI9Em7mHSzkgAwDCtCNJYi` → T0…T5 · Tutorial, plus the
 * "Tutorial — Interaction Notes" board beside them.
 *
 * OWNER: Ahmad Hamoudeh
 */

/** Which crop renders inside the phone. `null` on the cards that have none. */
export type TutorialCrop = "home" | "cars" | "bookings" | "oto";

export interface TutorialStep {
  id: string;
  /** Large line. Kept short enough to hold one line at default type scale. */
  headline: string;
  /** One sentence. The reason to care, not a description of the tab. */
  body: string;
  /** Null on the title and closing cards — they carry their own art. */
  crop: TutorialCrop | null;
  /** Title/closing cards sit outside the counted steps. See the note above. */
  counted: boolean;
  primaryCta: string;
  /** Rendered under the primary CTA. Null where the header "Skip" is enough. */
  secondaryCta: string | null;
}

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: "welcome",
    headline: "Your car, sorted.",
    body: "Otopair tracks what your car needs, tells you when it matters, and books it with a shop you can trust.",
    crop: null,
    counted: false,
    primaryCta: "Take the tour",
    secondaryCta: "Skip for now",
  },
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
