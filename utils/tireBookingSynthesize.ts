/**
 * synthesizeTireQuoteBooking
 *
 * PURPOSE: Creates a local `pending_quote` booking in `useBookingStore` the
 *          moment the user submits a tire quote request (before any shop has
 *          responded). Per the Apr 23 redesign, this booking lives in the
 *          Upcoming tab and carries the user's tire spec summary in `notes`
 *          until firm shop quotes arrive.
 *
 * USED IN: app/(tire-booking)/index.tsx (from handleGetQuotes)
 */

import { useBookingStore } from "@/stores/useBookingStore";
import { useShopStore } from "@/stores/useShopStore";

/** Service id + label used for every synthesized tire-quote booking. Keeping
 *  a generic service name lets each individual booking carry its specific
 *  tire specs in `notes` without contaminating the shared service catalog. */
const TIRE_INSTALL_SERVICE_ID = "tire_install_from_flow";

/** Placeholder shop used until the user picks a real partner from the
 *  eventual quote list. Lets `BookingCard`-style adapters resolve a shopId
 *  without crashing. */
const PLACEHOLDER_SHOP_ID = "pending_tire_quote_shop";
const PLACEHOLDER_SHOP_NAME = "Awaiting shop quotes";

export interface SynthesizeArgs {
  vehicleId: string | null;
  /** Rendered string like "4 Premium All-Season · 225/45R18". Written to
   *  `notes` so the PendingQuoteCard in Upcoming can display it verbatim. */
  tiresLabel: string;
}

export function synthesizeTireQuoteBooking({ vehicleId, tiresLabel }: SynthesizeArgs): string {
  const nowIso = new Date().toISOString();
  const bookingId = `tire_quote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Seed the placeholder shop if not already present.
  useShopStore.setState((prev) => {
    if (prev.shops[PLACEHOLDER_SHOP_ID]) return prev;
    return {
      shops: {
        ...prev.shops,
        [PLACEHOLDER_SHOP_ID]: {
          id: PLACEHOLDER_SHOP_ID,
          name: PLACEHOLDER_SHOP_NAME,
          address: "",
          latitude: 0,
          longitude: 0,
          distanceKm: null,
          rating: 0,
          imageUrl: null,
          availability: 0,
          hasAvailableSlots: false,
          nextAvailableSlot: null,
          serviceIds: [TIRE_INSTALL_SERVICE_ID],
        },
      },
      shopIds: [...prev.shopIds, PLACEHOLDER_SHOP_ID],
    };
  });

  // Add the tire-install service to the catalog if it's not already there,
  // then push the booking itself in pending_quote status.
  useBookingStore.setState((prev) => {
    const existing = prev.availableServices.find((s) => s.id === TIRE_INSTALL_SERVICE_ID);
    const availableServices = existing
      ? prev.availableServices
      : [
          ...prev.availableServices,
          {
            id: TIRE_INSTALL_SERVICE_ID,
            name: "Tire Installation",
            description: "Tire installation — awaiting shop quotes.",
            price: 0,
            category: "tires_wheels" as const,
          },
        ];

    return {
      availableServices,
      bookings: {
        ...prev.bookings,
        [bookingId]: {
          id: bookingId,
          userId: "current_user_id",
          shopId: PLACEHOLDER_SHOP_ID,
          vehicleId: vehicleId ?? "default_vehicle_id",
          serviceIds: [TIRE_INSTALL_SERVICE_ID],
          status: "pending_quote" as const,
          // Time is TBD until a shop quote is picked.
          scheduledDate: "",
          scheduledTime: "",
          estimatedDuration: 60,
          totalPrice: 0,
          notes: tiresLabel,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      },
      bookingIds: [...prev.bookingIds, bookingId],
    };
  });

  return bookingId;
}
