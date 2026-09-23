import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { StripeProvider } from "@stripe/stripe-react-native";
// Persistent session: tokenCache uses expo-secure-store so auth survives app reload/restart
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRootNavigationState, useSegments, type ErrorBoundaryProps } from "expo-router";
import { guardedRouter as router } from "@/lib/navigationLock";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { ConvexReactClient, useQuery } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { LogBox, Platform } from "react-native";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";

// Suppress the dev-mode red LogBox overlay for Convex mutation/query
// errors. We always catch these in app code and surface them via the
// existing error modal — the LogBox dump is just dev-time noise on top.
// Errors still log to Metro for debugging; this only hides the overlay.
import { ErrorBoundary as AppErrorBoundary, ErrorModalHost, errorBus } from "@/lib/error-ui";
import { ErrorOccurredModal } from "@/components/shared-ui";
import { StripePaymentMethodsSync } from "@/components/payments/StripePaymentMethodsSync";
import { ConnectionPillHost } from "@/components/connection/ConnectionPillHost";
import { OfflineBootGate } from "@/components/connection/OfflineBootGate";
import { CantLoadModalHost } from "@/lib/connection-ui";
import { ToastProvider } from "@/components/toast";
import { useEnrichmentCompletionWatcher } from "@/hooks/useEnrichmentCompletionWatcher";
import { api } from "@/convex/_generated/api";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAppFonts } from "@/hooks/use-fonts";
import { useConsoleToConvex } from "@/hooks/useConsoleToConvex";
import { useEnsureConvexUser } from "@/hooks/useEnsureConvexUser";
import { useNotificationHandler } from "@/hooks/useNotificationHandler";
import { useRefreshPushToken } from "@/hooks/useRefreshPushToken";
import { useOtopairDeepLinks } from "@/hooks/useOtopairDeepLinks";
import { clearUserSessionState } from "@/lib/session-state";
import { useAuthStore } from "@/stores/useAuthStore";
import { CoachProvider } from "@/components/coach/CoachContext";
import { CoachMarkHost } from "@/components/coach/CoachMarkHost";
import { START_AT_HOME_ON_RELOAD } from "@/constants/devFlags";

LogBox.ignoreLogs([
  /\[CONVEX M\([^\)]+\)\]/,
  /\[CONVEX Q\([^\)]+\)\]/,
  /\[CONVEX A\([^\)]+\)\]/,
]);

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Longest the splash may stay up after fonts + auth are ready. Safety net for
 *  a routing path that never resolves; the normal hand-off is index unmounting. */
const SPLASH_MAX_HOLD_MS = 4000;

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
  useNotificationHandler();
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

  /**
   * Backstop only. app/index.tsx hides the splash when it unmounts — that is
   * the real hand-off, and it happens once routing has resolved.
   *
   * Hiding here the moment fonts and Clerk were ready used to be the whole
   * story, but routing also waits on the Convex user record, so the splash
   * lifted early and exposed the routing screen underneath for that gap.
   *
   * This timer exists so a routing path that never resolves — no network, a
   * Convex query that never settles — cannot leave someone staring at a splash
   * forever. If it fires, the screen behind is index's own splash-coloured
   * view, which is why that view is no longer a dark spinner.
   */
  useEffect(() => {
    if (!fontsReady || !isLoaded) return;
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch((err) => {
        console.error("SplashScreen.hideAsync failed", err);
      });
    }, SPLASH_MAX_HOLD_MS);
    return () => clearTimeout(t);
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

function RootErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    errorBus.set({ visible: true, error });
  }, [error]);

  const message =
    error instanceof Error
      ? error.message
      : "Something went wrong. Tap Try again to reload.";

  // Both buttons re-render the route. The old close handler called
  // BackHandler.exitApp(), which on Android only backgrounds a singleTask
  // activity — reopening from Recents landed on the same broken state and
  // the same modal, with no way out.
  const recover = () => {
    errorBus.set({ visible: false, error: undefined });
    void retry();
  };

  return (
    <ErrorOccurredModal
      visible
      title="Something went wrong"
      message={message}
      onClose={recover}
      onRetry={recover}
    />
  );
}

export { RootErrorBoundary as ErrorBoundary };

/**
 * Dev-only: open on Home, ignoring the route a reload restored.
 *
 * Renders nothing. Runs once, after the navigator is ready — `useSegments`
 * is empty until then, which would read as "we are at /" and skip the work.
 */
function StartAtHomeOnReload() {
  const navState = useRootNavigationState();
  const segments = useSegments();
  const done = useRef(false);

  useEffect(() => {
    if (!START_AT_HOME_ON_RELOAD || done.current) return;
    if (!navState?.key || navState.stale) return;
    done.current = true;

    // `/` routes itself by auth state, and onboarding must not be jumped out
    // of — a half-finished signup is exactly the state worth keeping.
    // Typed as a tuple of known groups, so compare through `string` rather
    // than narrowing against literals TS has already ruled out.
    const group = segments[0] as string | undefined;
    const screen = segments[1] as string | undefined;
    if (!group || group === "(onboarding)") return;
    if (group === "(main-tabs)" && screen === "home") return;

    // Drop whatever the restored route was stacked on, so a back-swipe from
    // Home does not land in the middle of a flow that no longer has its state.
    try {
      router.dismissAll();
    } catch {
      // Nothing to dismiss.
    }
    router.replace("/(main-tabs)/home");
  }, [navState?.key, navState?.stale, segments]);

  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useAppFonts();
  const fontsReady = fontsLoaded || Boolean(fontError);

  return (
    <ClerkProvider publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!} tokenCache={tokenCache}>
      <StartupSplashGate fontsReady={fontsReady}>
        <ConvexClerkProvider>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <AppErrorBoundary>
            <EnsureConvexUserRecord />
            <SyncAuthStoreWithClerk />
            <StripePaymentMethodsSync />
            <PendingDeletionSessionGuard />
            <ErrorModalHost />
            <ConnectionPillHost />
            <CantLoadModalHost />
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
                  merchantIdentifier={process.env.EXPO_PUBLIC_STRIPE_MERCHANT_ID ?? "merchant.com.otopair"}
                  urlScheme="otopair"
                >
                <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
                  {/* fontsReady prevents the offline page from taking its first
                      text measurement against the fallback font (clipped labels
                      on slow cold starts). */}
                  <OfflineBootGate fontsReady={fontsReady}>
                  {/* Coach marks live at the ROOT, not on the tab layout.
                      The booking flow is its own group outside (main-tabs),
                      so a host mounted there could never reach the screens
                      the booking walkthrough points at. */}
                  <CoachProvider>
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
                    {/* No transition into the tabs.
                        The root stack defaults to ios_from_right, which is
                        right for pushing FORWARD into a detail screen and
                        wrong for every way you reach the tabs: cold launch
                        (the app should just open), and ~60 `replace` calls
                        that are dismissals — finishing a booking, leaving
                        onboarding, backing out of a flow. Sliding a
                        dismissal in from the right reads as going deeper
                        when you are coming back out.

                        Android also suspends the tabs while a flow is pushed
                        on top (Temur). Home otherwise re-renders under the
                        booking flow on every cart toggle, location fix and
                        Convex push (it is 2,200 lines and not compiler-
                        memoised), and Cars/Bookings keep their loops alive.
                        Frozen screens catch up with one render on return.

                        The two are independent — one governs the transition,
                        the other what happens to the screen underneath — so
                        the merge keeps both rather than picking a side. */}
                    <Stack.Screen
                      name="(main-tabs)"
                      options={{
                        headerShown: false,
                        animation: "none",
                        freezeOnBlur: Platform.OS === "android",
                      }}
                    />
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
                  <StartAtHomeOnReload />
                  <CoachMarkHost />
                  </CoachProvider>
                  </OfflineBootGate>
                  <StatusBar style="auto" />
                </ThemeProvider>
                </StripeProvider>
                </ToastProvider>
              </BottomSheetModalProvider>
            </GestureHandlerRootView>
            </KeyboardProvider>
          </AppErrorBoundary>
          </SafeAreaProvider>
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
