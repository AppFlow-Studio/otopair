/**
 * SearchAreaButton
 *
 * PURPOSE: A pill-shaped button that appears below the frosted header,
 *          allowing users to search for shops in the current map area.
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - onPress (() => void): Called when the button is tapped
 *   - visible (boolean): Whether the button should be shown
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";

// 2. Expo & Third-party
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

// 3. Shared UI (design system)
import { BrandColors, Shadows, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius } from "@/constants/theme";

// ============================================================================
// TYPES
// ============================================================================

interface SearchAreaButtonProps {
  /** Called when the button is tapped */
  onPress: () => void;
  /** Whether the button should be shown */
  visible: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SearchAreaButton({ onPress, visible }: SearchAreaButtonProps) {
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={styles.container}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.button}
      >
        <Text size="sm" weight="semiBold" color={BrandColors.secondary}>
          Search this area
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  button: {
    alignItems: "center",
    backgroundColor: BrandColors.white,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    ...Shadows.md,
  },
});
