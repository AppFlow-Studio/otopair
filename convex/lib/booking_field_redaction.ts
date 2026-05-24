/**
 * booking_field_redaction.ts — Server-side enforcement of the anti-anchoring
 * boundary in the Pre-Job Approval Booking Flow.
 *
 * (Mirror of otopair-web/convex/lib/booking_field_redaction.ts.)
 *
 * The customer's disclosed range is the customer's contract with Otopair.
 * If the mechanic could see the ceiling they could anchor their set price
 * to it. UI hiding alone is not sufficient; this helper strips the range
 * fields before returning the booking to any mechanic-facing surface.
 */

import type { Doc } from "../_generated/dataModel";

type Booking = Doc<"bookings">;

const MECHANIC_FORBIDDEN_FIELDS = [
  "disclosed_range_low_cents",
  "disclosed_range_high_cents",
  "disclosed_breakdown",
  "running_approved_ceiling_cents",
] as const;

export function stripRangeFieldsForMechanic<T extends Partial<Booking> | null | undefined>(
  booking: T,
): T {
  if (!booking) return booking;
  const cleaned: Record<string, unknown> = { ...booking };
  for (const field of MECHANIC_FORBIDDEN_FIELDS) {
    delete cleaned[field];
  }
  return cleaned as T;
}

export function stripRangeFieldsForMechanicList<T extends Partial<Booking>>(
  bookings: T[],
): T[] {
  return bookings.map((b) => stripRangeFieldsForMechanic(b));
}
