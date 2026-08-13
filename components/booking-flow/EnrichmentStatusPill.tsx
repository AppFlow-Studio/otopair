/**
 * EnrichmentStatusPill — announces that a newly-added vehicle is being
 * enriched by the v3 pipeline.
 *
 * Now fires through the normal toast system (useToast) instead of a
 * persistent, forever-spinning overlay: it's one of the brand-blue toasts
 * you already have — it slides up, sits, and AUTO-DISMISSES. That auto-
 * dismiss is the timeout, so a stuck/slow backend job never leaves an
 * endless spinner on screen. Completion is announced separately by
 * useEnrichmentCompletionWatcher.
 *
 * Kept as a mounted component (rendering nothing) so the existing mount
 * points in the layouts don't have to change:
 *   - app/(booking-flow)/_layout.tsx — scope "selected" (the active vehicle).
 *   - app/(main-tabs)/_layout.tsx — scope "any" (the whole garage).
 */

import React, { useEffect } from "react";
import { useQuery } from "convex/react";
import { Car } from "lucide-react-native";

import { api } from "@/convex/_generated/api";
import { useToast } from "@/hooks/useToast";
import { useVehicleEnrichmentStatus } from "@/hooks/useVehicleEnrichmentStatus";
import { useVehicleStore } from "@/stores/useVehicleStore";

// Announce each enriching VIN once per session so moving between screens
// doesn't re-fire the toast. Cleared when a VIN finishes so a later
// re-enrichment can announce again.
const announcedVins = new Set<string>();

interface EnrichmentStatusPillProps {
  /** Retained for call-site compatibility; the toast handles placement. */
  placement?: "top" | "bottom";
  /** "selected" watches the active vehicle; "any" watches the whole garage. */
  scope?: "selected" | "any";
}

export function EnrichmentStatusPill({
  scope = "selected",
}: EnrichmentStatusPillProps) {
  const toast = useToast();
  const selectedVin = useVehicleStore((s) => s.getSelectedVehicle()?.vin ?? null);

  // Garage-wide sweep for "any" scope; skipped in "selected".
  const fleet = useQuery(
    api.vehicles.getMyVehiclesEnrichmentStatus,
    scope === "any" ? {} : "skip",
  );
  const inProgressEntry =
    scope === "any"
      ? ((fleet ?? []) as Array<{ vin: string; label: string; phase: string }>).find(
          (v) => v.phase === "in_progress",
        ) ?? null
      : null;

  const vin = scope === "any" ? (inProgressEntry?.vin ?? null) : selectedVin;
  const enrichment = useVehicleEnrichmentStatus(vin);
  const inProgress =
    scope === "any" ? inProgressEntry != null : enrichment?.isInProgress === true;

  // "any" scope names the car; "selected" keeps it short (the user is
  // already looking at that car's flow).
  const subject =
    scope === "any" && inProgressEntry ? inProgressEntry.label : "your car";
  const message = `Connecting to ${
    subject === "your car" ? subject : `your ${subject}`
  }`;

  useEffect(() => {
    if (inProgress && vin) {
      if (!announcedVins.has(vin)) {
        announcedVins.add(vin);
        toast.trust(message, undefined, { icon: Car });
      }
    } else if (vin && enrichment && !enrichment.isInProgress) {
      // This VIN finished — let a future re-enrichment announce again.
      announcedVins.delete(vin);
    }
  }, [inProgress, vin, message, toast, enrichment]);

  // No persistent UI — the toast IS the notification.
  return null;
}
