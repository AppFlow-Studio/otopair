import { Stack } from "expo-router";

export default function OnboardingLayout() {
    return (
        <Stack>
            <Stack.Screen name="index" options={{ headerShown: false, title: 'Welcome' }} />
            <Stack.Screen name="car-experience" options={{ headerShown: false, title: 'Car Experience' }} />
            <Stack.Screen name="beginner-oil-change" options={{ headerShown: false, title: 'Oil Change' }} />
            <Stack.Screen name="beginner-brakes" options={{ headerShown: false, title: 'Brakes' }} />
            <Stack.Screen name="beginner-inspection" options={{ headerShown: false, title: 'Inspection' }} />
            <Stack.Screen name="average-oil-change" options={{ headerShown: false, title: 'Oil Change' }} />
            <Stack.Screen name="average-tire" options={{ headerShown: false, title: 'Tire' }} />
            <Stack.Screen name="average-battery" options={{ headerShown: false, title: 'Battery' }} />
            <Stack.Screen name="average-brakes" options={{ headerShown: false, title: 'Brakes' }} />
            <Stack.Screen name="average-inspection" options={{ headerShown: false, title: 'Inspection' }} />
            <Stack.Screen name="pro-services" options={{ headerShown: false, title: 'Services' }} />
            <Stack.Screen name="pro-mileage" options={{ headerShown: false, title: 'Mileage' }} />
            <Stack.Screen name="pro-brakes" options={{ headerShown: false, title: 'Brakes' }} />
            <Stack.Screen name="pro-inspection" options={{ headerShown: false, title: 'Inspection' }} />
            <Stack.Screen name="push-notifications" options={{ headerShown: false, title: 'Push Notifications' }} />
            <Stack.Screen name="location-services" options={{ headerShown: false, title: 'Location Services' }} />
            <Stack.Screen name="vin" options={{ headerShown: false, title: 'VIN' }} />

        </Stack>
    )
}