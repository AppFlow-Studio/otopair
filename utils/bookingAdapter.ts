/**
 * bookingAdapter
 *
 * PURPOSE: Transforms store Booking format to BookingCard format
 *          Handles data transformation between store types and UI component types.
 *          Also adapts Convex getByUserIdWithDetails rows to BookingCard.
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * OWNER: Temurbek Sayfutdinov
 */

import type { Booking as StoreBooking, Service } from "@/stores/types/store.types";
import type { Booking as BookingCardBooking } from "@/components/bookings/BookingCard";
import type { Mechanic } from "@/stores/types/store.types";
import type { Shop } from "@/stores/types/store.types";
import { hhmmToDisplayTime } from "@/utils/timeSlotUtils";

/** Convert "14:00" → "2:00 PM"; pass through anything that already
 *  contains AM/PM. Empty/undefined returns "". */
function formatBookingTime(raw: string | undefined | null): string {
  if (!raw) return "";
  if (/AM|PM/i.test(raw)) return raw;
  if (!/^\d{1,2}:\d{2}$/.test(raw)) return raw;
  return hhmmToDisplayTime(raw);
}

// ============================================================================
// TYPES
// ============================================================================

/** Shape returned by Convex api.bookings.getByUserIdWithDetails */
export interface ConvexBookingWithDetails {
  _id: string;
  /** Epoch ms when the booking row was inserted. Convex auto-populates. */
  _creationTime?: number;
  status: string;
  scheduled_date: string;
  scheduled_time: string;
  total_cost: number;
  shop_id?: string;
  mechanic_id?: string;
  shopName: string;
  shopPhone: string;
  mechanicName: string;
  mechanicImageUrl?: string;
  vehicleDisplay: string;
  /** VIN — used to match a booking to a chip-selected vehicle without
   *  relying on `vehicleDisplay` parsing (which can include trim names
   *  the chip filter doesn't know about). */
  vin?: string;
  licensePlate: string;
  makeLogoUrl?: string;
  /** Hero image of the vehicle (cached from VehicleDB). Preferred over
   *  `makeLogoUrl` for card thumbnails. */
  vehicleImageUrl?: string;
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

  // Format date string (e.g., "Tuesday, Sep 10").
  // `new Date("YYYY-MM-DD")` parses as UTC midnight, which renders as
  // the previous day in any timezone west of UTC. Construct from
  // numeric parts so the date is interpreted in local time. Empty
  // `scheduledDate` (tire quote-stage bookings) → empty string.
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let formattedDate = "";
  if (storeBooking.scheduledDate) {
    const [sy, sm, sd] = storeBooking.scheduledDate.split("-").map(Number);
    if (sy && sm && sd) {
      const bookingDate = new Date(sy, sm - 1, sd);
      formattedDate = `${weekdays[bookingDate.getDay()]}, ${months[bookingDate.getMonth()]} ${bookingDate.getDate()}`;
    }
  }

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
    time: formatBookingTime(storeBooking.scheduledTime),
    status: (statusMap[storeBooking.status] as BookingCardBooking["status"]) || "pending",
    totalCost: storeBooking.status === "completed" ? storeBooking.totalPrice : undefined,
  };

  return bookingCard;
}

/** Format date for display (e.g., "Tuesday, Sep 10") */
function formatBookingDate(isoDate: string | undefined | null): string {
  // Tire quote-stage bookings have no `scheduled_date` yet — return an
  // empty string so callers can render "Time TBD" themselves.
  if (!isoDate) return "";
  // Parse YYYY-MM-DD as a local date. `new Date("YYYY-MM-DD")` is
  // interpreted as UTC midnight by the JS engine, which displays as
  // the previous day in any timezone west of UTC.
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  const date = new Date(y, m - 1, d);
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
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
    // Prefer the cached vehicle hero image over the brand logo so the
    // booking thumbnail shows the actual car. `makeLogoUrl` stays as a
    // fallback for vehicles without a fetched image yet.
    makeLogoUrl: row.vehicleImageUrl ?? row.makeLogoUrl,
    mechanicName: row.mechanicName,
    shopName: row.shopName,
    mechanicImage: row.mechanicImageUrl,
    date: formatBookingDate(row.scheduled_date),
    time: formatBookingTime(row.scheduled_time),
    status: displayStatus as BookingCardBooking["status"],
    totalCost: row.status === "completed" ? row.total_cost : undefined,
    notes,
    createdAt: row._creationTime,
    vin: row.vin,
    liveStage: row.liveStage,
    shopId: row.shop_id,
    mechanicId: row.mechanic_id,
  };
}

// Removed in the May 2 redesign: `LIVE_STAGE_DEFINITIONS`,
// `stagesFromLiveStage`, and `adaptConvexBookingWithDetailsToLiveTracking`.
// The per-card progress bar (`utils/bookingStages.ts` +
// `components/bookings/BookingProgressBar.tsx`) replaces them. The
// canonical `live_stage` slug list still lives in `convex/bookings.ts`
// (`LIVE_STAGE_TITLES` / `LIVE_STAGE_PROGRESS`).
