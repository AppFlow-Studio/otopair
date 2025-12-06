import { Stack } from "expo-router";

export default function OnboardingLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="car-experience" options={{ headerShown: false }} />
            <Stack.Screen name="oil-change" options={{ headerShown: false }} />
        </Stack>
    )
}