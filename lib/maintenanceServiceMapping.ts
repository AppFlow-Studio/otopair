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
  oil: "oil_change",
  brakes: "brake_pad_replacement",
  tires: "tire_rotation",
  battery: "battery_replacement",
  inspection: "ny_state_inspection",
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

/**
 * Find the pre-attach service for a maintenance type, or undefined.
 * Matches slug hyphen/underscore-insensitively because the deployed Convex
 * catalog uses underscores ("oil_change") while older seed scripts use
 * hyphens ("oil-change") — we want to match either without forcing a sync.
 */
const normalizeSlug = (s: string | undefined) =>
  s ? s.toLowerCase().replace(/-/g, "_") : "";

export function findServiceForMaintenanceType(
  type: string,
  available: readonly Service[],
): Service | undefined {
  const wanted = normalizeSlug(MAINTENANCE_TYPE_TO_SLUG[type]);
  if (!wanted) return undefined;
  return available.find((s) => normalizeSlug(s.slug) === wanted);
}
