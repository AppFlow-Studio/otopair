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
import { BrandColors } from "@/constants/theme";

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  // Fire the redirect exactly once per mount. Without this guard, index.tsx remains
  // in the background stack (due to the (main-tabs) anchor) and would re-fire a
  // redirect to home every time isSignedIn changes — causing a flash during the
  // phone-verification step of OAuth onboarding.
  const hasNavigated = useRef(false);

  useEffect(() => {
    if (!isLoaded || hasNavigated.current) return;
    hasNavigated.current = true;

    if (isSignedIn) {
      router.replace("/(main-tabs)/home");
    } else {
      router.replace("/(onboarding)");
    }
  }, [isLoaded, isSignedIn]);

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
