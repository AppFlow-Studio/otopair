/**
 * bookingActionPolicy — client-side types + optimistic fallback for the
 * cancellation / reschedule action policy. The server query
 * `api.bookings.getCustomerBookingActions` is the source of truth (fees,
 * cutoffs, limits); this module supplies the TypeScript shape, an optimistic
 * phase→capability fallback used while that query loads / for local-only
 * bookings / offline, and the confirm-dialog copy. Pure — no React, no Convex.
 *
 * See hooks/useBookingActions.ts (consumes the server query) and the
 * phase→action matrix in the plan.
 */

import type { BookingStatus } from "@/components/bookings/BookingCard";

/** What the Cancel affordance does in the current phase. */
export type CancelKind =
  | "free" // no fee — cancel outright
  | "late_cancel" // within cutoff — a deposit-forfeit fee applies
  | "request_shop" // vehicle_at_shop — "Request to cancel & pick up car"
  | "blocked"; // in_progress / terminal — no cancel

/** What the Reschedule affordance does in the current phase. */
export type RescheduleKind =
  | "free" // reschedule request (shop confirms)
  | "limited" // over the free limit / inside cutoff — route to the shop
  | "contact_shop" // vehicle_at_shop — reschedule off, contact the shop
  | "blocked"; // in_progress / terminal — no reschedule

export type BlockedReason =
  | "work_in_progress"
  | "terminal"
  | "vehicle_at_shop"
  | null;

export interface BookingActionState {
  canCancel: boolean;
  cancelKind: CancelKind;
  /** Fee (cents) if cancelled right now. 0 for free / request_shop. */
  feeCentsIfCancelledNow: number;
  canReschedule: boolean;
  rescheduleKind: RescheduleKind;
  /** Instant (ms) the free-cancel window closes, or null when unscheduled. */
  freeUntilMs: number | null;
  rescheduleFreeUntilMs: number | null;
  reschedulesUsed: number;
  maxFreeReschedules: number;
  /** Set when the customer already requested pickup (vehicle_at_shop). */
  cancelRequestedAtMs: number | null;
  blockedReason: BlockedReason;
  /** True when this came from the phase fallback, not the server query. */
  isOptimistic: boolean;
}

/** Local (not-yet-persisted) booking ids never hit Convex. Mirrors the guard
 *  duplicated across the bookings screen. */
export function isLocalBookingId(id: string | undefined | null): boolean {
  return (
    !!id && (id.startsWith("tire_quote_") || id.startsWith("booking_"))
  );
}

/** Format a fee for disclosure copy: whole dollars drop the cents. */
export function formatFeeCents(cents: number): string {
  const dollars = cents / 100;
  return cents % 100 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/**
 * Phase→capability fallback. Used until the server query resolves and for
 * local/offline bookings. Cannot know the exact fee (server-computed), so
 * `late_cancel` fees surface as 0 with hedged copy; the server value wins
 * whenever present.
 */
export function deriveOptimisticActionState(
  status: BookingStatus,
  freeUntilMs?: number | null,
): BookingActionState {
  const base: BookingActionState = {
    canCancel: false,
    cancelKind: "blocked",
    feeCentsIfCancelledNow: 0,
    canReschedule: false,
    rescheduleKind: "blocked",
    freeUntilMs: freeUntilMs ?? null,
    rescheduleFreeUntilMs: null,
    reschedulesUsed: 0,
    maxFreeReschedules: 0,
    cancelRequestedAtMs: null,
    blockedReason: null,
    isOptimistic: true,
  };

  switch (status) {
    case "pending":
    case "pending_shop_acceptance":
    case "pending_quote":
    case "quotes_ready":
    case "pending_customer_acceptance":
      return {
        ...base,
        canCancel: true,
        cancelKind: "free",
        canReschedule: true,
        rescheduleKind: "free",
      };
    case "confirmed": {
      const late =
        freeUntilMs != null && Date.now() > freeUntilMs;
      return {
        ...base,
        canCancel: true,
        cancelKind: late ? "late_cancel" : "free",
        canReschedule: true,
        rescheduleKind: "free",
      };
    }
    case "vehicle_at_shop":
      return {
        ...base,
        canCancel: true,
        cancelKind: "request_shop",
        canReschedule: true,
        rescheduleKind: "contact_shop",
        blockedReason: "vehicle_at_shop",
      };
    case "in_progress":
    case "delayed":
      return { ...base, blockedReason: "work_in_progress" };
    case "completed":
    case "cancelled":
    case "no_show":
      return { ...base, blockedReason: "terminal" };
    default:
      return base;
  }
}

export interface CancelCopy {
  title: string;
  body: string;
  confirmLabel: string;
  /** Fee-bearing cancels use the bottom sheet; free/request use a plain Alert. */
  isFeeSheet: boolean;
}

/** One place for cancel-confirmation copy so the card and sheet match. */
export function buildCancelCopy(actions: BookingActionState): CancelCopy {
  if (actions.cancelKind === "request_shop") {
    return {
      title: "Request pickup?",
      body: "We'll let the shop know you'd like to cancel and collect your car. They'll confirm and release it.",
      confirmLabel: "Send request",
      isFeeSheet: false,
    };
  }

  const fee = actions.feeCentsIfCancelledNow;
  if (fee > 0) {
    return {
      title: "Cancel appointment",
      body: `Cancelling now incurs a ${formatFeeCents(fee)} late-cancellation fee because your appointment is soon.`,
      confirmLabel: `Cancel & pay ${formatFeeCents(fee)}`,
      isFeeSheet: true,
    };
  }

  return {
    title: "Cancel appointment?",
    body: "You won't be charged.",
    confirmLabel: "Cancel appointment",
    isFeeSheet: false,
  };
}
