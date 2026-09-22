/**
 * homeVehicleCards — pure helpers behind the Home "Vehicle Maintenance"
 * carousel (`components/home/VehicleMaintenanceCard.tsx`) and the per-vehicle
 * rows `app/(main-tabs)/home/index.tsx` feeds it.
 *
 * Lifted out of JSX so the three decisions that drive what the carousel shows
 * — which ownership rows become cards, which image a card renders, and how
 * tall the swiper slot is — are testable without mounting React Native.
 */

/** Row shape returned by `api.vehicles.listVehiclesByUser`. */
export interface HomeVehicleRow {
  vin?: string | null;
  /**
   * `null` when the active ownership points at a VIN that has no `vehicles`
   * doc — the query does a `.unique()` lookup per ownership and hands back
   * whatever it finds (`convex/vehicles.ts`).
   */
  vehicle?: unknown;
}

/**
 * The ownership rows that should become cards (and therefore dots).
 *
 * Mirrors the filter `useVehicleOwnershipFromConvex` already applies before it
 * hydrates `useVehicleStore` — a dangling ownership has no vehicle to show and
 * no entry on the Cars tab, so a card for it is a card that goes nowhere.
 * The VIN dedupe is normalised (trim + upper) because every other VIN
 * comparison on Home is, and a row whose VIN differs only in case would
 * otherwise mint a second card for the same car. The row's own `vin` value is
 * returned untouched — it is the lookup key for images and `selectVehicle`.
 */
export function selectHomeVehicleRows<T extends HomeVehicleRow>(
  rows: readonly T[] | null | undefined,
): T[] {
  if (!rows?.length) return [];
  const seen = new Set<string>();
  const selected: T[] = [];
  for (const row of rows) {
    if (row.vehicle == null) continue;
    const key = typeof row.vin === "string" ? row.vin.trim().toUpperCase() : "";
    // No VIN means no stable card identity: measured heights, image URLs and
    // the Cars-tab hand-off are all keyed by it.
    if (key.length === 0) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(row);
  }
  return selected;
}

/**
 * The remote image a vehicle card should load, or `null` when it should fall
 * back to the covered-car placeholder.
 *
 * Home only ever supplies an `imageUrl` when the cached Convex `image_url` is
 * a transparent-background one, so "no usable URL" is an ordinary state, not
 * an error. `failedUris` is keyed by URI rather than by vehicle so a later,
 * different URL for the same car still gets a chance to load.
 */
export function resolveVehicleCardImageUri(
  fetchedUrl: string | null | undefined,
  imageUrl: string | null | undefined,
  failedUris: Readonly<Record<string, true>>,
): string | null {
  for (const candidate of [fetchedUrl, imageUrl]) {
    const uri = typeof candidate === "string" ? candidate.trim() : "";
    if (uri.length === 0) continue;
    if (failedUris[uri]) continue;
    return uri;
  }
  return null;
}

/**
 * Height for the swiper slot, from the pre-measured per-vehicle heights.
 *
 * Sized to the card actually on screen so the slot never reserves space for a
 * vehicle the user isn't looking at. Falls back to the tallest measured card
 * among the vehicles currently in the list — stale ids from removed vehicles
 * are ignored — and to `undefined` while nothing has been measured, which
 * leaves the slot unconstrained rather than collapsing it to zero.
 */
export function resolveCardHeight(
  measuredHeights: Readonly<Record<string, number>>,
  visibleVehicleId: string | undefined,
  vehicleIds: readonly string[],
): number | undefined {
  if (visibleVehicleId != null) {
    const visible = measuredHeights[visibleVehicleId];
    if (typeof visible === "number" && visible > 0) return visible;
  }
  let tallest = 0;
  for (const id of vehicleIds) {
    const height = measuredHeights[id];
    if (typeof height === "number" && height > tallest) tallest = height;
  }
  return tallest > 0 ? tallest : undefined;
}
