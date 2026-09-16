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
  /** They own a car, so a service is actually bookable for it. */
  | "has_vehicle"
  /** They navigated to the screen under their own steam. */
  | "first_visit";

export type CoachRoute =
  | "/home"
  | "/cars"
  | "/bookings"
  // The booking flow. These are group-less paths — `(booking-flow)` is a
  // layout group, so it never appears in `usePathname`.
  | "/select-services"
  | "/category"
  | "/choose-mechanic"
  | "/pick-datetime";

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
  /**
   * Whether the hint swallows taps outside its target. Default true; every
   * mark today sets it false.
   *
   * A hint that blocks the control it is pointing at is a strange thing: tap
   * the search bar it is describing and the only thing that happens is the
   * hint goes away. Non-blocking means the real control fires, the driver
   * gets where they were going, and the hint counts itself acknowledged.
   */
  blocking?: boolean;

  /**
   * Halo around the spotlit element, in points. Default 6.
   *
   * A halo reads as "this thing, plus a little air" — right for a control
   * sitting in open space, too loose round a card that already has its own
   * padding and a 20pt radius, where the extra ring just looks like a miss.
   */
  pad?: number;
}

export const COACH_MARKS: readonly CoachMark[] = [
  {
    id: "search",
    blocking: false,
    target: "home.search",
    route: "/home",
    title: "Find a shop you can trust",
    body: "Search here for real shops near you — with real prices up front, before you call anyone.",
    placement: "below",
    trigger: "first_run",
  },
  {
    id: "health",
    blocking: false,
    target: "cars.health",
    route: "/cars",
    title: "Your car's health, at a glance",
    body: "One score for the whole car. Tap it to see what's pulling the number down.",
    placement: "below",
    trigger: "first_vehicle",
  },
  // ── The booking walkthrough ──────────────────────────────────────────────
  // One hint per step of the flow, each gated on owning a car — there is no
  // point explaining how to book a service to someone with nothing to book
  // it for. They fire as the driver reaches each screen for the first time,
  // so the walkthrough IS the booking rather than a rehearsal of it.
  {
    id: "book_services",
    blocking: false,
    target: "booking.services",
    route: "/select-services",
    title: "Start with what it needs",
    body: "Pick the services you want — or tap a category to browse. You can choose more than one.",
    placement: "above",
    trigger: "has_vehicle",
  },
  {
    id: "book_services_detail",
    blocking: false,
    pad: 2,
    target: "booking.serviceList",
    route: "/category",
    title: "Add what you need",
    body: "Tap a service to add it — the cart at the bottom keeps count. The \u201c?\u201d on each row explains what the job actually involves.",
    placement: "below",
    trigger: "has_vehicle",
  },
  {
    id: "book_shop",
    blocking: false,
    target: "booking.shops",
    route: "/choose-mechanic",
    title: "Compare real shops",
    body: "Swipe between shops to see who covers everything you picked, and what each one charges. The map follows along.",
    placement: "above",
    trigger: "has_vehicle",
  },
  {
    id: "book_confirm",
    blocking: false,
    target: "booking.confirm",
    route: "/pick-datetime",
    title: "Check this before you commit",
    body: "Your time, the price, and the cancellation window all sit here — nothing is charged until a mechanic has looked at the car.",
    placement: "above",
    trigger: "has_vehicle",
  },
  {
    id: "live",
    blocking: false,
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
] as const;

/** Storage key for a mark's seen-flag. */
export function coachMarkKey(id: string): string {
  return `otopair.coach.${id}`;
}

export function marksForRoute(pathname: string | null | undefined): CoachMark[] {
  if (!pathname) return [];
  return COACH_MARKS.filter((m) => pathname.startsWith(m.route));
}
