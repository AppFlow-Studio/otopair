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
import type { LiveTracking } from "@/components/bookings/LiveTrackerCard";
import {
  adaptConvexBookingWithDetailsToCard,
  adaptConvexBookingWithDetailsToLiveTracking,
  type ConvexBookingWithDetails,
} from "@/utils/bookingAdapter";
import { useUserFromConvex } from "./useUserFromConvex";
import { useBookingStore } from "@/stores/useBookingStore";
import { useShopStore } from "@/stores/useShopStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import type { Booking as StoreBooking } from "@/stores/types/store.types";

function isUpcoming(row: ConvexBookingWithDetails): boolean {
  if (row.status === "completed" || row.status === "cancelled") return false;
  if (row.status === "in_progress") return false;
  const today = new Date().toISOString().slice(0, 10);
  return row.scheduled_date >= today;
}

function isLive(row: ConvexBookingWithDetails): boolean {
  return row.status === "in_progress";
}

function isHistory(row: ConvexBookingWithDetails): boolean {
  if (row.status === "completed" || row.status === "cancelled") return true;
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

/** Adapt a local Zustand booking into the BookingCard format */
function adaptLocalBookingToLiveTracking(
  booking: StoreBooking,
  getServiceName: (id: string) => string,
  getMechanicName: (id: string) => string | undefined,
  getShopName: (id: string) => string | undefined,
  vehicle: { year: number; make: string; model: string; imageSource?: unknown } | undefined,
): LiveTracking {
  const carYear = vehicle ? String(vehicle.year) : "";
  const carModel = vehicle ? `${vehicle.make} ${vehicle.model}` : "Vehicle";
  const makeLogoUrl = vehicle ? extractImageUri(vehicle.imageSource) : undefined;
  const primaryService = booking.serviceIds[0] ? getServiceName(booking.serviceIds[0]) : "Service";
  return {
    id: booking.id,
    carModel,
    carYear,
    licensePlate: "",
    makeLogoUrl: makeLogoUrl ?? "",
    mechanicName: getMechanicName(booking.shopId) ?? "Assigned Mechanic",
    shopName: getShopName(booking.shopId) ?? "Auto Shop",
    currentStage: "Service in Progress",
    progressPercent: 45,
    stages: [
      { id: "1", title: "Booking Confirmed", description: "Your appointment is set.", status: "completed" },
      { id: "2", title: "Service in Progress", description: primaryService, status: "current" },
      { id: "3", title: "Your vehicle is ready", description: "You will be notified when ready.", status: "pending" },
      { id: "4", title: "Service Completed", description: "Your service is completed", status: "pending" },
    ],
  };
}

function adaptLocalBookingToCard(
  booking: StoreBooking,
  getServiceName: (id: string) => string,
  getMechanicName: (id: string) => string | undefined,
  getShopName: (id: string) => string | undefined,
  vehicle: { year: number; make: string; model: string; imageSource?: unknown } | undefined,
): BookingCardBooking {
  const serviceNames = booking.serviceIds.map(getServiceName);
  const [scheduledYear, scheduledMonth, scheduledDay] = booking.scheduledDate.split("-").map(Number);
  const dateObj = new Date(scheduledYear, scheduledMonth - 1, scheduledDay);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formattedDate = `${dayNames[dateObj.getDay()]}, ${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}`;

  const carYear = vehicle ? String(vehicle.year) : "";
  const carModel = vehicle ? `${vehicle.make} ${vehicle.model}` : "Vehicle";
  const makeLogoUrl = vehicle ? extractImageUri(vehicle.imageSource) : undefined;

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
    time: booking.scheduledTime,
    status: booking.status,
    totalCost: booking.totalPrice,
  };
}

export function useMyBookingsWithDetails() {
  const { userId } = useUserFromConvex();
  const rows = useQuery(api.bookings.getByUserIdWithDetails, userId ? { userId } : "skip");

  // Local bookings from Zustand (created with mock data)
  const localBookings = useBookingStore((s) => s.bookings);
  const localBookingIds = useBookingStore((s) => s.bookingIds);
  const availableServices = useBookingStore((s) => s.availableServices);
  const getShopById = useShopStore((s) => s.getShopById);
  const getVehicleById = useVehicleStore((s) => s.getVehicleById);
  const getSelectedVehicle = useVehicleStore((s) => s.getSelectedVehicle);
  const selectedMechanicSlot = useBookingStore((s) => s.selectedMechanicSlot);

  return useMemo(() => {
    // --- Convex bookings ---
    const list = rows ?? [];
    const liveRows = list.filter(isLive);
    const upcomingRows = list.filter(isUpcoming);
    const historyRows = list.filter(isHistory);

    let liveTracking: LiveTracking | null =
      liveRows.length > 0 ? adaptConvexBookingWithDetailsToLiveTracking(liveRows[0]) : null;
    let liveBooking: BookingCardBooking | null =
      liveRows.length > 0 ? adaptConvexBookingWithDetailsToCard(liveRows[0]) : null;

    const upcomingBookings: BookingCardBooking[] = upcomingRows
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
      .map(adaptConvexBookingWithDetailsToCard);

    const historyBookings: BookingCardBooking[] = historyRows
      .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime())
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

    const convexBookingIds = new Set(list.map((r) => r._id));
    const today = new Date().toISOString().slice(0, 10);

    for (const id of localBookingIds) {
      const booking = localBookings[id];
      if (!booking || convexBookingIds.has(id)) continue;

      const vehicle = getVehicleById(booking.vehicleId) ?? getSelectedVehicle();

      // Local in_progress booking → surface it as the active Live Tracker
      // (only if there isn't already a Convex-sourced one).
      if (booking.status === "in_progress") {
        if (!liveTracking) {
          liveTracking = adaptLocalBookingToLiveTracking(
            booking,
            getServiceName,
            getMechanicName,
            getShopName,
            vehicle,
          );
        }
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
        booking.status === "pending" ||
        booking.status === "pending_quote" ||
        booking.status === "confirmed";
      const isHistoryStatus = booking.status === "completed" || booking.status === "cancelled";

      if (isUpcomingStatus && booking.scheduledDate >= today) {
        upcomingBookings.push(card);
      } else if (isHistoryStatus || booking.scheduledDate < today) {
        historyBookings.push(card);
      }
    }

    // Re-sort after merging local bookings
    upcomingBookings.sort((a, b) => a.date.localeCompare(b.date));
    historyBookings.sort((a, b) => b.date.localeCompare(a.date));

    return {
      liveTracking,
      liveBooking,
      upcomingBookings,
      historyBookings,
      isLoading: rows === undefined,
    };
  }, [rows, localBookings, localBookingIds, availableServices, getShopById, getVehicleById, getSelectedVehicle, selectedMechanicSlot]);
}
