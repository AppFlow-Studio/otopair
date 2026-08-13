import { Stack } from "expo-router";
import { OtoGradient } from "@/constants/theme";

export default function SettingsLayout() {
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
            <Stack.Screen name="notification-preferences" />
            <Stack.Screen name="refer-a-friend" />
            <Stack.Screen name="faq" />
            <Stack.Screen name="faq-category" />
            <Stack.Screen name="biometric-setup" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="two-factor-method" />
            <Stack.Screen name="two-factor-verify" />
            <Stack.Screen name="success" />
            <Stack.Screen name="contact-us" />
            <Stack.Screen
                name="transactions"
                options={{
                    // Matches the top stop of the screen's own Oto gradient so
                    // the push doesn't flash a white edge before it paints.
                    contentStyle: { backgroundColor: OtoGradient.colors[0] },
                }}
            />
            <Stack.Screen
                name="past-service/[bookingId]"
                options={{ contentStyle: { backgroundColor: "#F5F8FB" } }}
            />
            <Stack.Screen name="privacy-policy" />
            <Stack.Screen name="terms-of-service" />
            <Stack.Screen name="about" />
        </Stack>
    );
}
