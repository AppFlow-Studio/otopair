import { Stack } from "expo-router";

export default function TellUsAboutLayout() {
    return (
        <Stack>
            <Stack.Screen name="flow" options={{ headerShown: false, title: 'Tell Us About Yourself' }} />
        </Stack>
    )
}

