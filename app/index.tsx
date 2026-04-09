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
import { BrandColors } from "@/constants/theme";

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();

  // Wait for Clerk to load (includes token-cache hydration)
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

  // Signed in → go straight to home. No Convex wait, no onboarding redirect = no signup flash.
  // Home/FinishAccountSetupCard handles incomplete onboarding via in-app flow.
  return <Redirect href="/(main-tabs)/home" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BrandColors.primary,
  },
});
