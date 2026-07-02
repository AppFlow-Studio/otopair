/**
 * MapSwipeHint — small chevron + label that sits at the top of a
 * booking-flow bottom sheet to tell the user the sheet is
 * swipe-down-able to reveal the map underneath. Non-interactive
 * (the gesture is what actually collapses the sheet); this is
 * pure affordance.
 *
 * Two soft pulses per cycle on the chevron so the indicator
 * draws the eye without feeling busy. Parent controls visibility
 * (e.g. only render when the sheet is at full/expanded snaps).
 */

import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { ChevronsDown } from "lucide-react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/shared-ui";

interface MapSwipeHintProps {
  /** Override the default copy when the surface needs different
   *  wording (e.g. "Swipe down to browse shops"). */
  label?: string;
}

export function MapSwipeHint({ label = "Swipe down to view map" }: MapSwipeHintProps) {
  const bob = useSharedValue(0);

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(3, { duration: 600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [bob]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }],
  }));

  return (
    <View style={styles.row} pointerEvents="none">
      <Animated.View style={chevronStyle}>
        <ChevronsDown size={14} color="#9CA3AF" strokeWidth={2.25} />
      </Animated.View>
      <Text size="xs" weight="medium" color="#9CA3AF">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "center",
    paddingTop: 6,
    paddingBottom: 8,
  },
});

export default MapSwipeHint;
