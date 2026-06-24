/**
 * useEnrichmentCompletionWatcher — global side-effect hook that fires a
 * persistent, tap-to-book toast the moment any of the current user's
 * vehicles transitions from in-progress to ready.
 *
 * Mount-once-globally (e.g. inside the root layout). The hook itself
 * renders nothing — it just subscribes to the reactive Convex query,
 * compares each tick against the previous snapshot, and reaches into
 * `useToast()` + the vehicle store on transition.
 *
 * Behavior:
 *   - On first non-null query result, populate the dedupe ref with the
 *     CURRENT phases so we don't fire a "ready" toast for vehicles that
 *     were already ready when the app booted (cache hits, second-session
 *     opens, etc.).
 *   - On every subsequent tick, any vehicle whose phase changed from
 *     "in_progress" → "ready" gets a persistent trust toast titled
 *     "<label> is ready" with body "Tap to book a service."
 *   - Tap → selects that vehicle in the local store + pushes the booking
 *     flow's Select Services screen. Vehicle store lookup is best-effort
 *     by VIN; if the local cache doesn't have the vehicle yet, we still
 *     push and let the screen pick whatever's selected.
 *   - Toast does not auto-dismiss (persistent: true). User taps the body
 *     to act, or swipes down to dismiss.
 *   - Once a vehicle has fired its "ready" toast we mark it in the dedupe
 *     ref so re-entering the watcher (HMR, etc.) doesn't re-spam.
 */

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { useToast } from "@/hooks/useToast";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";

type Phase = "in_progress" | "ready" | "not_started";

export function useEnrichmentCompletionWatcher() {
  const toast = useToast();
  const router = useRouter();

  // Reactive — when the v3 pipeline writes a new enrichment_status anywhere,
  // this re-fires automatically.
  const vehicles = useQuery(api.vehicles.getMyVehiclesEnrichmentStatus, {});

  // Tracks the LAST phase we've seen per VIN. Lets us detect a
  // transition (e.g. "in_progress" → "ready") between query ticks
  // without re-firing the toast for vehicles that were already ready
  // on app boot.
  const lastPhaseByVinRef = useRef<Record<string, Phase>>({});
  const initializedRef = useRef(false);

  useEffect(() => {
    // Skip while loading or unauthenticated. `null` = not authenticated,
    // `undefined` = still loading.
    if (vehicles == null) return;

    // First-time hydration: seed the dedupe ref with the CURRENT phases
    // so we don't fire toasts for vehicles that were already ready when
    // the watcher mounted (cold start with cars already enriched).
    if (!initializedRef.current) {
      const seed: Record<string, Phase> = {};
      for (const v of vehicles) seed[v.vin] = v.phase as Phase;
      lastPhaseByVinRef.current = seed;
      initializedRef.current = true;
      return;
    }

    // Subsequent ticks: detect any vehicle that just transitioned from
    // in_progress → ready. Fire one persistent tap-to-book toast per
    // such vehicle, then update the ref so we don't double-fire.
    for (const v of vehicles) {
      const prev = lastPhaseByVinRef.current[v.vin];
      const curr = v.phase as Phase;
      if (prev === "in_progress" && curr === "ready") {
        toast.trust(
          `Your ${v.label} is ready`,
          "Tap to book a service.",
          {
            persistent: true,
            onPress: () => {
              // Best-effort: pick the matching vehicle in the local
              // store so the booking flow's Select Services screen
              // opens with this car already active.
              const store = useVehicleStore.getState();
              const match = Object.values(store.vehicles).find(
                (sv) => sv?.vin === v.vin,
              );
              if (match) store.selectVehicle(match.id);
              router.push("/(booking-flow)/select-services");
            },
          },
        );
      }
      lastPhaseByVinRef.current[v.vin] = curr;
    }
  }, [vehicles, toast, router]);
}
