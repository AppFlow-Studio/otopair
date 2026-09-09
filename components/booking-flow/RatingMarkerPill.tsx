/**
 * RatingMarkerPill — Otopair-branded map pin.
 *
 * Layout, top-to-bottom:
 *  1. Big Otopair pin-logo image (~48pt) — this IS the pin. Selected
 *     state scales up ~8% and gets a soft brand-blue glow so the
 *     active shop reads at a glance without recoloring the logo.
 *  2. Small star-rating chip (white pill with amber star + rating).
 *     Selected → 1.5pt brand-blue border.
 *  3. Shop name in bold with a white text-shadow halo so it stays
 *     legible over any map-tile color.
 *
 * A gentle bob animation runs on the SELECTED pin only. Unselected
 * pins stay static so the map reads calm and the selected one draws
 * the eye. The bob is only visually rendered on the map when the
 * consumer wraps this in `<Marker tracksViewChanges={isSelected}>` —
 * a static marker snapshot won't repaint. Consumers already do that.
 *
 * Consumer contract:
 *   <Marker
 *     coordinate={...}
 *     anchor={{ x: 0.5, y: 1 }}  // bottom of the LOGO points at the coord
 *     tracksViewChanges={isSelected}
 *     onPress={...}
 *   >
 *     <RatingMarkerPill rating={...} shopName={...} isSelected={...} />
 *   </Marker>
 */

import React, { memo, useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Star } from "lucide-react-native";

import { Text } from "@/components/shared-ui";

const OTOPAIR_LOGO = require("@/assets/images/pin-logo-3d.png");

/** How long the host should keep `tracksViewChanges={true}` after the
 *  `isSelected` style flips, before going back to false. Long enough
 *  for the native side to repaint the new bg/fg, short enough to
 *  avoid frame thrashing. Exported so consumers use the same number. */
export const RATING_MARKER_REPAINT_MS = 200;

const LOGO_SIZE = 48;
const BOB_AMPLITUDE = 4;
const BOB_HALF_DURATION_MS = 900;

interface RatingMarkerPillProps {
  /** 0–5 rating. `null` hides the rating chip and shows only the
   *  logo + name (rare — pre-launch shops with no reviews yet). */
  rating: number | null;
  shopName: string;
  isSelected: boolean;
}

function RatingMarkerPillComponent({
  rating,
  shopName,
  isSelected,
}: RatingMarkerPillProps) {
  // Gentle up-and-down bob on the selected pin. Sine ease so the
  // hover feels weightless. Unselected pins skip the animation
  // entirely — no shared-value updates when they're not visible in
  // the native marker snapshot.
  const bob = useSharedValue(0);
  useEffect(() => {
    if (!isSelected) {
      cancelAnimation(bob);
      bob.value = 0;
      return;
    }
    bob.value = withRepeat(
      withSequence(
        withTiming(-BOB_AMPLITUDE, {
          duration: BOB_HALF_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(0, {
          duration: BOB_HALF_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
    );
    return () => {
      cancelAnimation(bob);
    };
  }, [isSelected, bob]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View
        style={[
          styles.logoWrap,
          isSelected ? styles.logoWrapSelected : styles.logoWrapUnselected,
          logoAnimatedStyle,
        ]}
      >
        <Image
          source={OTOPAIR_LOGO}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {rating != null ? (
        <View
          style={[
            styles.ratingChip,
            isSelected ? styles.ratingChipSelected : styles.ratingChipUnselected,
          ]}
        >
          <Star size={11} color="#F59E0B" fill="#F59E0B" strokeWidth={2} />
          <Text weight="bold" color="#0F172A" style={styles.ratingText}>
            {rating.toFixed(1)}
          </Text>
        </View>
      ) : null}

      <Text
        weight="bold"
        color="#0F172A"
        numberOfLines={2}
        style={styles.nameText}
      >
        {shopName}
      </Text>
    </View>
  );
}

export const RatingMarkerPill = memo(RatingMarkerPillComponent);

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 4,
    // Cap the visible footprint so very long shop names don't make
    // the marker view balloon and force tracksViewChanges churn.
    maxWidth: 140,
  },
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrapUnselected: {
    // Soft drop shadow so the logo lifts off the map tiles even
    // when static. Neutral shadow — no color that would fight the
    // selected-state's brand-blue glow.
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 4,
  },
  logoWrapSelected: {
    // Slight scale-up + brand-blue glow so the active shop reads
    // as the eye-catch on the map. Transform combines cleanly with
    // the bob translateY from the animated style.
    transform: [{ scale: 1.08 }],
    shadowColor: "#5299FE",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  ratingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  ratingChipUnselected: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  ratingChipSelected: {
    borderWidth: 1.5,
    borderColor: "#5299FE",
    shadowColor: "#5299FE",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  ratingText: {
    fontSize: 12,
    lineHeight: 14,
  },
  nameText: {
    fontSize: 11,
    lineHeight: 13,
    textAlign: "center",
    // White halo so the bold black name stays legible over any tile
    // color (ChatGPT screenshot uses the same trick).
    textShadowColor: "rgba(255, 255, 255, 0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
});
