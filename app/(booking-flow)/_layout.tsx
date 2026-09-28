import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

import { BookingFlowMapProvider } from "@/components/booking-flow/BookingFlowMap";
import { EnrichmentStatusPill } from "@/components/booking-flow/EnrichmentStatusPill";
import { AddVehicleRequiredSheet } from "@/components/home/AddVehicleRequiredSheet";
import type { FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { BrandColors } from "@/constants/theme";
import { useMechanicsFromConvex } from "@/hooks/useMechanicsFromConvex";
import { useServicesFromConvex } from "@/hooks/useServicesFromConvex";
import { useShopsFromConvex } from "@/hooks/useShopsFromConvex";
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
  /**
   * Hydrate the service catalog for this group.
   *
   * `availableServices` was only ever filled by home/_layout and
   * booking/_layout, so the flow relied on having passed through one of them
   * first. Reached any other way — a deep link, or a return after the store
   * was cleared — every category read "0 services" over a catalog that had
   * simply never loaded. The hook is a query plus an effect, so a second
   * caller is free.
   */
  useServicesFromConvex();
  // Same story for shops and mechanics: home/_layout and booking/_layout
  // hydrated them, this group did not, so Choose Mechanic sat on "Finding
  // shops near you…" forever whenever the flow was reached without passing
  // through one of those first.
  useShopsFromConvex();
  useMechanicsFromConvex();

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
          // No transition between screens.
          //
          // Every screen here is `contentStyle: transparent` so it can
          // sit over the shared map. That makes a cross-fade reveal the
          // whole stack at once rather than blending two screens: at 50%
          // opacity the frosted sheets stop hiding anything and the map,
          // the outgoing screen and the search screen all show through
          // together. It reads as text sliding around behind glass.
          //
          // Screens 1 and 2 are the same sheet — bottom-anchored, 92%
          // tall, same corner radius — so with no animation the frame
          // simply stays put and its contents change, which is what a
          // drill-down inside one sheet should look like.
          animation: "none",
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
