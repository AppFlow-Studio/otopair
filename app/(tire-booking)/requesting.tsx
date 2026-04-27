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

import React, { useEffect, useRef } from "react";
import { Dimensions, StyleSheet, View } from "react-native";

import { useRouter } from "expo-router";

import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { QuoteRequestStatus } from "@/components/tire-booking/QuoteRequestStatus";
import { TireGridBackground } from "@/components/tire-booking/TireGridBackground";

const { width: SCREEN_W, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = Math.round(SCREEN_HEIGHT * 0.52);

export default function TireRequestingScreen() {
  const router = useRouter();
  const sheetRef = useRef<FloatingSheetRef>(null);

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

  const handleViewUpcoming = () => {
    // `requestSubmitted` triggers the one-shot confirmation sheet on the
    // Upcoming tab. Consumed + cleared on arrival.
    router.replace({
      pathname: "/(main-tabs)/bookings",
      params: { tab: "upcoming", requestSubmitted: "1" },
    });
  };

  return (
    <View style={styles.screen}>
      {/* Isometric tire-grid background — seamlessly looping, matches the
          Claude Design handoff spec (10s drift top-right → bottom-left). */}
      <TireGridBackground width={SCREEN_W} height={SCREEN_HEIGHT} />

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
    backgroundColor: "#CFE4F7",
  },
});
