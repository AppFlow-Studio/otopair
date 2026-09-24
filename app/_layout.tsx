import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { StripeProvider } from "@stripe/stripe-react-native";
// Persistent session: the client token lives in expo-secure-store so auth
// survives a restart. Stored exactly as @clerk/clerk-expo/token-cache stores it
// (same key and keychain option), but a failed read no longer deletes it — see
// lib/clerkCaches.ts (#188).
import * as SecureStore from "expo-secure-store";
import { createSafeTokenCache, guardClerkResourceStorage } from "@/lib/clerkCaches";
// Offline startup. tokenCache alone does NOT let Clerk load without a network:
// it only holds the session token that authenticates Clerk's API requests, and
// on launch Clerk still has to fetch its environment + client before `isLoaded`
// can flip. resourceCache persists those two resources, so an offline cold start
// loads from disk in a "degraded" state instead of never loading at all — which
// is what lets a signed-in user reach the session-cached offline mode
// (lib/offlineSessionCache.ts) rather than stalling on app/index.
import { resourceCache } from "@clerk/clerk-expo/resource-cache";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useSegments, type ErrorBoundaryProps } from "expo-router";
import { guardedRouter as router } from "@/lib/navigationLock";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { ConvexProviderWithAuth, ConvexReactClient, useConvexAuth, useQuery } from "convex/react";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import { untilOnline, useConnection } from "@/hooks/useConnection";
import {
  CONVEX_AUTH_RETRY_MS,
  TOKEN_FETCH_RETRY_FLOOR_MS,
  isTokenFetchNetworkError,
  shouldRecoverConvexAuth,
} from "@/lib/connection/convexAuthRecovery";
import { useRefreshPushToken } from "@/hooks/useRefreshPushToken";
import { useOtopairDeepLinks } from "@/hooks/useOtopairDeepLinks";
import { shouldHideSplash } from "@/lib/auth-routing";
import { clearUserSessionState } from "@/lib/session-state";
import { useAuthStore } from "@/stores/useAuthStore";

const tokenCache = createSafeTokenCache(SecureStore, {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
});
// Never saves Clerk's offline placeholder over the real cached client (#188).
const guardedResourceCache = guardClerkResourceStorage(resourceCache);

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

/**
 * Convex only re-runs `client.setAuth` when the `fetchAccessToken` it holds
 * changes identity. After a failed token fetch it marks the session logged out
 * and never retries by itself (see lib/connection/convexAuthRecovery.ts, #269),
 * so recovery works by handing it a new one: bumping `epoch` does exactly that.
 */
const ConvexAuthEpochContext = createContext<{ epoch: number; bump: () => void }>({
  epoch: 0,
  bump: () => {},
});

/**
 * convex/react-clerk's own `useAuthFromClerk`, unchanged except that the
 * recovery epoch is part of `fetchAccessToken`'s identity. Kept on the public
 * ConvexProviderWithAuth API rather than reaching into ConvexProviderWithClerk.
 */
function useAuthFromClerk() {
  const { isLoaded, isSignedIn, getToken, orgId, orgRole, sessionClaims } = useAuth();
  const { epoch } = useContext(ConvexAuthEpochContext);
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      // A dead network is not an answer. Handing Convex "no token" logs the user
      // out of it while Clerk still has them signed in, and every query then
      // answers as if to a stranger — Home turned into a new account's (#269).
      // So wait for the network and ask again; only a real refusal returns null.
      for (;;) {
        try {
          if (sessionClaims?.aud === "convex") {
            return await getToken({ skipCache: forceRefreshToken });
          }
          return await getToken({ template: "convex", skipCache: forceRefreshToken });
        } catch (error) {
          if (!isTokenFetchNetworkError(error)) return null;
          await new Promise((resolve) => setTimeout(resolve, TOKEN_FETCH_RETRY_FLOOR_MS));
          await untilOnline();
        }
      }
    },
    // Same deps as Convex's own, plus `epoch`. Clerk's Expo useAuth is not
    // memoised, so listing getToken/sessionClaims would hand Convex a new
    // function — and a full re-authentication — on every render. The disable
    // also keeps the React Compiler off this hook, which is what we want: it
    // would otherwise re-derive these deps and could make the function stable,
    // silently switching recovery off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgId, orgRole, epoch],
  );
  return useMemo(
    () => ({ isLoading: !isLoaded, isAuthenticated: isSignedIn ?? false, fetchAccessToken }),
    [isLoaded, isSignedIn, fetchAccessToken],
  );
}

/** Re-authenticates Convex when it has dropped a user Clerk still has signed in. */
function ConvexAuthRecovery() {
  const { isSignedIn } = useAuth();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const conn = useConnection();
  const { bump } = useContext(ConvexAuthEpochContext);
  const lastAttemptRef = useRef(0);
  const dropped = shouldRecoverConvexAuth({
    clerkSignedIn: isSignedIn === true,
    convexLoading: isLoading,
    convexAuthenticated: isAuthenticated,
    online: conn === "online",
  });

  useEffect(() => {
    if (!dropped) return;
    // First attempt straight away; after that at most every CONVEX_AUTH_RETRY_MS,
    // so a failure that keeps recurring cannot hammer the backend.
    const wait = Math.max(0, lastAttemptRef.current + CONVEX_AUTH_RETRY_MS - Date.now());
    const timer = setTimeout(() => {
      lastAttemptRef.current = Date.now();
      bump();
    }, wait);
    return () => clearTimeout(timer);
  }, [dropped, bump]);

  return null;
}

function ConvexClerkProvider({ children }: { children: ReactNode }) {
  const [epoch, setEpoch] = useState(0);
  const bump = useCallback(() => setEpoch((e) => e + 1), []);
  const authEpoch = useMemo(() => ({ epoch, bump }), [epoch, bump]);
  return (
    <ConvexAuthEpochContext.Provider value={authEpoch}>
      <ConvexProviderWithAuth client={convex} useAuth={useAuthFromClerk}>
        <ConsoleToConvexLogger />
        <ConvexAuthRecovery />
        {children}
      </ConvexProviderWithAuth>
    </ConvexAuthEpochContext.Provider>
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
 * Hard ceiling on how long the native splash may cover the app.
 *
 * Generous on purpose: this is a backstop for a startup signal that never
 * arrives, NOT a racer against the normal path. A healthy cold start resolves
 * `isLoaded` well inside it, so the usual splash-to-content handoff is
 * untouched.
 */
const SPLASH_CEILING_MS = 5000;

/**
 * Keeps the splash visible while startup dependencies hydrate, without
 * blocking the root navigator from mounting on the first render.
 *
 * The ceiling is not a nicety. Clerk's `isLoaded` only flips after a network
 * round-trip, so with no connectivity it never resolves, the effect below
 * never runs, and the native splash covers the app forever — a frozen launch
 * icon with no spinner, no offline message and no timeout. The tree
 * underneath is alive and rendering the whole time (OfflineBootGate owns the
 * cold-start offline screen, and ConnectionPillHost deliberately stays quiet
 * because of it), so the app has something perfectly good to show and the
 * splash is the only thing hiding it. Bound it on wall-clock so no startup
 * signal — this one or a future one — can strand the app behind it.
 */
function StartupSplashGate({ children, fontsReady }: { children: ReactNode; fontsReady: boolean }) {
  const { isLoaded } = useAuth();
  const [ceilingReached, setCeilingReached] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setCeilingReached(true), SPLASH_CEILING_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (shouldHideSplash({ fontsReady, authLoaded: isLoaded, ceilingReached })) {
      SplashScreen.hideAsync().catch((err) => {
        console.error("SplashScreen.hideAsync failed", err);
      });
    }
  }, [fontsReady, isLoaded, ceilingReached]);

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

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useAppFonts();
  const fontsReady = fontsLoaded || Boolean(fontError);

  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
      __experimental_resourceCache={guardedResourceCache}
    >
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
                    {/* Android: suspend the tabs while a flow is pushed on top.
                        Home otherwise re-renders under the booking flow on every
                        cart toggle, location fix and Convex push (it is 2,200
                        lines and not compiler-memoised), and Cars/Bookings keep
                        their loops alive. Frozen screens catch up with one render
                        on return. */}
                    <Stack.Screen
                      name="(main-tabs)"
                      options={{ headerShown: false, freezeOnBlur: Platform.OS === "android" }}
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
