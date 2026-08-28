/** Resolve the vehicle permanently attached to the active checkout. */
export function resolveBookingVehicleVin(
  quoteVehicleVin: string | null | undefined,
  basketVehicleVin: string | null | undefined,
): string | null {
  return quoteVehicleVin ?? basketVehicleVin ?? null;
}

export function resolveBasketVehicleVin({
  previousServiceCount,
  nextServiceCount,
  basketVehicleVin,
  activeVehicleVin,
}: {
  previousServiceCount: number;
  nextServiceCount: number;
  basketVehicleVin: string | null;
  activeVehicleVin: string | null;
}): string | null {
  if (nextServiceCount === 0) return null;
  if (previousServiceCount === 0) return activeVehicleVin;
  return basketVehicleVin;
}
