/**
 * BookingsLayout
 *
 * PURPOSE: Stack navigator layout for the bookings flow screens
 *
 * USED IN: app/(main-tabs)/_layout.tsx
 *
 * OWNER: Waleed Mansour
 */

import { Stack } from "expo-router";

export default function BookingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        animationDuration: 250,
        gestureEnabled: true,
        gestureDirection: "horizontal",
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
