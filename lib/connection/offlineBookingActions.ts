/**
 * Which booking actions survive going offline. One rule, shared by
 * BookingCard and BookingDetailsSheet so the card and the sheet can never
 * disagree: actions that need the backend (writes / in-app chat) require
 * `canWrite` (see useCanWrite); actions that only read cached data or hand
 * off to another app on the device (maps, dialer, calendar) always work.
 */
export type BookingAction =
  | "viewDetails"
  | "cancelBooking"
  | "reschedule"
  | "messageMechanic"
  | "leaveReview"
  | "directions"
  | "contact"
  | "addToCalendar";

const NEEDS_BACKEND: ReadonlySet<BookingAction> = new Set([
  "cancelBooking",
  "reschedule",
  "messageMechanic",
  "leaveReview",
]);

export function isBookingActionAllowed(
  action: BookingAction,
  canWrite: boolean,
): boolean {
  return canWrite || !NEEDS_BACKEND.has(action);
}
