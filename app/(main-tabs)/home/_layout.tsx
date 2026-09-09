/**
 * Home Tab Layout
 *
 * PURPOSE: Stack navigator for the home tab. Hosts the home discovery
 *          screen. The booking flow (map / mechanic / shop) lives in
 *          the root-level `(booking)` group so it can present above the
 *          tab bar on iOS 26.
 */

import { Stack } from "expo-router";
import { useMechanicsFromConvex } from "@/hooks/useMechanicsFromConvex";
import { useServiceCategoriesFromConvex } from "@/hooks/useServiceCategoriesFromConvex";
import { useServicesFromConvex } from "@/hooks/useServicesFromConvex";
import { useShopsFromConvex } from "@/hooks/useShopsFromConvex";

/** Hydrates stores with Convex data — home discovery cards consume this. */
function HydrateConvexData() {
  useServicesFromConvex();
  useServiceCategoriesFromConvex();
  useShopsFromConvex();
  useMechanicsFromConvex();
  return null;
}

export default function HomeLayout() {
  return (
    <>
      <HydrateConvexData />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ presentation: "card" }} />
      </Stack>
    </>
  );
}
