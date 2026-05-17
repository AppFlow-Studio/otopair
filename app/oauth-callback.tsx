import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";

import { BrandColors } from "@/constants/theme";
import { Text } from "@/components/shared-ui";

export default function OAuthCallbackScreen() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;

    if (isSignedIn) {
      router.replace("/(main-tabs)/home");
      return;
    }

    const timeout = setTimeout(() => {
      router.replace("/(onboarding)");
    }, 1500);

    return () => clearTimeout(timeout);
  }, [isLoaded, isSignedIn]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={BrandColors.primary} />
        <Text style={styles.title}>Signing you in</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BrandColors.primary,
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    borderRadius: 24,
    backgroundColor: BrandColors.white,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  title: {
    color: BrandColors.primary,
    fontSize: 20,
  },
});
