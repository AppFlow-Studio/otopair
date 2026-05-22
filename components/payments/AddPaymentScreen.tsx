/**
 * AddPaymentScreen
 *
 * Headless. Mounts → fetches a SetupIntent + EphemeralKey from Convex →
 * opens Stripe's PaymentSheet immediately. When the sheet closes (success
 * or cancel), bounces back. No intermediate UI.
 *
 * USED IN: app/add-payment.tsx
 */

import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useAction } from "convex/react";
import { useStripe } from "@stripe/stripe-react-native";

import { api } from "@/convex/_generated/api";
import { usePaymentStore } from "@/stores/usePaymentStore";

export function AddPaymentScreen() {
  const router = useRouter();
  const createSetupIntent = useAction(api.payments_stripe.createSetupIntent);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const bumpPaymentMethodsRefresh = usePaymentStore(
    (s) => s.bumpPaymentMethodsRefresh,
  );

  const ranRef = useRef(false);

  useEffect(() => {
    // StrictMode / focus thrash guard — only run the sheet once per mount.
    if (ranRef.current) return;
    ranRef.current = true;

    const goBack = () => {
      if (router.canGoBack()) router.back();
      else router.replace("/payments");
    };

    const run = async () => {
      try {
        const {
          setupIntentClientSecret,
          customerId,
          ephemeralKeySecret,
        } = await createSetupIntent({});

        const init = await initPaymentSheet({
          merchantDisplayName: "OtoPair",
          customerId,
          customerEphemeralKeySecret: ephemeralKeySecret,
          setupIntentClientSecret,
          allowsDelayedPaymentMethods: false,
          returnURL: "otopair://stripe-redirect",
        });
        if (init.error) {
          // Surface to the global error modal rather than rendering anything
          // here — this screen is meant to be invisible.
          console.warn("[AddPayment] initPaymentSheet failed", init.error);
          goBack();
          return;
        }

        const { error } = await presentPaymentSheet();
        if (error) {
          if (error.code !== "Canceled") {
            console.warn("[AddPayment] presentPaymentSheet failed", error);
          }
        } else {
          // Card attached — kick the global Stripe re-fetch so consumers
          // (payments list, booking review) see the new card immediately.
          bumpPaymentMethodsRefresh();
        }
      } catch (err) {
        console.warn("[AddPayment] setup failed", err);
      } finally {
        goBack();
      }
    };

    void run();
  }, [
    createSetupIntent,
    initPaymentSheet,
    presentPaymentSheet,
    bumpPaymentMethodsRefresh,
    router,
  ]);

  // Fully transparent passthrough — Stripe's PaymentSheet renders on top
  // of whichever screen routed here, so the caller stays visible behind
  // the sheet (no second "page" flash).
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
});

export default AddPaymentScreen;
