/**
 * useSmartPricing
 *
 * Returns Smart Pricing estimates for services using the MI doc formula.
 * Uses engine-specific AI data when available, falls back to service defaults.
 *
 * Formula: Labor = hours × $150/hr, Parts = OEM × 1.35, Platform = 5%
 * Confidence tiers: Verified (≥0.90), Estimated ±10% (0.75–0.89),
 *                   Estimated ±20% (0.60–0.74), Contact for Quote (<0.60)
 */

import { useMemo } from "react";
import { useServiceVehicleSpecsForEngine } from "./useServiceVehicleSpecsForEngine";
import {
  computeSmartPrice,
  formatSmartPrice,
  type SmartPriceResult,
  type PricingTier,
} from "@/utils/smartPricing";

export interface SmartPricingEntry {
  serviceId: string;
  result: SmartPriceResult;
  formatted: string;
  hasEngineData: boolean;
}

export function useSmartPricing(
  engineId: string | undefined,
  serviceIds: string[]
): Record<string, SmartPricingEntry> {
  const engineSpecs = useServiceVehicleSpecsForEngine(engineId, serviceIds);

  return useMemo(() => {
    const pricing: Record<string, SmartPricingEntry> = {};
    for (const serviceId of serviceIds) {
      const spec = engineSpecs[serviceId];
      if (spec && spec.confidence_score != null) {
        const result = computeSmartPrice(
          spec.labor_hours,
          spec.parts_cost_low,
          spec.parts_cost_high,
          spec.confidence_score
        );
        pricing[serviceId] = {
          serviceId,
          result,
          formatted: formatSmartPrice(result),
          hasEngineData: true,
        };
      }
    }
    return pricing;
  }, [engineSpecs, serviceIds]);
}

export type { PricingTier, SmartPriceResult };
