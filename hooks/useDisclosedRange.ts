/**
 * useDisclosedRange — Convenience hook for reading the customer-facing
 * disclosed price range from a booking row. Wraps the pure helper in
 * `lib/disclosedRange.ts` for ergonomic use inside booking detail / confirm
 * status screens.
 *
 * For the pre-booking screen (ReviewPayContent), use `deriveDisclosedRange`
 * directly with a `useMemo` — the inputs are already computed locally and
 * there's no booking row to read from yet.
 */

import { useMemo } from "react";
import {
  disclosedRangeFromBooking,
  type SnapshottedRange,
} from "@/lib/disclosedRange";

type BookingWithRangeFields = {
  disclosed_range_low_cents?: number | null;
  disclosed_range_high_cents?: number | null;
} | null | undefined;

export function useDisclosedRange(booking: BookingWithRangeFields): SnapshottedRange {
  return useMemo(
    () => disclosedRangeFromBooking(booking),
    [booking?.disclosed_range_low_cents, booking?.disclosed_range_high_cents],
  );
}
