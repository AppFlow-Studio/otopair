/**
 * UpdateAvailableBanner — appears at the top of the main tabs when an EAS
 * Update bundle has been downloaded and is ready to apply. Tapping "Reload"
 * triggers `Updates.reloadAsync()`. The X dismisses the banner for the
 * current update only — a newer publish will surface it again.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { SlideInUp, SlideOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sparkles, X } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import {
  BorderRadius,
  BrandColors,
  FontFamily,
  FontSize,
  Shadows,
  Spacing,
} from "@/constants/theme";
import { useEasUpdate } from "@/hooks/useEasUpdate";

export function UpdateAvailableBanner() {
  const insets = useSafeAreaInsets();
  const { show, reload, dismiss } = useEasUpdate();

  if (!show) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingTop: insets.top + Spacing.sm }]}
      entering={SlideInUp.duration(250)}
      exiting={SlideOutUp.duration(200)}
    >
      <View style={styles.bar}>
        <View style={styles.leftGroup}>
          <Sparkles size={18} color={BrandColors.white} />
          <Text
            variant="bodyBold"
            color={BrandColors.white}
            style={styles.label}
          >
            Update available
          </Text>
        </View>

        <View style={styles.rightGroup}>
          <Pressable
            onPress={reload}
            hitSlop={8}
            style={({ pressed }) => [
              styles.reloadButton,
              pressed && styles.reloadButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Reload to apply the update"
          >
            <Text
              weight="semiBold"
              color={BrandColors.white}
              style={styles.reloadText}
            >
              Reload
            </Text>
          </Pressable>
          <Pressable
            onPress={dismiss}
            hitSlop={8}
            style={({ pressed }) => [
              styles.dismissButton,
              pressed && styles.dismissButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Dismiss update notice"
          >
            <X size={16} color={BrandColors.white} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    zIndex: 1000,
    elevation: 1000,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BrandColors.secondary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.sm,
    gap: Spacing.md,
    ...Shadows.md,
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexShrink: 1,
  },
  label: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.md,
  },
  rightGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  reloadButton: {
    backgroundColor: BrandColors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  reloadButtonPressed: {
    opacity: 0.85,
  },
  reloadText: {
    fontSize: FontSize.sm,
  },
  dismissButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissButtonPressed: {
    opacity: 0.6,
  },
});
