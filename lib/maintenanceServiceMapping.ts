import type { Service, ServiceCategory } from "@/stores/types/store.types";

/**
 * Maps a MaintenanceTracker / VehicleMaintenanceCard row's maintenance type
 * (oil | tires | brakes | battery | inspection) onto the booking flow:
 *
 *   - MAINTENANCE_TYPE_TO_CATEGORY drives which service category tab opens
 *   - MAINTENANCE_TYPE_TO_SLUG names the single service we pre-attach to the
 *     cart so the user lands on /booking/map with the right service ticked
 *
 * If the slug isn't in availableServices (e.g., Convex still hydrating or
 * the seed catalog differs), we silently fall back to category-only.
 */

export const MAINTENANCE_TYPE_TO_CATEGORY: Record<string, ServiceCategory> = {
  oil: "basic_maintenance",
  brakes: "brakes_suspension",
  tires: "tires_wheels",
  battery: "basic_maintenance",
  inspection: "basic_maintenance",
};

export const MAINTENANCE_TYPE_TO_SLUG: Record<string, string> = {
  oil: "oil-change",
  brakes: "brake-pad-replacement",
  tires: "tire-rotation",
  battery: "battery-replacement",
  inspection: "ny-state-inspection",
};

/**
 * Strip the row id back to a maintenance type key.
 *   Cars MaintenanceTracker: "oil" / "unknown-oil" / "user-oil"
 *   Home VehicleMaintenanceCard: "oil-<ownershipId>"
 */
export function extractMaintenanceType(id: string): string {
  const stripped = id.replace(/^(unknown-|user-)/, "");
  const dash = stripped.indexOf("-");
  return dash === -1 ? stripped : stripped.slice(0, dash);
}

/** Find the pre-attach service for a maintenance type, or undefined. */
export function findServiceForMaintenanceType(
  type: string,
  available: readonly Service[],
): Service | undefined {
  const slug = MAINTENANCE_TYPE_TO_SLUG[type];
  if (!slug) return undefined;
  return available.find((s) => s.slug === slug);
}
