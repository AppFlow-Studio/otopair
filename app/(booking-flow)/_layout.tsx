import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { BookingFlowMapProvider } from "@/components/booking-flow/BookingFlowMap";
import { EnrichmentStatusPill } from "@/components/booking-flow/EnrichmentStatusPill";
import { AddVehicleRequiredSheet } from "@/components/home/AddVehicleRequiredSheet";
import type { FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { BrandColors } from "@/constants/theme";
import { useVehicleOwnershipFromConvex } from "@/hooks/useVehicleOwnershipFromConvex";
import { useBookingStore } from "@/stores/useBookingStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

/**
 * Booking-flow Stack — the 4-screen linear flow that replaces the
 * stage-machine bottom sheet in app/booking/map.tsx.
 *
 * Screens:
 *  - select-services       Screen 1 · category landing + hero cards
 *  - category/[tab]        Screen 2 · per-tab service multi-select
 *  - choose-mechanic       Screen 3 · map + floating shop card + mechanic carousel
 *  - pick-datetime         Screen 4 · date + time picker + Confirm
 *
 * A single persistent map (BookingFlowMapProvider) lives behind the
 * Stack so navigating between screens no longer remounts the map.
 * The screens render transparent content over it — Screen 1/2 use it
 * as a locked backdrop, Screen 3 drives it interactively. Screen 4
 * (no map) just paints its own opaque background over it.
 */
export default function BookingFlowLayout() {
  const { hasVehicles, isLoading } = useVehicleOwnershipFromConvex();

  // Cart-vehicle guard. The cart (`selectedServiceIds`) is snapshotted to
  // the vehicle it was started for (`selectedVehicleVin`); nothing else
  // evicts it when the active car changes. Without this, a cart built for
  // car A survives switching to car B — including an ENRICHING car whose
  // services aren't even selectable — and the stale "Continue · N services"
  // pill lets the user check out services that don't apply. Runs on flow
  // entry and again on any mid-flow switch via the VehiclePuck sheet (this
  // layout stays mounted for the whole flow). Options are keyed by the old
  // car's service ids, so they go too. The Resume Booking card on Home
  // re-selects its snapshot vehicle before navigating here, so resuming
  // never trips this.
  const selectedVehicleId = useVehicleStore((s) => s.selectedVehicleId);
  useEffect(() => {
    const { selectedServiceIds, selectedVehicleVin, clearSelectedServices, clearSelectedServiceOptions } =
      useBookingStore.getState();
    if (selectedServiceIds.length > 0 && selectedVehicleVin && selectedVehicleVin !== selectedVehicleId) {
      clearSelectedServices();
      clearSelectedServiceOptions();
    }
  }, [selectedVehicleId]);

  if (isLoading) {
    return <View style={styles.gateRoot} />;
  }

  if (!hasVehicles) {
    return <NoVehicleBookingLock />;
  }

  return (
    <BookingFlowMapProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          // Calm cross-fade over the shared static map. A horizontal
          // slide fought the Screen 1→2 shared-element morph (the
          // category icon/title lifting into the header) by dragging
          // the morphing element along the slide path; a fade lets the
          // morph be the only motion, so the flow reads as content
          // swapping in place rather than screens shoving each other.
          animation: "fade",
          animationDuration: 320,
          gestureEnabled: true,
          gestureDirection: "horizontal",
          contentStyle: { backgroundColor: "transparent" },
        }}
      >
        <Stack.Screen name="select-services" />
        <Stack.Screen name="category/[tab]" />
        <Stack.Screen name="choose-mechanic" />
        <Stack.Screen name="pick-datetime" />
        <Stack.Screen name="search" />
      </Stack>
      {/* Persistent "Connecting to your car · ~N min" pill. Lives at the
          layout level (not per-screen) so it stays up across the whole
          flow for as long as the active vehicle is enriching, instead of
          the old one-shot toast that faded out while the block remained. */}
      <EnrichmentStatusPill />
    </BookingFlowMapProvider>
  );
}

function NoVehicleBookingLock() {
  const router = useRouter();
  const sheetRef = useRef<FloatingSheetRef>(null);
  const suppressCloseNavigationRef = useRef(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      sheetRef.current?.open();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const returnToPreviousScreen = useCallback(() => {
    if (suppressCloseNavigationRef.current) return;
    suppressCloseNavigationRef.current = true;
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(main-tabs)/home");
  }, [router]);

  const goAddVehicle = () => {
    suppressCloseNavigationRef.current = true;
    sheetRef.current?.close();
    router.replace("/add-vehicle");
  };

  return (
    <View style={styles.gateRoot}>
      <AddVehicleRequiredSheet
        ref={sheetRef}
        onAddVehicle={goAddVehicle}
        onMaybeLater={() => sheetRef.current?.close()}
        onClose={returnToPreviousScreen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  gateRoot: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
});
