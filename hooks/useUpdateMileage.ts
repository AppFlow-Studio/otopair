/**
 * useUpdateMileage — shared mileage-update hook with baked-in UX.
 *
 * One call: validates the input, writes `vehicle_owners.mileage` via the
 * existing `api.vehicles.updateMileage` mutation, fires the success or
 * error toast, and returns a `{ ok }` discriminated union the caller can
 * `if`/`else` on.
 *
 * **Maintenance tracker is reactive — DO NOT recompute manually.**
 * The cars-tab MaintenanceTracker derives its `now / soon / soonish /
 * resting` tiers from the same Convex query that backs the mileage row
 * (see `hooks/useMaintenanceData.ts` → `useMergedMaintenance` →
 * `computeMaintenanceStatus`). When this hook lands the new mileage,
 * the query re-fires automatically and the tracker re-tiers on the
 * next render tick — both directions (up or down). No extra call,
 * no subscription, no manual invalidation needed.
 *
 * **Do NOT add a success toast at the call site.**
 * `toast.success` is wired here; doubling it up will fire two toasts
 * (and two `haptics.success` since `ToastProvider` emits the haptic
 * itself per `lib/haptics.ts`).
 *
 * **Use cases:**
 *  - Cars tab `MileageEditModal` (the cars/index.tsx call site).
 *  - Oto AI chat — when the model parses a mileage update out of the
 *    user's message, call `updateMileage({ vin, userId, mileage })`
 *    inside the handler. The toast + reactive maintenance recompute
 *    give the same UX as the manual edit.
 *
 * @example
 *   const { updateMileage, isUpdating } = useUpdateMileage();
 *   const result = await updateMileage({ vin, userId, mileage: 47250 });
 *   if (!result.ok) {
 *     // result.error is a user-safe string; show it inline or in chat.
 *   }
 */

import { useCallback, useState } from "react";
import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useToast } from "@/hooks/useToast";

const MAX_MILEAGE = 1_500_000;

export interface UpdateMileageArgs {
  vin: string;
  userId: Id<"users">;
  mileage: number;
}

export type UpdateMileageResult =
  | { ok: true }
  | { ok: false; error: string };

export interface UseUpdateMileageResult {
  updateMileage: (args: UpdateMileageArgs) => Promise<UpdateMileageResult>;
  isUpdating: boolean;
}

export function useUpdateMileage(): UseUpdateMileageResult {
  const updateMileageMutation = useMutation(api.vehicles.updateMileage);
  const toast = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const updateMileage = useCallback(
    async ({ vin, userId, mileage }: UpdateMileageArgs): Promise<UpdateMileageResult> => {
      // Synchronous validation. Reject before hitting Convex so a bad
      // AI parse ("my odometer is 12" → 12 mi) or a fumbled keypad
      // never lands in the DB.
      if (Number.isNaN(mileage) || !Number.isFinite(mileage)) {
        const error = "Enter a valid mileage.";
        toast.error(error);
        return { ok: false, error };
      }
      if (mileage <= 0) {
        const error = "Mileage must be greater than 0.";
        toast.error(error);
        return { ok: false, error };
      }
      if (mileage > MAX_MILEAGE) {
        const error = "That mileage looks too high — double-check.";
        toast.error(error);
        return { ok: false, error };
      }

      setIsUpdating(true);
      try {
        await updateMileageMutation({ vin, userId, mileage });
        toast.success("Mileage updated");
        return { ok: true };
      } catch (e) {
        const message =
          e instanceof Error && e.message
            ? e.message
            : "Couldn't update mileage. Try again.";
        toast.error("Couldn't update mileage. Try again.");
        return { ok: false, error: message };
      } finally {
        setIsUpdating(false);
      }
    },
    [updateMileageMutation, toast],
  );

  return { updateMileage, isUpdating };
}
