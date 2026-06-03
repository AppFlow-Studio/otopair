/**
 * useBrakeSystemTypeFromConvex
 *
 * Returns the OEM brake system tier for the active vehicle. Drives the
 * "According to our records, your YYYY Make Model has: Standard brakes"
 * radio pre-selection on the Shop Rotors screen (spec section 2, field 1).
 *
 * When the field hasn't been backfilled for this VIN, returns
 * `{ brakeSystemType: null, isLoading: false }` so the UI leaves no radio
 * pre-selected and the user picks manually.
 */

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { BrakeSystemType } from "@/constants/rotorFlow";
import { useVehicleStore } from "@/stores/useVehicleStore";

interface BrakeSystemTypeResult {
  brakeSystemType: BrakeSystemType | null;
  isLoading: boolean;
}

export function useBrakeSystemTypeFromConvex(): BrakeSystemTypeResult {
  const selectedVehicle = useVehicleStore((s) =>
    s.selectedVehicleId ? s.vehicles[s.selectedVehicleId] : undefined,
  );
  const vin = selectedVehicle?.vin;

  const data = useQuery(
    api.vehicles.getBrakeSystemTypeForVin,
    vin ? { vin } : "skip",
  );

  return {
    brakeSystemType: (data ?? null) as BrakeSystemType | null,
    isLoading: vin != null && data === undefined,
  };
}
