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
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRootNavigationState } from "expo-router";
import { guardedRouter as router } from "@/lib/navigationLock";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { api } from "@/convex/_generated/api";
import { BrandColors } from "@/constants/theme";
import { shouldRunStartupRedirect } from "@/lib/auth-routing";
import { getOnboardingFinishedLaterKey } from "@/lib/onboarding-resume";

export default function Index() {
  const { isSignedIn, isLoaded, userId: clerkUserId } = useAuth();
  const rootNavigationState = useRootNavigationState();
  const rootNavigationReady = Boolean(rootNavigationState?.key);
  // Only run the Convex query once Clerk confirms the user is signed in.
  // Using isSignedIn === true (not !== false) prevents the query from running
  // while Clerk is still loading (isSignedIn = undefined), which would fire without
  // an auth token and immediately return null, causing a premature navigation.
  const rawMe = useQuery(api.users.getMe, isSignedIn === true ? undefined : "skip");
  const me =
    rawMe === undefined
      ? undefined
      : rawMe === null
        ? null
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

    if (!isSignedIn) {
      console.log("[onboarding-resume:index] navigating to onboarding: signed out");
      router.replace("/(onboarding)");
      hasNavigated.current = true;
      return;
    }

    // Wait for Convex user record to finish loading (undefined = still loading)
    if (me === undefined) {
      console.log("[onboarding-resume:index] waiting for Convex user record");
      return;
    }

    (async () => {
      if (hasNavigated.current) return;

      // Onboarding fully complete → home
      if (me?.onboardingCompleted === true) {
        console.log("[onboarding-resume:index] navigating home: onboarding completed", {
          convexUserId: me._id,
          clerkUserId,
        });
        router.replace("/(main-tabs)/home");
        hasNavigated.current = true;
        return;
      }

      // Required account setup is done; optional onboarding can be completed later from home.
      if (me?.essentialOnboardingCompleted === true) {
        console.log("[onboarding-resume:index] navigating home: essential onboarding completed", {
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
        router.replace("/(main-tabs)/home");
        hasNavigated.current = true;
      } else {
        // Signed in but onboarding incomplete — resume from last completed step
        console.log("[onboarding-resume:index] navigating to onboarding auto-resume", {
          finishedLaterKey,
          finishedLater,
          convexUserId: me?._id,
          clerkUserId,
        });
        router.replace({
          pathname: "/(onboarding)",
          params: { isResumeMode: "true" },
        });
        hasNavigated.current = true;
      }
    })();
  }, [clerkUserId, isLoaded, isSignedIn, me, rawMe, rootNavigationReady]);

  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={BrandColors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BrandColors.primary,
  },
});
