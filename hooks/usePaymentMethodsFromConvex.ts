/**
 * usePaymentMethodsFromConvex
 *
 * Reads the signed-in user's saved Stripe card payment methods via the
 * `api.payments_stripe.listPaymentMethods` action. Stripe is the source of
 * truth — we never cache card data in Convex or Zustand.
 *
 * Pattern: kicks an action on mount + on `refreshKey` bump; exposes loading
 * + error + an imperative `refresh()` for callers that just attached a new
 * card or detached an existing one.
 */

import { useAction } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";

export type SavedPaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
};

export function usePaymentMethodsFromConvex() {
  const listAction = useAction(api.payments_stripe.listPaymentMethods);
  const [paymentMethods, setPaymentMethods] = useState<SavedPaymentMethod[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setIsLoading(true);
    setError(null);
    listAction({})
      .then((rows) => {
        if (cancelledRef.current) return;
        setPaymentMethods(rows);
      })
      .catch((err: any) => {
        if (cancelledRef.current) return;
        setError(err?.message ?? "Failed to load payment methods.");
      })
      .finally(() => {
        if (!cancelledRef.current) setIsLoading(false);
      });
    return () => {
      cancelledRef.current = true;
    };
  }, [listAction, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { paymentMethods, isLoading, error, refresh };
}
