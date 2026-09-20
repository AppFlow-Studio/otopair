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

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { type DimensionValue, StyleSheet, useWindowDimensions, View } from "react-native";

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
import { QuoteRequestStatus } from "@/components/tire-booking/QuoteRequestStatus";
import { Text } from "@/components/shared-ui";
import { TIRE_TIERS, TIRE_TYPES } from "@/constants/tireFlow";
import { useCreateTireQuoteRequest } from "@/hooks/useCreateTireQuoteRequest";
import { calculateBookingConfirmLayout } from "@/lib/bookingConfirmSheet";
import { useTireBookingStore } from "@/stores/useTireBookingStore";
import { useToast } from "@/hooks/useToast";
import { useVehicleStore } from "@/stores/useVehicleStore";

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
  const toast = useToast();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const statusSheetRef = useRef<FloatingSheetRef>(null);
  const confirmSheetRef = useRef<QuoteRequestConfirmationSheetRef>(null);
  const confirmedRef = useRef(false);
  const requestVehicleVinRef = useRef<string | null>(
    useTireBookingStore.getState().vehicleId ?? useVehicleStore.getState().selectedVehicleId,
  );
  const requestVehicleVin = requestVehicleVinRef.current;
  const isCompactLayout = windowHeight < 860;
  const isVeryCompactLayout = windowHeight < 760;
  const confirmLayout = useMemo(
    () => calculateBookingConfirmLayout({ width: windowWidth, height: windowHeight }),
    [windowWidth, windowHeight],
  );

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
    if (confirmedRef.current) {
      // Confirmed path: hand over to the confirmation Modal now, not on a
      // timer.
      //
      // FloatingSheet renders inside a native <Modal> and so does the
      // confirmation sheet. The old code opened the second one 250ms after
      // calling close(), but FloatingSheet does not unmount until 280ms — so
      // the confirmation Modal was presented ON TOP of a status sheet that was
      // still up, and 30ms later that one came down and took its child with
      // it. iOS dismisses anything presented over a view controller it
      // dismisses. The result was no confirmation, no error and no control:
      // the driver was left on the bare "Searching for nearby shops" screen.
      //
      // This fires after unmount(), so there is nothing left to present over.
      confirmSheetRef.current?.open();
      return;
    }
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

    // The submit is intentionally not awaited — the confirmation is
    // optimistic. But a rejection must not vanish: the hook throws when the
    // user or VIN is still loading, and that used to leave the driver with a
    // "request sent" screen for a request that was never made.
    createTireQuoteRequest({
      tiresLabel,
      vehicleVin: requestVehicleVin,
      tireSpecs: {
        size: tireSize ?? "",
        type: typeLabel,
        tier: tierLabel,
        quantity: count,
        positions: selectedTirePositions,
      },
    }).catch((err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Please try again in a moment.";
      toast.error("Couldn't request tire quotes", message);
    });

    // Close the status sheet. The confirmation Modal is opened from that
    // sheet's onClose, once it has actually unmounted — see
    // handleStatusSheetClosed.
    statusSheetRef.current?.close();
  }, [createTireQuoteRequest, requestVehicleVin, selectedTirePositions, tier, tireSize, tireType, toast]);

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
        style={[
          styles.lottie,
          {
            width: windowWidth,
            height: windowHeight,
            transform: [{ translateY: confirmLayout.lottieTranslateY }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.copyOverlay,
          isCompactLayout && styles.copyOverlayCompact,
          { top: confirmLayout.copyTopPercent as DimensionValue },
          copyAnimStyle,
        ]}
        pointerEvents="none"
      >
        <Text size={isVeryCompactLayout ? "sm" : "md"} weight="bold" color="#000000" center>
          Searching for nearby tire shops
        </Text>
        <Text size="xs" weight="regular" color="#000000" center style={styles.copySub}>
          Reaching out to local mechanics for the best quotes
        </Text>
      </Animated.View>

      <FloatingSheet
        ref={statusSheetRef}
        snapHeights={[confirmLayout.sheetHeight]}
        onClose={handleStatusSheetClosed}
        cornerRadius={24}
      >
        <QuoteRequestStatus
          onGoBack={handleGoBack}
          onViewUpcoming={handleViewUpcoming}
          vehicleVin={requestVehicleVin}
        />
      </FloatingSheet>

      <QuoteRequestConfirmationSheet
        ref={confirmSheetRef}
        onViewBooking={handleBackToBooking}
        vehicleVin={requestVehicleVin}
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
  copyOverlayCompact: {
    left: 20,
    right: 20,
    gap: 6,
  },
  copySub: {
    marginTop: 2,
  },
});
