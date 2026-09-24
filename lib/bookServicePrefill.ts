/**
 * Oto's pre-picked services on the chat booking card (#268).
 *
 * Oto sends canonical catalog slugs (OTOPAIR_SERVICE_SLUGS in
 * convex/oto/tools.ts, e.g. "filter_replacement"). The card's lookup was
 * keyed by an older vocabulary ("air_filter"), so most picks were dropped
 * without a trace — while the card still said "Pre-checked from our chat" —
 * and Book & Pay matched rows to the catalog by display name, so "Air Filter"
 * never found "Filter Replacement" even when ticked by hand.
 */

/** A live catalog row, as the booking store holds it (slug is canonical). */
export interface CatalogService {
  id: string;
  slug?: string;
  name: string;
  description?: string;
}

/** Oto slug → the card's curated row id. Canonical slugs first; the older
 *  ids stay because conversations saved before the rename still carry them. */
export const SLUG_TO_CARD_ID: Record<string, string> = {
  oil_change: "svc_oil_change",
  filter_replacement: "svc_air_filter",
  tire_rotation: "svc_tire_rotation",
  tire_balance: "svc_tire_balance",
  brake_pad_replacement: "svc_brake_pads",
  brake_fluid_flush: "svc_brake_fluid",
  diagnostic_scan: "svc_diagnostic_scan",
  check_engine_light: "svc_check_engine",
  battery_test: "svc_battery_test",
  // Older vocabulary.
  air_filter: "svc_air_filter",
  fluid_top_off: "svc_fluid_check",
  wheel_balance: "svc_tire_balance",
  tpms_check: "svc_tire_pressure",
  brake_inspection: "svc_brake_inspection",
  brake_pads: "svc_brake_pads",
  brake_fluid: "svc_brake_fluid",
};

/** Card id for a catalog service the curated list has no row for. */
export const catalogCardId = (slug: string) => `catalog:${slug}`;

export interface ResolvedPrefill {
  /** Card ids to pre-check. */
  selectedIds: string[];
  /** Pre-picked services the curated list lacks, taken from the catalog so
   *  they appear checked instead of disappearing. */
  catalogOnly: (CatalogService & { cardId: string })[];
}

export function resolvePrefill(
  slugs: readonly string[] | undefined,
  catalog: readonly CatalogService[],
): ResolvedPrefill {
  const selectedIds: string[] = [];
  const catalogOnly: ResolvedPrefill["catalogOnly"] = [];
  for (const slug of slugs ?? []) {
    const curated = SLUG_TO_CARD_ID[slug];
    if (curated) {
      if (!selectedIds.includes(curated)) selectedIds.push(curated);
      continue;
    }
    const row = catalog.find((c) => c.slug === slug);
    if (!row) continue; // not a bookable service — nothing honest to show
    const cardId = catalogCardId(slug);
    if (selectedIds.includes(cardId)) continue;
    selectedIds.push(cardId);
    catalogOnly.push({ ...row, cardId });
  }
  return { selectedIds, catalogOnly };
}

/** The catalog row a card row books as: by slug, then by name. */
export function matchCatalogService(
  row: { slug?: string; name: string },
  catalog: readonly CatalogService[],
): CatalogService | undefined {
  if (row.slug) {
    const bySlug = catalog.find((c) => c.slug === row.slug);
    if (bySlug) return bySlug;
  }
  const name = row.name.trim().toLowerCase();
  return catalog.find((c) => c.name.trim().toLowerCase() === name);
}
