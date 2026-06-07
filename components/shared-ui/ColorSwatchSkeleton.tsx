/**
 * ColorSwatchSkeleton
 *
 * PURPOSE: Loading placeholder shown while `useVdbColorsForVin` is
 *          fetching paint variants from VehicleDatabases. Replaces the
 *          old behavior of showing a generic fallback palette during
 *          the in-flight window — user now sees a pulsing skeleton
 *          until the real (or "VDB had nothing") result lands.
 *
 *          Two variants share a single pulse driver:
 *          - <ColorSwatchSkeletonRow />  horizontal scroll-style row
 *                                         (matches add-vehicle-review).
 *          - <ColorSwatchSkeletonList /> stacked rows w/ swatch + label
 *                                         (matches add-car-info sheet).
 *
 * USED IN:
 *   - app/add-vehicle-review.tsx (inline horizontal swatches)
 *   - app/add-car-info.tsx       (color picker sheet)
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { CarSilhouette, type CarSilhouetteVariant } from "./CarSilhouette";

const PULSE_COLOR = "#E5E7EB";

/**
 * Drives a shared opacity 0.4 ↔ 1.0 loop. Returned as an animated
 * style so every skeleton dot in the same render tree pulses in
 * sync without each instance running its own worklet.
 */
function usePulseStyle() {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

/**
 * Horizontal row of N pulsing circles — for the inline color picker
 * in `add-vehicle-review.tsx`. Diameter and gap match the live
 * `styles.colorSwatch` (~40 px, 12 px gap) so the swap from skeleton
 * to real swatches doesn't jump the layout.
 */
export function ColorSwatchSkeletonRow({ count = 6 }: { count?: number }) {
  const pulse = usePulseStyle();
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View key={i} style={[styles.swatchDot, pulse]} />
      ))}
    </View>
  );
}

/**
 * Vertical list of N skeleton rows (swatch dot + label bar) — for the
 * picker sheet in `add-car-info.tsx`. Row height + dot size match the
 * sheet's existing `pickerItem` + `pickerColorDot` styles.
 */
export function ColorSwatchSkeletonList({ rows = 5 }: { rows?: number }) {
  const pulse = usePulseStyle();
  return (
    <View style={styles.listWrap}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.listRow}>
          <Animated.View style={[styles.listDot, pulse]} />
          <Animated.View
            style={[
              styles.listLabel,
              // Stagger label width so the rows don't feel mechanical.
              { width: i % 2 === 0 ? "55%" : "70%" },
              pulse,
            ]}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * Loading placeholder for the car-image preview area — shown while the
 * VDB image URL (or exterior render) is still resolving. A soft
 * light-blue rounded rectangle pulses gently behind the custom
 * `CarSilhouette` SVG. Silhouette stays at constant opacity so it
 * remains legible while the surface breathes.
 */
export function VehicleImageSkeleton({
  width,
  height,
  style,
  variant,
}: {
  width: number;
  height: number;
  style?: object;
  /** Passed through to `<CarSilhouette />` — sedan default, suv for
   *  Sport Utility / Crossover / MPV body classes. */
  variant?: CarSilhouetteVariant;
}) {
  const pulse = usePulseStyle();
  // Silhouette aspect ratio is ~1.5:1 (612×408 source). Filled past
  // 100% of the container's width — silhouette has no background, so
  // it can overflow the reservation box visually without affecting
  // surrounding layout.
  const byWidth = width * 1.1;
  const byHeight = height * 1.85;
  const carWidth = Math.round(Math.min(byWidth, byHeight));
  return (
    <View style={[styles.imageBlock, { width, height }, style]}>
      {/* No background — just the silhouette pulsing on whatever
          surface the parent card provides. The wrapper still reserves
          the layout space so the swap to the real VDB render doesn't
          jump anything. */}
      <Animated.View style={pulse}>
        <CarSilhouette width={carWidth} variant={variant} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Car-image variant ─────────────────────────────────────────────
  // Layout reservation only — no background. The silhouette is the
  // only visible element; it pulses on the surrounding card surface.
  imageBlock: {
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Horizontal row variant ────────────────────────────────────────
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  swatchDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PULSE_COLOR,
  },

  // ── Vertical list variant ─────────────────────────────────────────
  listWrap: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 14,
  },
  listDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: PULSE_COLOR,
  },
  listLabel: {
    height: 14,
    borderRadius: 4,
    backgroundColor: PULSE_COLOR,
  },
});
