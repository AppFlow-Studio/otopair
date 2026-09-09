/**
 * useCreateTireQuoteRequest
 *
 * Creates a quote-stage tire booking via `api.bookings.createTireQuoteRequest`.
 * Throws when required Convex data is missing so tire quote requests never
 * look successful while only living in local state.
 *
 * USED IN: app/(tire-booking)/index.tsx (handleGetQuotes)
 */

import { useMutation } from "convex/react";
import { useCallback } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import type { TirePosition } from "@/stores/useTireBookingStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

interface CreateArgs {
  /** "4 Premium All-Season - 225/45R18" */
  tiresLabel: string;
  tireSpecs: {
    size: string;
    type: string;
    tier: string;
    quantity: number;
    positions: TirePosition[];
  };
  /** VIN snapshotted when the quote-request countdown starts. */
  vehicleVin?: string | null;
}

export function useCreateTireQuoteRequest() {
  const createConvex = useMutation(api.bookings.createTireQuoteRequest);
  const { userId } = useUserFromConvex();
  const getSelectedVehicle = useVehicleStore((s) => s.getSelectedVehicle);

  return useCallback(
    async ({ tireSpecs, vehicleVin }: CreateArgs): Promise<string> => {
      const vin = vehicleVin ?? getSelectedVehicle()?.vin;

      if (!userId || !vin) {
        const missingFields = [
          !userId ? "user" : null,
          !vin ? "vehicle VIN" : null,
        ].filter((field): field is string => field != null);
        throw new Error(
          `We couldn't request tire quotes because the ${missingFields.join(", ")} ${missingFields.length === 1 ? "is" : "are"} still loading. Please reselect your vehicle and try again.`,
        );
      }

      const bookingId = await createConvex({
        user_id: userId as Id<"users">,
        vin,
        tire_specs: tireSpecs,
      });
      return String(bookingId);
    },
    [createConvex, userId, getSelectedVehicle],
  );
}
