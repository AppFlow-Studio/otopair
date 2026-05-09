/**
 * AvatarSlider
 *
 * PURPOSE: Revolut-style avatar inner content that auto-rotates between
 *          two panels (typically initials and the OtoPair pin logo).
 *          Each cycle the current panel slides leftward off-screen
 *          while the next panel slides in from the right — direction
 *          is consistent forever (it never reverses), so it reads as
 *          a one-way carousel rotating through the panels.
 *
 *          The container clips with `overflow: hidden`, so callers can
 *          drop this directly inside any circular avatar background
 *          (gradient, photo, etc) and the slide stays inside the
 *          circle.
 *
 * USED IN: SettingsContent's default avatar, ProfileInitialsButton.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect, useState } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type AvatarSliderProps = {
  size: number;
  /** Two panels rendered as the slide pair. */
  panels: [React.ReactNode, React.ReactNode];
  /** ms between each auto-flip. Default 3500. */
  intervalMs?: number;
  /** ms for the slide/crossfade itself. Default 450. */
  durationMs?: number;
  style?: ViewStyle;
};

export function AvatarSlider({
  size,
  panels,
  intervalMs = 3500,
  durationMs = 450,
  style,
}: AvatarSliderProps) {
  // We always render two layers: the panel currently in view and the
  // panel that's about to slide in. After each cycle we swap which
  // panel index lives in which slot, so the visual motion stays
  // identical (current → off left, next → in from right) regardless
  // of whether we're going initials→logo or logo→initials.
  const [slots, setSlots] = useState<{ current: 0 | 1; incoming: 0 | 1 }>({
    current: 0,
    incoming: 1,
  });
  const progress = useSharedValue(0);

  useEffect(() => {
    const swap = () => {
      setSlots((s) => ({
        current: s.incoming,
        incoming: s.current,
      }));
      progress.value = 0;
    };

    const id = setInterval(() => {
      progress.value = withTiming(
        1,
        { duration: durationMs, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(swap)();
        },
      );
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs, durationMs, progress]);

  const currentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -progress.value * size }],
    opacity: 1 - progress.value,
  }));

  const incomingStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - progress.value) * size }],
    opacity: progress.value,
  }));

  return (
    <View
      style={[{ width: size, height: size }, styles.clip, style]}
      pointerEvents="none"
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, currentStyle]}>
        {panels[slots.current]}
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, incomingStyle]}>
        {panels[slots.incoming]}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
});

export default AvatarSlider;
