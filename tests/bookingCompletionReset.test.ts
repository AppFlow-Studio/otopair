import { describe, expect, it } from "vitest";

import { shouldResetBookingAfterConfirmation } from "@/lib/bookingCompletionReset";

describe("shouldResetBookingAfterConfirmation", () => {
  it("clears a completed booking cart after its server record has loaded", () => {
    expect(
      shouldResetBookingAfterConfirmation({
        bookingId: "k57v9s1d8m2q",
        hasConfirmedBooking: true,
        isReschedule: false,
        alreadyReset: false,
      }),
    ).toBe(true);
  });

  it("keeps an unrelated in-progress cart during a reschedule", () => {
    expect(
      shouldResetBookingAfterConfirmation({
        bookingId: "k57v9s1d8m2q",
        hasConfirmedBooking: true,
        isReschedule: true,
        alreadyReset: false,
      }),
    ).toBe(false);
  });
});
