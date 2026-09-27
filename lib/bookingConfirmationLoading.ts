export function shouldShowBookingConfirmationLoading({
  bookingId,
  bookingQueryResult,
  isReschedule,
}: {
  bookingId: string | undefined;
  bookingQueryResult: unknown | undefined;
  isReschedule: boolean;
}) {
  return Boolean(bookingId && bookingQueryResult === undefined && !isReschedule);
}
