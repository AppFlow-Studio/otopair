/**
 * useQuickReadGate
 *
 * Returns whether a vehicle still needs its first quick-read (the 5-check
 * questionnaire on `/quarterly-checkin`). Used by ServiceBottomSheet to
 * gate the "Add to Cart" path: the user must complete a quick-read for
 * a vehicle before they can book any service for it.
 */

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export interface QuickReadGateResult {
  needsQuickRead: boolean;
  isLoading: boolean;
}

export function useQuickReadGate(
  vehicleOwnerId: Id<"vehicle_owners"> | string | undefined,
): QuickReadGateResult {
  const hasCompleted = useQuery(
    api.checkin.hasCompletedCheckin,
    vehicleOwnerId
      ? { vehicleOwnerId: vehicleOwnerId as Id<"vehicle_owners"> }
      : "skip",
  );

  if (!vehicleOwnerId) {
    return { needsQuickRead: false, isLoading: false };
  }
  if (hasCompleted === undefined) {
    return { needsQuickRead: false, isLoading: true };
  }
  return { needsQuickRead: !hasCompleted, isLoading: false };
}
