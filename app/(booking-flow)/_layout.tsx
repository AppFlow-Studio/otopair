import { Stack } from "expo-router";

import { BookingFlowMapProvider } from "@/components/booking-flow/BookingFlowMap";

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
    </BookingFlowMapProvider>
  );
}
