import { describe, expect, it } from "vitest";

import {
  formatShopServicePrice,
  servicePricingMapFromCents,
} from "../lib/shopServicePricing";
import { deriveDisclosedRange } from "../lib/disclosedRange";

describe("mobile shop service pricing", () => {
  it("shows equal endpoints as one fixed amount", () => {
    const price = servicePricingMapFromCents({
      oil: { low_cents: 8_900, high_cents: 8_900, is_fixed: true },
    }).get("oil")!;
    expect(price.isFixed).toBe(true);
    expect(formatShopServicePrice(price)).toBe("$89.00");
  });

  it("shows unequal endpoints as a range", () => {
    const price = servicePricingMapFromCents({
      oil: { low_cents: 8_000, high_cents: 12_000, is_fixed: false },
    }).get("oil")!;
    expect(price.isFixed).toBe(false);
    expect(formatShopServicePrice(price)).toBe("$80.00 – $120.00");
  });

  it("uses override endpoints and removes bundled labor", () => {
    const range = deriveDisclosedRange({
      laborCost: 100,
      partsCost: 0,
      partsLowDollars: 0,
      partsHighDollars: 0,
      fixedPriceLines: [
        { serviceId: "oil", laborCost: 100, partsLow: 80, partsHigh: 120 },
      ],
    });
    expect(range.lowDollars).toBeLessThan(range.highDollars);
    expect(range.formatted).toContain(" – ");
  });
});
