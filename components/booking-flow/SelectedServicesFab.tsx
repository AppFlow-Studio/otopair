/**
 * SelectedServicesFab — bottom-right floating action button on Screen 2.
 *
 * Surfaces the current multi-tab service cart at a glance and offers
 * a tap target to open the review sheet. Renders NOTHING when the
 * count is 0 — the FAB only exists once the user has picked at least
 * one service. A small white badge in the top-right corner shows the
 * count in brand navy.
 *
 * Positioning (right + bottom offset) is the parent's job; this
 * component just lays out the circle + icon + badge.
 *
 * Exposes a `ref` to the outer Pressable so the parent can
 * `measureInWindow` for the fly-to-cart animation endpoint. Bumps a
 * short scale-pop each time `pulseKey` changes so the FAB reacts when
 * a ghost lands on it.
 *
 * Structure: Animated.View (scale wrapper) > Pressable (ref target +
 * onPress + shape). Keeping the Pressable as a plain RN component
 * avoids the `createAnimatedComponent(Pressable)` ref-forwarding
 * quirks that would otherwise hide the underlying host view from
 * `measureInWindow`.
 */

import React, { forwardRef, useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { ShoppingCart } from "lucide-react-native";

import { Text } from "@/components/shared-ui";

const ACCENT = "#5299FE";
const INK = "#0F172A";

interface SelectedServicesFabProps {
  count: number;
  onPress: () => void;
  /** Increments each time a fly-to-cart ghost lands — the FAB pops. */
  pulseKey?: number;
}

export const SelectedServicesFab = forwardRef<View, SelectedServicesFabProps>(
  function SelectedServicesFab({ count, onPress, pulseKey = 0 }, ref) {
    const scale = useSharedValue(1);

    useEffect(() => {
      // Skip the pop on the initial mount (pulseKey === 0). Any bump
      // after mount fires the sequence.
      if (pulseKey === 0) return;
      scale.value = withSequence(
        withTiming(1.18, { duration: 120, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 10, stiffness: 240 }),
      );
    }, [pulseKey, scale]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return (
      <Animated.View style={animatedStyle}>
        <Pressable
          ref={ref}
          onPress={onPress}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Review ${count} selected service${count === 1 ? "" : "s"}`}
        >
          <ShoppingCart size={24} color="#FFFFFF" strokeWidth={2} />
          <View style={styles.badge}>
            <Text size="xs" weight="bold" color={INK}>
              {count}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  },
);

const styles = StyleSheet.create({
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    // Soft drop shadow so the FAB lifts off the sheet behind it.
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.9,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    // Tiny border so the badge separates from the blue FAB cleanly.
    borderWidth: 2,
    borderColor: ACCENT,
  },
});
