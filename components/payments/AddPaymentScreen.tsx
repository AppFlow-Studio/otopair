/**
 * AddPaymentScreen
 *
 * Custom add-card flow: live brand-themed card preview that updates as the
 * user types, a Stripe CardField for input, and a Save button that confirms
 * the SetupIntent and attaches the card to the customer.
 *
 * USED IN: app/add-payment.tsx
 */

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { useAction } from "convex/react";
import {
  CardField,
  CardFieldInput,
  initStripe,
  useStripe,
} from "@stripe/stripe-react-native";
import { ArrowLeft } from "lucide-react-native";

import { api } from "@/convex/_generated/api";
import { resolveStripePublishableKey } from "@/lib/stripeConfig";
import { usePaymentStore } from "@/stores/usePaymentStore";
import {
  FooterButton,
  Text,
} from "@/components/shared-ui";
import { BrandedCardVisual } from "@/components/payments/BrandedCardVisual";

export function AddPaymentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const createSetupIntent = useAction(api.payments_stripe.createSetupIntent);
  const { confirmSetupIntent } = useStripe();
  const bumpPaymentMethodsRefresh = usePaymentStore(
    (s) => s.bumpPaymentMethodsRefresh,
  );
  const selectPaymentMethod = usePaymentStore((s) => s.selectPaymentMethod);

  const [card, setCard] = useState<CardFieldInput.Details | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(true);
  const [stripeReady, setStripeReady] = useState(false);
  const clientSecretRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { setupIntentClientSecret, publishableKeyHint } =
          await createSetupIntent({});
        if (cancelled) return;

        const publishableKey = resolveStripePublishableKey(
          process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
          publishableKeyHint,
        );

        if (!publishableKey) {
          setErrorMessage(
            "Card payments aren't configured for this build. Please contact support.",
          );
          return;
        }

        await initStripe({
          publishableKey,
          merchantIdentifier:
            process.env.EXPO_PUBLIC_STRIPE_MERCHANT_ID ?? "merchant.com.otopair",
          urlScheme: "otopair",
        });
        if (cancelled) return;
        clientSecretRef.current = setupIntentClientSecret;
        setStripeReady(true);
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(
            "Couldn't start the card setup. Please try again.",
          );
          console.warn("[AddPayment] secure form setup failed", err);
        }
      } finally {
        if (!cancelled) setIntentLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createSetupIntent]);

  const handleSave = async () => {
    if (!card?.complete || !clientSecretRef.current || submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const { error, setupIntent } = await confirmSetupIntent(
        clientSecretRef.current,
        { paymentMethodType: "Card" },
      );
      if (error) {
        setErrorMessage(error.localizedMessage || error.message || "Card could not be saved.");
        return;
      }
      // Pre-select the freshly-attached card *before* the Stripe re-pull
      // lands. `hydratePaymentMethods` keeps the existing selection when
      // it's still in the list — so when the new pm shows up in the
      // refreshed Stripe list, this selection sticks and any screen
      // subscribed to the store (e.g. /booking/.../payment) shows the
      // new card as active without an extra tap.
      const newPaymentMethodId = setupIntent?.paymentMethodId;
      if (newPaymentMethodId) {
        selectPaymentMethod(newPaymentMethodId);
      }
      bumpPaymentMethodsRefresh();
      if (router.canGoBack()) router.back();
      else router.replace("/payments");
    } catch (err) {
      console.warn("[AddPayment] confirmSetupIntent failed", err);
      setErrorMessage("Card could not be saved. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const brand = card?.brand ?? "";
  const last4 = card?.last4 || undefined;
  const expMonth = card?.expiryMonth ?? undefined;
  const expYear = card?.expiryYear ?? undefined;
  const canSave =
    stripeReady && !!card?.complete && !!clientSecretRef.current && !submitting;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={10}
        >
          <ArrowLeft size={20} color="#1F2937" strokeWidth={2.5} />
        </Pressable>
        <View style={styles.headerTitle} pointerEvents="none">
          <Text size="lg" weight="bold" color="#1F2937">
            Add Card
          </Text>
        </View>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.body}>
          <View style={styles.cardPreview}>
            <BrandedCardVisual
              brand={brand}
              last4={last4}
              expMonth={expMonth}
              expYear={expYear}
            />
          </View>

          <Text
            size="xs"
            weight="medium"
            color="#6B7280"
            style={styles.fieldLabel}
          >
            CARD DETAILS
          </Text>
          {stripeReady ? (
            <View style={styles.cardFieldWrap}>
              <CardField
                postalCodeEnabled={false}
                placeholders={{ number: "1234 1234 1234 1234" }}
                cardStyle={{
                  backgroundColor: "#FFFFFF",
                  textColor: "#1F2937",
                  placeholderColor: "#9CA3AF",
                  fontSize: 16,
                  borderWidth: 0,
                }}
                style={styles.cardField}
                onCardChange={(details) => {
                  setCard(details);
                  if (details.complete) Keyboard.dismiss();
                }}
              />
            </View>
          ) : null}

          {errorMessage ? (
            <Text size="sm" color="#EF4444" style={styles.errorText}>
              {errorMessage}
            </Text>
          ) : null}

          {intentLoading ? (
            <View style={styles.intentLoading}>
              <ActivityIndicator color="#5299FE" />
              <Text size="sm" color="#6B7280" style={{ marginLeft: 8 }}>
                Preparing secure form…
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableWithoutFeedback>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <FooterButton
          label={submitting ? "Saving…" : "Save card"}
          onPress={handleSave}
          disabled={!canSave}
          loading={submitting}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
  },
  cardPreview: {
    marginTop: 12,
    marginBottom: 28,
  },
  fieldLabel: {
    marginBottom: 8,
    letterSpacing: 1,
  },
  cardFieldWrap: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 56,
    justifyContent: "center",
  },
  cardField: {
    width: "100%",
    height: 50,
  },
  errorText: {
    marginTop: 12,
  },
  intentLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
});

export default AddPaymentScreen;
