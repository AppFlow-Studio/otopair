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
 *          Implementation: both panels are always mounted at the same
 *          z-level inside an `overflow: hidden` clip. Their visual
 *          role (current vs incoming) is derived from a UI-thread
 *          shared value `cycleSV` plus an animated `progress` 0→1.
 *          When `progress` reaches 1 we increment `cycleSV` and reset
 *          `progress` to 0 *on the same UI-thread frame*, so there's
 *          no React-state-vs-shared-value race that would briefly
 *          flash the wrong panel between cycles.
 *
 * USED IN: SettingsContent's default avatar, ProfileInitialsButton.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type AvatarSliderProps = {
  size: number;
  /** Two panels rendered as the slide pair. */
  panels: [React.ReactNode, React.ReactNode];
  /** ms between each auto-flip. Default 5000. */
  intervalMs?: number;
  /** ms for the slide/crossfade itself. Default 450. */
  durationMs?: number;
  /** When true, the auto-flip interval is suspended. Whatever panel is
   *  current at the moment `paused` flips true stays visible until
   *  `paused` flips back to false. Used by the SettingsOverlay's
   *  shared-element transition so the home button, the floating avatar,
   *  and the natural avatar can all "freeze" on the same panel for the
   *  duration of the open/close animation. */
  paused?: boolean;
  style?: ViewStyle;
};

export function AvatarSlider({
  size,
  panels,
  intervalMs = 5000,
  durationMs = 450,
  paused = false,
  style,
}: AvatarSliderProps) {
  // `cycleSV` flips between even / odd to decide which of `panels[0]`
  // and `panels[1]` is the current vs the incoming surface. Living on
  // the UI thread (alongside `progress`) means the swap + reset run
  // on the same animation frame — no inter-thread race.
  const cycleSV = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      progress.value = withTiming(
        1,
        { duration: durationMs, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) {
            // Both updates happen synchronously on the UI thread,
            // so the next frame's `useAnimatedStyle` reads a
            // consistent (cycle+1, progress=0) pair instead of
            // briefly seeing the old slot at the new position.
            cycleSV.value = cycleSV.value + 1;
            progress.value = 0;
          }
        },
      );
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, durationMs, progress, cycleSV, paused]);

  // Each panel is conditionally treated as "current" (sliding out
  // leftward) or "incoming" (sliding in from the right) based on
  // cycle parity. Both are always mounted; only their transform +
  // opacity change.
  const panel0Style = useAnimatedStyle(() => {
    const isCurrent = cycleSV.value % 2 === 0;
    return isCurrent
      ? {
          transform: [{ translateX: -progress.value * size }],
          opacity: 1 - progress.value,
        }
      : {
          transform: [{ translateX: (1 - progress.value) * size }],
          opacity: progress.value,
        };
  });

  const panel1Style = useAnimatedStyle(() => {
    const isCurrent = cycleSV.value % 2 === 1;
    return isCurrent
      ? {
          transform: [{ translateX: -progress.value * size }],
          opacity: 1 - progress.value,
        }
      : {
          transform: [{ translateX: (1 - progress.value) * size }],
          opacity: progress.value,
        };
  });

  return (
    <View
      style={[{ width: size, height: size }, styles.clip, style]}
      pointerEvents="none"
    >
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, panel0Style]}>
        {panels[0]}
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, panel1Style]}>
        {panels[1]}
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
