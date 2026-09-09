/**
 * useMostBookedService
 *
 * Returns the single most-frequently-booked service across the
 * platform in the last 7 days. Powers the "Most Booked" hero card
 * on the new booking-flow entry screen (Screen 1).
 *
 * Joins the Convex query result to the v5 taxonomy so the card can
 * render the spec label, subtitle, and tab key (for routing on tap).
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";

import { api } from "@/convex/_generated/api";
import { TAXONOMY, type TaxonomyEntry } from "@/constants/serviceTaxonomy";

export interface MostBookedServiceResult {
  serviceId: string;
  slug: string;
  taxonomy: TaxonomyEntry;
  bookingCount: number;
}

export function useMostBookedService(): {
  result: MostBookedServiceResult | null;
  isLoading: boolean;
} {
  const top = useQuery(api.services.getMostBookedThisWeek, { limit: 1 });

  return useMemo(() => {
    if (top === undefined) return { result: null, isLoading: true };
    if (!top || top.length === 0) return { result: null, isLoading: false };

    const { service, count } = top[0];
    const slug = (service as { slug?: string }).slug;
    if (!slug) return { result: null, isLoading: false };

    const taxonomy = TAXONOMY[slug];
    if (!taxonomy) return { result: null, isLoading: false };

    return {
      result: {
        serviceId: String((service as { _id: unknown })._id),
        slug,
        taxonomy,
        bookingCount: count,
      },
      isLoading: false,
    };
  }, [top]);
}
