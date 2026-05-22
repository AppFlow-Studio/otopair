import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useToast } from "./useToast";

/**
 * Subscription-driven payment toasts. Watches the payment row attached
 * to this booking and fires when `status` transitions. Strings post-
 * Step-0 triage; "Tap to update your card" downgraded since the
 * dedicated route is deferred.
 *
 * Stripe webhooks never write the current user's id, so self-action
 * filtering is a no-op in practice for this hook.
 */
type Variant = "success" | "info" | "warning" | "error" | "trust";

interface PaymentConfig {
  variant: Variant;
  title: string;
  body?: string;
  href?: "booking-details" | "payments";
}

const STATUS_TO_TOAST: Record<string, PaymentConfig> = {
  authorized: {
    variant: "info",
    title: "Card held",
    body: "You're only charged after service.",
    href: "booking-details",
  },
  captured: {
    variant: "success",
    title: "Payment captured",
    body: "Charged to your saved card.",
    href: "booking-details",
  },
  refunded: {
    variant: "success",
    title: "Refund issued",
    body: "Funds will appear on your statement within 7 days.",
    href: "booking-details",
  },
  partial_refund: {
    variant: "info",
    title: "Partial refund issued",
    href: "booking-details",
  },
  failed: {
    variant: "error",
    title: "Payment didn't go through",
    body: "Update your card from booking details.",
    href: "booking-details",
  },
  declined: {
    variant: "error",
    title: "Card declined",
    body: "Update your card from booking details.",
    href: "booking-details",
  },
  dispute_opened: {
    variant: "warning",
    title: "We received a dispute on this charge",
  },
  hold_released: {
    variant: "trust",
    title: "Payment hold released",
    body: "Funds will return to your card within 7 days.",
  },
};

export function usePaymentStatusToasts(bookingId: Id<"bookings"> | undefined) {
  const toast = useToast();
  const router = useRouter();
  const payment = useQuery(
    api.payments.getByBookingId,
    bookingId ? { bookingId } : "skip",
  );
  const lastStatusRef = useRef<string | null>(null);

  // Reset snapshot when the focused booking changes (deep link, stack swap
  // without unmount). Fix from Phase 2.5 STRESS-REPORT §1.1.
  useEffect(() => {
    lastStatusRef.current = null;
  }, [bookingId]);

  useEffect(() => {
    if (!payment) return;
    const status = payment.status;
    if (!status) return;

    // First successful response: snapshot current status, do not toast.
    if (lastStatusRef.current === null) {
      lastStatusRef.current = status;
      return;
    }

    if (status === lastStatusRef.current) return;
    lastStatusRef.current = status;

    const config = STATUS_TO_TOAST[status];
    if (!config) return;

    const onPress = config.href
      ? () => {
          if (config.href === "booking-details" && bookingId) {
            router.push(`/booking/mechanic/${bookingId}/booking-details`);
          } else if (config.href === "payments") {
            router.push("/payments");
          }
        }
      : undefined;
    const opts = onPress ? { onPress } : undefined;

    switch (config.variant) {
      case "success":
        toast.success(config.title, config.body, opts);
        break;
      case "info":
        toast.info(config.title, config.body, opts);
        break;
      case "warning":
        toast.warning(config.title, config.body, opts);
        break;
      case "error":
        toast.error(config.title, config.body, opts);
        break;
      case "trust":
        toast.trust(config.title, config.body, opts);
        break;
    }
  }, [payment, toast, router, bookingId]);
}
