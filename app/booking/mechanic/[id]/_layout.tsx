/**
 * Mechanic Booking Flow Layout
 *
 * PURPOSE: Stack navigator for the mechanic booking flow pages.
 *          Provides iOS-style screen-to-screen transitions.
 *
 * SCREENS:
 *   - index (Mechanic Detail)
 *   - booking-details (Booking Details)
 *   - payment (Review & Pay)
 *   - confirming (Loading screen — runs the booking mutation)
 *   - confirmation (Booking Confirmed)
 *
 * OWNER: Temurbek Sayfutdinov
 */

import { Stack } from "expo-router";

export default function MechanicBookingLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
                gestureEnabled: true,
                gestureDirection: "horizontal",
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="booking-details" />
            <Stack.Screen name="payment" />
            <Stack.Screen
                name="confirming"
                options={{
                    // The user shouldn't be able to swipe back out of the
                    // loading screen mid-mutation. Fade in matches the
                    // confirmation screen for a clean visual handoff.
                    gestureEnabled: false,
                    animation: "fade",
                    // Native-stack's default screen container is white,
                    // which shows through the sheet's rounded bottom
                    // corners at the safe-area edge and reads as a
                    // second card. Match the confirming screen's own
                    // pale-blue backdrop so the strip disappears.
                    contentStyle: { backgroundColor: "#E6EFFA" },
                }}
            />
            <Stack.Screen
                name="confirmation"
                options={{
                    gestureEnabled: false,
                    animation: "fade",
                }}
            />
        </Stack>
    );
}

