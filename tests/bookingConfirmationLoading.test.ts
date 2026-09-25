import { describe, expect, it } from "vitest";

import { shouldShowBookingConfirmationLoading } from "@/lib/bookingConfirmationLoading";

describe("shouldShowBookingConfirmationLoading", () => {
  it("shows a placeholder while a newly created booking is loading", () => {
    expect(
      shouldShowBookingConfirmationLoading({
        bookingId: "k57v9s1d8m2q",
        bookingQueryResult: undefined,
        isReschedule: false,
      }),
    ).toBe(true);
  });

  it("keeps reschedules and loaded bookings on their existing confirmation view", () => {
    expect(
      shouldShowBookingConfirmationLoading({
        bookingId: "k57v9s1d8m2q",
        bookingQueryResult: undefined,
        isReschedule: true,
      }),
    ).toBe(false);
    expect(
      shouldShowBookingConfirmationLoading({
        bookingId: "k57v9s1d8m2q",
        bookingQueryResult: { id: "k57v9s1d8m2q" },
        isReschedule: false,
      }),
    ).toBe(false);
  });
});
