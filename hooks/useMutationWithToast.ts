import { useCallback } from "react";
import { useMutation } from "convex/react";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import type { LucideIcon } from "lucide-react-native";

import type { ToastOptions } from "@/components/toast/types";
import {
  formatBookingError,
  readBookingError,
  type BookingErrorCode,
  type BookingErrorData,
} from "@/convex/lib/bookingErrors";

import { useToast } from "./useToast";

/** `variant: "info"` shows a neutral toast instead of success/error — for an
 *  outcome that is information, not a win or a failure (e.g. a cancel that
 *  found the booking already closed, bug #394). A spec returning null shows
 *  nothing (the caller handles it). */
type ToastContent = { title: string; body?: string; variant?: "info" };

type ToastSpec<T> =
  | string
  | ((value: T) => ToastContent | null)
  | undefined;

/**
 * What an error toast spec receives. `message` is always one clean sentence
 * (the typed server copy, the cleaned legacy text, or the fallback) — never
 * the Convex wrapper / stack / JSON that `error.message` can carry (#394).
 */
export interface MutationErrorContext<TArgs> {
  /** The ORIGINAL thrown value (a ConvexError keeps its `.data`). */
  error: unknown;
  message: string;
  code: BookingErrorCode | undefined;
  data: BookingErrorData | null;
  args: TArgs;
}

export interface MutationToastConfig<TArgs, TResult> {
  success?: ToastSpec<{ result: TResult; args: TArgs }>;
  /**
   * A string is the curated title; a typed server error still wins because
   * its sentence is more specific. A function gets the decoded context.
   */
  error?: ToastSpec<MutationErrorContext<TArgs>>;
  /** Fallback for `message` when the error carries nothing readable. */
  errorFallback?: string;
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
): ToastContent | null {
  if (!spec) return null;
  if (typeof spec === "string") return { title: spec };
  return spec(payload);
}

/**
 * Convex mutation wrapper that fires the right toast on settle.
 * Mirrors the LeaveReviewSheet try/catch pattern so call sites can drop
 * the boilerplate.
 *
 * The returned function still REJECTS on failure (with the original error, so
 * callers can branch on `readBookingError(err)?.code`). Callers that drop the
 * promise (`void mutate(...)`) must attach a `.catch` — the toast already
 * told the user, the catch only prevents an unhandled rejection.
 *
 * @example
 *   const cancel = useMutationWithToast(api.bookings.cancel, {
 *     success: "Booking cancelled. Any payment hold will release within 7 days.",
 *     error: (ctx) => ({ title: ctx.message }),
 *     errorFallback: "Couldn't cancel this booking. Try again.",
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
        if (success?.variant === "info") {
          toast.info(success.title, success.body);
        } else if (success) {
          const opts: Omit<ToastOptions, "title" | "body"> = config.successIcon
            ? { icon: config.successIcon }
            : {};
          toast.success(success.title, success.body, opts);
        }
        return result;
      } catch (err) {
        if (!config.suppressError && config.error) {
          const data = readBookingError(err);
          const fallback =
            config.errorFallback ??
            (typeof config.error === "string" ? config.error : undefined);
          const failure: ToastContent | null =
            typeof config.error === "string"
              ? // Only a typed server sentence overrides the curated string;
                // legacy plain-Error text stays behind it.
                { title: data ? data.message : config.error }
              : resolveToast(config.error, {
                  error: err,
                  message: formatBookingError(err, fallback),
                  code: data?.code,
                  data,
                  args,
                });
          if (failure?.variant === "info") {
            toast.info(failure.title, failure.body);
          } else if (failure) {
            toast.error(failure.title, failure.body);
          }
        }
        // Rethrow the ORIGINAL value: re-wrapping in `new Error(String(err))`
        // dropped ConvexError `.data`, so callers could never read the code.
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      run,
      toast,
      config.success,
      config.error,
      config.errorFallback,
      config.successIcon,
      config.suppressError,
    ],
  );
}
