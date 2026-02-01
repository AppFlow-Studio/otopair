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
import { useServicesFromConvex } from "@/hooks/useServicesFromConvex";

/** Hydrates booking store with Convex services when home tab is active. */
function HydrateServices() {
  useServicesFromConvex();
  return null;
}

export default function HomeLayout() {
  return (
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