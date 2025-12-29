/**
 * SearchAreaButton
 *
 * PURPOSE: A pill-shaped button that appears below the frosted header,
 *          allowing users to search for shops in the current map area.
 *          Fades with the rest of the TopBar components when sheets expand.
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - onPress (() => void): Called when the button is tapped
 *   - visible (boolean): Whether the button should be shown
 *   - sheetAnimatedIndex (SharedValue<number>): Animated index from bottom sheet [optional]
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";

// 2. Expo & Third-party
import Animated, { FadeIn, FadeOut, SharedValue, useAnimatedStyle } from "react-native-reanimated";

// 3. Shared UI (design system)
import { BrandColors, Shadows, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { SheetDrivenAnimation } from "@/constants/animations";
import { BorderRadius } from "@/constants/theme";

// ============================================================================
// TYPES
// ============================================================================

interface SearchAreaButtonProps {
  /** Called when the button is tapped */
  onPress: () => void;
  /** Whether the button should be shown */
  visible: boolean;
  /** Animated index from bottom sheet (for fading with TopBar) */
  sheetAnimatedIndex?: SharedValue<number>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SearchAreaButton({ onPress, visible, sheetAnimatedIndex }: SearchAreaButtonProps) {
  // Animation for fading with TopBar components (sheet-driven: fade out when expanded)
  const animatedStyle = useAnimatedStyle(() => {
    if (!sheetAnimatedIndex) {
      return { opacity: 1 };
    }

    const opacity = SheetDrivenAnimation.fadeOut(sheetAnimatedIndex.value);

    return { opacity, pointerEvents: opacity < 0.1 ? "none" : "auto" };
  }, [sheetAnimatedIndex]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      style={styles.container}
    >
      <Animated.View style={animatedStyle}>
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
