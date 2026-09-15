/**
 * coachSteps.ts — the in-app spotlight tour, as data.
 *
 * Runs AFTER the phone-mock tour (components/tutorial). That one explains
 * what Otopair does using pictures of the app; this one points at the real
 * thing and makes the driver tap it.
 *
 * DESIGN: Figma `kI9Em7mHSzkgAwDCtCNJYi` → C1…C4 + the Spec panel.
 *
 * TARGETS ARE ELEMENTS, NOT CONTAINERS. The first pass anchored to whichever
 * View happened to wrap the area — `carouselContainer` on Home, the whole
 * quick-read card on Cars — and the result was a hole the size of half the
 * screen with four unrelated things inside it, pointed at by copy about one
 * of them. Every target below is the smallest element that IS the thing the
 * step is about, and CoachOverlay refuses to spotlight anything bigger than
 * MAX_TARGET_FRACTION of the screen so that mistake cannot ship again.
 *
 * WHY NO TAB-BAR STEPS: on iOS 26+ the app renders `NativeTabs`, a real
 * UIKit tab bar. Its items are not React Native views, so they cannot be
 * measured and a hole cannot be cut over them. Every step here points at
 * something inside the screen, and the tour navigates between tabs itself.
 *
 * A step whose target never reports is skipped rather than stranding the
 * driver behind a scrim — so `bookings.live` drops out cleanly for someone
 * with no car at a shop, which is most new drivers, and the tour renumbers
 * itself because the count is derived.
 *
 * ONE STEP IS MISSING ON PURPOSE: "what your car needs next", pointing at
 * the maintenance card on Home. The anchor is in place
 * (components/home/VehicleMaintenanceCard.tsx) and measures correctly — it
 * just measures to y≈931 on an 874pt screen, because those cards live below
 * the fold until the driver scrolls. Spotlighting them needs the tour to
 * scroll a target into view first, which nothing here does yet. The step is
 * out rather than in, because a step that silently skips is a tour that
 * counts to five and shows four.
 *
 * OWNER: Ahmad Hamoudeh
 */

export interface CoachStep {
  id: string;
  /**
   * A <CoachTarget id="..."> / useCoachAnchor somewhere in the app, or null
   * for a step that is a plain card with no spotlight (the closing one).
   */
  target: string | null;
  /** Route this step lives on. The tour navigates here before measuring. */
  route: "/home" | "/cars" | "/bookings" | "/ai-chat";
  title: string;
  body: string;
  /**
   * Preferred side. The overlay flips to the other side when the target is
   * too close to that edge, so this is a preference and not a guarantee.
   */
  placement: "below" | "above";
  /** Label for the advance control. Defaults to Next / Finish. */
  cta?: string;
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
    title: "Your car's health, at a glance",
    body: "One score for the whole car. Tap it to see what's pulling the number down.",
    placement: "below",
  },
  {
    id: "live",
    target: "bookings.live",
    route: "/bookings",
    title: "Watch it happen",
    body: "Once a shop has your car, every stage lands here live — so you are never left wondering.",
    placement: "below",
  },
  {
    // Deliberately targetless. The Oto tab shows one of three different
    // screens depending on whether the driver has cars, has chatted before,
    // or is mid-thread — and the only element common to all of them is the
    // composer, which the welcome screen does not render. Anchoring any of
    // them meant the step skipped on the exact screen it was describing.
    // Dimming the real Oto tab behind a centred card says the same thing and
    // cannot miss; it is also the shape of the Vivid reference in the brief.
    id: "oto",
    target: null,
    route: "/ai-chat",
    title: "Ask Oto anything",
    body: "Describe a noise, a light, a smell — and get a straight answer before you pay anyone to look at it.",
    placement: "below",
  },
  {
    id: "done",
    target: null,
    route: "/home",
    title: "That's the tour",
    body: "Add your car and Otopair starts tracking what it needs straight away. Takes about a minute.",
    placement: "below",
    cta: "Add my car",
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
