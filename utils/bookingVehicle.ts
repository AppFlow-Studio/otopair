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

/** True only when every cart item is attached to the same vehicle VIN. */
export function hasConsistentBasketVehicle({
  serviceIds,
  serviceVehicleVins,
  basketVehicleVin,
}: {
  serviceIds: readonly string[];
  serviceVehicleVins: Readonly<Record<string, string | null | undefined>>;
  basketVehicleVin: string | null;
}): boolean {
  const vehicleVins = new Set<string>();

  for (const serviceId of serviceIds) {
    const vehicleVin = serviceVehicleVins[serviceId] ?? basketVehicleVin;
    if (!vehicleVin) return false;
    vehicleVins.add(vehicleVin);
  }

  return vehicleVins.size <= 1;
}
