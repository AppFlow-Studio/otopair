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

import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BrandColors } from "@/constants/theme";

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const me = useQuery(api.users.getMe);
  // Wait for Clerk to load
  if (!isLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={BrandColors.white} />
      </View>
    );
  }

  // Not signed in → go to onboarding (starts at signup)
  if (!isSignedIn) {
    return <Redirect href="/(onboarding)" />;
  }

  // Signed in but Convex user not loaded yet
  if (me === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={BrandColors.white} />
      </View>
    );
  }

  // Signed in + onboarding complete → go to home
  if (me?.onboardingCompleted) {
    return <Redirect href="/(main-tabs)/home" />;
  }

  // Signed in + onboarding NOT complete → resume onboarding
  return <Redirect href="/(onboarding)" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BrandColors.primary,
  },
});
