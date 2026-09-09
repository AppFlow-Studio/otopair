/**
 * rotorFlow
 *
 * PURPOSE: Types + dev fixtures for the Rotor Booking Flow. Spec:
 *          docs/rotor-booking/SPEC_v1.pdf (June 2026).
 *          User picks brake system type (OEM pre-selected), axle, whether
 *          to include pads, and pad type (when pads = yes). Quantity is
 *          derived from axle. Mocks here exist for dev runs until the
 *          shop-facing partner UI is wired end-to-end.
 */

// ============================================================================
// TYPES
// ============================================================================

/** OEM brake system tier — sourced from VDB `brakingSpec.type`. */
export type BrakeSystemType = "standard" | "sport" | "carbon_ceramic";

/** Front pair, rear pair, or both axles (quantity 2 or 4). */
export type RotorAxle = "front" | "rear" | "both";

/** Pad material the customer picked when include_pads is true. */
export type PadType = "ceramic" | "semi_metallic" | "oem_recommended";

export interface RotorAxleOption {
  id: RotorAxle;
  label: string;
  description: string;
  quantity: number;
}

export interface BrakeSystemOption {
  id: BrakeSystemType;
  label: string;
  caption: string;
}

export interface PadTypeOption {
  id: PadType;
  label: string;
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
  /** Set when include_pads was true on the request. */
  padBrand?: string;
  padType?: PadType;
  padPrice?: number;
  padQuantity?: number;
}

// ============================================================================
// OPTIONS — copy per spec section 6
// ============================================================================

export const BRAKE_SYSTEM_OPTIONS: BrakeSystemOption[] = [
  { id: "standard", label: "Standard brakes", caption: "OEM cast-iron rotors. Most vehicles ship with these." },
  { id: "sport", label: "Sport brakes", caption: "Larger, vented rotors paired with performance pads." },
  { id: "carbon_ceramic", label: "Carbon ceramic", caption: "Track-grade carbon-ceramic discs — lightest, most expensive." },
];

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

export const PAD_TYPE_OPTIONS: PadTypeOption[] = [
  { id: "oem_recommended", label: "OEM recommended" },
  { id: "ceramic", label: "Ceramic" },
  { id: "semi_metallic", label: "Semi-metallic" },
];

export function formatPadTypeLabel(padType: PadType | string | null | undefined): string | null {
  if (!padType) return null;
  const option = PAD_TYPE_OPTIONS.find((o) => o.id === padType);
  if (option) return option.label;
  return padType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// MOCK SHOP RESPONSE GENERATOR — dev fixture
// ============================================================================

const BRAND_POOL: Record<BrakeSystemType, { brand: string; model: string }[]> = {
  standard: [
    { brand: "Bosch", model: "QuietCast Premium" },
    { brand: "Akebono", model: "Pro-ACT Disc" },
    { brand: "Centric", model: "Premium Disc" },
    { brand: "Raybestos", model: "Element3" },
  ],
  sport: [
    { brand: "Brembo", model: "Sport Slotted" },
    { brand: "EBC", model: "USR Sport" },
    { brand: "PowerStop", model: "Z23 Evolution Sport" },
    { brand: "DBA", model: "4000 Series T3" },
  ],
  carbon_ceramic: [
    { brand: "Brembo", model: "CCM-R Carbon Ceramic" },
    { brand: "Surface Transforms", model: "CSiC Disc" },
    { brand: "Akebono", model: "Ceramic Composite" },
    { brand: "Brembo", model: "Carbon Ceramic OE" },
  ],
};

const PAD_BRAND_POOL: Record<PadType, { brand: string; label: string }[]> = {
  oem_recommended: [
    { brand: "Akebono", label: "OEM-equivalent" },
    { brand: "Bosch", label: "OEM Spec" },
  ],
  ceramic: [
    { brand: "Akebono", label: "Ceramic Pro-ACT" },
    { brand: "EBC", label: "Redstuff Ceramic" },
  ],
  semi_metallic: [
    { brand: "Wagner", label: "ThermoQuiet Semi-Metallic" },
    { brand: "PowerStop", label: "Evolution Semi-Metallic" },
  ],
};

export const PRICE_RANGES: Record<BrakeSystemType, [number, number]> = {
  standard: [80, 120],
  sport: [180, 260],
  carbon_ceramic: [900, 1400],
};

const PAD_PRICE_RANGES: Record<PadType, [number, number]> = {
  oem_recommended: [70, 110],
  ceramic: [85, 130],
  semi_metallic: [50, 90],
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

interface MockResponseArgs {
  brakeSystemType: BrakeSystemType;
  axle: RotorAxle;
  includePads: boolean;
  padType: PadType | null;
}

/**
 * Deterministic mock rotor quotes. Pricing tiers off brake system type;
 * pad line items only land when includePads is true.
 */
export function MOCK_SHOP_RESPONSES({
  brakeSystemType,
  axle,
  includePads,
  padType,
}: MockResponseArgs): RotorQuote[] {
  const brands = BRAND_POOL[brakeSystemType];
  const [priceMin, priceMax] = PRICE_RANGES[brakeSystemType];
  const quantity = quantityForAxle(axle);
  const shops = SHOP_POOL;

  const padBrandPool = includePads && padType ? PAD_BRAND_POOL[padType] : null;
  const padPriceRange = includePads && padType ? PAD_PRICE_RANGES[padType] : null;

  return shops.map((shop, i) => {
    const brandInfo = brands[i % brands.length];
    const spread = (priceMax - priceMin) / (shops.length - 1);
    const perRotorPrice = Math.round(priceMin + spread * i);
    const laborCost = quantity === 4 ? 220 + i * 15 : 140 + i * 10;

    let padBrand: string | undefined;
    let padPrice: number | undefined;
    let padQuantity: number | undefined;
    if (padBrandPool && padPriceRange && padType) {
      const padInfo = padBrandPool[i % padBrandPool.length];
      const [padMin, padMax] = padPriceRange;
      const padSpread = (padMax - padMin) / (shops.length - 1);
      padBrand = `${padInfo.brand} ${padInfo.label}`;
      padPrice = Math.round(padMin + padSpread * i);
      padQuantity = quantity;
    }

    const padsSubtotal = padPrice != null && padQuantity != null ? padPrice * padQuantity : 0;
    const total = perRotorPrice * quantity + padsSubtotal + laborCost;

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
      padBrand,
      padType: padType ?? undefined,
      padPrice,
      padQuantity,
    };
  });
}

// ============================================================================
// LABEL HELPERS — used by the requesting screen + analytics
// ============================================================================

/** Human label for the rotors request: "2 Standard-brake rotors · Front pair". */
export function formatRotorsLabel(
  axle: RotorAxle,
  brakeSystemType: BrakeSystemType,
): string {
  const axleLabel =
    axle === "front"
      ? "Front pair"
      : axle === "rear"
        ? "Rear pair"
        : "All four";
  const systemLabel =
    brakeSystemType === "carbon_ceramic"
      ? "Carbon-ceramic"
      : brakeSystemType === "sport"
        ? "Sport"
        : "Standard-brake";
  const quantity = quantityForAxle(axle);
  return `${quantity} ${systemLabel} rotors · ${axleLabel}`;
}

/** Resolve axle → quantity (front=2, rear=2, both=4). */
export function quantityForAxle(axle: RotorAxle): number {
  return ROTOR_AXLE_OPTIONS.find((o) => o.id === axle)?.quantity ?? 2;
}
