/**
 * HomeCrop — one shop card over a hinted map.
 *
 * The Home tab is a map with results on it, and at 200pt wide a faithful
 * miniature of that is unreadable. So this is a ZOOM, not a shrink: the map is
 * reduced to a suggestion and one result card is shown near full size, because
 * the card is the thing being explained.
 *
 * The price is on the card on purpose — up-front pricing is the actual
 * difference from ringing round for quotes, and the step's copy makes that
 * claim. A crop that omitted it would leave the sentence unsupported.
 *
 * BEAT: pin drops, then the card rises. Reads as "we found this for you"
 * rather than a poster that was always there.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { BrandColors, FontFamily } from "@/constants/theme";
import { SpringConfig } from "@/constants/animations";
import { SCREEN_HEIGHT, SCREEN_WIDTH } from "../PhoneMock";

const INK = BrandColors.primary;
const ACCENT = BrandColors.secondary;
const MUTED = "#5A6675";

export function HomeCrop({ play, reduceMotion }: { play: boolean; reduceMotion: boolean }) {
  const pin = useSharedValue(reduceMotion ? 1 : 0);
  const card = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      pin.value = 1;
      card.value = 1;
      return;
    }
    if (!play) {
      pin.value = 0;
      card.value = 0;
      return;
    }
    pin.value = withDelay(120, withSpring(1, SpringConfig.bouncy));
    card.value = withDelay(260, withTiming(1, { duration: 320, easing: Easing.bezier(0.16, 1, 0.3, 1) }));
  }, [play, reduceMotion, pin, card]);

  const pinStyle = useAnimatedStyle(() => ({
    opacity: pin.value,
    transform: [{ scale: 0.4 + pin.value * 0.6 }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.value,
    transform: [{ translateY: (1 - card.value) * 16 }],
  }));

  return (
    <View style={styles.root}>
      {/* Map hint. Two roads and a block is enough to say "map" — anything
          more competes with the card it exists to sit behind. */}
      <View style={[styles.road, styles.roadA]} />
      <View style={[styles.road, styles.roadB]} />
      <View style={styles.block} />

      <Animated.View style={[styles.pin, pinStyle]} />

      <Animated.View style={[styles.card, cardStyle]}>
        <Text style={styles.shop} numberOfLines={1}>
          Chelala Service Center
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          ★ 4.9 · 1.2 mi · Opens 8 AM
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>$89</Text>
          <Text style={styles.priceFor}>oil change · all in</Text>
        </View>
        <View style={styles.book}>
          <Text style={styles.bookText}>Book</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: "#ECF1F7" },
  road: { position: "absolute", backgroundColor: "#FFFFFF", opacity: 0.9 },
  roadA: { width: 260, height: 9, left: -30, top: 96, transform: [{ rotate: "-12deg" }] },
  roadB: { width: 9, height: 300, left: 132, top: -20, transform: [{ rotate: "6deg" }] },
  block: {
    position: "absolute",
    width: 70,
    height: 54,
    left: 18,
    top: 26,
    borderRadius: 8,
    backgroundColor: "#E0E8EF",
  },
  pin: {
    position: "absolute",
    width: 24,
    height: 24,
    left: 92,
    top: 106,
    borderRadius: 12,
    backgroundColor: ACCENT,
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  card: {
    position: "absolute",
    left: 12,
    top: 188,
    width: 176,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 13,
    gap: 7,
    shadowColor: "#141C24",
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  shop: { fontFamily: FontFamily.bold, fontSize: 14, color: INK },
  meta: { fontFamily: FontFamily.medium, fontSize: 11.5, color: MUTED },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  price: { fontFamily: FontFamily.bold, fontSize: 15, color: INK },
  priceFor: { fontFamily: FontFamily.medium, fontSize: 11.5, color: MUTED },
  book: {
    height: 32,
    borderRadius: 9,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  bookText: { fontFamily: FontFamily.semiBold, fontSize: 12.5, color: "#FFFFFF" },
});
