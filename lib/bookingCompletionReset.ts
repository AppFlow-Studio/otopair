export function shouldResetBookingAfterConfirmation({
  bookingId,
  hasConfirmedBooking,
  isReschedule,
  alreadyReset,
}: {
  bookingId: string | undefined;
  hasConfirmedBooking: boolean;
  isReschedule: boolean;
  alreadyReset: boolean;
}) {
  return Boolean(bookingId && hasConfirmedBooking && !isReschedule && !alreadyReset);
}
