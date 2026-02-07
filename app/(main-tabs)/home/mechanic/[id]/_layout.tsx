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
                name="confirmation"
                options={{
                    gestureEnabled: false,
                    animation: "fade",
                }}
            />
        </Stack>
    );
}

