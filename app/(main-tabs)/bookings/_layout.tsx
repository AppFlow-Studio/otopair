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
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
