import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { StripeProvider } from "@stripe/stripe-react-native";
// Persistent session: tokenCache uses expo-secure-store so auth survives app reload/restart
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useSegments, type ErrorBoundaryProps } from "expo-router";
import { guardedRouter as router } from "@/lib/navigationLock";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { ConvexReactClient, useQuery } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { LogBox } from "react-native";

// Suppress the dev-mode red LogBox overlay for Convex mutation/query
// errors. We always catch these in app code and surface them via the
// existing error modal — the LogBox dump is just dev-time noise on top.
// Errors still log to Metro for debugging; this only hides the overlay.
import { ErrorBoundary as AppErrorBoundary, ErrorModalHost, errorBus } from "@/lib/error-ui";
import { StripePaymentMethodsSync } from "@/components/payments/StripePaymentMethodsSync";
import { ToastProvider } from "@/components/toast";
import { useEnrichmentCompletionWatcher } from "@/hooks/useEnrichmentCompletionWatcher";
import { api } from "@/convex/_generated/api";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAppFonts } from "@/hooks/use-fonts";
import { useConsoleToConvex } from "@/hooks/useConsoleToConvex";
import { useEnsureConvexUser } from "@/hooks/useEnsureConvexUser";
import { useRefreshPushToken } from "@/hooks/useRefreshPushToken";
import { useOtopairDeepLinks } from "@/hooks/useOtopairDeepLinks";
import { clearUserSessionState } from "@/lib/session-state";
import { useAuthStore } from "@/stores/useAuthStore";

LogBox.ignoreLogs([
  /\[CONVEX M\([^\)]+\)\]/,
  /\[CONVEX Q\([^\)]+\)\]/,
  /\[CONVEX A\([^\)]+\)\]/,
]);

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

// NOTE: no `anchor` and no `initialRouteName`.
//  - `anchor: "(main-tabs)"` rendered the tabs as the stack anchor (home
//    instance A) while `app/index`'s `replace("/(main-tabs)/home")` stacked a
//    SECOND `(main-tabs)` (home instance B) on top → back-swipe on home
//    revealed a duplicate home.
//  - `initialRouteName: "index"` prepended the `/` loading screen beneath the
//    restored home on reload → back-swipe revealed the spinner.
// Letting the auth redirect in `app/index` build the stack keeps home as the
// sole root, with nothing underneath.
export const unstable_settings = {};

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
  useRefreshPushToken();
  useOtopairDeepLinks();

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
 * Keeps the splash visible while startup dependencies hydrate, without
 * blocking the root navigator from mounting on the first render.
 */
function StartupSplashGate({ children, fontsReady }: { children: ReactNode; fontsReady: boolean }) {
  const { isLoaded } = useAuth();

  useEffect(() => {
    if (fontsReady && isLoaded) {
      SplashScreen.hideAsync().catch((err) => {
        console.error("SplashScreen.hideAsync failed", err);
      });
    }
  }, [fontsReady, isLoaded]);

  return <>{children}</>;
}

/** Keep the local auth store in sync with Clerk session state */
function SyncAuthStoreWithClerk() {
  const { isSignedIn, isLoaded, userId } = useAuth();
  const setIsAuthenticated = useAuthStore((s) => s.setIsAuthenticated);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    const previousUserId = lastUserIdRef.current;

    if (!isSignedIn) {
      lastUserIdRef.current = null;
      void clearUserSessionState(previousUserId).catch((error) => {
        console.error("Failed to clear user session state after sign-out", error);
      });
      setIsAuthenticated(false);
      return;
    }

    if (previousUserId && userId && previousUserId !== userId) {
      void clearUserSessionState(previousUserId).catch((error) => {
        console.error("Failed to clear user session state after account switch", error);
      });
    }

    lastUserIdRef.current = userId ?? null;
    setIsAuthenticated(isSignedIn);
  }, [isLoaded, isSignedIn, setIsAuthenticated, userId]);

  return null;
}

function PendingDeletionSessionGuard() {
  const { isLoaded, isSignedIn, signOut } = useAuth();
  const me = useQuery(api.users.getMe);
  const segments = useSegments();
  const isSigningOutRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !me?.isPendingDeletion || isSigningOutRef.current) {
      return;
    }

    // Preserve the login/reactivation path: LoginStep intentionally
    // reactivates pending-deletion accounts during onboarding.
    if (segments[0] === "(onboarding)") {
      return;
    }

    isSigningOutRef.current = true;

    void signOut()
      .catch((error) => {
        console.error("Failed to sign out pending-deletion session", error);
      })
      .finally(() => {
        router.replace("/(onboarding)");
        isSigningOutRef.current = false;
      });
  }, [isLoaded, isSignedIn, me?.isPendingDeletion, segments, signOut]);

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
  const fontsReady = fontsLoaded || Boolean(fontError);

  return (
    <ClerkProvider publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!} tokenCache={tokenCache}>
      <StartupSplashGate fontsReady={fontsReady}>
        <ConvexClerkProvider>
          <AppErrorBoundary>
            <EnsureConvexUserRecord />
            <SyncAuthStoreWithClerk />
            <StripePaymentMethodsSync />
            <PendingDeletionSessionGuard />
            <ErrorModalHost />
            <KeyboardProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <BottomSheetModalProvider>
                <ToastProvider>
                {/* Mounts the global enrichment-completion watcher.
                    Subscribes to the user's vehicles' enrichment phases
                    and fires a persistent tap-to-book toast the moment
                    any of them transitions in_progress → ready. */}
                <EnrichmentCompletionMount />
                <StripeProvider
                  publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""}
                  merchantIdentifier={process.env.EXPO_PUBLIC_STRIPE_MERCHANT_ID ?? "merchant.com.otopair.app"}
                  urlScheme="otopair"
                >
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
                    <Stack.Screen
                      name="(onboarding)"
                      options={{ headerShown: false, gestureEnabled: false }}
                    />
                    <Stack.Screen name="(main-tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="(tell-us-about)" options={{ headerShown: false }} />
                    <Stack.Screen name="(tire-booking)" options={{ headerShown: false }} />
                    <Stack.Screen name="(rotor-booking)" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="booking"
                      options={{
                        headerShown: false,
                        presentation: "fullScreenModal",
                        animation: "slide_from_bottom",
                      }}
                    />
                    <Stack.Screen
                      name="coming-soon"
                      options={{
                        animation: "fade_from_bottom",
                        animationDuration: 200,
                      }}
                    />
                    <Stack.Screen name="add-vehicle" options={{ headerShown: false }} />
                    <Stack.Screen name="recommendation/[recId]" options={{ headerShown: false, animation: "slide_from_right" }} />
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
                    {/* Headless — opens Stripe PaymentSheet on top of whatever
                        screen called it. `containedTransparentModal` keeps
                        the caller in the parent navigator (so the underlying
                        screen stays mounted + visible through the sheet),
                        rather than `transparentModal` which paints a white
                        system window in the safe-area on iOS. */}
                    <Stack.Screen
                      name="add-payment"
                      options={{
                        headerShown: false,
                        presentation: "containedTransparentModal",
                        animation: "none",
                        contentStyle: { backgroundColor: "transparent" },
                      }}
                    />
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
                    <Stack.Screen name="settings" options={{ headerShown: false }} />
                    {/* SettingsOverlay is no longer a route — it's mounted
                        as a layout-level absolute component in
                        app/(main-tabs)/_layout.tsx. Driving open/close
                        through useSettingsOverlayStore keeps iOS out of
                        modal-stack mode so child screens pushed from
                        inside the overlay (Saved Addresses, Payment
                        Methods, etc.) use the normal slide_from_right. */}
                  </Stack>
                  <StatusBar style="auto" />
                </ThemeProvider>
                </StripeProvider>
                </ToastProvider>
              </BottomSheetModalProvider>
            </GestureHandlerRootView>
            </KeyboardProvider>
          </AppErrorBoundary>
          {/* <EnsureConvexUserRecord />
        <SyncAuthStoreWithClerk />
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
      </StartupSplashGate>
    </ClerkProvider>
  );
}

/** Mount-only component for the global enrichment-completion watcher.
 *  Needs to be a child of <ToastProvider> so it can call useToast(),
 *  so we wrap the hook in its own component instead of inlining it
 *  into RootLayout. Renders nothing. */
function EnrichmentCompletionMount(): null {
  useEnrichmentCompletionWatcher();
  return null;
}
