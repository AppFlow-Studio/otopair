/**
 * bookingAdapter
 *
 * PURPOSE: Transforms store Booking format to BookingCard format
 *          Handles data transformation between store types and UI component types
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * OWNER: Temurbek Sayfutdinov
 */

import type { Booking as StoreBooking, Service } from "@/stores/types/store.types";
import type { Booking as BookingCardBooking } from "@/components/bookings/BookingCard";
import type { Mechanic } from "@/stores/types/store.types";
import type { Shop } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

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

