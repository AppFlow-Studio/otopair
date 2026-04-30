/**
 * useCreateTireQuoteRequest
 *
 * Creates a quote-stage tire booking via `api.bookings.createTireQuoteRequest`.
 * Falls back to the local-only synthesis (`synthesizeTireQuoteBooking`) when
 * required data (Convex userId or VIN) isn't available — e.g., the user is
 * unauthenticated or hasn't linked a vehicle in Convex yet. Mirrors the
 * fallback pattern in `useCreateBookingConvex`.
 *
 * USED IN: app/(tire-booking)/index.tsx (handleGetQuotes)
 */

import { useMutation } from "convex/react";
import { useCallback } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { synthesizeTireQuoteBooking } from "@/utils/tireBookingSynthesize";

interface CreateArgs {
  /** "4 Premium All-Season · 225/45R18" — used by the local fallback path. */
  tiresLabel: string;
  tireSpecs: {
    size: string;
    type: string;
    tier: string;
    quantity: number;
  };
}

export function useCreateTireQuoteRequest() {
  const createConvex = useMutation(api.bookings.createTireQuoteRequest);
  const { userId } = useUserFromConvex();
  const getSelectedVehicle = useVehicleStore((s) => s.getSelectedVehicle);
  const selectedVehicleId = useVehicleStore((s) => s.selectedVehicleId);

  return useCallback(
    async ({ tiresLabel, tireSpecs }: CreateArgs): Promise<string> => {
      const vehicle = getSelectedVehicle();
      const vin = vehicle?.vin;

      // Fallback: missing Convex prereqs → local-only booking. Card still
      // shows up in Upcoming, but the website won't see it.
      if (!userId || !vin) {
        return synthesizeTireQuoteBooking({
          vehicleId: selectedVehicleId,
          tiresLabel,
        });
      }

      const bookingId = await createConvex({
        user_id: userId as Id<"users">,
        vin,
        tire_specs: tireSpecs,
      });
      return String(bookingId);
    },
    [createConvex, userId, getSelectedVehicle, selectedVehicleId],
  );
}
