/**
 * FlyToCartGhost — one flying ghost from a service row to the cart FAB.
 *
 * A tap on a bookable row spawns one of these in the screen's overlay
 * layer. It starts at the row's window bounds and animates along a
 * gentle downward arc to the FAB's center, shrinking + fading as it
 * lands. When done it calls `onDone` so the parent can retire it and
 * pop the FAB.
 *
 * Pure presentation. State (cart contents, count) lives in the store —
 * this component just visualizes the transition.
 */

import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/shared-ui";
import { getServiceIcon } from "@/components/booking-flow/serviceIcons";

interface FlyToCartGhostProps {
  slug: string;
  label: string;
  /** Row's screen bounds at the moment of tap. */
  from: { x: number; y: number; w: number; h: number };
  /** FAB center in the same coordinate space (window). */
  to: { x: number; y: number };
  onDone: () => void;
}

const DURATION_MS = 1100;
const ARC_DIP_PX = -110;
// Final rendered size of the landing square. The container animates
// its width/height directly to this instead of using scaleX/scaleY —
// non-uniform scaling was distorting borderRadius into ellipses, so
// the "square" looked like a soft rounded rect no matter how high we
// pushed the radius. Animating dimensions keeps corners perfectly
// circular.
const NATURAL_HEIGHT = 80; // row padding (18*2) + iconSlot (44)
// Smaller than the FAB (56pt) so the ghost tucks INTO the cart
// rather than covering it as it lands.
const FINAL_SIZE = 36;
const START_RADIUS = 28;
const END_RADIUS = FINAL_SIZE / 2; // fully rounded at end

export function FlyToCartGhost({
  slug,
  label,
  from,
  to,
  onDone,
}: FlyToCartGhostProps) {
  const progress = useSharedValue(0);
  const Icon = getServiceIcon(slug);

  // Container animates its width/height (top-left anchored), so the
  // translate has to land the FINAL top-left at (to.x - half final size,
  // to.y - half final size) — that puts the shrunk square's CENTER on
  // the FAB center.
  const dx = to.x - FINAL_SIZE / 2 - from.x;
  const dy = to.y - FINAL_SIZE / 2 - from.y;

  useEffect(() => {
    progress.value = withTiming(
      1,
      { duration: DURATION_MS, easing: Easing.bezier(0.32, 0, 0.32, 1) },
      (finished) => {
        if (finished) runOnJS(onDone)();
      },
    );
    // onDone is stable across renders in the parent (it's a fresh
    // closure per ghost but only runs once); progress is a shared
    // value. Effect intentionally runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Outer container: travels along the arc AND shrinks its box (width
  // + height) down to the final square. No scale transforms — those
  // distort the corner radius since they scale it too.
  const containerStyle = useAnimatedStyle(() => {
    const tx = interpolate(progress.value, [0, 1], [0, dx]);
    const arc = interpolate(progress.value, [0, 0.5, 1], [0, ARC_DIP_PX, 0]);
    const ty = interpolate(progress.value, [0, 1], [0, dy]) + arc;
    const w = interpolate(progress.value, [0, 1], [from.w, FINAL_SIZE]);
    const h = interpolate(progress.value, [0, 1], [NATURAL_HEIGHT, FINAL_SIZE]);
    return {
      transform: [{ translateX: tx }, { translateY: ty }],
      width: w,
      height: h,
    };
  });

  // Card background + border stays visible throughout — it IS the
  // square that lands on the FAB. Border radius climbs so the corners
  // round off into the cart circle by the end.
  const cardStyle = useAnimatedStyle(() => ({
    borderRadius: interpolate(
      progress.value,
      [0, 1],
      [START_RADIUS, END_RADIUS],
    ),
  }));

  // Label fades away early — by ~35% we already read as icon-only.
  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.35, 1], [1, 0, 0]),
  }));

  // Icon TILE background (the rounded inner chip the glyph sits on)
  // fades out around the halfway point so at the end the outer
  // service card carries only the raw icon — no nested tile.
  const iconTileStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.35, 0.6, 1], [1, 1, 0, 0]),
  }));

  // Since the container width shrinks in real dimensions (not scale),
  // the row layout on the left would push the icon off the shrinking
  // right edge. Translate the icon slot from its row-left starting
  // position to the container's live center so it stays inside the
  // shrinking box and ends up centered in the final square.
  //   Icon-center starts at:  paddingLeft 16 + tileWidth/2 22 = 38.
  //   Icon-center ends at:    FINAL_SIZE / 2 = 28.
  //   translate = end - start = 28 - 38 = -10 (moves left slightly).
  // The bigger visual effect is the container itself collapsing
  // around the icon — this translate just fine-tunes the centering.
  const ICON_ROW_CENTER_X = 16 + 22;
  const finalIconCenterOffset = FINAL_SIZE / 2 - ICON_ROW_CENTER_X;
  const iconSlotStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [0, finalIconCenterOffset],
        ),
      },
    ],
  }));

  // No counter-scale on the icon glyph — the container isn't scaling
  // anymore, so the glyph stays at its natural 22pt size throughout.
  const iconStyle = useAnimatedStyle(() => ({}));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          top: from.y,
          left: from.x,
          width: from.w,
        },
        containerStyle,
      ]}
    >
      {/* Card background — fades out so the icon is what lands on the
          FAB, not a shrunk card. */}
      <Animated.View style={[styles.cardBg, cardStyle]} />

      {/* Content row on top of the card bg. The icon-tile bg is a
          separate absolute layer so it can fade out without taking
          the glyph with it. */}
      <View style={styles.row}>
        <Animated.View style={[styles.iconSlot, iconSlotStyle]}>
          <Animated.View style={[styles.iconTileBg, iconTileStyle]} />
          <Animated.View style={iconStyle}>
            <Icon size={22} color="#4B5563" strokeWidth={2} />
          </Animated.View>
        </Animated.View>
        <Animated.View style={[styles.textCol, labelStyle]}>
          <Text
            size="md"
            weight="bold"
            color="#0F172A"
            numberOfLines={1}
            style={styles.title}
          >
            {label}
          </Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    // Overflow hidden so the row content clips cleanly as the box
    // shrinks past its natural row width.
    overflow: "hidden",
  },
  cardBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(82, 153, 254, 0.55)",
  },
  row: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  iconSlot: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  iconTileBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    flexShrink: 1,
  },
});

export default FlyToCartGhost;
