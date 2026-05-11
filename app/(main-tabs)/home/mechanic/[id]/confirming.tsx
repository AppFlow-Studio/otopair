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
import { Dimensions, StyleSheet, View } from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { BookingConfirmStatus } from "@/components/booking/BookingConfirmStatus";
import { useCreateBookingConvex } from "@/hooks/useCreateBookingConvex";
import { useBookingStore } from "@/stores/useBookingStore";

const { width: SCREEN_W, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.52);

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
  const { createBookingConvex } = useCreateBookingConvex();
  const selectedMechanicId = useBookingStore((s) => s.selectedMechanicId);
  const bookingType = useBookingStore((s) => s.bookingType);
  const navigatedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

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
    else router.replace(`/home/mechanic/${id}/payment`);
  }, [router, id]);

  const handleGoBack = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  const handleConfirm = useCallback(async () => {
    if (submitting || navigatedRef.current) return;
    if (!selectedMechanicId) {
      navigatedRef.current = true;
      router.replace({
        pathname: `/home/mechanic/${id}/payment`,
        params: { confirmError: "No mechanic selected." },
      });
      return;
    }
    setSubmitting(true);
    try {
      await createBookingConvex(selectedMechanicId, bookingType || "book_now");
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      router.replace(`/home/mechanic/${id}/confirmation`);
    } catch (err) {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      router.replace({
        pathname: `/home/mechanic/${id}/payment`,
        params: { confirmError: extractErrorMessage(err) },
      });
    }
  }, [submitting, selectedMechanicId, bookingType, createBookingConvex, router, id]);

  return (
    <View style={styles.screen}>
      <LottieView
        source={require("@/assets/animations/logo-loading-animation.json")}
        autoPlay
        loop
        resizeMode="cover"
        style={styles.lottie}
      />

      <Animated.View style={[styles.copyOverlay, copyAnimStyle]} pointerEvents="none">
        <Text size="md" weight="bold" color="#000000" center>
          Confirming your appointment
        </Text>
        <Text size="xs" weight="regular" color="#000000" center style={styles.copySub}>
          Locking in your time slot with the shop
        </Text>
      </Animated.View>

      <FloatingSheet
        ref={sheetRef}
        snapHeights={[SHEET_HEIGHT]}
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
    width: SCREEN_W,
    height: SCREEN_HEIGHT,
  },
  copyOverlay: {
    position: "absolute",
    top: "37%",
    left: 24,
    right: 24,
    alignItems: "center",
    gap: 8,
  },
  copySub: {
    marginTop: 2,
  },
});
