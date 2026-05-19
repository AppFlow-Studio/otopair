/**
 * Tire Booking · Requesting route
 *
 * Full-screen "your request is in progress" surface shown after the user taps
 * Get Quotes on the configuration page. A Lottie pin-drop plays in the
 * background; a FloatingSheet hosts <QuoteRequestStatus> with the Confirm
 * (8s auto-fire countdown) + Go back actions.
 *
 * On Confirm (tap or auto-fire), the tire quote is submitted and the
 * <QuoteRequestConfirmationSheet> "Quote requests sent" Modal slides up over
 * the loading screen. Its CTA ("Back to booking") routes to the Bookings tab
 * — or, in inline-modal mode, calls onConfirmed so the parent dismisses the
 * outer Modal first.
 */

import React, { useCallback, useEffect, useRef } from "react";
import { Dimensions, StyleSheet, View } from "react-native";

import { useRouter } from "expo-router";
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
import { QuoteRequestStatus } from "@/components/tire-booking/QuoteRequestStatus";
import { Text } from "@/components/shared-ui";
import { TIRE_TIERS, TIRE_TYPES } from "@/constants/tireFlow";
import { useCreateTireQuoteRequest } from "@/hooks/useCreateTireQuoteRequest";
import { useTireBookingStore } from "@/stores/useTireBookingStore";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.52);

interface TireRequestingScreenProps {
  /** Modal-mode close — when set, "Go back" closes the outer modal entirely. */
  onClose?: () => void;
  /** Modal-mode confirm — when set, "Back to booking" calls this instead of
   *  router.replace. Parent should close the outer modal AND navigate to the
   *  bookings tab from its own live router context. */
  onConfirmed?: () => void;
}

export default function TireRequestingScreen({ onClose, onConfirmed }: TireRequestingScreenProps = {}) {
  const router = useRouter();
  const statusSheetRef = useRef<FloatingSheetRef>(null);
  const confirmSheetRef = useRef<QuoteRequestConfirmationSheetRef>(null);
  const confirmedRef = useRef(false);

  const createTireQuoteRequest = useCreateTireQuoteRequest();
  const tireSize = useTireBookingStore((s) => s.tireSize);
  const tireType = useTireBookingStore((s) => s.tireType);
  const tier = useTireBookingStore((s) => s.tier);
  const selectedTirePositions = useTireBookingStore((s) => s.selectedTirePositions);

  // Copy fade-in — the pin lands at Lottie frame 120 (60fps → 2s). Wait
  // for the landing, then fade the text in over 600ms so it appears like
  // a follow-up beat to the drop.
  const copyOpacity = useSharedValue(0);
  const copyAnimStyle = useAnimatedStyle(() => ({ opacity: copyOpacity.value }));
  useEffect(() => {
    copyOpacity.value = withDelay(2050, withTiming(1, { duration: 600 }));
  }, [copyOpacity]);

  // Open the status sheet on mount.
  useEffect(() => {
    statusSheetRef.current?.open();
  }, []);

  // Fired after the status FloatingSheet finishes its close animation
  // via the Go back path.
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

  // Confirm tap (or 8s auto-fire) — submit the quote and slide the
  // "Quote requests sent" Modal up over the loading screen.
  const handleViewUpcoming = useCallback(() => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;

    const tierLabel = TIRE_TIERS.find((t) => t.id === tier)?.label ?? "";
    const typeLabel = TIRE_TYPES.find((t) => t.id === tireType)?.label ?? "";
    const tierAndType = [tierLabel, typeLabel].filter(Boolean).join(" ");
    const count = selectedTirePositions.length;
    const tiresLabel = [
      count > 0 ? `${count} ${tierAndType || "tires"}` : tierAndType || "Tires",
      tireSize || undefined,
    ]
      .filter(Boolean)
      .join(" · ");

    void createTireQuoteRequest({
      tiresLabel,
      tireSpecs: {
        size: tireSize ?? "",
        type: typeLabel,
        tier: tierLabel,
        quantity: count,
      },
    });

    // Close the status sheet first, then slide up the confirmation Modal.
    // Stagger so the nested Modal doesn't race the FloatingSheet's close.
    statusSheetRef.current?.close();
    setTimeout(() => {
      confirmSheetRef.current?.open();
    }, 250);
  }, [createTireQuoteRequest, selectedTirePositions.length, tier, tireSize, tireType]);

  const handleBackToBooking = useCallback(() => {
    confirmSheetRef.current?.close();
    if (onConfirmed) {
      // Inline-modal mode — let the nested Modal finish its close animation
      // before the parent dismisses the outer Modal, or iOS hangs with a
      // black screen.
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
          Searching for nearby tire shops
        </Text>
        <Text size="xs" weight="regular" color="#000000" center style={styles.copySub}>
          Reaching out to local mechanics for the best quotes
        </Text>
      </Animated.View>

      <FloatingSheet
        ref={statusSheetRef}
        snapHeights={[SHEET_HEIGHT]}
        onClose={handleStatusSheetClosed}
        cornerRadius={24}
      >
        <QuoteRequestStatus
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
    backgroundColor: "#FFFFFF",
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
