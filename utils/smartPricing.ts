/**
 * Smart Pricing — Pre-shop estimated pricing using MI doc formula.
 *
 * Used when no shop is selected to give users a ballpark estimate.
 * Once a shop is chosen, actual shop labor rates take over.
 */

const DEFAULT_LABOR_RATE = 150; // $/hr
const PARTS_MARKUP = 1.35;
const PLATFORM_FEE_RATE = 0.05;

export type PricingTier =
  | "verified"       // confidence ≥ 0.90 — exact price shown
  | "estimated_10"   // confidence 0.75–0.89 — ±10% range
  | "estimated_20"   // confidence 0.60–0.74 — ±20% range
  | "contact";       // confidence < 0.60 — no number shown

export interface SmartPriceResult {
  tier: PricingTier;
  label: string;
  laborCost: number;
  partsCost: number;
  platformFee: number;
  total: number;
  rangeLow?: number;
  rangeHigh?: number;
}

export function classifyPricingTier(confidence: number): PricingTier {
  if (confidence >= 0.9) return "verified";
  if (confidence >= 0.75) return "estimated_10";
  if (confidence >= 0.6) return "estimated_20";
  return "contact";
}

export function getPricingLabel(tier: PricingTier): string {
  switch (tier) {
    case "verified":
      return "Verified Pricing";
    case "estimated_10":
    case "estimated_20":
      return "Estimated Pricing";
    case "contact":
      return "Contact for Quote";
  }
}

/**
 * Compute a smart price estimate for a single service.
 *
 * @param laborHours     - AI-estimated labor hours (from service_vehicle_specs)
 * @param partsCostLow   - AI-estimated parts cost floor
 * @param partsCostHigh  - AI-estimated parts cost ceiling
 * @param confidence     - AI confidence score (0.0–1.0)
 */
export function computeSmartPrice(
  laborHours: number,
  partsCostLow: number,
  partsCostHigh: number,
  confidence: number
): SmartPriceResult {
  const tier = classifyPricingTier(confidence);

  const laborCost = laborHours * DEFAULT_LABOR_RATE;
  const partsAvg = ((partsCostLow + partsCostHigh) / 2) * PARTS_MARKUP;
  const subtotal = laborCost + partsAvg;
  const platformFee = subtotal * PLATFORM_FEE_RATE;
  const total = subtotal + platformFee;
  const label = getPricingLabel(tier);

  if (tier === "contact") {
    return { tier, label, laborCost, partsCost: partsAvg, platformFee, total };
  }

  if (tier === "verified") {
    return { tier, label, laborCost, partsCost: partsAvg, platformFee, total };
  }

  const margin = tier === "estimated_10" ? 0.1 : 0.2;
  return {
    tier,
    label,
    laborCost,
    partsCost: partsAvg,
    platformFee,
    total,
    rangeLow: Math.round(total * (1 - margin)),
    rangeHigh: Math.round(total * (1 + margin)),
  };
}

/**
 * Format a smart price for display.
 * Returns a string like "$185", "$165 – $205", or "Contact for Quote".
 */
export function formatSmartPrice(result: SmartPriceResult): string {
  if (result.tier === "contact") return "Contact for Quote";
  if (result.rangeLow != null && result.rangeHigh != null) {
    return `$${result.rangeLow} – $${result.rangeHigh}`;
  }
  return `$${Math.round(result.total)}`;
}
