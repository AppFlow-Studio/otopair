/**
 * Home Tab Layout
 *
 * PURPOSE: Stack navigator for the home tab screens.
 *          Handles navigation between home, map, and mechanic booking flow.
 *
 * SCREENS:
 *   - index: Home screen
 *   - map: Map screen with service selection bottom sheet
 *   - mechanic/[id]: Nested booking flow (has its own _layout.tsx)
 *
 * OWNER: Temurbek Sayfutdinov
 */

import { Stack } from "expo-router";
import { useMechanicsFromConvex } from "@/hooks/useMechanicsFromConvex";
import { useServiceCategoriesFromConvex } from "@/hooks/useServiceCategoriesFromConvex";
import { useServicesFromConvex } from "@/hooks/useServicesFromConvex";
import { useShopsFromConvex } from "@/hooks/useShopsFromConvex";

/** Hydrates stores with Convex data when home tab is active (services, categories, shops, mechanics). */
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
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" options={{ presentation: "card" }} />
        <Stack.Screen
          name="map"
          options={{
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="mechanic/[id]"
          options={{
            presentation: "fullScreenModal",
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="shop/[id]"
          options={{
            presentation: "fullScreenModal",
            animation: "slide_from_right",
          }}
        />
      </Stack>
    </>
  );
}
