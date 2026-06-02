/**
 * serviceVariants
 *
 * PURPOSE: Declarative registry of position-aware variants for services whose
 *          parts differ by axle/side/corner (brakes today; wipers/headlights
 *          later). Single source of truth consulted by:
 *            - ServiceSelectionContent (renders the chip row)
 *            - useBookingStore (stores the user's choice)
 *            - useBookingPartsBreakdown (translates choice → position filter
 *              passed to Convex `getPricedPartsForServices`)
 *            - createBatch caller (forwards `service_variants` so the booking
 *              snapshot freezes the correct part)
 *
 *          Without this, the parts resolver picks whichever fitment scores
 *          highest on evidence regardless of front/rear — see
 *          docs/PACKAGE_AWARE_PARTS.md and `resolveWinningPartForService`
 *          in convex/serviceParts.ts.
 *
 *          Adding a new positional service = one entry here.
 */

/** Axis along which a service varies. Future axes: "side" (L/R), "corner". */
export type VariantAxis = "axle";

/** User-facing choice for the axle axis. */
export type AxleChoice = "front" | "rear" | "both";

export interface ServiceVariantOption {
  /** Stable id used as the cart key. */
  id: AxleChoice;
  /** Chip label shown to the user. */
  label: string;
  /** Value sent to Convex `part_fitments.position` filter. "both" tells the
   *  server to resolve front AND rear and return them as two lines. */
  position: AxleChoice;
}

export interface ServiceVariantSpec {
  axis: VariantAxis;
  /** When true, the Add-to-Cart CTA stays disabled until the user picks one. */
  required: boolean;
  options: ServiceVariantOption[];
}

const AXLE_OPTIONS: ServiceVariantOption[] = [
  { id: "front", label: "Front pair", position: "front" },
  { id: "rear", label: "Rear pair", position: "rear" },
  { id: "both", label: "All four", position: "both" },
];

/**
 * Slug → variant spec. Slugs match `services.slug` in the Convex catalog
 * (see convex/seed_services.ts). Add a new entry to enable variant chips +
 * position-aware part resolution for that service.
 */
export const SERVICE_VARIANTS: Record<string, ServiceVariantSpec> = {
  "brake-pads": { axis: "axle", required: true, options: AXLE_OPTIONS },
  "brake-rotors": { axis: "axle", required: true, options: AXLE_OPTIONS },
};

/** Returns the spec for a service slug, or null if the service is non-positional. */
export function getVariantSpec(slug: string | undefined | null): ServiceVariantSpec | null {
  if (!slug) return null;
  return SERVICE_VARIANTS[slug] ?? null;
}

/** Translate a user choice into the `position` value the resolver expects.
 *  Returns null for unknown slug/choice — callers should treat that as
 *  "no filter, behave as before." */
export function positionForChoice(
  slug: string | undefined | null,
  choice: string | undefined | null,
): AxleChoice | null {
  const spec = getVariantSpec(slug);
  if (!spec || !choice) return null;
  const opt = spec.options.find((o) => o.id === choice);
  return opt ? opt.position : null;
}
