import { Stack } from "expo-router";

export default function SettingsLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="refer-a-friend" options={{ headerShown: false }} />
            <Stack.Screen name="two-factor" options={{ headerShown: false }} />
        </Stack>
    )
}   