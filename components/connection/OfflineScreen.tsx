/**
 * OfflineScreen — full-screen cold-start offline page (concept id 1a). Shown by
 * OfflineBootGate when the app opens with no connection and nothing cached.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WifiOff } from "lucide-react-native";

import { BorderRadius, BrandColors, Spacing } from "@/constants/theme";
import { PrimaryButton, Text } from "@/components/shared-ui";

export function OfflineScreen({ onRetry }: { onRetry: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <View style={styles.iconTile}>
          <WifiOff size={40} color={BrandColors.primary} />
        </View>
        <Text size="2xl" weight="bold" color={BrandColors.primary} style={styles.title}>
          No connection
        </Text>
        <Text size="md" weight="regular" color="#6B7280" style={styles.subtitle}>
          You&apos;re offline. Reconnect to load OtoPair.
        </Text>
        <PrimaryButton style={styles.retry} onPress={onRetry}>
          <Text size="md" weight="semiBold" color={BrandColors.white}>
            Retry
          </Text>
        </PrimaryButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BrandColors.background, justifyContent: "center", alignItems: "center" },
  content: { alignItems: "center", paddingHorizontal: Spacing["3xl"] },
  iconTile: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    backgroundColor: "#EAECEF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  title: { textAlign: "center", marginBottom: Spacing.sm },
  subtitle: { textAlign: "center", lineHeight: 22, marginBottom: Spacing["2xl"] },
  retry: { borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing["4xl"] },
});
