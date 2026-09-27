/**
 * Duplicate-VIN guard for the add-vehicle flow (#308 / #309).
 *
 * The server's `addOwner` treats a second add of the same (vin, user) as an
 * idempotent retry and patches the existing ownership, and `upsertVehicle`
 * overwrites the vehicle row — so re-adding a car already in the garage
 * silently replaced its data. The add flow checks the garage first and stops.
 */

export const DUPLICATE_GARAGE_VIN_MESSAGE = "This car is already in your garage.";

/** True when `vin` matches a car in the user's active garage. */
export function isVinInGarage(
  vin: string,
  garage: readonly { vin: string }[] | null | undefined,
): boolean {
  const target = vin.trim().toUpperCase();
  if (!target || !garage) return false;
  return garage.some((row) => row.vin.trim().toUpperCase() === target);
}
