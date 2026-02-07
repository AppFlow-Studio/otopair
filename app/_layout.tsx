import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAppFonts } from "@/hooks/use-fonts";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
  initialRouteName: "index",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useAppFonts();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Don't render anything until fonts are loaded
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: "ios_from_right",
              animationDuration: 350,
              gestureEnabled: true,
              gestureDirection: "horizontal",
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(onboarding)" />
            <Stack.Screen name="(main-tabs)" />
            <Stack.Screen name="(tell-us-about)" />
            <Stack.Screen 
              name="coming-soon" 
              options={{ 
                animation: "fade_from_bottom",
                animationDuration: 200,
              }} 
            />
            <Stack.Screen name="add-vehicle" />
            <Stack.Screen name="add-car-info" />
            <Stack.Screen 
              name="vehicle-added" 
              options={{ 
                animation: "fade",
                animationDuration: 300,
              }} 
            />
            <Stack.Screen name="vin-scanner" />
            <Stack.Screen 
              name="payment-methods" 
              options={{ 
                animation: "slide_from_bottom",
                gestureDirection: "vertical",
              }} 
            />
            <Stack.Screen name="membership" />
            <Stack.Screen name="suggested-deals" />
            <Stack.Screen 
              name="modal" 
              options={{ 
                presentation: "modal",
                animation: "slide_from_bottom",
              }} 
            />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}
