import { Stack } from "expo-router";

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
 * Each screen has its own visual treatment (sheet sizes change, map
 * presence changes), so they live as separate routes rather than
 * snap points on one sheet.
 */
export default function BookingFlowLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        animationDuration: 220,
        gestureEnabled: true,
        gestureDirection: "horizontal",
      }}
    >
      <Stack.Screen name="select-services" />
      <Stack.Screen name="category/[tab]" />
      <Stack.Screen name="choose-mechanic" />
      <Stack.Screen name="pick-datetime" />
    </Stack>
  );
}
