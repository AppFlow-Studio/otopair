/**
 * useCreateRotorQuoteRequest
 *
 * Creates a quote-stage rotor booking via `api.bookings.createRotorQuoteRequest`.
 * Mirrors `useCreateTireQuoteRequest`. Throws when user/VIN is missing so
 * rotor quote requests never look successful while only living in local state.
 *
 * USED IN: app/(rotor-booking)/index.tsx (handleGetQuotes)
 */

import { useMutation } from "convex/react";
import { useCallback } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { useVehicleStore } from "@/stores/useVehicleStore";
import type {
  BrakeSystemType,
  PadType,
  RotorAxle,
} from "@/constants/rotorFlow";

interface CreateArgs {
  /** "2 Standard-brake rotors · Front pair" */
  rotorsLabel: string;
  rotorSpecs: {
    brake_system_type: BrakeSystemType;
    axle: RotorAxle;
    include_pads: boolean;
    pad_type?: PadType;
  };
  /** VIN snapshotted when the quote-request countdown starts. */
  vehicleVin?: string | null;
}

export function useCreateRotorQuoteRequest() {
  const createConvex = useMutation(api.bookings.createRotorQuoteRequest);
  const { userId } = useUserFromConvex();
  const getSelectedVehicle = useVehicleStore((s) => s.getSelectedVehicle);

  return useCallback(
    async ({ rotorSpecs, vehicleVin }: CreateArgs): Promise<string> => {
      const vin = vehicleVin ?? getSelectedVehicle()?.vin;

      if (!userId || !vin) {
        const missingFields = [
          !userId ? "user" : null,
          !vin ? "vehicle VIN" : null,
        ].filter((field): field is string => field != null);
        throw new Error(
          `We couldn't request rotor quotes because the ${missingFields.join(", ")} ${missingFields.length === 1 ? "is" : "are"} still loading. Please reselect your vehicle and try again.`,
        );
      }

      const bookingId = await createConvex({
        user_id: userId as Id<"users">,
        vin,
        rotor_specs: rotorSpecs,
      });
      return String(bookingId);
    },
    [createConvex, userId, getSelectedVehicle],
  );
}
