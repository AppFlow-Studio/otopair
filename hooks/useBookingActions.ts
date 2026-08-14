/**
 * useBookingActions — the single client entry point for "what can the customer
 * do to this booking, and what would it cost". Reads the reactive server query
 * `api.bookings.getCustomerBookingActions` (source of truth) and falls back to
 * the optimistic phase model while it loads, for local-only bookings, and
 * offline. BookingCard and BookingDetailsSheet both consume this so their
 * gating is identical by construction.
 */

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { BookingStatus } from "@/components/bookings/BookingCard";
import {
  deriveOptimisticActionState,
  isLocalBookingId,
  type BlockedReason,
  type BookingActionState,
  type CancelKind,
  type RescheduleKind,
} from "@/constants/bookingActionPolicy";

export function useBookingActions(
  bookingId: string | undefined,
  fallbackStatus: BookingStatus,
): BookingActionState {
  const isLocal = isLocalBookingId(bookingId);
  const server = useQuery(
    api.bookings.getCustomerBookingActions,
    !bookingId || isLocal
      ? "skip"
      : { bookingId: bookingId as Id<"bookings"> },
  );

  // Loading / local / not-yours → optimistic phase fallback.
  if (isLocal || server === undefined || server === null) {
    return deriveOptimisticActionState(fallbackStatus);
  }

  const blockedReason: BlockedReason =
    server.blockedReason == null
      ? null
      : server.blockedReason === "work_in_progress"
        ? "work_in_progress"
        : "terminal";

  let cancelKind: CancelKind;
  let rescheduleKind: RescheduleKind;
  if (blockedReason) {
    cancelKind = "blocked";
    rescheduleKind = "blocked";
  } else if (server.cancelKind === "request_shop") {
    cancelKind = "request_shop";
    rescheduleKind = "contact_shop";
  } else {
    cancelKind = server.cancelKind === "late_cancel" ? "late_cancel" : "free";
    rescheduleKind = server.rescheduleKind === "limited" ? "limited" : "free";
  }

  return {
    canCancel: cancelKind !== "blocked" && server.canCancel,
    cancelKind,
    feeCentsIfCancelledNow: server.feeCentsIfCancelledNow,
    canReschedule: rescheduleKind !== "blocked",
    rescheduleKind,
    freeUntilMs: server.freeUntilMs ?? null,
    rescheduleFreeUntilMs: server.rescheduleFreeUntilMs ?? null,
    reschedulesUsed: server.reschedulesUsed,
    maxFreeReschedules: server.maxFreeReschedules,
    cancelRequestedAtMs: server.cancelRequestedAtMs ?? null,
    blockedReason,
    isOptimistic: false,
  };
}
