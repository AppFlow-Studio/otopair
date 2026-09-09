import { Stack } from 'expo-router';

export default function AIChatLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, headerShadowVisible: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}

