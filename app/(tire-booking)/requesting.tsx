/**
 * Tire Booking · Requesting route
 *
 * Full-screen "your request is in progress" surface shown after the user taps
 * Get Quotes on the configuration page. A seamlessly-looping isometric
 * tire-grid (ported from the Claude Design handoff) plays in the background;
 * a FloatingSheet hosts the QuoteRequestStatus body with title, ETA range,
 * vehicle, and tire selection.
 *
 * Two actions live inside the sheet:
 *   - **View** (primary) → routes to the Upcoming tab in bookings.
 *   - **Go back** (secondary) → closes the sheet and returns to the config
 *     page. The in-flight request is left running in the background either
 *     way — per the Apr 23 meeting, shop quotes come back asynchronously.
 *
 * BACKUP: a simpler city-skyline Lottie (`assets/animations/muv-car-city-skyline.json`)
 * is kept on disk as a fallback. To swap it in, replace <TireGridBackground />
 * below with the Lottie render block that lived here previously (see git
 * history for the original block).
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

import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { QuoteRequestStatus } from "@/components/tire-booking/QuoteRequestStatus";
import { Text } from "@/components/shared-ui";
// Earlier backgrounds parked on disk for revert if needed:
// import { TireGridBackground } from "@/components/tire-booking/TireGridBackground";
// import { RequestingMapBackground } from "@/components/tire-booking/RequestingMapBackground";
// import { RequestingPinAnimation } from "@/components/tire-booking/RequestingPinAnimation";
import { TIRE_TIERS, TIRE_TYPES } from "@/constants/tireFlow";
import { useCreateTireQuoteRequest } from "@/hooks/useCreateTireQuoteRequest";
import { useTireBookingStore } from "@/stores/useTireBookingStore";

const { width: SCREEN_W, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.52);

export default function TireRequestingScreen() {
  const router = useRouter();
  const sheetRef = useRef<FloatingSheetRef>(null);

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

  // Open the sheet as soon as the route mounts.
  useEffect(() => {
    sheetRef.current?.open();
  }, []);

  const handleClose = () => {
    // Fires after the sheet finishes closing. We pop back to the config
    // page so the user sees their tire selections again.
    if (router.canGoBack()) router.back();
    else router.replace("/(main-tabs)/home");
  };

  const handleGoBack = () => {
    sheetRef.current?.close();
  };

  const handleViewUpcoming = useCallback(() => {
    // Confirm tap (or 8s auto-fire) — this is when the booking record is
    // actually written. Get Quotes only opens the requesting sheet; tapping
    // Go back leaves no trace on the Upcoming tab.
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

    // `requestSubmitted` triggers the one-shot confirmation sheet on the
    // Upcoming tab. Consumed + cleared on arrival.
    router.replace({
      pathname: "/(main-tabs)/bookings",
      params: { tab: "bookings", requestSubmitted: "1" },
    });
  }, [
    createTireQuoteRequest,
    router,
    selectedTirePositions.length,
    tier,
    tireSize,
    tireType,
  ]);

  return (
    <View style={styles.screen}>
      {/* Authoritative Lottie export from Claude Design — the same
          "OtoPair Pin Loader" prototype, now as a single animated asset
          so we don't have to maintain a hand-built recreate. The 600x600
          source is centered and scaled to fill the screen. */}
      <LottieView
        source={require("@/assets/animations/logo-loading-animation.json")}
        autoPlay
        loop
        resizeMode="cover"
        style={styles.lottie}
      />

      {/* Contextual loading copy layered on top of the Lottie. Fades in
          after the pin lands (~2s in) so it reads as a follow-up beat
          rather than competing with the drop animation. Native RN Text so
          the font matches the rest of the app. */}
      <Animated.View style={[styles.copyOverlay, copyAnimStyle]} pointerEvents="none">
        <Text size="md" weight="bold" color="#000000" center>
          Searching for nearby tire shops
        </Text>
        <Text size="xs" weight="regular" color="#000000" center style={styles.copySub}>
          Reaching out to local mechanics for the best quotes
        </Text>
      </Animated.View>

      {/* Bottom sheet hosting the status body. */}
      <FloatingSheet
        ref={sheetRef}
        snapHeights={[SHEET_HEIGHT]}
        onClose={handleClose}
        cornerRadius={24}
      >
        <QuoteRequestStatus
          onGoBack={handleGoBack}
          onViewUpcoming={handleViewUpcoming}
        />
      </FloatingSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // Match the Lottie's first frame (light edge of the radial gradient)
    // so there's no flash of contrasting color before the JSON paints.
    backgroundColor: "#FFFFFF",
  },
  lottie: {
    ...StyleSheet.absoluteFillObject,
  },
  // Position the copy in the upper visible area, well below where the
  // pin settles in the Lottie (~28% from top of screen) and well above
  // the FloatingSheet which covers the bottom 52%.
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
