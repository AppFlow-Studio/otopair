import { Stack } from "expo-router";

export default function TellUsAboutLayout() {
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
            <Stack.Screen name="flow" />
        </Stack>
    );
}

