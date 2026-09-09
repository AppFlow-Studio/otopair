/**
 * Booking Group Layout
 *
 * PURPOSE: Stack navigator for the booking flow (map → service select →
 *          mechanic/shop → booking-details → payment → confirming →
 *          confirmation).
 *
 * NOTE: This group lives at app root, outside (main-tabs), so the root
 *       Stack.Screen in app/_layout.tsx can present it as a
 *       `fullScreenModal` — on iOS 26 this is the only clean way to
 *       overlay the native UITabBar.
 */

import { Stack } from "expo-router";
import { useMechanicsFromConvex } from "@/hooks/useMechanicsFromConvex";
import { useServiceCategoriesFromConvex } from "@/hooks/useServiceCategoriesFromConvex";
import { useServicesFromConvex } from "@/hooks/useServicesFromConvex";
import { useShopsFromConvex } from "@/hooks/useShopsFromConvex";

function HydrateConvexData() {
  useServicesFromConvex();
  useServiceCategoriesFromConvex();
  useShopsFromConvex();
  useMechanicsFromConvex();
  return null;
}

export default function BookingLayout() {
  return (
    <>
      <HydrateConvexData />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="map"
          options={{ animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="mechanic/[id]"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="shop/[id]"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="approve-estimate/[id]"
          options={{ animation: "slide_from_bottom" }}
        />
      </Stack>
    </>
  );
}
