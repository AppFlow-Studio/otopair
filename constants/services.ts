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

// ============================================================================
// BID-PATH SERVICE NAMES — services that hand off to a shop-bidding flow
// (broadcast quote request → shops respond → user accepts) instead of
// landing as a normal line-item in the booking cart.
//
// The customer-facing name is matched against `service.name` on the
// Convex catalog row. The catalog must seed:
//   - "Tire Replacement"  with slug `tire-replacement`
//   - "Rotor Replacement" with slug `rotor-replacement`
// (acceptTireQuote / acceptRotorQuote read those slugs to link the
//  service onto the accepted booking.)
// ============================================================================

export const SHOP_TIRES_SERVICE_NAME = "Tire Replacement";
export const ROTOR_REPLACEMENT_SERVICE_NAME = "Rotor Replacement";

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

// ============================================================================
// SERVICE PARTS (for Review & Pay breakdown)
// ============================================================================

/**
 * Maps service display name to part names shown in the Service Breakdown.
 * Used to list each part on its own line with "(Part)" label.
 */
export const SERVICE_PARTS: Record<string, string[]> = {
  "Oil Change": ["Oil", "Filter"],
  "Brake Pad Replacement": ["Brake Pads"],
  "Tire Rotation": [],
};

export interface BreakdownPart {
  name: string;
  cost: number;
}

/**
 * Builds a list of parts with individual costs from selected services and total parts cost.
 * Parts cost is split equally among all part names. If no part names exist, returns one generic "Parts" entry.
 */
export function getPartsBreakdown(serviceNames: string[], totalPartsCost: number): BreakdownPart[] {
  const partNames: string[] = [];
  for (const name of serviceNames) {
    const parts = SERVICE_PARTS[name];
    if (parts?.length) partNames.push(...parts);
  }
  if (partNames.length === 0) {
    return totalPartsCost > 0 ? [{ name: "Parts", cost: totalPartsCost }] : [];
  }
  const costPerPart = totalPartsCost / partNames.length;
  return partNames.map((name) => ({ name, cost: costPerPart }));
}
