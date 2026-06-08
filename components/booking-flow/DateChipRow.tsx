/**
 * DateChipRow — Screen 4 horizontal day picker.
 *
 * Each chip shows the day-of-week (caps) + date number + a small
 * availability dot. The selected chip is bigger + darker blue with
 * a white dot. Days without availability render greyed.
 */

import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/shared-ui";

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
    >
      {items.map((item) => {
        const isSelected = item.isoDate === selectedIsoDate;
        const isDisabled = !item.hasAvailability;
        return (
          <Pressable
            key={item.isoDate}
            style={[
              styles.chip,
              isSelected && styles.chipSelected,
              isDisabled && !isSelected && styles.chipDisabled,
            ]}
            onPress={() => !isDisabled && onSelect(item.isoDate)}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled: isDisabled }}
            accessibilityLabel={`${item.dayOfWeek} ${item.dayNumber}${
              isDisabled ? ", no availability" : ""
            }`}
          >
            <Text
              size="xs"
              weight="semiBold"
              color="#6B7280"
              style={styles.day}
            >
              {item.dayOfWeek}
            </Text>
            <Text
              size="2xl"
              weight="bold"
              color="#0F172A"
              style={styles.num}
            >
              {item.dayNumber}
            </Text>
            <View
              style={[
                styles.dot,
                item.hasAvailability ? styles.dotAvailable : styles.dotUnavailable,
              ]}
            />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    paddingVertical: 14,
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
  },
  chipSelected: {
    backgroundColor: "rgba(82, 153, 254, 0.22)",
    borderColor: "rgba(82, 153, 254, 0.55)",
    transform: [{ translateY: -10 }, { scale: 1.14 }],
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 12,
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
