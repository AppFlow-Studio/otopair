/**
 * index
 *
 * PURPOSE: Auth-aware routing entry point. Routes to onboarding, home, or resume based on auth state.
 *
 * USED IN: app/_layout.tsx
 *
 * PROPS: None
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import { useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { useRootNavigationState, useSegments } from "expo-router";
import { guardedRouter as router } from "@/lib/navigationLock";
import { useAuth } from "@clerk/clerk-expo";
import { useConvexAuth, useQuery } from "convex/react";
import * as SecureStore from "expo-secure-store";
import * as SplashScreen from "expo-splash-screen";
import { api } from "@/convex/_generated/api";
import { shouldRunStartupRedirect } from "@/lib/auth-routing";
import { getOnboardingFinishedLaterKey } from "@/lib/onboarding-resume";

export default function Index() {
  const { isSignedIn, isLoaded, userId: clerkUserId } = useAuth();
  const rootNavigationState = useRootNavigationState();
  // stale: true means the navigator is mid-rehydration (e.g. app returning from
  // Android background). assertIsReady() throws in that window even though the key
  // already exists, so we must wait until stale flips to false before navigating.
  const rootNavigationReady =
    Boolean(rootNavigationState?.key) && rootNavigationState?.stale !== true;
  // On reload, Expo Router restores the previous route (e.g. home). This
  // `/` entry screen still re-mounts and its redirect would fire again —
  // stacking a SECOND copy of the destination (the "two home pages"
  // back-swipe bug). If we've already restored into a real in-app group,
  // the destination layouts own auth correction, so skip the redirect.
  const segments = useSegments();
  const alreadyInApp =
    segments[0] === "(main-tabs)" || segments[0] === "(onboarding)";
  // useConvexAuth().isAuthenticated flips true only after the Clerk JWT has
  // actually propagated to Convex. Until then, getMe's ctx.auth.getUserIdentity()
  // is null and the query returns null even for an existing, fully-onboarded
  // user — which must NOT be mistaken for "no user record exists".
  const { isAuthenticated: convexAuthenticated } = useConvexAuth();
  // Only run the Convex query once Clerk confirms the user is signed in.
  // Using isSignedIn === true (not !== false) prevents the query from running
  // while Clerk is still loading (isSignedIn = undefined), which would fire without
  // an auth token and immediately return null, causing a premature navigation.
  const rawMe = useQuery(api.users.getMe, isSignedIn === true ? undefined : "skip");
  const me =
    rawMe === undefined
      ? undefined
      : rawMe === null
        ? isSignedIn === true && !convexAuthenticated
          ? undefined
          : null
        : rawMe.clerkUserId === clerkUserId
          ? rawMe
          : undefined;
  // Fire the redirect exactly once per mount to prevent re-fires during onboarding.
  const hasNavigated = useRef(false);

  useEffect(() => {
    console.log("[onboarding-resume:index] route check", {
      isLoaded,
      isSignedIn,
      clerkUserId,
      rawMeState: rawMe === undefined ? "loading" : rawMe === null ? "null" : "loaded",
      meState: me === undefined ? "loading" : me === null ? "null" : "loaded",
      onboardingCompleted: me?.onboardingCompleted,
      essentialOnboardingCompleted: me?.essentialOnboardingCompleted,
      hasNavigated: hasNavigated.current,
      rootNavigationReady,
    });

    if (
      !shouldRunStartupRedirect({
        authLoaded: isLoaded,
        hasNavigated: hasNavigated.current,
        rootNavigationReady,
      })
    ) {
      return;
    }

    // Already restored into the app (reload case) — don't re-navigate, or
    // we stack a duplicate of the current screen.
    if (alreadyInApp) {
      hasNavigated.current = true;
      return;
    }

    if (!isSignedIn) {
      console.log("[onboarding-resume:index] navigating to onboarding: signed out");
      try {
        router.replace("/(onboarding)");
        hasNavigated.current = true;
      } catch (e) {
        // Navigator mid-rehydration — stale guard should prevent this, but catch
        // as a safety net so the error boundary isn't triggered. Effect will
        // re-fire once rootNavigationReady flips (stale → false).
        console.warn("[onboarding-resume:index] navigation not ready, will retry:", e);
      }
      return;
    }

    // Wait for Convex user record to finish loading (undefined = still loading)
    if (me === undefined) {
      console.log("[onboarding-resume:index] waiting for Convex user record");
      return;
    }

    (async () => {
      if (hasNavigated.current) return;

      const safeReplace = (destination: Parameters<typeof router.replace>[0]): boolean => {
        try {
          router.replace(destination);
          return true;
        } catch (e) {
          console.warn("[onboarding-resume:index] navigation not ready, will retry:", e);
          return false;
        }
      };

      // Onboarding fully complete → home
      if (me?.onboardingCompleted === true) {
        console.log("[onboarding-resume:index] navigating home: onboarding completed", {
          convexUserId: me._id,
          clerkUserId,
        });
        if (safeReplace("/(main-tabs)/home")) hasNavigated.current = true;
        return;
      }

      // Required account setup is done; optional onboarding can be completed later from home.
      if (me?.essentialOnboardingCompleted === true) {
        console.log("[onboarding-resume:index] navigating home: essential onboarding completed", {
          convexUserId: me._id,
          clerkUserId,
        });
        if (safeReplace("/(main-tabs)/home")) hasNavigated.current = true;
        return;
      }

      // User explicitly tapped "Finish later" mid-onboarding — respect
      // that on re-login instead of restarting them at the phone step.
      // This is the OAuth-friendly path: it doesn't require all
      // `essentialOnboardingCompleted` field gates to have passed.
      if ((me as { onboardingDeferred?: boolean })?.onboardingDeferred === true) {
        console.log("[onboarding-resume:index] navigating home: onboarding deferred", {
          convexUserId: me._id,
          clerkUserId,
        });
        router.replace("/(main-tabs)/home");
        hasNavigated.current = true;
        return;
      }

      const finishedLaterKey = getOnboardingFinishedLaterKey(clerkUserId);
      const finishedLater = await SecureStore.getItemAsync(finishedLaterKey);
      if (hasNavigated.current) return;

      if (finishedLater === "true") {
        console.log("[onboarding-resume:index] navigating home: finish-later flag set", {
          finishedLaterKey,
          clerkUserId,
        });
        if (safeReplace("/(main-tabs)/home")) hasNavigated.current = true;
      } else {
        // Signed in but onboarding incomplete — resume from last completed step
        console.log("[onboarding-resume:index] navigating to onboarding auto-resume", {
          finishedLaterKey,
          finishedLater,
          convexUserId: me?._id,
          clerkUserId,
        });
        if (safeReplace({ pathname: "/(onboarding)", params: { isResumeMode: "true" } })) {
          hasNavigated.current = true;
        }
      }
    })();
  }, [clerkUserId, isLoaded, isSignedIn, me, rawMe, rootNavigationReady, alreadyInApp]);

  /**
   * Hold the splash until this screen goes away.
   *
   * The splash used to lift as soon as fonts and Clerk were ready, but routing
   * also waits on the Convex user record — so for that gap the driver got a
   * third screen between the splash and Home: dark navy with a spinner, which
   * then slid away. Hiding on unmount means the splash lifts at the exact
   * moment we hand off to the real screen, and this one is never seen.
   *
   * StartupSplashGate keeps a timeout as a backstop, so a routing path that
   * never resolves cannot strand anyone on a splash.
   */
  useEffect(() => {
    return () => {
      SplashScreen.hideAsync().catch(() => {});
    };
  }, []);

  // Deliberately empty and splash-coloured rather than a spinner: with the
  // splash held above it this is never visible, and if it ever does show it
  // should read as the splash rather than as a fourth screen.
  return <View style={styles.loading} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    // Matches the splash's background (app.json → expo-splash-screen), not the
    // brand ink it used to use — the mismatch was what made the hand-off read
    // as a separate screen.
    backgroundColor: "#FFFFFF",
  },
});
