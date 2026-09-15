/**
 * coachSteps.ts — the in-app spotlight tour, as data.
 *
 * Runs AFTER the phone-mock tour (components/tutorial). That one explains
 * what Otopair does using pictures of the app; this one points at the real
 * thing and makes the driver tap it.
 *
 * DESIGN: Figma `kI9Em7mHSzkgAwDCtCNJYi` → C1…C4 + the Spec panel.
 *
 * WHY NO TAB-BAR STEPS: on iOS 26+ the app renders `NativeTabs`, a real
 * UIKit tab bar. Its items are not React Native views, so they cannot be
 * measured and a hole cannot be cut over them. Every step here points at
 * something inside the screen, and the tour navigates between tabs itself.
 *
 * NOT YET ANCHORED. Two more steps are designed and ready to drop in as
 * soon as their targets get a <CoachTarget>/useCoachAnchor:
 *
 *   home.priority   the NOW card at the top of Home — "We tell you what's
 *                   due", with the reason it fired and a price before you book
 *   bookings.live   the live-tracking card — "Watch it happen"
 *
 * They are left out rather than left in, because a step whose target never
 * reports is skipped, and a tour that silently jumps from 2 to 4 reads as
 * broken rather than as unfinished.
 *
 * OWNER: Ahmad Hamoudeh
 */

export interface CoachStep {
  id: string;
  /** Must match a <CoachTarget id="..."> somewhere in the app. */
  target: string;
  /** Route this step lives on. The tour navigates here before measuring. */
  route: "/home" | "/cars" | "/bookings" | "/ai-chat";
  title: string;
  body: string;
  /**
   * Preferred side. The overlay flips to the other side when the target is
   * too close to that edge, so this is a preference and not a guarantee.
   */
  placement: "below" | "above";
}

export const COACH_STEPS: readonly CoachStep[] = [
  {
    id: "search",
    target: "home.search",
    route: "/home",
    title: "Find a shop you can trust",
    body: "Search here for real shops near you — with real prices up front, before you call anyone.",
    placement: "below",
  },
  {
    id: "health",
    target: "cars.health",
    route: "/cars",
    title: "One score for the whole car",
    body: "Tap it any time to see what's pulling the number down — and what it would take to fix.",
    placement: "below",
  },
  {
    id: "oto",
    target: "oto.composer",
    route: "/ai-chat",
    title: "Ask Oto anything",
    body: "Describe a noise, a light, a smell — and get a straight answer before you pay for one.",
    placement: "above",
  },
] as const;

export const COACH_STEP_COUNT = COACH_STEPS.length;

export function isLastCoachStep(index: number): boolean {
  return index === COACH_STEPS.length - 1;
}

/** Screen-reader label for the footer counter. */
export function coachProgressLabel(index: number): string | null {
  if (index < 0 || index >= COACH_STEPS.length) return null;
  return `Step ${index + 1} of ${COACH_STEP_COUNT}`;
}
