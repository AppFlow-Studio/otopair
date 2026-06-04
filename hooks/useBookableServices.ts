/**
 * useBookableServices
 *
 * Wraps `api.services.listBookableForVehicle` for the active vehicle and
 * surfaces the per-service state buckets the booking-flow picker needs.
 *
 * Four states (see backend doc on `listBookableForVehicle`):
 *   - bookable             → enabled
 *   - blocked_by_enrichment→ greyed (no action; wait it out)
 *   - blocked_by_specs     → greyed + tappable; tap redirects to My Cars
 *                            so the user answers the pending package question
 *   - missing_data         → hidden entirely (backend gap, no recourse)
 *
 * Frontend pattern:
 *   - applicableIds = all four states (renderable in the picker EXCEPT
 *     missing_data → strip those at the consumer level)
 *   - bookableIds   = "bookable" only (enabled rows)
 *   - needsSpecsIds = "blocked_by_specs" only (tappable-redirect rows)
 *
 * Pass the active vehicle's `ownershipId`. Undefined ownership → query
 * skipped, `isLoading: true` returned.
 *
 * See docs/TICKET_PACKAGE_QUESTIONS.md.
 */

import { useQuery } from "convex/react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type BookableState =
  | "bookable"
  | "blocked_by_enrichment"
  | "blocked_by_specs"
  | "missing_data";

export interface UseBookableServicesResult {
  /** Renderable services (everything EXCEPT missing_data). */
  applicableIds: Set<string>;
  /** Subset of applicableIds that can be booked right now (enabled). */
  bookableIds: Set<string>;
  /** Subset of applicableIds blocked by an unanswered package question. */
  needsSpecsIds: Set<string>;
  /** True while the underlying query is in flight or skipped. */
  isLoading: boolean;
}

export function useBookableServices(
  ownershipId: string | undefined | null,
): UseBookableServicesResult {
  const data = useQuery(
    api.services.listBookableForVehicle,
    ownershipId
      ? { vehicleOwnerId: ownershipId as Id<"vehicle_owners"> }
      : "skip",
  );

  const { applicableIds, bookableIds, needsSpecsIds } = useMemo<{
    applicableIds: Set<string>;
    bookableIds: Set<string>;
    needsSpecsIds: Set<string>;
  }>(() => {
    const applicable = new Set<string>();
    const bookable = new Set<string>();
    const needsSpecs = new Set<string>();
    if (!data) {
      return {
        applicableIds: applicable,
        bookableIds: bookable,
        needsSpecsIds: needsSpecs,
      };
    }
    // Defensive iteration — Convex codegen typing may lag the query until
    // `npx convex dev` regenerates api.d.ts, so don't rely on inferred row shape.
    for (const row of data as Array<{ service_id: string; state: BookableState }>) {
      if (!row || typeof row.service_id !== "string") continue;
      // missing_data is hidden — never renderable, so don't add it to any set
      if (row.state === "missing_data") continue;
      applicable.add(row.service_id);
      if (row.state === "bookable") bookable.add(row.service_id);
      else if (row.state === "blocked_by_specs") needsSpecs.add(row.service_id);
    }
    return {
      applicableIds: applicable,
      bookableIds: bookable,
      needsSpecsIds: needsSpecs,
    };
  }, [data]);

  return {
    applicableIds,
    bookableIds,
    needsSpecsIds,
    isLoading: data === undefined,
  };
}
