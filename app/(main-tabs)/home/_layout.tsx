import { Stack } from 'expo-router';

export default function HomeLayout() {
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
      <Stack.Screen name="index" />
      <Stack.Screen 
        name="map" 
        options={{ 
          animation: "fade_from_bottom",
          animationDuration: 300,
        }} 
      />
    </Stack>
  );
}