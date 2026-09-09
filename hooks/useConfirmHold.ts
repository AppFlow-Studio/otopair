/**
 * useConfirmHold
 *
 * Resolves which payment method backs the new hold for the merged
 * approve-and-hold screen, and mints the concrete PaymentMethod id to pass to
 * `approveAndAuthorizeHold` (which records the approval and places the hold
 * on-session in one call).
 *
 * The method follows the customer's choice, not just the booking's original
 * payment: an explicit wallet pick (`walletIntent`) wins, then an explicitly
 * selected card, then the booking's original origin, then any saved card.
 * Wallet holds (Apple/Google Pay) mint a fresh one-time PaymentMethod via the
 * wallet sheet — the original token can't be reused.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import {
  PlatformPay,
  PlatformPayError,
  usePlatformPay,
} from "@stripe/stripe-react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePaymentStore } from "@/stores/usePaymentStore";
import type { PaymentMethod } from "@/stores/types/store.types";

/** The method that will back the hold, once the customer's choice, the
 *  booking's origin, and saved cards are resolved. */
export type HoldMethodKind = "card" | "apple_pay" | "google_pay" | "none";

/** Concrete method to authorize the hold on, or "cancelled" when the customer
 *  backed out of the wallet sheet (a soft, non-error exit). */
export type ResolvedPaymentMethod =
  | { paymentMethodId: string; paymentOrigin: "card" | "apple_pay" | "google_pay" }
  | "cancelled";

export interface UseConfirmHold {
  /** Amount the new hold will be placed for (approved ceiling). */
  newHoldCents: number;
  /** Resolved method backing the hold. */
  methodKind: HoldMethodKind;
  /** Human label for the resolved method (e.g. "Visa •••• 4242", "Apple Pay"). */
  methodLabel: string;
  /** False when no usable method is resolved yet (blocks confirm). */
  canConfirm: boolean;
  /** The booking's payment origin is still loading — hold the confirm button. */
  originLoading: boolean;
  /** Whether the device can launch Apple / Google Pay (gates the picker). */
  applePaySupported: boolean;
  googlePaySupported: boolean;
  /** Mint (wallet) or resolve (card) the concrete PaymentMethod to authorize. */
  resolvePaymentMethod: () => Promise<ResolvedPaymentMethod>;
}

const brandLabel = (brand: PaymentMethod["brand"] | undefined): string => {
  switch (brand) {
    case "visa":
      return "Visa";
    case "mastercard":
      return "Mastercard";
    case "amex":
      return "Amex";
    case "discover":
      return "Discover";
    default:
      return "Card";
  }
};

export function useConfirmHold(
  bookingId: Id<"bookings">,
  booking:
    | { running_approved_ceiling_cents?: number; mechanic_set_price_cents?: number }
    | null
    | undefined,
): UseConfirmHold {
  const { createPlatformPayPaymentMethod, isPlatformPaySupported } =
    usePlatformPay();

  const selectedPaymentMethodId = usePaymentStore(
    (s) => s.selectedPaymentMethodId,
  );
  const paymentMethods = usePaymentStore((s) => s.paymentMethods);
  const walletIntent = usePaymentStore((s) => s.walletIntent);

  const paymentOrigin = useQuery(
    api.payments_stripe.getPaymentOriginForBooking,
    { bookingId },
  ) as "card" | "apple_pay" | "google_pay" | undefined;
  const originLoading = paymentOrigin === undefined;

  // Wallet availability — same detection as `useWalletCheckout`, so the picker
  // never offers a wallet the confirm step can't launch.
  const [applePaySupported, setApplePaySupported] = useState(false);
  const [googlePaySupported, setGooglePaySupported] = useState(false);
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

  // Prefer the approved ceiling (what the backend re-authorizes to); fall back
  // to the mechanic set price for older bookings not yet through the new cycle.
  const newHoldCents: number =
    booking?.running_approved_ceiling_cents ??
    booking?.mechanic_set_price_cents ??
    0;

  // The card that would back a card-origin hold: the user's active selection
  // (set by the picker / AddPaymentScreen), then default, then the first saved.
  const resolvedCard = useMemo<PaymentMethod | null>(() => {
    if (selectedPaymentMethodId) {
      const explicit = paymentMethods.find(
        (pm) => pm.id === selectedPaymentMethodId,
      );
      if (explicit) return explicit;
    }
    return paymentMethods.find((pm) => pm.isDefault) ?? paymentMethods[0] ?? null;
  }, [paymentMethods, selectedPaymentMethodId]);

  // Explicit choice wins (wallet intent, then a selected card); otherwise fall
  // back to the booking's original origin, then any saved card.
  const methodKind: HoldMethodKind = useMemo(() => {
    if (walletIntent) return walletIntent;
    if (selectedPaymentMethodId && resolvedCard) return "card";
    if (paymentOrigin === "apple_pay" || paymentOrigin === "google_pay") {
      return paymentOrigin;
    }
    if (resolvedCard) return "card";
    return "none";
  }, [walletIntent, selectedPaymentMethodId, resolvedCard, paymentOrigin]);

  const methodLabel = useMemo(() => {
    if (methodKind === "apple_pay") return "Apple Pay";
    if (methodKind === "google_pay") return "Google Pay";
    if (methodKind === "card") {
      return resolvedCard
        ? `${brandLabel(resolvedCard.brand)} •••• ${resolvedCard.last4}`
        : "Card";
    }
    return "No payment method";
  }, [methodKind, resolvedCard]);

  const canConfirm = methodKind !== "none";

  const resolvePaymentMethod =
    useCallback(async (): Promise<ResolvedPaymentMethod> => {
      if (methodKind === "apple_pay" || methodKind === "google_pay") {
        // Mint a fresh one-time PM — only the user's device auth on a new sheet
        // produces a valid token.
        const { paymentMethod, error } =
          methodKind === "apple_pay"
            ? await createPlatformPayPaymentMethod({
                applePay: {
                  cartItems: [
                    {
                      paymentType: PlatformPay.PaymentType.Immediate,
                      label: "OtoPair booking",
                      amount: ((newHoldCents ?? 0) / 100).toFixed(2),
                    },
                  ],
                  merchantCountryCode: "US",
                  currencyCode: "USD",
                },
              })
            : await createPlatformPayPaymentMethod({
                googlePay: {
                  testEnv: __DEV__,
                  merchantCountryCode: "US",
                  currencyCode: "USD",
                  merchantName: "OtoPair",
                },
              });
        if (error) {
          if (error.code === PlatformPayError.Canceled) return "cancelled";
          throw new Error(error.message ?? "Wallet authorization failed.");
        }
        if (!paymentMethod) {
          throw new Error("Wallet didn't return a payment method.");
        }
        return { paymentMethodId: paymentMethod.id, paymentOrigin: methodKind };
      }
      if (methodKind === "card" && resolvedCard) {
        return { paymentMethodId: resolvedCard.id, paymentOrigin: "card" };
      }
      throw new Error("Choose a payment method first.");
    }, [methodKind, resolvedCard, newHoldCents, createPlatformPayPaymentMethod]);

  return {
    newHoldCents,
    methodKind,
    methodLabel,
    canConfirm,
    originLoading,
    applePaySupported,
    googlePaySupported,
    resolvePaymentMethod,
  };
}
