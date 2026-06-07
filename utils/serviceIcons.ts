/**
 * serviceIcons — maps a free-form service-name string to one of the six
 * canonical 3D PNG assets used across the app (Diagnostics, Oil Change,
 * Brakes, Battery, Tires, Inspection).
 *
 * Returns `null` when nothing matches — callers should fall back to a
 * neutral icon (lucide Wrench) so unknown services don't break the row.
 *
 * Substring matching on the user-visible service name is intentional:
 * the seed services are already descriptive enough (e.g. "Battery
 * Replacement", "Brake Pad Replacement") that simple keyword detection
 * covers the bulk of the catalog without threading a backend category
 * field through the booking adapter.
 */

const ICONS = {
  diagnostics: require("@/assets/images/services/newIcons/Engineicon.png"),
  oilChange: require("@/assets/images/services/newIcons/oilchangeicon.png"),
  brakes: require("@/assets/images/services/newIcons/brakesicon.png"),
  battery: require("@/assets/images/services/newIcons/batteryicon.png"),
  tires: require("@/assets/images/services/newIcons/tiresicon.png"),
  inspection: require("@/assets/images/services/newIcons/inspection.png"),
};

export type ServiceIconAsset = number;

export function getServiceIcon(name: string): ServiceIconAsset | null {
  const s = name.toLowerCase();
  if (s.includes("oil")) return ICONS.oilChange;
  if (s.includes("batter")) return ICONS.battery;
  if (s.includes("brake")) return ICONS.brakes;
  if (s.includes("tire") || s.includes("wheel")) return ICONS.tires;
  if (s.includes("diagnos") || s.includes("scan")) return ICONS.diagnostics;
  if (s.includes("inspect")) return ICONS.inspection;
  return null;
}
