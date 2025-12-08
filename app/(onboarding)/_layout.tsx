import { Stack } from "expo-router";

export default function OnboardingLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ headerShown: true, title: 'Welcome' }} />
            <Stack.Screen name="car-experience" options={{ headerShown: true, title: 'Car Experience' }} />
            <Stack.Screen name="beginner-oil-change" options={{ headerShown: true, title: 'Oil Change' }} />
            <Stack.Screen name="beginner-brakes" options={{ headerShown: true, title: 'Brakes' }} />
            <Stack.Screen name="beginner-inspection" options={{ headerShown: true, title: 'Inspection' }} />
            <Stack.Screen name="average-oil-change" options={{ headerShown: true, title: 'Oil Change' }} />
            <Stack.Screen name="average-tire" options={{ headerShown: true, title: 'Tire' }} />
            <Stack.Screen name="average-battery" options={{ headerShown: true, title: 'Battery' }} />
            <Stack.Screen name="average-brakes" options={{ headerShown: true, title: 'Brakes' }} />
            <Stack.Screen name="average-inspection" options={{ headerShown: true, title: 'Inspection' }} />
            <Stack.Screen name="pro-services" options={{ headerShown: true, title: 'Services' }} />
            <Stack.Screen name="pro-mileage" options={{ headerShown: true, title: 'Mileage' }} />
            <Stack.Screen name="pro-brakes" options={{ headerShown: true, title: 'Brakes' }} />
            <Stack.Screen name="pro-inspection" options={{ headerShown: true, title: 'Inspection' }} />
            <Stack.Screen name="push-notifications" options={{ headerShown: true, title: 'Push Notifications' }} />
        </Stack>
    )
}