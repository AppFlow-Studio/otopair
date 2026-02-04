import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useRef } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { ConvexReactClient, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAppFonts } from "@/hooks/use-fonts";
import { api } from "@/convex/_generated/api";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
  initialRouteName: "index",
};

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

function ConvexClerkProvider({ children }: { children: ReactNode }) {
  // Convex expects the Clerk useAuth hook that matches the provider
  const auth = useAuth();
  return (
    <ConvexProviderWithClerk client={convex} useAuth={() => auth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

function EnsureConvexUserRecord() {
  const { isSignedIn, userId } = useAuth();
  const ensureUser = useMutation(api.users.getOrCreateMe);
  const claimSeedData = useMutation(api.seed.claimSeedDataForCurrentUser);
  const lastUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (isSignedIn && userId && lastUserRef.current !== userId) {
      lastUserRef.current = userId;
      const retryWithBackoff = async (fn: () => Promise<any>, retries = 4, delay = 1500) => {
        // Initial delay to let Clerk JWT propagate to Convex
        await new Promise(r => setTimeout(r, 2000));
        for (let i = 0; i <= retries; i++) {
          try { return await fn(); } catch (e) {
            if (i === retries) throw e;
            await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
          }
        }
      };
      retryWithBackoff(() => ensureUser())
        .then(() => {
          console.log("Ensured Convex user via RootLayout");
          return claimSeedData();
        })
        .then((result) => {
          if (result?.claimed) console.log("Claimed seed data for guest account");
        })
        .catch((error) => console.error("Failed to ensure Convex user via RootLayout after retries", error));
    }
  }, [ensureUser, claimSeedData, isSignedIn, userId]);

  return null;
}

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
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <ConvexClerkProvider>
        <EnsureConvexUserRecord />
        <GestureHandlerRootView style={{ flex: 1 }}>
          <BottomSheetModalProvider>
            <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
                <Stack.Screen name="(main-tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="(tell-us-about)" options={{ headerShown: false }} />
                <Stack.Screen name="coming-soon" options={{ headerShown: false }} />
                <Stack.Screen name="add-vehicle" options={{ headerShown: false }} />
                <Stack.Screen name="add-car-info" options={{ headerShown: false }} />
                <Stack.Screen name="vehicle-added" options={{ headerShown: false }} />
                <Stack.Screen name="vin-scanner" options={{ headerShown: false }} />
                <Stack.Screen name="add-vehicle-review" options={{ headerShown: false }} />
                <Stack.Screen name="payments" options={{ headerShown: false }} />
                {/* <Stack.Screen name="payment-methods" options={{ headerShown: false }} /> */}
                <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
                <Stack.Screen name="membership" options={{ headerShown: false }} />
              </Stack>
              <StatusBar style="auto" />
            </ThemeProvider>
          </BottomSheetModalProvider>
        </GestureHandlerRootView>
      </ConvexClerkProvider>
    </ClerkProvider>
  );
}
