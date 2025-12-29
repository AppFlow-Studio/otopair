import { Stack } from 'expo-router';

export default function HomeLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="map" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="mechanic/[id]" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
    </Stack>
  );
}