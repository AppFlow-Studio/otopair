/**
 * Booking · Confirming route
 *
 * Loading screen shown after the user taps "Confirm Appointment" on the
 * Review & Pay screen. Mirrors the tire-quote requesting visual:
 *   - Lottie pin-drop on a radial OtoPair-blue gradient
 *   - Contextual copy that fades in after the pin lands
 *   - FloatingSheet hosting the appointment summary + an Uber-Eats-style
 *     Confirm-with-countdown button (8s auto-fire) and a Go back link
 *
 * The mutation is gated on the Confirm tap (or the 8s countdown firing).
 * On success the route forwards to /confirmation; on failure it bounces
 * back to /payment with an error param.
 *
 * USED IN: payment screen's `handleConfirmPayment` flow.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Platform, StyleSheet, View, useWindowDimensions } from "react-native";

import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { useAction } from "convex/react";
import { useStripe } from "@stripe/stripe-react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { BookingConfirmStatus } from "@/components/booking/BookingConfirmStatus";
import { useCreateBookingConvex } from "@/hooks/useCreateBookingConvex";
import { calculateBookingConfirmSheetHeight } from "@/lib/bookingConfirmSheet";
import { useBookingStore } from "@/stores/useBookingStore";
import { usePaymentStore } from "@/stores/usePaymentStore";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Copy fade-in is gated to the same landing moment as the tire flow so
// the timing reads consistently across both surfaces.
const COPY_FADE_DELAY_MS = 2050;
const COPY_FADE_DURATION_MS = 600;

/** Strip the Convex error wrapper down to the human-readable message. */
function extractErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Something went wrong. Please try again.";
  const raw = err.message;
  const m = raw.match(/(?:Uncaught\s+)?Error:\s*([^\n]+)/i);
  if (m && m[1]) return m[1].trim();
  return raw
    .replace(/\[CONVEX[^\]]*\]\s*/gi, "")
    .replace(/\[Request ID:[^\]]*\]\s*/gi, "")
    .replace(/\n\s*at\s+.*/g, "")
    .replace(/\n\s*Called by client.*/g, "")
    .trim() || "Something went wrong. Please try again.";
}

export default function BookingConfirmingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sheetRef = useRef<FloatingSheetRef>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { createBookingConvex } = useCreateBookingConvex();
  const selectedMechanicId = useBookingStore((s) => s.selectedMechanicId);
  const selectedMechanicSlot = useBookingStore((s) => s.selectedMechanicSlot);
  const bookingType = useBookingStore((s) => s.bookingType);
  const selectedPaymentMethodId = usePaymentStore((s) => s.selectedPaymentMethodId);
  const createPaymentIntent = useAction(api.payments_stripe.createPaymentIntentForBooking);
  // The PaymentIntent is created + confirmed server-side. If 3DS is needed,
  // Stripe returns requires_action and the client *finishes* the challenge
  // via `handleNextAction(clientSecret)` — NOT `confirmPayment`, which
  // would error out on an already-confirmed PI.
  const { handleNextAction } = useStripe();
  const navigatedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const isCompactLayout = windowHeight < 860;
  const isVeryCompactLayout = windowHeight < 760;
  const sheetHeight = calculateBookingConfirmSheetHeight(windowHeight);

  // Open the sheet on mount, same shape as the tire-quote requesting flow.
  useEffect(() => {
    sheetRef.current?.open();
  }, []);

  // Copy fade-in (after pin lands).
  const copyOpacity = useSharedValue(0);
  const copyAnimStyle = useAnimatedStyle(() => ({ opacity: copyOpacity.value }));
  useEffect(() => {
    copyOpacity.value = withDelay(
      COPY_FADE_DELAY_MS,
      withTiming(1, { duration: COPY_FADE_DURATION_MS }),
    );
  }, [copyOpacity]);

  const handleSheetClose = useCallback(() => {
    // Fires after the sheet finishes closing on Go back. Pop back to the
    // Review & Pay screen so the user can change something + retry.
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    if (router.canGoBack()) router.back();
    else router.replace(`/booking/mechanic/${id}/payment`);
  }, [router, id]);

  const handleGoBack = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") {
        return undefined;
      }

      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (!submitting) {
          handleGoBack();
        }
        return true;
      });

      return () => subscription.remove();
    }, [handleGoBack, submitting])
  );

  const handleConfirm = useCallback(async () => {
    if (submitting || navigatedRef.current) return;
    if (!selectedMechanicId && !selectedMechanicSlot?.shopId) {
      navigatedRef.current = true;
      router.replace({
        pathname: "/booking/mechanic/[id]/payment",
        params: { id, confirmError: "No shop selected." },
      });
      return;
    }
    if (!selectedPaymentMethodId) {
      navigatedRef.current = true;
      router.replace({
        pathname: "/booking/mechanic/[id]/payment",
        params: { id, confirmError: "Add a payment method to confirm." },
      });
      return;
    }
    setSubmitting(true);
    try {
      const bookingIds = await createBookingConvex(selectedMechanicId, bookingType || "book_now");
      const newBookingId = bookingIds[0];

      // If the booking was created locally (no Convex id), skip the
      // PaymentIntent step — there's nothing to authorize against yet.
      // (`createBookingConvex` returns a local-only id when Convex args
      // are missing; the booking will be re-submitted later.)
      const isConvexBookingId = typeof newBookingId === "string" && newBookingId.length > 10;
      if (isConvexBookingId) {
        const pi = await createPaymentIntent({
          bookingId: newBookingId as Id<"bookings">,
          paymentMethodId: selectedPaymentMethodId,
        });

        if (pi.requiresAction) {
          const { error } = await handleNextAction(pi.clientSecret);
          if (error) {
            throw new Error(error.message ?? "Card authorization failed.");
          }
        } else if (
          pi.status !== "requires_capture" &&
          pi.status !== "succeeded" &&
          pi.status !== "processing"
        ) {
          throw new Error(`Card authorization failed (status: ${pi.status}).`);
        }
      }

      if (navigatedRef.current) return;
      navigatedRef.current = true;
      router.replace({
        pathname: "/booking/mechanic/[id]/confirmation",
        params: newBookingId ? { id, bookingDbId: newBookingId } : { id },
      });
    } catch (err) {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      router.replace({
        pathname: "/booking/mechanic/[id]/payment",
        params: { id, confirmError: extractErrorMessage(err) },
      });
    }
  }, [
    submitting,
    selectedMechanicId,
    selectedMechanicSlot?.shopId,
    selectedPaymentMethodId,
    bookingType,
    createBookingConvex,
    createPaymentIntent,
    handleNextAction,
    router,
    id,
  ]);

  return (
    <View style={styles.screen}>
      <LottieView
        source={require("@/assets/animations/logo-loading-animation.json")}
        autoPlay
        loop={false}
        resizeMode="cover"
        style={[
          styles.lottie,
          isCompactLayout && styles.lottieCompact,
          isVeryCompactLayout && styles.lottieVeryCompact,
          { width: windowWidth, height: windowHeight },
        ]}
      />

      <Animated.View
        style={[
          styles.copyOverlay,
          isCompactLayout && styles.copyOverlayCompact,
          isVeryCompactLayout && styles.copyOverlayVeryCompact,
          copyAnimStyle,
        ]}
        pointerEvents="none"
      >
        <Text size={isVeryCompactLayout ? "sm" : "md"} weight="bold" color="#000000" center>
          Confirming your appointment
        </Text>
        <Text
          size="xs"
          weight="regular"
          color="#000000"
          center
          style={[styles.copySub, isCompactLayout && styles.copySubCompact]}
        >
          Locking in your time slot with the shop
        </Text>
      </Animated.View>

      <FloatingSheet
        ref={sheetRef}
        snapHeights={[sheetHeight]}
        onClose={handleSheetClose}
        cornerRadius={24}
      >
        <BookingConfirmStatus
          onConfirm={handleConfirm}
          onGoBack={handleGoBack}
          mechanicId={id}
        />
      </FloatingSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  lottie: {
    ...StyleSheet.absoluteFillObject,
  },
  lottieCompact: {
    transform: [{ translateY: -66 }],
  },
  lottieVeryCompact: {
    transform: [{ translateY: -94 }],
  },
  copyOverlay: {
    position: "absolute",
    top: "37%",
    left: 24,
    right: 24,
    alignItems: "center",
    gap: 8,
  },
  copyOverlayCompact: {
    top: "29%",
    left: 20,
    right: 20,
    gap: 6,
  },
  copyOverlayVeryCompact: {
    top: "19%",
  },
  copySub: {
    marginTop: 2,
  },
  copySubCompact: {
    marginTop: 0,
  },
});
