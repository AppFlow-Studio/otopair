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
import { KeyboardProvider } from "react-native-keyboard-controller";

import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";

import { ErrorBoundary as AppErrorBoundary, ErrorModalHost, errorBus } from "@/lib/error-ui";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAppFonts } from "@/hooks/use-fonts";
import { useConsoleToConvex } from "@/hooks/useConsoleToConvex";
import { useEnsureConvexUser } from "@/hooks/useEnsureConvexUser";
import { useVehicleOwnershipFromConvex } from "@/hooks/useVehicleOwnershipFromConvex";
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
  anchor: "(main-tabs)",
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
          console.log("Ensured Convex user via RootLayout", {
            clerkUserId: userId,
          });
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

/**
 * Gates app navigation until Clerk has hydrated from token cache.
 * Keeps splash visible until auth state is known so signed-in users
 * go straight to home without flashing welcome/signup/login.
 */
function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuth();

  useEffect(() => {
    if (isLoaded) {
      SplashScreen.hideAsync().catch((err) => {
        console.error("SplashScreen.hideAsync failed", err);
      });
    }
  }, [isLoaded]);

  // Don't render navigation until Clerk has checked stored token
  if (!isLoaded) {
    return null;
  }

  return <>{children}</>;
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

/**
 * Refresh Smartcar data once on cold start for all connected vehicles.
 * Runs silently in the background — no loading UI.
 */
function SmartcarColdStartRefresh() {
  const { vehicles } = useVehicleOwnershipFromConvex();
  const fetchVehicleData = useAction(api.smartcar.fetchVehicleData);
  const hasRefreshedRef = useRef(false);

  useEffect(() => {
    if (hasRefreshedRef.current) return;
    if (!vehicles || vehicles.length === 0) return;

    // Find connected vehicles
    const connected = vehicles.filter((v: any) => v.connectionStatus === "connected" && v.ownership?._id);

    console.log(
      `[ColdStart] vehicles=${vehicles.length}, connected=${connected.length}, statuses=${vehicles.map((v: any) => v.connectionStatus).join(",")}`
    );

    if (connected.length === 0) return;

    hasRefreshedRef.current = true;

    // Refresh each connected vehicle (fire-and-forget)
    for (const v of connected) {
      const ownerId = (v as any).ownership._id;
      console.log(`[ColdStart] Refreshing vehicle owner=${ownerId}`);
      fetchVehicleData({ vehicleOwnerId: ownerId }).catch((err: any) =>
        console.warn("[ColdStart] Smartcar refresh failed:", err)
      );
    }
  }, [vehicles, fetchVehicleData]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useAppFonts();

  // Don't render anything until fonts are loaded (splash stays visible)
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ClerkProvider publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!} tokenCache={tokenCache}>
      <AuthGate>
        <ConvexClerkProvider>
          <AppErrorBoundary>
            <EnsureConvexUserRecord />
            <SyncAuthStoreWithClerk />
            <ErrorModalHost />
            <KeyboardProvider>
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
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
                    <Stack.Screen name="(main-tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="(tell-us-about)" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="coming-soon"
                      options={{
                        animation: "fade_from_bottom",
                        animationDuration: 200,
                      }}
                    />
                    <Stack.Screen name="add-vehicle" options={{ headerShown: false }} />
                    <Stack.Screen name="add-car-info" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="vehicle-added"
                      options={{
                        animation: "fade",
                        animationDuration: 300,
                      }}
                    />
                    <Stack.Screen name="vin-scanner" options={{ headerShown: false }} />
                    <Stack.Screen name="add-vehicle-review" options={{ headerShown: false }} />
                    <Stack.Screen name="payments" options={{ headerShown: false }} />
                    <Stack.Screen name="add-payment" options={{ headerShown: false }} />
                    {/* <Stack.Screen name="payment-methods" options={{ headerShown: false }} /> */}
                    <Stack.Screen
                      name="modal"
                      options={{
                        presentation: "modal",
                        animation: "slide_from_bottom",
                      }}
                    />
                    <Stack.Screen name="membership" options={{ headerShown: false }} />
                    <Stack.Screen name="suggested-deals" options={{ headerShown: false }} />
                    <Stack.Screen name="transactions" options={{ headerShown: false }} />
                    <Stack.Screen name="refer-a-friend" options={{ headerShown: false }} />
                  </Stack>
                  <StatusBar style="auto" />
                </ThemeProvider>
              </BottomSheetModalProvider>
            </GestureHandlerRootView>
            </KeyboardProvider>
          </AppErrorBoundary>
          {/* <EnsureConvexUserRecord />
        <SyncAuthStoreWithClerk />
        <SmartcarColdStartRefresh />
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
                <Stack.Screen
                  name="(main-tabs)"
                  options={{
                    animation: "fade",
                    animationDuration: 300,
                  }}
                />
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
                <Stack.Screen
                  name="car-pre-onboarding"
                  options={{
                    animation: "fade_from_bottom",
                    animationDuration: 280,
                  }}
                />
                <Stack.Screen
                  name="health-estimating"
                  options={{
                    animation: "fade",
                    animationDuration: 300,
                  }}
                />
                <Stack.Screen name="vin-scanner" />
                <Stack.Screen name="add-vehicle-review" />
                <Stack.Screen name="payments" />
                <Stack.Screen name="add-payment" />
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
        </GestureHandlerRootView> */}
        </ConvexClerkProvider>
      </AuthGate>
    </ClerkProvider>
  );
}
