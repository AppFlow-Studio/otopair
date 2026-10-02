/**
 * Shared between `convex/vehicles.ts` (which throws it) and the Cars screen
 * (which recognises it). `removeOwner` refuses a car that still has an
 * upcoming booking by throwing a ConvexError whose data carries this code and
 * the booking to open (#395 / #396).
 */
export const UPCOMING_BOOKING_ERROR_CODE = "VEHICLE_HAS_UPCOMING_BOOKING";

export type UpcomingBookingErrorData = {
  code: typeof UPCOMING_BOOKING_ERROR_CODE;
  bookingId: string;
  // "Thu, Oct 1" — lets the app's two-line notice name the day without the
  // full sentence. Absent when the booking has no date.
  dateLabel?: string;
  message: string;
};

export function isUpcomingBookingErrorData(data: unknown): data is UpcomingBookingErrorData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    d.code === UPCOMING_BOOKING_ERROR_CODE &&
    typeof d.bookingId === "string" &&
    typeof d.message === "string"
  );
}
