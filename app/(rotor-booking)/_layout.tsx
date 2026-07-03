import { Stack } from "expo-router";

export default function RotorBookingLayout() {
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
        name="requesting"
        options={{
          // Match the Lottie's radial-gradient bottom edge so the
          // FloatingSheet's rounded bottom corners don't show
          // through onto a hard white screen backdrop (native-stack
          // defaults contentStyle.backgroundColor to white). Same
          // fix as the mechanic-flow confirming route.
          contentStyle: { backgroundColor: "#E6EFFA" },
        }}
      />
    </Stack>
  );
}
