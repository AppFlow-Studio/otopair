/**
 * tireFlow
 *
 * PURPOSE: Mock data + copy for the Tire Booking Flow skeleton. Everything
 *          here is scaffolding — tier brand lists, tire types, OEM size
 *          fallbacks, and a canned shop-response generator — so the full UX
 *          is demoable without a backend. Shapes intentionally mirror the
 *          spec's Request/Response so a later Convex wire-up is drop-in.
 *
 * SPEC: see Otopair_Tire_Booking_Flow_v1.html + Tire_Brand_Tier_Classification_v1.html
 */

// ============================================================================
// TYPES
// ============================================================================

export type TireTypeId = "all-season" | "performance" | "winter";
// NOTE: Tier IDs renamed 2026-04-22 (elite→premium, select→plus). If analytics
// events or persisted tier values are added later, map old→new explicitly
// instead of renaming in-place again.
export type TireTierId = "premium" | "plus" | "standard";
export type TireQuantity = 2 | 4;

export interface TireTypeOption {
  id: TireTypeId;
  label: string;
  description: string;
  recommended?: boolean;
}

export interface TireTierOption {
  id: TireTierId;
  label: string;
  tagline: string;
  warrantyRange: string;
  brandSample: string[];
  recommended?: boolean;
}

export interface TireQuote {
  id: string;
  shopId: string;
  shopName: string;
  shopRating: number;
  shopDistanceMi: number;
  verifiedPartner: boolean;
  tireBrand: string;
  perTirePrice: number;
  /** Count of tires quoted — 1, 2, 3, or 4. Legacy TireQuantity kept for back-compat. */
  quantity: number;
  laborCost: number;
  total: number;
  availability: string;
  /** Best-fit flag per the spec's ranking algorithm. One true per result set. */
  isBestMatch: boolean;
}

// ============================================================================
// TIRE TYPES
// ============================================================================

export const TIRE_TYPES: TireTypeOption[] = [
  {
    id: "all-season",
    label: "All-Season",
    description:
      "The best fit for year-round driving in your area. Balanced grip across wet and dry conditions with no seasonal swap needed.",
  },
  {
    id: "performance",
    label: "Performance",
    description:
      "Sharper handling and shorter braking distances. Built for sportier driving, with shorter tread life than all-seasons.",
  },
  {
    id: "winter",
    label: "Winter",
    description:
      "Specialized rubber and tread for snow, ice, and freezing temperatures. Swap out once spring arrives.",
  },
];

// ============================================================================
// TIRE TIERS
// ============================================================================

export const TIRE_TIERS: TireTierOption[] = [
  {
    id: "premium",
    label: "Premium",
    tagline:
      "Premium tires engineered for the best ride quality, safety, and longevity. The same brands trusted by luxury automakers.",
    warrantyRange: "60K – 80K mi",
    brandSample: ["Michelin", "Continental", "Bridgestone"],
  },
  {
    id: "plus",
    label: "Plus",
    tagline:
      "Trusted brands with excellent performance and value. Great everyday tires from well-known manufacturers.",
    warrantyRange: "45K – 70K mi",
    brandSample: ["Hankook", "Yokohama", "Cooper"],
  },
  {
    id: "standard",
    label: "Standard",
    tagline:
      "Reliable tires for everyday driving at the most affordable price. Safe and functional for daily commutes.",
    warrantyRange: "30K – 50K mi",
    brandSample: ["Kumho", "Nexen", "Sailun"],
  },
];

// ============================================================================
// OEM SIZE FALLBACKS
// ============================================================================

// Canned OEM sizes keyed by make. Trim isn't hydrated on the Zustand Vehicle
// today, so we fall back to the make. If the make has no entry, we use the
// DEFAULT_OEM_SIZES list.
export const MOCK_OEM_SIZES_BY_MAKE: Record<string, string[]> = {
  Toyota: ["215/55R17", "235/45R18"],
  Honda: ["215/60R16", "235/45R18"],
  Volkswagen: ["225/45R18", "235/55R17"],
  BMW: ["225/45R18", "245/40R19"],
  Mercedes: ["245/45R18", "255/35R19"],
  Ford: ["235/65R17", "265/60R18"],
  Chevrolet: ["225/65R17", "265/65R18"],
  Tesla: ["235/45R19", "265/35R21"],
  Nissan: ["215/60R16", "235/55R18"],
};

export const DEFAULT_OEM_SIZES = ["225/55R17", "235/50R18"];

// ============================================================================
// MOCK SHOP RESPONSE GENERATOR
// ============================================================================

const BRAND_POOL: Record<TireTierId, Array<{ brand: string; model: string }>> = {
  premium: [
    { brand: "Michelin", model: "Defender 2" },
    { brand: "Continental", model: "PureContact LS" },
    { brand: "Bridgestone", model: "Turanza QuietTrack" },
    { brand: "Pirelli", model: "P Zero All Season Plus" },
    { brand: "Goodyear", model: "Assurance WeatherReady" },
  ],
  plus: [
    { brand: "Hankook", model: "Kinergy GT" },
    { brand: "Yokohama", model: "Avid Ascend GT" },
    { brand: "Cooper", model: "Endeavor Plus" },
    { brand: "Falken", model: "Ziex ZE960 A/S" },
    { brand: "General Tire", model: "AltiMAX RT45" },
  ],
  standard: [
    { brand: "Kumho", model: "Solus TA71" },
    { brand: "Nexen", model: "N'Priz AH8" },
    { brand: "Sailun", model: "Atrezzo Elite" },
    { brand: "Westlake", model: "RP18" },
    { brand: "Milestar", model: "MS932 Sport" },
  ],
};

export const PRICE_RANGES: Record<TireTierId, [number, number]> = {
  premium: [185, 258],
  plus: [112, 168],
  standard: [72, 108],
};

export const SHOP_POOL = [
  { id: "shop_ac_wmsbg", name: "AutoCare Express — Williamsburg", rating: 4.9, distance: 0.8, verified: true },
  { id: "shop_metro_tire", name: "Metro Tire Co.", rating: 4.6, distance: 1.4, verified: true },
  { id: "shop_parkslope_auto", name: "Park Slope Auto", rating: 4.4, distance: 2.1, verified: false },
  { id: "shop_bk_tire_pro", name: "Brooklyn Tire Pro", rating: 4.7, distance: 3.3, verified: true },
];

const AVAILABILITY_SLOTS = [
  "Tomorrow, 10:00 AM",
  "Tomorrow, 2:30 PM",
  "Wed, 9:00 AM",
  "Thu, 11:30 AM",
];

/**
 * Deterministically generates 4 canned quotes for the given tier + qty + size.
 * One is flagged isBestMatch (highest trust + earliest availability).
 * Quantity accepts any positive integer (1, 2, 3, 4) — per-tire price × qty + labor.
 */
export function MOCK_SHOP_RESPONSES(
  tier: TireTierId,
  quantity: number,
  _size: string,
): TireQuote[] {
  const brands = BRAND_POOL[tier];
  const [priceMin, priceMax] = PRICE_RANGES[tier];
  const shops = SHOP_POOL;

  return shops.map((shop, i) => {
    const brandInfo = brands[i % brands.length];
    // Slight price variance per shop so totals differ.
    const spread = (priceMax - priceMin) / (shops.length - 1);
    const perTirePrice = Math.round(priceMin + spread * i);
    const laborCost = 70 + i * 10;
    const total = perTirePrice * quantity + laborCost;
    return {
      id: `quote_${shop.id}`,
      shopId: shop.id,
      shopName: shop.name,
      shopRating: shop.rating,
      shopDistanceMi: shop.distance,
      verifiedPartner: shop.verified,
      tireBrand: `${brandInfo.brand} ${brandInfo.model}`,
      perTirePrice,
      quantity,
      laborCost,
      total,
      availability: AVAILABILITY_SLOTS[i % AVAILABILITY_SLOTS.length],
      // First shop is highest rated + closest + verified → Best Match.
      isBestMatch: i === 0,
    };
  });
}
