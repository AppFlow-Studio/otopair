/**
 * StripePaymentMethodsSync
 *
 * Renderless bridge that pulls the user's saved cards from Stripe via the
 * Convex action and hydrates `usePaymentStore.paymentMethods`. Mounted once
 * at the root so every consumer of the store sees the live Stripe list.
 *
 * The store is a display-only mirror — actual save/detach/set-default go
 * through `api.payments_stripe.*` actions.
 */

import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";

import { usePaymentMethodsFromConvex } from "@/hooks/usePaymentMethodsFromConvex";
import { usePaymentStore } from "@/stores/usePaymentStore";
import type {
  PaymentCardBrand,
  PaymentMethod,
} from "@/stores/types/store.types";

function mapBrand(stripeBrand: string): PaymentCardBrand {
  switch (stripeBrand) {
    case "visa":
      return "visa";
    case "mastercard":
      return "mastercard";
    case "amex":
      return "amex";
    case "discover":
      return "discover";
    default:
      return "generic";
  }
}

export function StripePaymentMethodsSync() {
  const { isSignedIn } = useAuth();
  const hydrate = usePaymentStore((s) => s.hydratePaymentMethods);
  const refreshKey = usePaymentStore((s) => s.paymentMethodsRefreshKey);
  const { paymentMethods, refresh } = usePaymentMethodsFromConvex();

  // Re-pull from Stripe whenever a consumer bumps the store-level refresh
  // counter (e.g. after AddPaymentScreen successfully attaches a card or
  // a future detach UI removes one).
  useEffect(() => {
    if (refreshKey === 0) return;
    refresh();
  }, [refreshKey, refresh]);

  useEffect(() => {
    if (!isSignedIn) {
      hydrate([]);
      return;
    }
    const mapped: PaymentMethod[] = paymentMethods.map((pm) => ({
      id: pm.id,
      brand: mapBrand(pm.brand),
      last4: pm.last4,
      expMonth: pm.expMonth,
      expYear: pm.expYear,
      isDefault: pm.isDefault,
      createdAt: new Date().toISOString(),
    }));
    hydrate(mapped);
  }, [paymentMethods, hydrate, isSignedIn]);

  return null;
}
