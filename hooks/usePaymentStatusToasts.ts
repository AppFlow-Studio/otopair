import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useToast } from "./useToast";

/**
 * Subscription-driven payment toasts. Watches the payment row attached
 * to this booking and fires when `status` transitions. Strings per
 * PLAN.md §B.7.
 *
 * Note: this hook is best-effort — Stripe webhook timing can lag the
 * server, so we ignore transitions older than the user's session start.
 */
const STATUS_TO_TOAST: Record<
  string,
  {
    variant: "success" | "info" | "warning" | "error" | "trust";
    title: string;
    body?: string;
  }
> = {
  authorized: {
    variant: "info",
    title: "Card held",
    body: "You're only charged after service.",
  },
  captured: {
    variant: "success",
    title: "Payment captured",
    body: "Charged to your saved card.",
  },
  refunded: {
    variant: "success",
    title: "Refund issued",
    body: "Funds will appear on your statement within 7 days.",
  },
  partial_refund: {
    variant: "info",
    title: "Partial refund issued",
  },
  failed: {
    variant: "error",
    title: "Payment didn't go through",
    body: "Tap to update your card.",
  },
  declined: {
    variant: "error",
    title: "Card declined",
    body: "Tap to update your card.",
  },
  dispute_opened: {
    variant: "warning",
    title: "Dispute received",
    body: "Tap for details.",
  },
  hold_released: {
    variant: "trust",
    title: "Payment hold released",
    body: "Funds will return to your card within 7 days.",
  },
};

export function usePaymentStatusToasts(bookingId: Id<"bookings"> | undefined) {
  const toast = useToast();
  const payment = useQuery(
    api.payments.getByBookingId,
    bookingId ? { bookingId } : "skip",
  );
  const lastStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!payment) return;
    const status = payment.status;
    if (!status) return;

    if (lastStatusRef.current === null) {
      lastStatusRef.current = status;
      return;
    }

    if (status === lastStatusRef.current) return;
    lastStatusRef.current = status;

    const config = STATUS_TO_TOAST[status];
    if (!config) return;

    switch (config.variant) {
      case "success":
        toast.success(config.title, config.body);
        break;
      case "info":
        toast.info(config.title, config.body);
        break;
      case "warning":
        toast.warning(config.title, config.body);
        break;
      case "error":
        toast.error(config.title, config.body);
        break;
      case "trust":
        toast.trust(config.title, config.body);
        break;
    }
  }, [payment, toast]);
}
