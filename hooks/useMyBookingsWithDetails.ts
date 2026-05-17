/**
 * useMyBookingsWithDetails
 *
 * Fetches the current user's bookings from Convex with shop, mechanic, vehicle,
 * and service names resolved. Also includes local (Zustand) bookings created
 * with mock data. Splits into live (in_progress), upcoming, and history
 * for the My Bookings screen.
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
import { useBookingStore } from "@/stores/useBookingStore";
import { useShopStore } from "@/stores/useShopStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import type { Booking as StoreBooking } from "@/stores/types/store.types";
import { hhmmToDisplayTime } from "@/utils/timeSlotUtils";

function isUpcoming(row: ConvexBookingWithDetails): boolean {
  if (row.status === "completed" || row.status === "cancelled") return false;
  if (row.status === "in_progress") return false;
  // Tire quote-stage bookings have no scheduled_date yet — they belong in
  // Upcoming until shops respond + the user accepts a quote.
  if (row.status === "pending_quote") return true;
  if (row.status === "quotes_ready") return true;
  const today = new Date().toISOString().slice(0, 10);
  return row.scheduled_date >= today;
}

function isLive(row: ConvexBookingWithDetails): boolean {
  return row.status === "in_progress";
}

function isHistory(row: ConvexBookingWithDetails): boolean {
  if (row.status === "completed" || row.status === "cancelled") return true;
  if (row.status === "pending_quote" || row.status === "quotes_ready") return false;
  const today = new Date().toISOString().slice(0, 10);
  return row.scheduled_date < today;
}

/** Extract a URI string from an ImageSourcePropType if it's a uri-based source */
function extractImageUri(source: unknown): string | undefined {
  if (source && typeof source === "object" && "uri" in (source as Record<string, unknown>)) {
    return (source as { uri: string }).uri;
  }
  return undefined;
}

function adaptLocalBookingToCard(
  booking: StoreBooking,
  getServiceName: (id: string) => string,
  getMechanicName: (id: string) => string | undefined,
  getShopName: (id: string) => string | undefined,
  vehicle: { year: number; make: string; model: string; vin?: string; imageSource?: unknown } | undefined,
): BookingCardBooking {
  const serviceNames = booking.serviceIds.map(getServiceName);

  // `scheduledDate` is "" for pending_quote bookings (date is TBD). Only
  // format when we actually have a real ISO date to avoid NaN output.
  let formattedDate = "";
  if (booking.scheduledDate) {
    const [scheduledYear, scheduledMonth, scheduledDay] = booking.scheduledDate.split("-").map(Number);
    const dateObj = new Date(scheduledYear, scheduledMonth - 1, scheduledDay);
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    formattedDate = `${dayNames[dateObj.getDay()]}, ${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}`;
  }

  const carYear = vehicle ? String(vehicle.year) : "";
  const carModel = vehicle ? `${vehicle.make} ${vehicle.model}` : "Vehicle";
  const makeLogoUrl = vehicle ? extractImageUri(vehicle.imageSource) : undefined;

  // Local store stamps `createdAt` as an ISO string. Convert to epoch ms so
  // it sorts cleanly alongside Convex's `_creationTime` (also epoch ms).
  const createdAtMs = booking.createdAt ? Date.parse(booking.createdAt) : Date.now();

  return {
    id: booking.id,
    services: serviceNames,
    carModel,
    carYear,
    licensePlate: "",
    makeLogoUrl: makeLogoUrl ?? "",
    mechanicName: getMechanicName(booking.shopId) ?? "Assigned Mechanic",
    shopName: getShopName(booking.shopId) ?? "Auto Shop",
    date: formattedDate,
    time: booking.scheduledTime && /^\d{1,2}:\d{2}$/.test(booking.scheduledTime)
      ? hhmmToDisplayTime(booking.scheduledTime)
      : booking.scheduledTime,
    status: booking.status,
    totalCost: booking.totalPrice,
    notes: booking.notes,
    createdAt: Number.isFinite(createdAtMs) ? createdAtMs : Date.now(),
    vin: vehicle?.vin,
  };
}

export function useMyBookingsWithDetails() {
  const { userId, isLoading: isUserLoading } = useUserFromConvex();
  const rows = useQuery(api.bookings.getByUserIdWithDetails, userId ? { userId } : "skip");
  // Booking IDs the user has already submitted a review for. Drives the
  // "Leave a review" card on completed bookings — once a review exists,
  // the card disappears for good.
  const reviewedBookingIds = useQuery(
    api.reviews.listReviewedBookingIdsForUser,
    userId ? { userId } : "skip",
  );

  // Local bookings from Zustand (created with mock data)
  const localBookings = useBookingStore((s) => s.bookings);
  const localBookingIds = useBookingStore((s) => s.bookingIds);
  const availableServices = useBookingStore((s) => s.availableServices);
  const getShopById = useShopStore((s) => s.getShopById);
  const getVehicleById = useVehicleStore((s) => s.getVehicleById);
  const getSelectedVehicle = useVehicleStore((s) => s.getSelectedVehicle);
  const selectedMechanicSlot = useBookingStore((s) => s.selectedMechanicSlot);

  return useMemo(() => {
    if (!userId) {
      return {
        liveBooking: null,
        upcomingBookings: [],
        quoteBookings: [],
        pendingReviewBookings: [],
        historyBookings: [],
        isLoading: isUserLoading,
      };
    }

    // --- Convex bookings ---
    const list: ConvexBookingWithDetails[] = rows ?? [];
    const liveRows = list.filter(isLive);
    const upcomingRows = list.filter(isUpcoming);
    const historyRows = list.filter(isHistory);

    let liveBooking: BookingCardBooking | null =
      liveRows.length > 0 ? adaptConvexBookingWithDetailsToCard(liveRows[0]) : null;

    // May 2 redesign: both quote-stage statuses (`pending_quote` +
    // `quotes_ready`) live in the Quotes tab. Service-stage bookings
    // (pending, confirmed, in_progress) live in the Bookings tab —
    // including in-progress, which used to have its own Live Tracker
    // tab. The per-card progress bar now communicates status inline.
    const isQuoteStage = (r: ConvexBookingWithDetails) =>
      r.status === "pending_quote" || r.status === "quotes_ready";
    const serviceRows = [...liveRows, ...upcomingRows.filter((r: ConvexBookingWithDetails) => !isQuoteStage(r))];
    const quoteRows = upcomingRows.filter(isQuoteStage);

    const upcomingBookings: BookingCardBooking[] = serviceRows
      .sort((a: ConvexBookingWithDetails, b: ConvexBookingWithDetails) =>
        (a.scheduled_date ?? "").localeCompare(b.scheduled_date ?? ""),
      )
      .map(adaptConvexBookingWithDetailsToCard);

    const quoteBookings: BookingCardBooking[] = quoteRows
      .sort((a: ConvexBookingWithDetails, b: ConvexBookingWithDetails) =>
        (b.scheduled_date ?? "").localeCompare(a.scheduled_date ?? ""),
      )
      .map(adaptConvexBookingWithDetailsToCard);

    // Pull completed-but-unreviewed rows out of history — they need a
    // dedicated "Leave a review" card at the top of the Bookings tab.
    // Cancelled bookings stay in history regardless.
    const reviewedSet = new Set(reviewedBookingIds ?? []);
    const isPendingReview = (r: ConvexBookingWithDetails) =>
      r.status === "completed" && !reviewedSet.has(String(r._id));
    const pendingReviewRows = historyRows.filter(isPendingReview);
    const trueHistoryRows = historyRows.filter((r: ConvexBookingWithDetails) => !isPendingReview(r));

    const pendingReviewBookings: BookingCardBooking[] = pendingReviewRows
      .sort((a: ConvexBookingWithDetails, b: ConvexBookingWithDetails) => (b._creationTime ?? 0) - (a._creationTime ?? 0))
      .map(adaptConvexBookingWithDetailsToCard);

    const historyBookings: BookingCardBooking[] = trueHistoryRows
      .sort((a: ConvexBookingWithDetails, b: ConvexBookingWithDetails) =>
        new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime(),
      )
      .map(adaptConvexBookingWithDetailsToCard);

    // --- Local (Zustand) bookings ---
    const getServiceName = (id: string) => {
      const svc = availableServices.find((s) => s.id === id);
      return svc?.name ?? "Service";
    };
    const getMechanicName = (shopId: string) => {
      // Use the selected slot's mechanic name if it matches the shop
      if (selectedMechanicSlot?.shopId === shopId && selectedMechanicSlot.mechanicName) {
        return selectedMechanicSlot.mechanicName;
      }
      return undefined;
    };
    const getShopName = (shopId: string) => {
      const shop = getShopById(shopId);
      return shop?.name;
    };

    const convexBookingIds = new Set(list.map((r: ConvexBookingWithDetails) => r._id));
    const today = new Date().toISOString().slice(0, 10);

    for (const id of localBookingIds) {
      const booking = localBookings[id];
      if (!booking || convexBookingIds.has(id)) continue;

      const vehicle = getVehicleById(booking.vehicleId) ?? getSelectedVehicle();

      // Local in_progress booking → surface it as the active card.
      // Per the May 2 redesign, in-progress bookings appear in the
      // Bookings list with their own progress bar instead of a
      // dedicated Live Tracker tab.
      if (booking.status === "in_progress") {
        if (!liveBooking) {
          liveBooking = adaptLocalBookingToCard(
            booking,
            getServiceName,
            getMechanicName,
            getShopName,
            vehicle,
          );
        }
        continue;
      }

      const card = adaptLocalBookingToCard(booking, getServiceName, getMechanicName, getShopName, vehicle);
      const isUpcomingStatus =
        booking.status === "pending" || booking.status === "confirmed";
      const isHistoryStatus = booking.status === "completed" || booking.status === "cancelled";

      if (booking.status === "pending_quote") {
        // Per the Apr 23 redesign: pending-quote bookings live in Upcoming
        // until shop responses arrive.
        upcomingBookings.push(card);
      } else if (booking.status === "quotes_ready") {
        // Quotes-ready bookings live in the Quotes tab (user toggled the
        // Move to Quotes switch on the Pending Quote card in Upcoming).
        quoteBookings.push(card);
      } else if (isUpcomingStatus && booking.scheduledDate >= today) {
        upcomingBookings.push(card);
      } else if (isHistoryStatus || booking.scheduledDate < today) {
        historyBookings.push(card);
      }
    }

    // Newest-first across every tab — most recently created booking sits at
    // the top so a freshly-submitted card appears immediately on return to
    // the My Bookings screen. Older `scheduled_date`-based ordering caused
    // tire quote-stage rows (no scheduled_date yet) to clump arbitrarily.
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
  }, [userId, isUserLoading, rows, reviewedBookingIds, localBookings, localBookingIds, availableServices, getShopById, getVehicleById, getSelectedVehicle, selectedMechanicSlot]);
}
