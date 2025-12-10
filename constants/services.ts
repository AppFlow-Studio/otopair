/**
 * Service Constants
 *
 * PURPOSE: Centralized service category definitions and mappings
 *
 * USED IN: Multiple booking flow components (TopBar, ServiceSelectionContent, etc.)
 *
 * OWNER: Waleed Mansour
 */

import type { ServiceCategory } from "@/stores/types/store.types";

// ============================================================================
// SERVICE CATEGORIES
// ============================================================================

/** Service category display items with labels for UI */
export interface ServiceCategoryItem {
  key: ServiceCategory;
  label: string;
}

/** Service categories with display labels (supports multiline with \n) */
export const SERVICE_CATEGORIES: ServiceCategoryItem[] = [
  { key: "basic_maintenance", label: "Basic\nMaintenance" },
  { key: "tires_wheels", label: "Tires &\nWheels" },
  { key: "brakes_suspension", label: "Brakes &\nSuspension" },
  { key: "system_diagnostics", label: "System\nDiagnostics" },
];

/** Single-line labels for compact display */
export const SERVICE_CATEGORIES_COMPACT: ServiceCategoryItem[] = [
  { key: "basic_maintenance", label: "Basic Maintenance" },
  { key: "tires_wheels", label: "Tires & Wheels" },
  { key: "brakes_suspension", label: "Brakes & Suspension" },
  { key: "system_diagnostics", label: "System Diagnostics" },
];

// ============================================================================
// SERVICE ID MAPPINGS
// ============================================================================

/** Maps service categories to their corresponding service IDs for filtering */
export const SERVICE_CATEGORY_TO_IDS: Record<ServiceCategory, string[]> = {
  basic_maintenance: ["svc_oil_change"],
  tires_wheels: ["svc_tire_service"],
  brakes_suspension: ["svc_brake_service"],
  system_diagnostics: ["svc_diagnostics"],
};

/** Get service IDs for a given category */
export function getServiceIdsForCategory(category: ServiceCategory): string[] {
  return SERVICE_CATEGORY_TO_IDS[category] || [];
}
