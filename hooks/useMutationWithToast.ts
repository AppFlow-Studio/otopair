import { useCallback } from "react";
import { useMutation } from "convex/react";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import type { LucideIcon } from "lucide-react-native";

import type { ToastOptions } from "@/components/toast/types";

import { useToast } from "./useToast";

type ToastSpec<T> =
  | string
  | ((value: T) => { title: string; body?: string })
  | undefined;

export interface MutationToastConfig<TArgs, TResult> {
  success?: ToastSpec<{ result: TResult; args: TArgs }>;
  error?: ToastSpec<{ error: Error; args: TArgs }>;
  /** Action-matching icon for the success toast; falls back to the ✓. */
  successIcon?: LucideIcon;
  /** Currently unused — toast haptic fires on appear. Kept for forward-compat. */
  haptic?: boolean;
  /** Suppress the error toast (still rethrows). */
  suppressError?: boolean;
}

function resolveToast<T>(
  spec: ToastSpec<T>,
  payload: T,
): { title: string; body?: string } | null {
  if (!spec) return null;
  if (typeof spec === "string") return { title: spec };
  return spec(payload);
}

/**
 * Convex mutation wrapper that fires the right toast on settle.
 * Mirrors the LeaveReviewSheet try/catch pattern so call sites can drop
 * the boilerplate.
 *
 * @example
 *   const cancel = useMutationWithToast(api.bookings.cancel, {
 *     success: "Booking cancelled. Any payment hold will release within 7 days.",
 *     error: "Couldn't cancel this booking. Try again.",
 *   });
 *   await cancel({ bookingId });
 */
export function useMutationWithToast<
  Mutation extends FunctionReference<"mutation">,
>(
  mutation: Mutation,
  config: MutationToastConfig<
    FunctionArgs<Mutation>,
    FunctionReturnType<Mutation>
  >,
): (args: FunctionArgs<Mutation>) => Promise<FunctionReturnType<Mutation>> {
  const toast = useToast();
  const run = useMutation(mutation);

  return useCallback(
    async (args: FunctionArgs<Mutation>) => {
      try {
        const result = (await run(args)) as FunctionReturnType<Mutation>;
        const success = resolveToast(config.success, { result, args });
        if (success) {
          const opts: Omit<ToastOptions, "title" | "body"> = config.successIcon
            ? { icon: config.successIcon }
            : {};
          toast.success(success.title, success.body, opts);
        }
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (!config.suppressError) {
          const failure = resolveToast(config.error, { error, args });
          if (failure) {
            toast.error(failure.title, failure.body);
          }
        }
        throw error;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, toast, config.success, config.error, config.successIcon, config.suppressError],
  );
}
