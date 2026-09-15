/**
 * The pre-booking cancellation disclosure must match the policy that is
 * actually enforced.
 *
 * Ahmad, 2026-09-15: the Confirm Booking bar read "Free cancellation up to
 * 2 hours before your appointment" while `POLICY_DEFAULTS.cancelFreeCutoffHours`
 * was 24. Nobody noticed because the two numbers live in different halves of
 * the repo and nothing compared them.
 *
 * Terms of Use §6 says the window and the fee are shown before the booking is
 * confirmed, so a drift here is not a copy nit — it is the app disclaiming a
 * fee on terms it does not actually apply.
 *
 * The client constants are a deliberate duplicate (nothing under components/
 * imports from convex/lib). This test is the thing that makes the duplicate
 * safe, so if it is ever deleted, import directly instead.
 */
import { describe, expect, it } from "vitest";
import {
  CANCEL_FREE_CUTOFF_HOURS_DEFAULT,
  CANCEL_LATE_FEE_CENTS_DEFAULT,
  cancellationDisclosure,
} from "@/constants/bookingActionPolicy";
import { POLICY_DEFAULTS } from "../convex/lib/cancellation_policy";
import { BOOKING_DEPOSIT_CENTS } from "../convex/lib/payment_constants";

describe("the disclosure matches the enforced policy", () => {
  it("uses the same free-cancel cutoff the server does", () => {
    expect(CANCEL_FREE_CUTOFF_HOURS_DEFAULT).toBe(POLICY_DEFAULTS.cancelFreeCutoffHours);
  });

  it("uses the same late-cancellation fee the server charges", () => {
    expect(CANCEL_LATE_FEE_CENTS_DEFAULT).toBe(POLICY_DEFAULTS.cancelLateFeeCents);
  });

  it("quotes a fee no larger than the hold it is captured from", () => {
    // The fee is a partial capture of the $20 authorization. Quoting more than
    // the hold would promise a charge the payment path cannot actually take.
    expect(CANCEL_LATE_FEE_CENTS_DEFAULT).toBeLessThanOrEqual(BOOKING_DEPOSIT_CENTS);
  });

  it("charges the same for a no-show as for a late cancel", () => {
    // The copy covers both in one sentence; that only stays true while the two
    // fees agree.
    expect(POLICY_DEFAULTS.noShowFeeCents).toBe(POLICY_DEFAULTS.cancelLateFeeCents);
  });
});

describe("the sentence itself", () => {
  it("states the real window and the real fee", () => {
    const s = cancellationDisclosure();
    expect(s).toContain("24 hours");
    expect(s).toContain("$20");
  });

  it("no longer says two hours", () => {
    expect(cancellationDisclosure()).not.toContain("2 hours");
  });

  it("covers the no-show case, not just cancellation", () => {
    expect(cancellationDisclosure().toLowerCase()).toContain("show");
  });

  it("renders a shop override rather than the default when given one", () => {
    // Nothing passes these yet — no client query selects the per-shop columns.
    // The arguments exist so that wiring them up later is a one-line change
    // at the call site instead of a rewrite of the copy.
    const s = cancellationDisclosure(48, 1500);
    expect(s).toContain("48 hours");
    expect(s).toContain("$15");
  });

  it("does not pluralise a one-hour window", () => {
    expect(cancellationDisclosure(1, 1000)).toContain("1 hour ");
  });
});
