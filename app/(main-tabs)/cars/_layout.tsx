import { Stack } from "expo-router";

export default function CarsLayout() {
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
            {/* Presented as a full-screen modal so the bottom tab bar
                (NativeTabs on iOS 26 can't be hidden via tabBarStyle) is
                fully covered. */}
            <Stack.Screen
                name="recommendation/[recId]"
                options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
            />
        </Stack>
    );
}