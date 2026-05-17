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
import { router } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { api } from "@/convex/_generated/api";
import { BrandColors } from "@/constants/theme";
import { getOnboardingFinishedLaterKey } from "@/lib/onboarding-resume";

export default function Index() {
  const { isSignedIn, isLoaded, userId: clerkUserId } = useAuth();
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
    if (!isLoaded || hasNavigated.current) return;

    if (!isSignedIn) {
      hasNavigated.current = true;
      router.replace("/(onboarding)");
      return;
    }

    // Wait for Convex user record to finish loading (undefined = still loading)
    if (me === undefined) return;

    (async () => {
      if (hasNavigated.current) return;

      // Onboarding fully complete → home
      if (me?.onboardingCompleted === true) {
        hasNavigated.current = true;
        router.replace("/(main-tabs)/home");
        return;
      }

      // User explicitly chose "Finish later" → respect that, go to home
      const finishedLater = await SecureStore.getItemAsync(getOnboardingFinishedLaterKey(clerkUserId));
      if (hasNavigated.current) return;
      hasNavigated.current = true;

      if (finishedLater === "true") {
        router.replace("/(main-tabs)/home");
      } else {
        // Signed in but onboarding incomplete — resume from last completed step
        router.replace({
          pathname: "/(onboarding)",
          params: { isResumeMode: "true" },
        });
      }
    })();
  }, [clerkUserId, isLoaded, isSignedIn, me]);

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
