/**
 * RatingMarkerPill — Otopair-themed map pin for booking-flow shop pins.
 *
 * Rendered as the child of a react-native-maps `<Marker>` (the same
 * custom-child pattern proven by `components/booking/ShopMarker.tsx`).
 * Two rows stacked:
 *  1. Pill: mini Otopair pin logo + amber star icon + rating to 1
 *     decimal. Selected → brand-blue bg with white fg; unselected →
 *     white bg with dark fg and a soft drop shadow so it pops on
 *     map tiles.
 *  2. Shop name in bold below the pill, white text-shadow halo so
 *     it stays legible over any map tile color.
 *
 * The Otopair logo makes the pin unmistakably ours vs. a generic
 * map marker. Star stays amber in both selected/unselected states
 * for brand consistency with the rest of the app's star treatments.
 *
 * Consumer is responsible for wrapping in `<Marker>` with
 * `anchor={{ x: 0.5, y: 0.5 }}` and `tracksViewChanges={false}` (with
 * the brief-true trick on `isSelected` changes — see comment on
 * `MARKER_REPAINT_MS` below).
 */

import React, { memo } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Star } from "lucide-react-native";

import { Text } from "@/components/shared-ui";

const OTOPAIR_LOGO = require("@/assets/images/pin-logo-3d.png");

/** How long the host should keep `tracksViewChanges={true}` after the
 *  `isSelected` style flips, before going back to false. Long enough
 *  for the native side to repaint the new bg/fg, short enough to
 *  avoid frame thrashing. Exported so the consumers all use the same
 *  number. */
export const RATING_MARKER_REPAINT_MS = 200;

interface RatingMarkerPillProps {
  /** 0–5 rating. `null` hides the pill row and shows only the shop
   *  name (rare — pre-launch shops with no reviews yet). */
  rating: number | null;
  shopName: string;
  isSelected: boolean;
}

function RatingMarkerPillComponent({
  rating,
  shopName,
  isSelected,
}: RatingMarkerPillProps) {
  return (
    <View style={styles.container} pointerEvents="none">
      {rating != null ? (
        <View style={[styles.pill, isSelected ? styles.pillSelected : styles.pillUnselected]}>
          <Image source={OTOPAIR_LOGO} style={styles.logo} resizeMode="contain" />
          <Star
            size={11}
            color="#F59E0B"
            fill="#F59E0B"
            strokeWidth={2}
          />
          <Text
            weight="bold"
            color="#0F172A"
            style={styles.ratingText}
          >
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
    gap: 3,
    // Cap the visible footprint so very long shop names don't make
    // the marker view balloon and force tracksViewChanges churn.
    maxWidth: 140,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pillSelected: {
    // Selected state stays WHITE per Ahmad — differentiated from
    // the resting state by a brand-blue border ring + a bigger
    // brand-blue glow shadow so it reads as "active" without
    // changing the pill's fill color.
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#5299FE",
    shadowColor: "#5299FE",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  pillUnselected: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },
  logo: {
    // Small Otopair pin logo tucked at the left edge of the pill.
    // Sized to match the star icon so the row reads as a balanced
    // triplet: logo · star · rating.
    width: 18,
    height: 18,
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
    // color (the ChatGPT screenshot does this same trick).
    textShadowColor: "rgba(255, 255, 255, 0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },
});
