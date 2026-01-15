import { Stack } from "expo-router";

export default function SettingsLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="notification-preferences" options={{ headerShown: false }} />
            <Stack.Screen name="refer-a-friend" options={{ headerShown: false }} />
            <Stack.Screen name="two-factor-method" options={{ headerShown: false }} />
            <Stack.Screen name="two-factor-verify" options={{ headerShown: false }} />
            <Stack.Screen name="two-factor-success" options={{ headerShown: false }} />
        </Stack>
    )
}   