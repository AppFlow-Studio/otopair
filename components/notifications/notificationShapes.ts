/**
 * notificationShapes — the declared "shape" of every customer notification.
 *
 * The product rule: a notification that lands is either **acknowledged** (FYI;
 * it self-resolves when the booking moves on, or the user taps the dismiss X)
 * or **actionable** (it carries one decision the user must make; there is no
 * dismiss — you act on it). This registry is the single source of truth for
 * that distinction, so the card never has to special-case categories inline.
 *
 * Shape is a pure function of `category`, so this stays client-side — no schema
 * or trigger changes. If we ever want the shape authoritative on the row, it's
 * the same lookup moved server-side.
 *
 * Guardrail: every customer-facing category should appear here. Anything
 * unlisted falls back to `acknowledge` (dismissable, never traps the user).
 */

export type NotificationShape = "acknowledge" | "actionable";

/** The concrete decision an actionable row triggers when tapped. */
export type NotificationAction =
  | "reschedule_decision" // Accept / decline a proposed slot (RescheduleDecisionOverlay)
  | "estimate_decision" // Approve / decline out-of-range work (deep link → approval)
  | "confirm_payment" // Re-authorize the card hold (deep link → pay sheet)
  | "on_my_way" // Shop is waiting — "On my way" (acknowledge) / "Reschedule"
  | "claim"; // Claim a completed walk-in receipt (payload claim URL)

export interface NotificationShapeSpec {
  shape: NotificationShape;
  /** Present iff shape === "actionable". */
  action?: NotificationAction;
}

const ACKNOWLEDGE: NotificationShapeSpec = { shape: "acknowledge" };

/** Exact category → shape. Prefix families are handled in the resolver below. */
const SHAPES: Record<string, NotificationShapeSpec> = {
  // ── Actionable: a decision blocks the booking ────────────────────────────
  booking_reschedule_proposed: { shape: "actionable", action: "reschedule_decision" },
  booking_forced_delay_proposed: { shape: "actionable", action: "reschedule_decision" },
  booking_prejob_pending: { shape: "actionable", action: "estimate_decision" },
  booking_midjob_pending: { shape: "actionable", action: "estimate_decision" },
  booking_postjob_pending: { shape: "actionable", action: "estimate_decision" },
  booking_reauth_required: { shape: "actionable", action: "confirm_payment" },
  walkin_completed_claim: { shape: "actionable", action: "claim" },
  // The shop is waiting on a late customer — the customer taps "On my way"
  // (acknowledge) or "Reschedule". Only the customer-facing push variant is
  // actionable; the sms/front_desk variants fall through to acknowledge below.
  customer_late_push_reminder: { shape: "actionable", action: "on_my_way" },

  // ── Acknowledge: FYI / self-resolving ────────────────────────────────────
  booking_estimate_in_range: ACKNOWLEDGE,
  booking_estimate_withdrawn: ACKNOWLEDGE,
  booking_reschedule_withdrawn: ACKNOWLEDGE,
  booking_reschedule_auto_reverted: ACKNOWLEDGE,
  schedule_courtesy_update: ACKNOWLEDGE,
  silent_lateral_mechanic_change: ACKNOWLEDGE,
  overrun_customer_resolution: ACKNOWLEDGE,
  appointment_reminder: ACKNOWLEDGE,
  pickup_request_response: ACKNOWLEDGE,
  booking_auto_dropped: ACKNOWLEDGE,
  booking_request_expired: ACKNOWLEDGE,
  customer_cancel_pickup_request: ACKNOWLEDGE,
  walkin_booking_confirmed: ACKNOWLEDGE,
  walkin_vehicle_at_shop: ACKNOWLEDGE,
  walkin_prejob_complete: ACKNOWLEDGE,
  vehicle_enrichment_complete: ACKNOWLEDGE,
};

/**
 * Resolve a category's shape. The exact lookup above already handles the
 * actionable `customer_late_push_reminder`; the `customer_late` prefix here
 * catches only its acknowledge-only siblings (sms / front_desk variants).
 * `job_blocked_*` blockers are likewise acknowledge-only, then anything
 * unlisted falls back to acknowledge.
 */
export function getNotificationShape(category: string): NotificationShapeSpec {
  const exact = SHAPES[category];
  if (exact) return exact;
  if (category.startsWith("customer_late")) return ACKNOWLEDGE;
  if (category.startsWith("job_blocked_")) return ACKNOWLEDGE;
  return ACKNOWLEDGE;
}

export function isActionable(category: string): boolean {
  return getNotificationShape(category).shape === "actionable";
}
