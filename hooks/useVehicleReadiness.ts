/**
 * useVehicleReadiness
 *
 * Wraps `api.vehicles.getReadiness` for the active vehicle. Drives the My Cars
 * vehicle-detail readiness UX: "Setting up your car…" pill while the pipeline
 * is in flight, "Confirm your car's specs" CTA when there are pending package
 * questions, nothing once the user has answered everything.
 *
 * Pass the active vehicle's `ownershipId` (= `vehicle_owners._id`, available on
 * the Vehicle store as `Vehicle.ownershipId`). Undefined ownership → query
 * skipped, hook returns the "loading" shape.
 *
 * See docs/TICKET_PACKAGE_QUESTIONS.md.
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export interface PendingPackageQuestion {
  code: string;
  label: string;
  services_affected: string[];
  detected_from: string;
  confidence?: number;
}

export interface VehicleReadiness {
  /** "enriching" while the pipeline is running; "ready" once data exists. */
  status: "enriching" | "ready" | null;
  /** Empty while loading or once all questions are answered. */
  pendingPackages: PendingPackageQuestion[];
  /** True while the underlying Convex query is in flight (or skipped). */
  isLoading: boolean;
}

export function useVehicleReadiness(
  ownershipId: string | undefined | null,
): VehicleReadiness {
  const data = useQuery(
    api.vehicles.getReadiness,
    ownershipId
      ? { vehicleOwnerId: ownershipId as Id<"vehicle_owners"> }
      : "skip",
  );

  if (data === undefined) {
    return { status: null, pendingPackages: [], isLoading: true };
  }

  return {
    status: data.status,
    pendingPackages: data.pendingPackages,
    isLoading: false,
  };
}
