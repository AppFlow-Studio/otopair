/**
 * Duplicate-VIN guard for the add-vehicle flow (#308 / #309).
 *
 * The server's `addOwner` treats a second add of the same (vin, user) as an
 * idempotent retry and patches the existing ownership, and `upsertVehicle`
 * overwrites the vehicle row — so re-adding a car already in the garage
 * silently replaced its data. The add flow checks the garage first and stops.
 */

export const DUPLICATE_GARAGE_VIN_MESSAGE = "This car is already in your garage.";

/** The matching garage row, or null. Callers that want to NAME the car —
 *  "Your 2025 Mercedes-Benz G-Class is already in your garage" reads very
 *  differently from "This car is already in your garage" — need the row, not
 *  a boolean. `isVinInGarage` is this with the answer thrown away. */
export function findVinInGarage<T extends { vin: string }>(
  vin: string,
  garage: readonly T[] | null | undefined,
): T | null {
  const target = vin.trim().toUpperCase();
  if (!target || !garage) return null;
  return garage.find((row) => row.vin.trim().toUpperCase() === target) ?? null;
}

/** True when `vin` matches a car in the user's active garage. */
export function isVinInGarage(
  vin: string,
  garage: readonly { vin: string }[] | null | undefined,
): boolean {
  return findVinInGarage(vin, garage) !== null;
}
