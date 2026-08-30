/**
 * useMyBookingsWithDetails
 *
 * Fetches the current user's bookings from Convex with shop, mechanic, vehicle,
 * and service names resolved. Splits them into live (in_progress), upcoming,
 * quotes, pending review, and history for the My Bookings screen.
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 */

import { useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Booking as BookingCardBooking } from "@/components/bookings/BookingCard";
import {
  adaptConvexBookingWithDetailsToCard,
  type ConvexBookingWithDetails,
} from "@/utils/bookingAdapter";
import { useSessionCachedQuery } from "@/lib/offlineSessionCache";
import { useUserFromConvex } from "./useUserFromConvex";
import { getQuoteTileState } from "@/utils/quoteAvailability";

// Approval cycles that mean the customer still owes a decision (or the
// mechanic is mid-cycle awaiting one). A booking in any of these states
// must stay on the active list even if the server has already advanced
// status to "completed" — the post-job capture isn't final until the
// customer signs off on the breakdown.
const PENDING_APPROVAL_STATES = new Set([
  "pre_job_pending",
  "mid_job_pending",
  "post_job_pending",
  "pre_job_declined",
  "mid_job_declined",
  "post_job_declined",
  "sla_expired",
]);

function hasPendingApproval(row: ConvexBookingWithDetails): boolean {
  return (
    typeof row.payment_approval_state === "string" &&
    PENDING_APPROVAL_STATES.has(row.payment_approval_state)
  );
}

function isUpcoming(row: ConvexBookingWithDetails): boolean {
  if (row.status === "cancelled") return false;
  if (row.status === "completed" && !hasPendingApproval(row)) return false;
  if (row.status === "in_progress") return false;
  if (row.status === "pending_quote") return true;
  if (row.status === "quotes_ready") return true;
  // Local-tz "today" — bookings.scheduled_date is a local YYYY-MM-DD
  // string with no timezone, so comparing it against `toISOString()`
  // (which returns UTC) drops same-day bookings whenever local time
  // has rolled into the next UTC day (evenings west of UTC). Sister
  // of the same fix in app/(main-tabs)/home/index.tsx.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return row.scheduled_date >= today;
}

function isLive(row: ConvexBookingWithDetails): boolean {
  if (row.status === "in_progress") return true;
  // Booking auto-flipped to "completed" but the customer hasn't approved
  // the final breakdown — still a live, actionable booking.
  return row.status === "completed" && hasPendingApproval(row);
}

function isHistory(row: ConvexBookingWithDetails): boolean {
  // History is strictly terminal states. Anything else (pending,
  // confirmed, in_progress, quote stages) belongs to upcoming or live.
  // The previous implementation had a past-date fallthrough that swept
  // stale `"pending"` rows into history and rendered them as "Completed
  // On <date>" — a stale past-date pending row is a backend concern
  // (auto-cancel / expire), not a UI one.
  if (row.status === "cancelled") return true;
  if (row.status === "no_show") return true;
  if (row.status === "completed") return !hasPendingApproval(row);
  return false;
}

export function useMyBookingsWithDetails() {
  const { userId } = useUserFromConvex();
  const liveRows = useQuery(
    api.bookings.getByUserIdWithDetails,
    userId ? { userId } : "skip",
  ) as unknown as ConvexBookingWithDetails[] | undefined;
  const liveReviewedIds = useQuery(
    api.reviews.listReviewedBookingIdsForUser,
    userId ? { userId } : "skip",
  );

  // Session-scoped offline cache. Offline cold starts never resolve
  // `useUserFromConvex` (it's a Convex query), so the live queries stay
  // skipped/undefined forever — the cache serves the last online result
  // as long as the saved Clerk session hasn't expired. Keys are
  // per-device single-user; the envelope pins them to the Clerk user.
  const { value: rows, isFromCache } = useSessionCachedQuery(
    "bookings_rows",
    liveRows,
  );
  const { value: reviewedBookingIds } = useSessionCachedQuery(
    "bookings_reviewed_ids",
    liveReviewedIds,
  );

  const [quoteClock, setQuoteClock] = useState(() => Date.now());
  useEffect(() => {
    const nextBoundary = (rows ?? [])
      .flatMap((row) =>
        row.quote_expires_at == null
          ? []
          : [row.quote_expires_at, row.quote_expires_at + 24 * 60 * 60_000],
      )
      .filter((value) => value > quoteClock)
      .sort((a, b) => a - b)[0];
    if (nextBoundary == null) return;
    const timer = setTimeout(
      () => setQuoteClock(Date.now()),
      Math.max(0, nextBoundary - Date.now() + 50),
    );
    return () => clearTimeout(timer);
  }, [quoteClock, rows]);

  return useMemo(() => {
    const list = rows ?? [];
    const liveRows = list.filter(isLive);
    const upcomingRows = list.filter(isUpcoming);
    const historyRows = list.filter(isHistory);

    const liveBooking: BookingCardBooking | null =
      liveRows.length > 0 ? adaptConvexBookingWithDetailsToCard(liveRows[0]) : null;

    const isQuoteStage = (row: ConvexBookingWithDetails) =>
      row.status === "pending_quote" || row.status === "quotes_ready";
    const serviceRows = [...liveRows, ...upcomingRows.filter((row) => !isQuoteStage(row))];
    const quoteRows = upcomingRows
      .filter(isQuoteStage)
      .map((row) => {
        const fallbackState = row.status === "quotes_ready" ? "ready" : "pending";
        return {
          ...row,
          quote_tile_state: getQuoteTileState(
            row.quote_state ?? fallbackState,
            row.quote_expires_at ?? null,
            quoteClock,
          ),
        };
      })
      .filter((row) => row.quote_tile_state !== "hidden");

    const upcomingBookings: BookingCardBooking[] = serviceRows
      .sort((a, b) => (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? ""))
      .map(adaptConvexBookingWithDetailsToCard);

    const quoteBookings: BookingCardBooking[] = quoteRows
      .sort((a, b) => (b.scheduled_date ?? "").localeCompare(a.scheduled_date ?? ""))
      .map(adaptConvexBookingWithDetailsToCard);

    const reviewedSet = new Set(reviewedBookingIds ?? []);
    const pendingReviewRows = historyRows.filter(
      (row) => row.status === "completed" && !reviewedSet.has(String(row._id)),
    );

    const pendingReviewBookings: BookingCardBooking[] = pendingReviewRows
      .sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0))
      .map(adaptConvexBookingWithDetailsToCard);

    const historyBookings: BookingCardBooking[] = historyRows
      .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime())
      .map(adaptConvexBookingWithDetailsToCard);

    const byCreatedAtDesc = (a: BookingCardBooking, b: BookingCardBooking) =>
      (b.createdAt ?? 0) - (a.createdAt ?? 0);
    upcomingBookings.sort(byCreatedAtDesc);
    quoteBookings.sort(byCreatedAtDesc);
    historyBookings.sort(byCreatedAtDesc);

    return {
      liveBooking,
      upcomingBookings,
      quoteBookings,
      pendingReviewBookings,
      historyBookings,
      isLoading: rows === undefined,
      /** True when the data shown is the offline session cache, not live. */
      isFromCache,
    };
  }, [rows, reviewedBookingIds, isFromCache, quoteClock]);
}
