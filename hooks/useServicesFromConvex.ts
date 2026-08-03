/**
 * useServicesFromConvex
 *
 * Fetches services from Convex (api.services.list) and joins each
 * row with the v5 taxonomy (constants/serviceTaxonomy.ts) by slug,
 * denormalizing tab/order/label/subtitle/aliases/applicability onto
 * the store `Service`. Services without a taxonomy entry are dropped
 * (logged once) so the booking grid never renders an un-spec'd card.
 *
 * Legacy `category` field is derived from the taxonomy tab so
 * existing non-grid consumers (Discovery, AddMore, TopBar) keep
 * compiling.
 *
 * Price = parts only here; labor is computed at the shop step where
 * `shop.labor_rate` is known.
 */

import { useQuery } from "convex/react";
import { useEffect, useMemo, useRef } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { TAXONOMY, type TaxonomyEntry, type TaxonomyTab } from "@/constants/serviceTaxonomy";
import type { Service, ServiceCategory } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";

/**
 * Map v5 tab key to the legacy 4-key `ServiceCategory` enum so
 * downstream surfaces (Discovery/AddMore/TopBar/Modals) that still
 * filter by `service.category` keep behaving sensibly.
 *  - routine_upkeep / inspections → basic_maintenance
 *  - tires_brakes                 → tires_wheels  (brakes share this bucket today)
 *  - major_service                → system_diagnostics
 */
function tabToLegacyCategory(tab: TaxonomyTab): ServiceCategory {
  switch (tab) {
    case "routine_upkeep":
    case "inspections":
      return "basic_maintenance";
    case "tires_brakes":
      return "tires_wheels";
    case "major_service":
      return "system_diagnostics";
  }
}

interface ConvexServiceDoc {
  _id: Id<"services">;
  name: string;
  slug?: string;
  description: string;
  default_labor_hours: number;
  default_parts_estimate?: number;
  has_options?: boolean;
  serviceCategory?: { name?: string } | null;
}

function mapConvexServiceToStore(doc: ConvexServiceDoc, entry: TaxonomyEntry): Service {
  const default_parts_estimate = doc.default_parts_estimate;
  return {
    id: doc._id,
    // Normalize to the taxonomy's canonical (underscored) slug so downstream
    // comparisons like `service.slug === SLUG_TIRE_REPLACEMENT` and
    // `HANDOFF_SLUGS.has(service.slug)` work even when Convex still has the
    // hyphenated legacy slug. TAXONOMY accepts either form (see HYPHEN_ALIASES
    // in constants/serviceTaxonomy.ts); the store always stores the canonical form.
    slug: entry.slug,
    name: doc.name,
    description: doc.description,
    price: default_parts_estimate ?? 0,
    category: tabToLegacyCategory(entry.tab),
    default_labor_hours: doc.default_labor_hours,
    default_parts_estimate,
    has_options: doc.has_options,
    tab: entry.tab,
    order: entry.order,
    displayLabel: entry.label,
    subtitle: entry.subtitle,
    estTimeLabel: entry.estTimeLabel,
    variant: entry.variant,
    applicability: entry.applicability,
    searchAliases: entry.searchAliases,
  };
}

export function useServicesFromConvex() {
  const convexServices = useQuery(api.services.list);
  const setAvailableServices = useBookingStore((s) => s.setAvailableServices);

  // One-shot warning for unmapped slugs per session so a missing
  // taxonomy entry doesn't silently disappear from the grid.
  const warnedRef = useRef<Set<string>>(new Set());

  const services: Service[] = useMemo(() => {
    if (!convexServices || !Array.isArray(convexServices)) return [];
    const out: Service[] = [];
    // Dedupe by canonical taxonomy slug. The DB has multiple legacy
    // rows that all map to the same v5 entry (e.g. `engine-air-filter`
    // and `cabin-air-filter` both alias to `filter_replacement`), so
    // without this the grid showed the same card twice. First DB row
    // wins — its id is what downstream toggles / booking store use.
    const seen = new Set<string>();
    for (const raw of convexServices) {
      const doc = raw as ConvexServiceDoc;
      const slug = doc.slug;
      const entry = slug ? TAXONOMY[slug] : undefined;
      if (!entry) {
        const key = slug ?? doc.name;
        if (!warnedRef.current.has(key)) {
          warnedRef.current.add(key);
          console.warn(
            `[useServicesFromConvex] dropping service without v5 taxonomy entry: slug="${slug ?? "(none)"}" name="${doc.name}"`,
          );
        }
        continue;
      }
      if (seen.has(entry.slug)) continue;
      seen.add(entry.slug);
      out.push(mapConvexServiceToStore(doc, entry));
    }
    return out;
  }, [convexServices]);

  useEffect(() => {
    if (services.length > 0) {
      setAvailableServices(services);
    }
  }, [services, setAvailableServices]);

  return {
    services,
    isLoading: convexServices === undefined,
    error: convexServices === null ? "Failed to load services" : null,
  };
}
