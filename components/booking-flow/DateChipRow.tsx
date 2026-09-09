/**
 * DateChipRow — Screen 4 horizontal day picker.
 *
 * Each chip shows the day-of-week (caps) + date number + a small
 * availability dot. The selected chip lifts up + scales a touch
 * with a soft drop shadow so it reads as "popping forward" out of
 * the row. Days without availability render greyed.
 *
 * Selection state animates smoothly via Reanimated — the
 * previously selected chip drops back down as the new one lifts.
 */

import React, { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/shared-ui";

const LIFT_DURATION_MS = 220;

export interface DateChipItem {
  /** ISO date "YYYY-MM-DD". */
  isoDate: string;
  /** "SAT" "SUN" etc — already abbreviated. */
  dayOfWeek: string;
  /** "7" "8" … */
  dayNumber: number;
  /** True when at least one available slot exists. */
  hasAvailability: boolean;
}

interface DateChipRowProps {
  items: DateChipItem[];
  selectedIsoDate: string | null;
  onSelect: (isoDate: string) => void;
}

export function DateChipRow({ items, selectedIsoDate, onSelect }: DateChipRowProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      // The lifted chip needs to render outside the row's vertical
      // bounds; without this the top of the lifted card gets
      // clipped by the section above.
      style={styles.scroll}
    >
      {items.map((item) => (
        <DateChip
          key={item.isoDate}
          item={item}
          isSelected={item.isoDate === selectedIsoDate}
          onPress={() => onSelect(item.isoDate)}
        />
      ))}
    </ScrollView>
  );
}

interface DateChipProps {
  item: DateChipItem;
  isSelected: boolean;
  onPress: () => void;
}

function DateChip({ item, isSelected, onPress }: DateChipProps) {
  const isDisabled = !item.hasAvailability;

  // 0 → resting, 1 → fully lifted. Drives translate, scale, and
  // shadow opacity in one smooth tween so the chip doesn't snap.
  const lift = useSharedValue(isSelected ? 1 : 0);
  useEffect(() => {
    lift.value = withTiming(isSelected ? 1 : 0, {
      duration: LIFT_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [isSelected, lift]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: lift.value * -10 },
      { scale: 1 + lift.value * 0.14 },
    ],
    shadowOpacity: lift.value * 0.22,
    // Higher z-index when lifted so neighbours don't paint over it.
    zIndex: isSelected ? 2 : 1,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={[
          styles.chip,
          isSelected && styles.chipSelected,
          isDisabled && !isSelected && styles.chipDisabled,
        ]}
        onPress={() => !isDisabled && onPress()}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected, disabled: isDisabled }}
        accessibilityLabel={`${item.dayOfWeek} ${item.dayNumber}${
          isDisabled ? ", no availability" : ""
        }`}
      >
        <Text size="xs" weight="semiBold" color="#6B7280" style={styles.day}>
          {item.dayOfWeek}
        </Text>
        <Text size="2xl" weight="bold" color="#0F172A" style={styles.num}>
          {item.dayNumber}
        </Text>
        <View
          style={[
            styles.dot,
            item.hasAvailability ? styles.dotAvailable : styles.dotUnavailable,
          ]}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Vertical overflow lets the lifted chip's shadow / scale render
  // outside the row's natural box without being clipped by the
  // section above.
  scroll: {
    overflow: "visible",
  },
  row: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 10,
  },
  chip: {
    width: 64,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    gap: 4,
    // Shadow geometry is static; the OPACITY is animated by the
    // Animated.View wrapper so the lift+shadow appear together.
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0,
    shadowRadius: 18,
    elevation: 0,
  },
  chipSelected: {
    backgroundColor: "#BFD8FA",
    borderColor: "rgba(82, 153, 254, 0.55)",
    elevation: 0,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  day: {
    letterSpacing: 0.6,
  },
  num: {
    fontSize: 22,
    lineHeight: 26,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  dotAvailable: {
    backgroundColor: "rgba(15, 23, 42, 0.5)",
  },
  dotUnavailable: {
    backgroundColor: "transparent",
  },
});
