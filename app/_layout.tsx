import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
// Persistent session: tokenCache uses expo-secure-store so auth survives app reload/restart
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

import { ErrorBoundary as AppErrorBoundary, ErrorModalHost, errorBus } from "@/lib/error-ui";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAppFonts } from "@/hooks/use-fonts";
import { useConsoleToConvex } from "@/hooks/useConsoleToConvex";
import { useEnsureConvexUser } from "@/hooks/useEnsureConvexUser";
import { useAuthStore } from "@/stores/useAuthStore";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Global error handler: log to Convex + show modal
if (typeof global !== "undefined") {
  const ErrorUtils = (global as any).ErrorUtils;
  if (ErrorUtils?.setGlobalHandler) {
    ErrorUtils.setGlobalHandler((error: unknown) => {
      console.error(error);
      errorBus.set({ visible: true, error });
    });
  }
}

export const unstable_settings = {
  anchor: "(tabs)",
  initialRouteName: "index",
};

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

function ConsoleToConvexLogger() {
  useConsoleToConvex();
  return null;
}

function ConvexClerkProvider({ children }: { children: ReactNode }) {
  // Convex expects the Clerk useAuth hook that matches the provider
  const auth = useAuth();
  return (
    <ConvexProviderWithClerk client={convex} useAuth={() => auth}>
      <ConsoleToConvexLogger />
      {children}
    </ConvexProviderWithClerk>
  );
}

function EnsureConvexUserRecord() {
  const { isSignedIn, userId } = useAuth();
  const ensureUser = useEnsureConvexUser();
  const lastUserRef = useRef<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  useEffect(() => {
    if (!isSignedIn) {
      lastUserRef.current = null;
      return;
    }
    if (!userId) return;
    // Only run if we haven't already succeeded for this userId (set on success below)
    if (lastUserRef.current === userId) return;

    let cancelled = false;
    const retryWithBackoff = async (fn: () => Promise<any>, retries = 6, delay = 1500) => {
      // Initial delay so Clerk JWT has time to propagate to Convex after login
      await new Promise((r) => setTimeout(r, 5000));
      for (let i = 0; i <= retries; i++) {
        if (cancelled) return;
        try {
          return await fn();
        } catch (e: any) {
          if (e?.message?.includes("Not authenticated") && i < retries) {
            await new Promise((r) => setTimeout(r, delay * Math.pow(2, i)));
            continue;
          }
          if (i === retries) throw e;
          await new Promise((r) => setTimeout(r, delay * Math.pow(2, i)));
        }
      }
    };

    retryWithBackoff(() => ensureUser())
      .then(() => {
        if (!cancelled) {
          lastUserRef.current = userId;
          console.log("Ensured Convex user via RootLayout", { clerkUserId: userId });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        // On login, JWT can take a moment to reach Convex; schedule one more try
        if (error?.message?.includes("Not authenticated")) {
          setTimeout(() => setRetryTrigger((t) => t + 1), 5000);
          return;
        }
        console.error("Failed to ensure Convex user via RootLayout after retries", error);
      });

    return () => {
      cancelled = true;
    };
  }, [ensureUser, isSignedIn, userId, retryTrigger]);

  return null;
}

/** Keep the local auth store in sync with Clerk session state */
function SyncAuthStoreWithClerk() {
  const { isSignedIn, isLoaded } = useAuth();
  const setIsAuthenticated = useAuthStore((s) => s.setIsAuthenticated);

  useEffect(() => {
    if (!isLoaded) return;
    setIsAuthenticated(isSignedIn);
  }, [isLoaded, isSignedIn, setIsAuthenticated]);

  return null;
}

function RootErrorBoundary({ error }: ErrorBoundaryProps) {
  useEffect(() => {
    errorBus.set({ visible: true, error });
  }, [error]);
  return null;
}

export { RootErrorBoundary as ErrorBoundary };

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useAppFonts();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch((err) => {
        console.error("SplashScreen.hideAsync failed", err);
      });
    }
  }, [fontsLoaded, fontError]);

  // Don't render anything until fonts are loaded
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ClerkProvider publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!} tokenCache={tokenCache}>
      <ConvexClerkProvider>
        <AppErrorBoundary>
          <EnsureConvexUserRecord />
          <SyncAuthStoreWithClerk />
          <ErrorModalHost />
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
                  <Stack.Screen name="add-payment" options={{ headerShown: false }} />
                  {/* <Stack.Screen name="payment-methods" options={{ headerShown: false }} /> */}
                  <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
                  <Stack.Screen name="membership" options={{ headerShown: false }} />
                  <Stack.Screen name="suggested-deals" options={{ headerShown: false }} />
                  <Stack.Screen name="transactions" options={{ headerShown: false }} />
                  <Stack.Screen name="refer-a-friend" options={{ headerShown: false }} />
                </Stack>
                <StatusBar style="auto" />
              </ThemeProvider>
            </BottomSheetModalProvider>
          </GestureHandlerRootView>
        </AppErrorBoundary>
        {/* <EnsureConvexUserRecord />
        <SyncAuthStoreWithClerk />
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
                <Stack.Screen name="add-payment" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
                <Stack.Screen name="membership" options={{ headerShown: false }} />
              </Stack>
              <StatusBar style="auto" />
            </ThemeProvider>
          </BottomSheetModalProvider>
        </GestureHandlerRootView> */}
      </ConvexClerkProvider>
    </ClerkProvider>
  );
}
