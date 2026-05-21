import { useCallback } from "react";
import { useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";

import type { ToastOptions } from "@/components/toast/types";

import { useToast } from "./useToast";

type ToastSpec<T> =
  | string
  | ((value: T) => { title: string; body?: string })
  | undefined;

export interface MutationToastConfig<TArgs, TResult> {
  success?: ToastSpec<{ result: TResult; args: TArgs }>;
  error?: ToastSpec<{ error: Error; args: TArgs }>;
  /** Whether to fire haptic. Defaults to true on success/error. */
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
 * Convex mutation wrapper that fires the right toast + haptic on settle.
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
  config: MutationToastConfig<Mutation["_args"], Mutation["_returnType"]>,
): (args: Mutation["_args"]) => Promise<Mutation["_returnType"]> {
  const toast = useToast();
  // Convex's useMutation returns a callable; we keep its full typing.
  const run = useMutation(mutation);

  return useCallback(
    async (args: Mutation["_args"]) => {
      try {
        const result = (await run(args)) as Mutation["_returnType"];
        const success = resolveToast(config.success, { result, args });
        if (success) {
          const opts: Omit<ToastOptions, "title" | "body"> = {};
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
    // run identity is stable; deps captured intentionally
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, toast, config.success, config.error, config.suppressError],
  );
}
