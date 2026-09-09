/**
 * MapSkeleton
 *
 * PURPOSE: Placeholder shown in the booking-flow map slot while the
 *          real map can't be drawn yet — location permission is still
 *          resolving, `getCurrentPositionAsync` is in flight, or the
 *          MapView is mounted but hasn't reported `onMapLoaded`
 *          (tiles rendered — NOT `onMapReady`, which fires seconds
 *          earlier on a still-blank canvas).
 *          Previously that window rendered as a flat `#C8D7DE` fill,
 *          which reads as "the map is broken" rather than "the map is
 *          coming".
 *
 * VISUAL: A plain grey surface with a single shimmer band sweeping
 *         across it — the whole screen IS the skeleton. No placeholder
 *         panels/blocks (per Waleed's direction, 2026-07-25): the map
 *         is one canvas, so its loading state is one breathing surface.
 *
 * Purely decorative. It sits under the screen sheets at
 * `pointerEvents="none"` and is unmounted the moment the map is live.
 *
 * USED IN: components/booking-flow/BookingFlowMap.tsx
 */

import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/** Neutral grey canvas — close to Google's own unloaded-tile tone so
 *  the swap to the live map doesn't flash. */
const SURFACE = "#E9EBEE";

/** The sweep band: a soft grey a shade below the surface — the middle
 *  ground Waleed landed on (2026-07-25) after the white highlight
 *  ("rgba(255,255,255,0.4)") read invisible and the dark grey
 *  ("rgba(148,158,170,0.4)") read out of place. */
const BAND = "rgba(201,206,212,0.45)";

/** One sweep across the screen, then restart from off-screen left.
 *  Slow enough to read as a loading pass, not a camera flash. */
const SWEEP_DURATION_MS = 2400;

export function MapSkeleton() {
  const { width, height } = useWindowDimensions();
  // Band is nearly screen-wide so the pass feels broad and unhurried.
  const bandWidth = width * 0.9;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: SWEEP_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false,
    );
  }, [progress]);

  const sweep = useAnimatedStyle(() => ({
    transform: [
      // Travel from fully off-screen left to fully off-screen right.
      { translateX: -bandWidth + progress.value * (width + bandWidth * 2) },
      // Slight tilt so the band reads as a light pass, not a scanline.
      { rotate: "8deg" },
    ],
  }));

  return (
    <View
      style={styles.root}
      pointerEvents="none"
      // Decorative only — keep it out of the a11y tree on both
      // platforms (`accessibilityElementsHidden` is iOS-only).
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[
          styles.band,
          // Overshoot vertically so the tilted band still covers the
          // full height at both ends of its travel.
          { width: bandWidth, top: -height * 0.25, bottom: -height * 0.25 },
          sweep,
        ]}
      >
        <LinearGradient
          colors={["transparent", BAND, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SURFACE,
    overflow: "hidden",
  },
  band: {
    position: "absolute",
  },
});

export default MapSkeleton;
