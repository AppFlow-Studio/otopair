/**
 * rotorFlow
 *
 * PURPOSE: Mock data + copy for the Rotor Booking Flow. Mirrors
 *          `constants/tireFlow.ts` (tiers, brand pool, shop pool, mock
 *          response generator) but with rotor-specific axles instead of
 *          tire sizes/types. The shop is responsible for sourcing the
 *          lowest OEM price, so this file carries the tier copy that
 *          frames the customer's choice + a canned response generator
 *          used while the backend is being wired.
 */

// ============================================================================
// TYPES
// ============================================================================

/** Front pair, rear pair, or both axles (quantity 2 or 4). */
export type RotorAxle = "front" | "rear" | "both";
export type RotorTierId = "premium" | "plus" | "standard";

export interface RotorTierOption {
  id: RotorTierId;
  label: string;
  tagline: string;
  warrantyRange: string;
  brandSample: string[];
  recommended?: boolean;
}

export interface RotorAxleOption {
  id: RotorAxle;
  label: string;
  description: string;
  quantity: number;
}

export interface RotorQuote {
  id: string;
  shopId: string;
  shopName: string;
  shopRating: number;
  shopDistanceMi: number;
  verifiedPartner: boolean;
  rotorBrand: string;
  perRotorPrice: number;
  quantity: number;
  laborCost: number;
  total: number;
  availability: string;
  isBestMatch: boolean;
}

// ============================================================================
// AXLE OPTIONS
// ============================================================================

export const ROTOR_AXLE_OPTIONS: RotorAxleOption[] = [
  {
    id: "front",
    label: "Front pair",
    description: "Replace both front rotors. Most common — the front rotors do most of the braking and wear first.",
    quantity: 2,
  },
  {
    id: "rear",
    label: "Rear pair",
    description: "Replace both rear rotors.",
    quantity: 2,
  },
  {
    id: "both",
    label: "All four",
    description: "Replace front and rear rotors together. Recommended if both axles are due.",
    quantity: 4,
  },
];

// ============================================================================
// TIERS
// ============================================================================

export const ROTOR_TIERS: RotorTierOption[] = [
  {
    id: "premium",
    label: "Premium",
    tagline:
      "OEM-grade rotors trusted by automakers. Longest life, quietest braking, lowest dust. Best for daily drivers who want it done once.",
    warrantyRange: "50K – 70K mi",
    brandSample: ["Brembo", "Akebono", "Bosch"],
  },
  {
    id: "plus",
    label: "Plus",
    tagline:
      "Strong all-around brake rotors with solid stopping power and a long service life. Great everyday value from well-known names.",
    warrantyRange: "35K – 55K mi",
    brandSample: ["EBC", "PowerStop", "Centric Premium"],
  },
  {
    id: "standard",
    label: "Standard",
    tagline:
      "Reliable rotors at the most affordable price. Safe for normal driving — replaced sooner than premium options.",
    warrantyRange: "20K – 40K mi",
    brandSample: ["Centric", "AC Delco Advantage", "Wagner"],
  },
];

// ============================================================================
// MOCK SHOP RESPONSE GENERATOR — parallels MOCK_SHOP_RESPONSES in tireFlow
// ============================================================================

const BRAND_POOL: Record<RotorTierId, Array<{ brand: string; model: string }>> = {
  premium: [
    { brand: "Brembo", model: "OE Replacement Disc" },
    { brand: "Akebono", model: "Pro-ACT Disc" },
    { brand: "Bosch", model: "QuietCast Premium" },
    { brand: "ATE", model: "Original" },
    { brand: "Zimmermann", model: "Coat Z" },
  ],
  plus: [
    { brand: "EBC", model: "Ultimax Disc" },
    { brand: "PowerStop", model: "Evolution Geomet" },
    { brand: "Centric", model: "Premium Disc" },
    { brand: "Raybestos", model: "Element3" },
    { brand: "DuraGo", model: "Premium Electrophoretic" },
  ],
  standard: [
    { brand: "AC Delco", model: "Advantage Disc" },
    { brand: "Wagner", model: "BD126111E" },
    { brand: "Centric", model: "C-TEK Standard" },
    { brand: "Detroit Axle", model: "OE Replacement" },
    { brand: "Bosch", model: "Blue Disc" },
  ],
};

export const PRICE_RANGES: Record<RotorTierId, [number, number]> = {
  premium: [125, 215],
  plus: [75, 135],
  standard: [42, 85],
};

export const SHOP_POOL = [
  { id: "shop_ac_wmsbg", name: "AutoCare Express — Williamsburg", rating: 4.9, distance: 0.8, verified: true },
  { id: "shop_brake_masters", name: "Brake Masters Garage", rating: 4.7, distance: 1.5, verified: true },
  { id: "shop_parkslope_auto", name: "Park Slope Auto", rating: 4.4, distance: 2.1, verified: false },
  { id: "shop_bk_brake_co", name: "Brooklyn Brake Co.", rating: 4.6, distance: 3.0, verified: true },
];

const AVAILABILITY_SLOTS = [
  "Tomorrow, 10:00 AM",
  "Tomorrow, 2:30 PM",
  "Wed, 9:00 AM",
  "Thu, 11:30 AM",
];

/**
 * Deterministic mock rotor quotes. Mirrors MOCK_SHOP_RESPONSES from the
 * tire flow so the UX can be demoed before the Convex backend lands.
 */
export function MOCK_SHOP_RESPONSES(
  tier: RotorTierId,
  quantity: number,
): RotorQuote[] {
  const brands = BRAND_POOL[tier];
  const [priceMin, priceMax] = PRICE_RANGES[tier];
  const shops = SHOP_POOL;

  return shops.map((shop, i) => {
    const brandInfo = brands[i % brands.length];
    const spread = (priceMax - priceMin) / (shops.length - 1);
    const perRotorPrice = Math.round(priceMin + spread * i);
    // Rotor labor is more involved than tire swap — front+rear adds ~30 min.
    const laborCost = quantity === 4 ? 220 + i * 15 : 140 + i * 10;
    const total = perRotorPrice * quantity + laborCost;
    return {
      id: `rotor_quote_${shop.id}`,
      shopId: shop.id,
      shopName: shop.name,
      shopRating: shop.rating,
      shopDistanceMi: shop.distance,
      verifiedPartner: shop.verified,
      rotorBrand: `${brandInfo.brand} ${brandInfo.model}`,
      perRotorPrice,
      quantity,
      laborCost,
      total,
      availability: AVAILABILITY_SLOTS[i % AVAILABILITY_SLOTS.length],
      isBestMatch: i === 0,
    };
  });
}

// ============================================================================
// LABEL HELPERS — used by the requesting screen + analytics
// ============================================================================

/** Human label for the rotors request: "2 Plus rotors · Front pair" /
 *  "4 Premium rotors · All four". Mirrors the tire flow's
 *  "{count} {tier+type} · {size}" pattern so the requesting sheet reads
 *  the same way across services. */
export function formatRotorsLabel(axle: RotorAxle, tier: RotorTierId): string {
  const axleLabel =
    axle === "front"
      ? "Front pair"
      : axle === "rear"
        ? "Rear pair"
        : "All four";
  const tierOpt = ROTOR_TIERS.find((t) => t.id === tier);
  const tierLabel = tierOpt?.label ?? tier;
  const quantity = quantityForAxle(axle);
  return `${quantity} ${tierLabel} rotors · ${axleLabel}`;
}

/** Resolve axle → quantity (front=2, rear=2, both=4). */
export function quantityForAxle(axle: RotorAxle): number {
  return ROTOR_AXLE_OPTIONS.find((o) => o.id === axle)?.quantity ?? 2;
}
