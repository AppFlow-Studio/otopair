/**
 * FloatingMapControls
 *
 * PURPOSE: Floating glass-styled buttons for map controls (filter and recenter).
 *          Positioned at top-right of the map screen, like Flighty app.
 *
 * USED IN: app/(main-tabs)/home/map.tsx
 *
 * PROPS:
 *   - onFilterPress (() => void): Called when filter button is pressed
 *   - onRecenterPress (() => void): Called when recenter button is pressed
 *   - isFilterActive (boolean): Whether a filter is currently active [optional]
 *
 * EXAMPLE:
 *   <FloatingMapControls
 *     onFilterPress={() => setFilterOpen(true)}
 *     onRecenterPress={handleRecenter}
 *     isFilterActive={hasActiveFilters}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Expo & Third-party
import { BlurView } from "expo-blur";
import { Navigation2, Settings2 } from "lucide-react-native";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors } from "@/components/shared-ui";

// 4. Constants
import { BorderRadius, Spacing } from "@/constants/theme";

// Native iOS 26 liquid glass (optional). Mirrors the home/ai-chat pattern —
// falls back to BlurView when the lib is unavailable.
let LiquidGlassView: React.ComponentType<any> | null = null;
let isLiquidGlassEnabled = false;
try {
  const lg = require("@callstack/liquid-glass");
  LiquidGlassView = lg.LiquidGlassView;
  isLiquidGlassEnabled = !!lg.isLiquidGlassSupported;
} catch {
  // Not available — fall back to BlurView style
}

// ============================================================================
// TYPES
// ============================================================================

export interface FloatingMapControlsProps {
  /** Called when filter button is pressed */
  onFilterPress: () => void;
  /** Called when recenter button is pressed */
  onRecenterPress: () => void;
  /** Whether a filter is currently active */
  isFilterActive?: boolean;
  /** Animated index from bottom sheet to hide controls when fully expanded */
  sheetAnimatedIndex?: SharedValue<number>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FloatingMapControls({
  onFilterPress,
  onRecenterPress,
  isFilterActive = false,
  sheetAnimatedIndex,
}: FloatingMapControlsProps) {
  const insets = useSafeAreaInsets();

  // Fade out and slide right when sheet is fully expanded (index 3)
  const animatedStyle = useAnimatedStyle(() => {
    if (!sheetAnimatedIndex) {
      return { opacity: 1, transform: [{ translateX: 0 }] };
    }

    // Start fading at index 2.5, fully hidden at index 3
    const opacity = interpolate(
      sheetAnimatedIndex.value,
      [2.5, 3],
      [1, 0],
      Extrapolation.CLAMP
    );

    const translateX = interpolate(
      sheetAnimatedIndex.value,
      [2.5, 3],
      [0, 60],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateX }],
    };
  });

  const filterButton = (
    <TouchableOpacity
      onPress={onFilterPress}
      style={styles.button}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}
    >
      <Settings2
        size={22}
        color={isFilterActive ? BrandColors.secondary : BrandColors.primary}
        strokeWidth={2}
      />
      {isFilterActive && <View style={styles.activeDot} />}
    </TouchableOpacity>
  );

  const recenterButton = (
    <TouchableOpacity
      onPress={onRecenterPress}
      style={styles.button}
      activeOpacity={0.7}
      hitSlop={{ top: 4, bottom: 8, left: 8, right: 8 }}
    >
      <Navigation2
        size={22}
        color={BrandColors.secondary}
        fill={BrandColors.secondary}
      />
    </TouchableOpacity>
  );

  return (
    <Animated.View style={[styles.container, { top: insets.top + Spacing.md }, animatedStyle]}>
      {isLiquidGlassEnabled && LiquidGlassView ? (
        <LiquidGlassView interactive effect="clear" style={styles.glassContainer}>
          {filterButton}
          <View style={styles.divider} />
          {recenterButton}
        </LiquidGlassView>
      ) : (
        <BlurView intensity={80} tint="light" style={styles.blurContainer}>
          <View style={styles.frostedOverlay} />
          {filterButton}
          <View style={styles.divider} />
          {recenterButton}
        </BlurView>
      )}
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: Spacing.lg,
    zIndex: 10,
  },
  blurContainer: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  glassContainer: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  frostedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  button: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.08)",
    marginHorizontal: Spacing.sm,
  },
  activeDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrandColors.secondary,
  },
});
