/**
 * RatingMarkerPill — ChatGPT-style map pin for booking-flow shop pins.
 *
 * Rendered as the child of a react-native-maps `<Marker>` (the same
 * custom-child pattern proven by `components/booking/ShopMarker.tsx`).
 * Two rows stacked:
 *  1. Small pill: ★ icon + rating to 1 decimal. Selected → black bg
 *     with white fg; unselected → white bg with black fg and a soft
 *     drop shadow so it pops on map tiles.
 *  2. Shop name in bold below the pill, white text-shadow halo so
 *     it stays legible over any map tile color.
 *
 * Consumer is responsible for wrapping in `<Marker>` with
 * `anchor={{ x: 0.5, y: 0.5 }}` and `tracksViewChanges={false}` (with
 * the brief-true trick on `isSelected` changes — see comment on
 * `MARKER_REPAINT_MS` below).
 */

import React, { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Star } from "lucide-react-native";

import { Text } from "@/components/shared-ui";

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
          <Star
            size={11}
            color={isSelected ? "#FFFFFF" : "#0F172A"}
            fill={isSelected ? "#FFFFFF" : "#0F172A"}
            strokeWidth={2}
          />
          <Text
            weight="bold"
            color={isSelected ? "#FFFFFF" : "#0F172A"}
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillSelected: {
    backgroundColor: "#0F172A",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  pillUnselected: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
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
