import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import {
  PlatformPay,
  PlatformPayError,
  usePlatformPay,
} from "@stripe/stripe-react-native";
import { usePaymentStore } from "@/stores/usePaymentStore";

interface UseWalletCheckoutOptions {
  /** Mechanic id used as the `[id]` path param when routing to the
   *  confirming screen (matches the existing route shape). */
  bookingMechanicId: string;
  /** Amount the wallet will authorize at booking time, in cents. Currently
   *  the $20 deposit on the Pre-Job Approval flow — passed in so the
   *  wallet sheet shows the right number; the server still re-derives the
   *  hold amount from the booking row. */
  totalCents: number;
  /** Label shown on the wallet sheet's summary item. */
  label?: string;
  /** All prerequisites for kicking off a booking are met (mechanic
   *  selected, totals computed, etc.). When false, the wallet handlers
   *  are no-ops. */
  enabled: boolean;
}

interface UseWalletCheckoutReturn {
  handleApplePay: () => Promise<void>;
  handleGooglePay: () => Promise<void>;
  applePaySupported: boolean;
  googlePaySupported: boolean;
  walletPending: boolean;
  walletError: string | null;
}

/** Bridges the Apple Pay / Google Pay buttons on the booking checkout into
 *  the existing card-confirm flow. Mints a one-time wallet PaymentMethod via
 *  `usePlatformPay`, stashes it in `usePaymentStore.selectedWalletPm`, then
 *  routes to `/booking/mechanic/[id]/confirming?paymentMode=wallet`. The
 *  confirming screen then runs the same `createPaymentIntentForBooking`
 *  pipeline as a saved card — the only difference is the `paymentOrigin`
 *  arg, which tags the row so the reauth screen knows to re-prompt via
 *  PlatformPay instead of silently re-using a card.
 */
export function useWalletCheckout(
  opts: UseWalletCheckoutOptions,
): UseWalletCheckoutReturn {
  const { bookingMechanicId, totalCents, label = "OtoPair booking", enabled } = opts;
  const router = useRouter();
  const { createPlatformPayPaymentMethod, isPlatformPaySupported } = usePlatformPay();
  const setSelectedWalletPm = usePaymentStore((s) => s.setSelectedWalletPm);

  const [applePaySupported, setApplePaySupported] = useState(false);
  const [googlePaySupported, setGooglePaySupported] = useState(false);
  const [walletPending, setWalletPending] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Platform.OS === "ios") {
        const ok = await isPlatformPaySupported();
        if (!cancelled) setApplePaySupported(ok);
      } else if (Platform.OS === "android") {
        const ok = await isPlatformPaySupported({
          googlePay: { testEnv: __DEV__ },
        });
        if (!cancelled) setGooglePaySupported(ok);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPlatformPaySupported]);

  const totalDollars = (totalCents / 100).toFixed(2);

  const handleApplePay = useCallback(async () => {
    if (!enabled || walletPending) return;
    setWalletError(null);
    setWalletPending(true);
    try {
      const { paymentMethod, error } = await createPlatformPayPaymentMethod({
        applePay: {
          cartItems: [
            {
              paymentType: PlatformPay.PaymentType.Immediate,
              label,
              amount: totalDollars,
            },
          ],
          merchantCountryCode: "US",
          currencyCode: "USD",
        },
      });
      if (error) {
        // Apple Pay cancellation surfaces as code 'Canceled' — swallow it
        // silently so the user just stays on the payment screen.
        if (error.code !== PlatformPayError.Canceled) {
          setWalletError(error.message ?? "Apple Pay failed.");
        }
        return;
      }
      if (!paymentMethod) {
        setWalletError("Apple Pay didn't return a payment method.");
        return;
      }
      setSelectedWalletPm({ id: paymentMethod.id, type: "apple_pay" });
      router.push({
        pathname: "/booking/mechanic/[id]/confirming",
        params: { id: bookingMechanicId, paymentMode: "wallet" },
      });
    } finally {
      setWalletPending(false);
    }
  }, [
    enabled,
    walletPending,
    createPlatformPayPaymentMethod,
    label,
    totalDollars,
    setSelectedWalletPm,
    router,
    bookingMechanicId,
  ]);

  const handleGooglePay = useCallback(async () => {
    if (!enabled || walletPending) return;
    setWalletError(null);
    setWalletPending(true);
    try {
      const { paymentMethod, error } = await createPlatformPayPaymentMethod({
        googlePay: {
          testEnv: __DEV__,
          merchantCountryCode: "US",
          currencyCode: "USD",
          merchantName: "OtoPair",
        },
      });
      if (error) {
        if (error.code !== PlatformPayError.Canceled) {
          setWalletError(error.message ?? "Google Pay failed.");
        }
        return;
      }
      if (!paymentMethod) {
        setWalletError("Google Pay didn't return a payment method.");
        return;
      }
      setSelectedWalletPm({ id: paymentMethod.id, type: "google_pay" });
      router.push({
        pathname: "/booking/mechanic/[id]/confirming",
        params: { id: bookingMechanicId, paymentMode: "wallet" },
      });
    } finally {
      setWalletPending(false);
    }
  }, [
    enabled,
    walletPending,
    createPlatformPayPaymentMethod,
    setSelectedWalletPm,
    router,
    bookingMechanicId,
  ]);

  return {
    handleApplePay,
    handleGooglePay,
    applePaySupported,
    googlePaySupported,
    walletPending,
    walletError,
  };
}
