/**
 * Rotor Booking · Requesting route
 *
 * Mirrors `app/(tire-booking)/requesting.tsx`. Lottie pin-drop in the
 * background; `FloatingSheet` hosts the rotor status body with the
 * Confirm (auto-fire countdown) + Go back actions. On Confirm, fires
 * `createRotorQuoteRequest` and slides up the confirmation Modal.
 */

import React, { useCallback, useEffect, useRef } from "react";
import { Dimensions, StyleSheet, View } from "react-native";

import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import LottieView from "lottie-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import {
  QuoteRequestConfirmationSheet,
  type QuoteRequestConfirmationSheetRef,
} from "@/components/bookings/QuoteRequestConfirmationSheet";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { RotorQuoteRequestStatus } from "@/components/rotor-booking/RotorQuoteRequestStatus";
import { Text } from "@/components/shared-ui";
import { formatRotorsLabel } from "@/constants/rotorFlow";
import { useCreateRotorQuoteRequest } from "@/hooks/useCreateRotorQuoteRequest";
import { useRotorBookingStore } from "@/stores/useRotorBookingStore";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.52);

interface RotorRequestingScreenProps {
  onClose?: () => void;
  onConfirmed?: () => void;
}

export default function RotorRequestingScreen({
  onClose,
  onConfirmed,
}: RotorRequestingScreenProps = {}) {
  const router = useRouter();
  const statusSheetRef = useRef<FloatingSheetRef>(null);
  const confirmSheetRef = useRef<QuoteRequestConfirmationSheetRef>(null);
  const confirmedRef = useRef(false);

  const createRotorQuoteRequest = useCreateRotorQuoteRequest();
  const brakeSystemType = useRotorBookingStore((s) => s.brakeSystemType);
  const axle = useRotorBookingStore((s) => s.axle);
  const includePads = useRotorBookingStore((s) => s.includePads);
  const padType = useRotorBookingStore((s) => s.padType);

  const copyOpacity = useSharedValue(0);
  const copyAnimStyle = useAnimatedStyle(() => ({ opacity: copyOpacity.value }));
  useEffect(() => {
    copyOpacity.value = withDelay(2050, withTiming(1, { duration: 600 }));
  }, [copyOpacity]);

  useEffect(() => {
    statusSheetRef.current?.open();
  }, []);

  const handleStatusSheetClosed = useCallback(() => {
    if (confirmedRef.current) return;
    if (onClose) {
      onClose();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(main-tabs)/home");
  }, [onClose, router]);

  const handleGoBack = useCallback(() => {
    statusSheetRef.current?.close();
  }, []);

  const handleViewUpcoming = useCallback(() => {
    if (confirmedRef.current) return;
    if (!brakeSystemType || !axle) return;
    if (includePads && !padType) return;
    confirmedRef.current = true;

    const rotorsLabel = formatRotorsLabel(axle, brakeSystemType);

    void createRotorQuoteRequest({
      rotorsLabel,
      rotorSpecs: {
        brake_system_type: brakeSystemType,
        axle,
        include_pads: includePads,
        ...(includePads && padType ? { pad_type: padType } : {}),
      },
    });

    statusSheetRef.current?.close();
    setTimeout(() => {
      confirmSheetRef.current?.open();
    }, 250);
  }, [brakeSystemType, axle, includePads, padType, createRotorQuoteRequest]);

  const handleBackToBooking = useCallback(() => {
    confirmSheetRef.current?.close();
    if (onConfirmed) {
      setTimeout(() => {
        onConfirmed();
      }, 300);
      return;
    }
    router.replace("/(main-tabs)/bookings");
  }, [onConfirmed, router]);

  return (
    <View style={styles.screen}>
      <LottieView
        source={require("@/assets/animations/logo-loading-animation.json")}
        autoPlay
        loop={false}
        resizeMode="cover"
        style={styles.lottie}
      />

      <Animated.View style={[styles.copyOverlay, copyAnimStyle]} pointerEvents="none">
        <Text size="md" weight="bold" color="#000000" center>
          Searching for nearby brake shops
        </Text>
        <Text size="xs" weight="regular" color="#000000" center style={styles.copySub}>
          Reaching out to local mechanics for the best rotor quotes
        </Text>
      </Animated.View>

      <FloatingSheet
        ref={statusSheetRef}
        snapHeights={[SHEET_HEIGHT]}
        onClose={handleStatusSheetClosed}
        cornerRadius={24}
      >
        <RotorQuoteRequestStatus
          onGoBack={handleGoBack}
          onViewUpcoming={handleViewUpcoming}
        />
      </FloatingSheet>

      <QuoteRequestConfirmationSheet
        ref={confirmSheetRef}
        onViewBooking={handleBackToBooking}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // Blends with the Lottie's radial-gradient bottom edge so the
    // FloatingSheet's rounded bottom corners don't show a white
    // strip at the safe-area edge. Layout parent's contentStyle
    // is set to the same tint for the belt-and-suspenders fix.
    backgroundColor: "#E6EFFA",
  },
  lottie: {
    ...StyleSheet.absoluteFillObject,
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
