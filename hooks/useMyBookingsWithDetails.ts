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
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Booking as BookingCardBooking } from "@/components/bookings/BookingCard";
import {
  adaptConvexBookingWithDetailsToCard,
  type ConvexBookingWithDetails,
} from "@/utils/bookingAdapter";
import { useUserFromConvex } from "./useUserFromConvex";

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
  const today = new Date().toISOString().slice(0, 10);
  return row.scheduled_date >= today;
}

function isLive(row: ConvexBookingWithDetails): boolean {
  if (row.status === "in_progress") return true;
  // Booking auto-flipped to "completed" but the customer hasn't approved
  // the final breakdown — still a live, actionable booking.
  return row.status === "completed" && hasPendingApproval(row);
}

function isHistory(row: ConvexBookingWithDetails): boolean {
  if (row.status === "cancelled") return true;
  if (row.status === "completed") return !hasPendingApproval(row);
  if (row.status === "pending_quote" || row.status === "quotes_ready") return false;
  const today = new Date().toISOString().slice(0, 10);
  return row.scheduled_date < today;
}

export function useMyBookingsWithDetails() {
  const { userId } = useUserFromConvex();
  const rows = useQuery(api.bookings.getByUserIdWithDetails, userId ? { userId } : "skip");
  const reviewedBookingIds = useQuery(
    api.reviews.listReviewedBookingIdsForUser,
    userId ? { userId } : "skip",
  );

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
    const quoteRows = upcomingRows.filter(isQuoteStage);

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
    };
  }, [rows, reviewedBookingIds]);
}
