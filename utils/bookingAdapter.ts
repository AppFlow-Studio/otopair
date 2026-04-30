/**
 * bookingAdapter
 *
 * PURPOSE: Transforms store Booking format to BookingCard format
 *          Handles data transformation between store types and UI component types.
 *          Also adapts Convex getByUserIdWithDetails rows to BookingCard and LiveTrackerCard.
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * OWNER: Temurbek Sayfutdinov
 */

import type { Booking as StoreBooking, Service } from "@/stores/types/store.types";
import type { Booking as BookingCardBooking } from "@/components/bookings/BookingCard";
import type { LiveTracking, ServiceStage } from "@/components/bookings/LiveTrackerCard";
import type { Mechanic } from "@/stores/types/store.types";
import type { Shop } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

/** Shape returned by Convex api.bookings.getByUserIdWithDetails */
export interface ConvexBookingWithDetails {
  _id: string;
  status: string;
  scheduled_date: string;
  scheduled_time: string;
  total_cost: number;
  shopName: string;
  shopPhone: string;
  mechanicName: string;
  mechanicImageUrl?: string;
  vehicleDisplay: string;
  licensePlate: string;
  makeLogoUrl?: string;
  serviceNames: string[];
  progressPercent?: number;
  currentStage?: string;
  delayMinutes?: number;
  /** Stored live stage when status is in_progress: booking_confirmed | service_in_progress | vehicle_ready */
  liveStage?: string;
  /** Populated for tire-quote bookings only (status pending_quote / quotes_ready). */
  tire_specs?: {
    size: string;
    type: string;
    tier: string;
    quantity: number;
  };
}

interface BookingAdapterParams {
  storeBooking: StoreBooking;
  services: Service[];
  mechanic: Mechanic | null;
  shop: Shop | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Mock vehicle data until vehicle store is implemented
const DEFAULT_VEHICLE = {
  model: "BMW M5",
  year: "2019",
  licensePlate: "RPH 468",
};

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Converts store Booking format to BookingCard format
 */
export function adaptBookingForCard({
  storeBooking,
  services,
  mechanic,
  shop,
}: BookingAdapterParams): BookingCardBooking {
  // Convert service IDs to service names
  const serviceNames = storeBooking.serviceIds
    .map((serviceId) => {
      const service = services.find((s) => s.id === serviceId);
      return service?.name || serviceId;
    })
    .filter((name): name is string => !!name);

  // Format date string (e.g., "Tuesday, Sep 10")
  const bookingDate = new Date(storeBooking.scheduledDate);
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const weekday = weekdays[bookingDate.getDay()];
  const month = months[bookingDate.getMonth()];
  const day = bookingDate.getDate();
  const formattedDate = `${weekday}, ${month} ${day}`;

  // Convert store BookingStatus to BookingCard BookingStatus
  // BookingCard has "delayed" which store doesn't have, so map it appropriately
  const statusMap: Record<StoreBooking["status"], BookingCardBooking["status"]> = {
    pending: "pending",
    pending_quote: "pending_quote",
    quotes_ready: "quotes_ready",
    confirmed: "confirmed",
    in_progress: "in_progress",
    completed: "completed",
    cancelled: "cancelled",
  };

  // Build BookingCard booking object
  const bookingCard: BookingCardBooking = {
    id: storeBooking.id,
    services: serviceNames,
    carModel: DEFAULT_VEHICLE.model, // TODO: Get from vehicle store
    carYear: DEFAULT_VEHICLE.year, // TODO: Get from vehicle store
    licensePlate: DEFAULT_VEHICLE.licensePlate, // TODO: Get from vehicle store
    mechanicName: mechanic?.name || "Unknown Mechanic",
    shopName: shop?.name || mechanic?.shopName || "Unknown Shop",
    mechanicImage: mechanic?.photoUrl || undefined,
    date: formattedDate,
    time: storeBooking.scheduledTime,
    status: (statusMap[storeBooking.status] as BookingCardBooking["status"]) || "pending",
    totalCost: storeBooking.status === "completed" ? storeBooking.totalPrice : undefined,
  };

  return bookingCard;
}

/** Format date for display (e.g., "Tuesday, Sep 10") */
function formatBookingDate(isoDate: string): string {
  const d = new Date(isoDate);
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${weekdays[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

/** Parse vehicleDisplay into carModel + carYear (e.g. "BMW M5 2019" -> model "BMW M5", year "2019") */
function parseVehicleDisplay(vehicleDisplay: string): { carModel: string; carYear: string } {
  const parts = vehicleDisplay.trim().split(/\s+/);
  const yearPart = parts.find((p) => /^\d{4}$/.test(p));
  const carYear = yearPart ?? "";
  const carModel = yearPart ? parts.filter((p) => p !== yearPart).join(" ") : vehicleDisplay;
  return { carModel: carModel || vehicleDisplay, carYear };
}

/**
 * Converts Convex getByUserIdWithDetails row to BookingCard format
 */
export function adaptConvexBookingWithDetailsToCard(row: ConvexBookingWithDetails): BookingCardBooking {
  const { carModel, carYear } = parseVehicleDisplay(row.vehicleDisplay);
  const status = row.status as BookingCardBooking["status"];
  const displayStatus = status === "in_progress" && (row.delayMinutes ?? 0) > 0 ? "delayed" : status;

  // For tire-quote bookings, synthesize the same notes string the local
  // PendingQuoteCard parser expects ("4 Premium All-Season · 225/45R18").
  let notes: string | undefined;
  if (row.tire_specs) {
    const { quantity, tier, type, size } = row.tire_specs;
    const head = [String(quantity), tier, type].filter(Boolean).join(" ");
    notes = [head || "Tires", size].filter(Boolean).join(" · ");
  }

  return {
    id: row._id,
    services: row.serviceNames,
    carModel,
    carYear,
    licensePlate: row.licensePlate,
    makeLogoUrl: row.makeLogoUrl,
    mechanicName: row.mechanicName,
    shopName: row.shopName,
    mechanicImage: row.mechanicImageUrl,
    date: formatBookingDate(row.scheduled_date),
    time: row.scheduled_time,
    status: displayStatus as BookingCardBooking["status"],
    totalCost: row.status === "completed" ? row.total_cost : undefined,
    notes,
  };
}

/** Canonical Live Tracker stage definitions (slug matches booking.live_stage) */
const LIVE_STAGE_DEFINITIONS: { id: string; slug: string; title: string; description: string }[] = [
  { id: "1", slug: "booking_confirmed", title: "Booking Confirmed", description: "Your appointment is set." },
  {
    id: "2",
    slug: "service_in_progress",
    title: "Service in Progress",
    description: "Currently working on your vehicle.",
  },
  { id: "3", slug: "vehicle_ready", title: "Your vehicle is ready", description: "You will be notified when ready." },
  { id: "4", slug: "service_completed", title: "Service Completed", description: "Your service is completed" },
];

/**
 * Build Live Tracker stages from stored live_stage (and optional progressPercent fallback).
 * When liveStage is set, completed/current/pending are derived from stage order; otherwise falls back to progress-based heuristic.
 */
export function stagesFromLiveStage(liveStage: string | undefined, progressPercent: number = 25): ServiceStage[] {
  const currentIndex = liveStage ? LIVE_STAGE_DEFINITIONS.findIndex((s) => s.slug === liveStage) : -1;
  if (currentIndex >= 0) {
    return LIVE_STAGE_DEFINITIONS.map((def, i) => ({
      id: def.id,
      title: def.title,
      description: def.description,
      status:
        i < currentIndex ? ("completed" as const) : i === currentIndex ? ("current" as const) : ("pending" as const),
    }));
  }
  // Fallback: no stored stage (e.g. legacy or job_actual–only)
  return [
    { id: "1", title: "Booking Confirmed", description: "Your appointment is set.", status: "completed" },
    {
      id: "2",
      title: "Service in Progress",
      description: "Currently working on your vehicle.",
      status: progressPercent < 100 ? "current" : "completed",
    },
    { id: "3", title: "Your vehicle is ready", description: "You will be notified when ready.", status: "pending" },
    { id: "4", title: "Service Completed", description: "Your service is completed", status: "pending" },
  ];
}

/**
 * Converts Convex getByUserIdWithDetails row (in_progress) to LiveTrackerCard format.
 * Uses stored liveStage when present for stage list and currentStage from query.
 */
export function adaptConvexBookingWithDetailsToLiveTracking(row: ConvexBookingWithDetails): LiveTracking {
  const { carModel, carYear } = parseVehicleDisplay(row.vehicleDisplay);
  const progressPercent = row.progressPercent ?? 25;
  return {
    id: row._id,
    carModel,
    carYear,
    licensePlate: row.licensePlate,
    makeLogoUrl: row.makeLogoUrl,
    mechanicName: row.mechanicName,
    shopName: row.shopName,
    mechanicImage: row.mechanicImageUrl,
    shopPhone: row.shopPhone,
    currentStage: row.currentStage ?? "Car checked in",
    progressPercent,
    delayMinutes: row.delayMinutes,
    stages: stagesFromLiveStage(row.liveStage, progressPercent),
  };
}
