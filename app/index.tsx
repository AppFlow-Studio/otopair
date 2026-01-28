/**
 * index
 *
 * PURPOSE: Redirects to the onboarding flow. Includes dev shortcut to demo screen.
 *
 * USED IN: app/_layout.tsx
 *
 * PROPS: None
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { BrandColors, FontFamily, FontSize, Spacing, BorderRadius } from "@/constants/theme";

export default function Index() {
  const router = useRouter();
  const [goToOnboarding, setGoToOnboarding] = useState(false);

  if (goToOnboarding) {
    return <Redirect href="/(onboarding)" />;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => setGoToOnboarding(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryText}>Continue to App</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.demoButton}
        onPress={() => router.push("/demo")}
        activeOpacity={0.8}
      >
        <Text style={styles.demoText}>Go to Demo Booking</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.demoButton, { backgroundColor: "#22C55E" }]}
        onPress={() => router.push("/demo-learning")}
        activeOpacity={0.8}
      >
        <Text style={styles.demoText}>Go to Learning Pipeline Demo</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: BrandColors.primary,
    gap: Spacing.lg,
    paddingHorizontal: Spacing["3xl"],
  },
  primaryButton: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing["3xl"],
    width: "100%",
    alignItems: "center",
  },
  primaryText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: BrandColors.primary,
  },
  demoButton: {
    backgroundColor: BrandColors.secondary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing["3xl"],
    width: "100%",
    alignItems: "center",
  },
  demoText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: BrandColors.white,
  },
});
