/**
 * coachMarks.ts — the in-app spotlight hints, as data.
 *
 * NOT a tour. This used to be one linear five-step walk that ran straight
 * after the phone-mock tutorial and marched the driver Home → Cars →
 * Bookings → Oto. The trouble with that shape is that it explained the
 * health score to someone with no car and live job tracking to someone who
 * had never booked anything — the two things it most needed to explain were
 * shown at the exact moment they meant least.
 *
 * So each hint now waits for the moment it is about, and fires once:
 *
 *   search   Home, on first run. Nothing to wait for — finding a shop is
 *            what a new driver is here to do.
 *   health   the first time they have a car to score.
 *   live     the first time they have a booking to track.
 *   oto      the first time they open the Oto tab THEMSELVES. Nothing drags
 *            them there; if they never go, they never see it.
 *
 * Each is independent: its own trigger, its own seen-flag, no ordering
 * between them and no counter. A driver who books before adding a car gets
 * them in that order, and one who never opens Oto simply never sees that
 * one.
 *
 * DESIGN: Figma `kI9Em7mHSzkgAwDCtCNJYi` → C1…C4 + the Spec panel.
 *
 * WHY NO TAB-BAR TARGETS: on iOS 26+ the app renders `NativeTabs`, a real
 * UIKit tab bar whose items are not React Native views, so they cannot be
 * measured and a hole cannot be cut over them.
 *
 * OWNER: Ahmad Hamoudeh
 */

/** What has to be true before a mark is allowed to show. */
export type CoachTrigger =
  /** The phone-mock tutorial is behind them. Nothing else required. */
  | "first_run"
  /** They have at least one vehicle. */
  | "first_vehicle"
  /** They have at least one booking. */
  | "first_booking"
  /** They navigated to the screen under their own steam. */
  | "first_visit";

export type CoachRoute = "/home" | "/cars" | "/bookings" | "/ai-chat";

export interface CoachMark {
  /** Also the storage key suffix — changing it re-shows the mark. */
  id: string;
  /** A <CoachTarget id="..."> / useCoachAnchor somewhere in the app. */
  target: string;
  /** The screen this mark belongs to. Never navigated to; only waited for. */
  route: CoachRoute;
  title: string;
  body: string;
  /** Preferred side. The overlay flips it when the target sits near an edge. */
  placement: "below" | "above";
  trigger: CoachTrigger;
}

export const COACH_MARKS: readonly CoachMark[] = [
  {
    id: "search",
    target: "home.search",
    route: "/home",
    title: "Find a shop you can trust",
    body: "Search here for real shops near you — with real prices up front, before you call anyone.",
    placement: "below",
    trigger: "first_run",
  },
  {
    id: "health",
    target: "cars.health",
    route: "/cars",
    title: "Your car's health, at a glance",
    body: "One score for the whole car. Tap it to see what's pulling the number down.",
    placement: "below",
    trigger: "first_vehicle",
  },
  {
    id: "live",
    target: "bookings.live",
    route: "/bookings",
    // Deliberately not "watch it happen" any more. This now fires on a
    // freshly-made booking, which is confirmed rather than in progress —
    // promising live stages next to a job nobody has started reads as broken.
    title: "Your booking lives here",
    body: "Every update from the shop lands on this card — from confirmed, through the work itself, to ready for pickup.",
    placement: "below",
    trigger: "first_booking",
  },
  {
    id: "oto",
    target: "oto.ask",
    route: "/ai-chat",
    title: "Ask Oto anything",
    body: "Describe a noise, a light, a smell — and get a straight answer before you pay anyone to look at it.",
    placement: "above",
    trigger: "first_visit",
  },
] as const;

/** Storage key for a mark's seen-flag. */
export function coachMarkKey(id: string): string {
  return `otopair.coach.${id}`;
}

export function marksForRoute(pathname: string | null | undefined): CoachMark[] {
  if (!pathname) return [];
  return COACH_MARKS.filter((m) => pathname.startsWith(m.route));
}
