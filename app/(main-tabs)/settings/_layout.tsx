import { Stack } from "expo-router";

export default function SettingsLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="notification-preferences" options={{ headerShown: false }} />
            <Stack.Screen name="refer-a-friend" options={{ headerShown: false }} />
            <Stack.Screen name="faq" options={{ headerShown: false }} />
            <Stack.Screen name="faq-category" options={{ headerShown: false }} />
            <Stack.Screen name="biometric-setup" options={{ headerShown: false }} />
            <Stack.Screen name="two-factor-method" options={{ headerShown: false }} />
            <Stack.Screen name="two-factor-verify" options={{ headerShown: false }} />
            <Stack.Screen name="success" options={{ headerShown: false }} />
            <Stack.Screen name="contact-us" options={{ headerShown: false }} />
            <Stack.Screen name="transactions" options={{ headerShown: false }} />
            <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
            <Stack.Screen name="terms-and-conditions" options={{ headerShown: false }} />
            <Stack.Screen name="about" options={{ headerShown: false }} />
            <Stack.Screen name="change-password" options={{ headerShown: false }} />
            <Stack.Screen name="permissions" options={{ headerShown: false }} />
            <Stack.Screen name="preferences" options={{ headerShown: false }} />
            <Stack.Screen name="pricing-transparency" options={{ headerShown: false }} />
            <Stack.Screen name="my-mechanics" options={{ headerShown: false }} />
            <Stack.Screen name="delete-account" options={{ headerShown: false }} />

        </Stack>
    )
}   