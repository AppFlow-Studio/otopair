import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useToast } from "./useToast";

/**
 * Subscription-driven booking toasts. Mount on the booking detail screen
 * (or anywhere this booking is the focused entity). Listens for new
 * entries in the booking's status_history and fires the appropriate
 * toast.
 *
 * Per PLAN.md §B.7. Strings live here so this hook is the single
 * source of truth for status-transition copy.
 */
const TRANSITION_TO_TOAST: Record<
  string,
  {
    variant: "success" | "info" | "warning" | "error" | "trust";
    title: string;
    body?: string;
  }
> = {
  confirmed: {
    variant: "trust",
    title: "Booking confirmed",
    body: "Your shop accepted this appointment.",
  },
  pending_shop_acceptance: {
    variant: "info",
    title: "Waiting on the shop to accept",
  },
  declined_by_shop: {
    variant: "warning",
    title: "Shop can't take this booking",
    body: "Tap to see alternative times.",
  },
  vehicle_at_shop: {
    variant: "info",
    title: "Vehicle checked in",
    body: "Your mechanic will review shortly.",
  },
  in_progress: {
    variant: "info",
    title: "Work started",
    body: "Your mechanic is on it.",
  },
  completed: {
    variant: "success",
    title: "Service complete",
    body: "Tap to review the invoice.",
  },
  cancelled_by_user: {
    variant: "success",
    title: "Booking cancelled",
    body: "Any payment hold will release within 7 days.",
  },
  cancelled_by_shop: {
    variant: "warning",
    title: "Shop cancelled this booking",
    body: "Tap to rebook.",
  },
  rescheduled: {
    variant: "info",
    title: "Booking rescheduled",
  },
  no_show: {
    variant: "warning",
    title: "Marked as no-show",
    body: "Tap to dispute or reschedule.",
  },
  quote_revised: {
    variant: "warning",
    title: "Quote revised",
    body: "Review the change before approving.",
  },
  eta_updated: {
    variant: "info",
    title: "Mechanic ETA updated",
  },
  diagnostic_resolved: {
    variant: "trust",
    title: "Diagnostic complete",
    body: "No additional work needed.",
  },
};

export function useBookingStatusToasts(bookingId: Id<"bookings"> | undefined) {
  const toast = useToast();
  const booking = useQuery(
    api.bookings.getBookingByIdForCustomer,
    bookingId ? { bookingId } : "skip",
  );
  const lastSeenRef = useRef<number | null>(null);

  useEffect(() => {
    if (!booking) return;
    const history = booking.statusHistory ?? [];
    if (history.length === 0) return;

    if (lastSeenRef.current === null) {
      // Initialize to the most recent entry so historical rows do not all fire.
      lastSeenRef.current = history[history.length - 1].changedAt;
      return;
    }

    const cutoff = lastSeenRef.current;
    const fresh = history.filter((h) => h.changedAt > cutoff);
    if (fresh.length === 0) return;

    fresh.forEach((entry) => {
      const config = TRANSITION_TO_TOAST[entry.status];
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
    });

    lastSeenRef.current = fresh[fresh.length - 1].changedAt;
  }, [booking, toast]);
}
