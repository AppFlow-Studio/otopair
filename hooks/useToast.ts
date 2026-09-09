import { useMemo } from "react";

import {
  buildHandle,
  useToastInternal,
} from "@/components/toast/ToastProvider";
import type { ToastHandle } from "@/components/toast/types";

/**
 * Imperative toast API. Available from any component beneath <ToastProvider>.
 *
 * @example
 *   const toast = useToast();
 *   toast.success("Booking confirmed", "Thursday, 9:00 AM");
 *   toast.error("Couldn't save", "Pull to refresh to try again.");
 */
export function useToast(): ToastHandle {
  const ctx = useToastInternal();
  return useMemo(() => buildHandle(ctx), [ctx]);
}
