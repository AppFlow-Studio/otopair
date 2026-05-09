/**
 * bookingStages
 *
 * Maps a booking's `status` (and `live_stage` when in progress) to a
 * 5-segment service progress bar or 3-segment tire-quote progress bar.
 * Mirrors the lifecycle defined server-side in
 * `convex/bookings.ts:LIVE_STAGE_TITLES` so the client doesn't drift.
 *
 * Service flow:
 *   pending → confirmed → in_progress (service_in_progress)
 *           → in_progress (vehicle_ready) → completed
 *
 * Tire-quote flow:
 *   pending_quote → quotes_ready → (accepted = service flow)
 */

import type { BookingStatus } from "@/components/bookings/BookingCard";

export const SERVICE_STAGES = [
  "Booked",
  "Confirmed",
  "Servicing",
  "Vehicle Ready",
  "Completed",
] as const;

export const QUOTE_STAGES = [
  "Request Sent",
  "Quotes Ready",
  "Accepted",
] as const;

export interface BookingStageView {
  /** Human-readable stage labels — render under each segment if needed. */
  stages: readonly string[];
  /** 0-based index of the highest filled segment. -1 means none filled
   *  (used for cancelled bookings shown in History). */
  currentIndex: number;
}

export function getBookingStageView(
  status: BookingStatus,
  liveStage?: string,
): BookingStageView {
  // Quote-stage flow — three segments. Once the user accepts, the
  // booking flips to `confirmed` and moves to the service flow below.
  if (status === "pending_quote") {
    return { stages: QUOTE_STAGES, currentIndex: 0 };
  }
  if (status === "quotes_ready") {
    return { stages: QUOTE_STAGES, currentIndex: 1 };
  }

  // Service flow — five segments.
  if (status === "pending") {
    return { stages: SERVICE_STAGES, currentIndex: 0 };
  }
  if (status === "confirmed") {
    return { stages: SERVICE_STAGES, currentIndex: 1 };
  }
  if (status === "in_progress") {
    // The convex side stamps `live_stage` on the booking when the
    // mechanic moves through the job. `vehicle_ready` is the last
    // pre-completion sub-stage; treat anything else (or missing) as
    // mid-service.
    if (liveStage === "vehicle_ready") {
      return { stages: SERVICE_STAGES, currentIndex: 3 };
    }
    return { stages: SERVICE_STAGES, currentIndex: 2 };
  }
  if (status === "completed") {
    return { stages: SERVICE_STAGES, currentIndex: 4 };
  }

  // Cancelled / delayed — render the bar grayed out so the card still
  // has consistent visual structure but conveys "not progressing".
  return { stages: SERVICE_STAGES, currentIndex: -1 };
}
