import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import {
  CalendarCheck,
  CalendarClock,
  CalendarX,
  Car,
  Clock,
  FileText,
  Stethoscope,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { useToast } from "./useToast";

/**
 * Subscription-driven booking toasts. Mount on the booking detail screen
 * (or anywhere this booking is the focused entity). Listens for new
 * entries in the booking's status_history and fires the appropriate
 * toast.
 *
 * Self-action filtering (PLAN §B.5): subscription hooks should ignore
 * rows where `changed_by === currentUserId`. The current shape of
 * `getBookingByIdForCustomer` strips `changed_by` from the returned
 * statusHistory rows, so the hook approximates the filter by NOT
 * mapping transitions that are predominantly user-initiated
 * (cancelled_by_user). All other transitions in the map are
 * shop/mechanic/webhook-driven, where double-fire is not a risk.
 *
 * Strings here are post-Step-0-triage (PLAN §B.7 + ROUTE-GAPS.md). Some
 * "Tap to..." copy was downgraded to non-tappable variants because the
 * dedicated destination screens are deferred post-launch.
 */
type Variant = "success" | "info" | "warning" | "error" | "trust";

interface TransitionConfig {
  variant: Variant;
  title: string;
  body?: string;
  /** Optional tap route. Most are deferred — see ROUTE-GAPS.md. */
  href?: string;
  /** Action-matching icon override; falls back to the variant icon. */
  icon?: LucideIcon;
}

const TRANSITION_TO_TOAST: Record<string, TransitionConfig> = {
  confirmed: {
    variant: "trust",
    title: "Booking confirmed",
    body: "Your shop accepted this appointment.",
    href: "booking-details",
    icon: CalendarCheck,
  },
  pending_shop_acceptance: {
    variant: "info",
    title: "Waiting on the shop to accept",
    href: "booking-details",
    icon: Clock,
  },
  declined_by_shop: {
    variant: "warning",
    title: "Shop can't take this booking",
    body: "Tap to see alternatives.",
    href: "home",
    icon: CalendarX,
  },
  vehicle_at_shop: {
    variant: "info",
    title: "Vehicle checked in",
    body: "Your mechanic will review shortly.",
    href: "booking-details",
    icon: Car,
  },
  in_progress: {
    variant: "info",
    title: "Work started",
    body: "Your mechanic is on it.",
    href: "booking-details",
    icon: Wrench,
  },
  completed: {
    variant: "success",
    title: "Service complete",
    // Dedicated invoice screen deferred — see ROUTE-GAPS.md.
  },
  cancelled_by_shop: {
    variant: "warning",
    title: "Shop cancelled this booking",
    body: "Tap to rebook.",
    href: "home",
    icon: CalendarX,
  },
  rescheduled: {
    variant: "info",
    title: "Booking rescheduled",
    href: "booking-details",
    icon: CalendarClock,
  },
  no_show: {
    variant: "warning",
    title: "Marked as no-show",
    body: "Open booking to dispute or reschedule.",
    href: "booking-details",
  },
  quote_revised: {
    variant: "warning",
    title: "Quote revised",
    body: "Review the change before approving.",
    href: "booking-details",
    icon: FileText,
  },
  eta_updated: {
    variant: "info",
    title: "Mechanic ETA updated",
    href: "booking-details",
    icon: Clock,
  },
  diagnostic_resolved: {
    variant: "trust",
    title: "Diagnostic complete",
    body: "No additional work needed.",
    href: "booking-details",
    icon: Stethoscope,
  },
  // cancelled_by_user intentionally NOT mapped — the mutation wrapper
  // handles its toast; subscription would double-fire.
};

export function useBookingStatusToasts(bookingId: Id<"bookings"> | undefined) {
  const toast = useToast();
  const router = useRouter();
  const booking = useQuery(
    api.bookings.getBookingByIdForCustomer,
    bookingId ? { bookingId } : "skip",
  );
  const lastSeenRef = useRef<number | null>(null);

  // Reset snapshot when the focused booking changes (deep link, stack swap
  // without unmount). Without this, lastSeenRef carries the previous
  // booking's high-water mark and suppresses or fires wrong toasts on the
  // new booking. Fix from Phase 2.5 STRESS-REPORT §1.1.
  useEffect(() => {
    lastSeenRef.current = null;
  }, [bookingId]);

  useEffect(() => {
    if (!booking) return;
    const history = booking.statusHistory ?? [];
    if (history.length === 0) return;

    type HistoryRow = { status: string; changedAt: number };
    const rows = history as HistoryRow[];

    // PLAN §B.5 patch 3: initialize to max(existingRows.changedAt) on
    // first successful response. Stay null before that.
    if (lastSeenRef.current === null) {
      lastSeenRef.current = rows.reduce(
        (acc: number, h: HistoryRow) => Math.max(acc, h.changedAt),
        0,
      );
      return;
    }

    const cutoff = lastSeenRef.current;
    const fresh = rows.filter((h: HistoryRow) => h.changedAt > cutoff);
    if (fresh.length === 0) return;

    // Reconnect-flood guard (Phase 2.5 STRESS-REPORT §3.1 / §5.1): if the
    // user was offline through several transitions, condense into one
    // summary instead of N individual toasts (where older ones would be
    // silently dropped by the queue cap of 3).
    if (fresh.length > 3) {
      toast.info(
        `${fresh.length} updates while you were away.`,
        "Open booking to see what changed.",
        {
          onPress: bookingId
            ? () => router.push(`/booking/mechanic/${bookingId}/booking-details`)
            : undefined,
        },
      );
      lastSeenRef.current = fresh.reduce(
        (acc: number, h: HistoryRow) => Math.max(acc, h.changedAt),
        cutoff,
      );
      return;
    }

    fresh.forEach((entry: HistoryRow) => {
      const config = TRANSITION_TO_TOAST[entry.status];
      if (!config) return;
      const onPress = config.href
        ? () => {
            if (!bookingId) return;
            if (config.href === "booking-details") {
              router.push(`/booking/mechanic/${bookingId}/booking-details`);
            } else if (config.href === "home") {
              router.push("/(main-tabs)/home");
            }
          }
        : undefined;
      const opts = {
        ...(onPress ? { onPress } : {}),
        ...(config.icon ? { icon: config.icon } : {}),
      };
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
    });

    lastSeenRef.current = fresh.reduce(
      (acc: number, h: HistoryRow) => Math.max(acc, h.changedAt),
      cutoff,
    );
  }, [booking, toast, router, bookingId]);
}
