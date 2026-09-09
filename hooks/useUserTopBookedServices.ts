/**
 * useUserTopBookedServices
 *
 * Returns the current user's top-N most-frequently-booked services
 * (joined to v5 taxonomy). Falls back to a curated default chip set
 * for first-time users with no booking history. Powers the Quick
 * Book row on the new booking-flow entry screen (Screen 1).
 */

import { useQuery } from "convex/react";
import { useAuth } from "@clerk/clerk-expo";
import { useMemo } from "react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { TAXONOMY, type TaxonomyEntry } from "@/constants/serviceTaxonomy";
import { useBookingStore } from "@/stores/useBookingStore";

const DEFAULT_QUICK_BOOK_SLUGS = [
  "oil_change",
  "tire_rotation",
  "state_inspection",
  "brake_pad_replacement",
  "battery_test",
  "filter_replacement",
] as const;

export interface QuickBookChip {
  /** Convex services._id when resolved from the catalog; null for
   *  fallback chips where the user has no real booking history yet
   *  (caller still has the slug + taxonomy entry to route on tap). */
  serviceId: string | null;
  slug: string;
  taxonomy: TaxonomyEntry;
  bookingCount: number;
}

export function useUserTopBookedServices(limit = 6): {
  chips: QuickBookChip[];
  isLoading: boolean;
} {
  const { isLoaded, isSignedIn } = useAuth();
  const me = useQuery(api.users.getMe, isLoaded && isSignedIn ? undefined : "skip");

  const userId = me?._id as Id<"users"> | undefined;

  const top = useQuery(
    api.bookings.getTopBookedServicesByUser,
    userId ? { userId, limit } : "skip",
  );

  // Fall back to the curated chip set hydrated against the live
  // services catalog so we can route by service id even for first-
  // time users.
  const availableServices = useBookingStore((s) => s.availableServices);

  return useMemo(() => {
    const userQueryLoading =
      isLoaded && isSignedIn && (me === undefined || top === undefined);
    if (userQueryLoading) return { chips: [], isLoading: true };

    // Real history available — render the user's top-N.
    if (top && top.length > 0) {
      const chips: QuickBookChip[] = [];
      for (const { service, count } of top) {
        const slug = (service as { slug?: string }).slug;
        if (!slug) continue;
        const taxonomy = TAXONOMY[slug];
        if (!taxonomy) continue;
        chips.push({
          serviceId: String((service as { _id: unknown })._id),
          slug,
          taxonomy,
          bookingCount: count,
        });
      }
      if (chips.length > 0) return { chips, isLoading: false };
    }

    // No history yet — curated default. Resolve Convex `_id` against
    // the hydrated catalog so taps still route via the same path as
    // real top-services.
    const bySlug = new Map(
      availableServices.map((s) => [s.slug ?? "", s.id] as const),
    );
    const fallback: QuickBookChip[] = [];
    for (const slug of DEFAULT_QUICK_BOOK_SLUGS) {
      const taxonomy = TAXONOMY[slug];
      if (!taxonomy) continue;
      fallback.push({
        serviceId: bySlug.get(slug) ?? null,
        slug,
        taxonomy,
        bookingCount: 0,
      });
      if (fallback.length >= limit) break;
    }
    return { chips: fallback, isLoading: false };
  }, [isLoaded, isSignedIn, me, top, availableServices, limit]);
}
