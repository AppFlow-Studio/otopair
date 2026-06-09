/**
 * TimeSlotGrid — Screen 4 sectioned time picker.
 *
 * Buckets the available slot times into MORNING / AFTERNOON /
 * EVENING by 24-hour start hour. Empty sections are skipped. Each
 * time is a chip; the selected one is filled darker blue.
 *
 * When the parent rekeys the grid (e.g. on date change) the
 * sections + chips fade up in a small stagger — same family of
 * motion as MaintenanceTracker uses when switching cars.
 */

import React, { useMemo } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import { Text } from "@/components/shared-ui";

// Locked 3-per-row grid. Compute chip width from screen width so
// each chip is identical and the row is evenly distributed.
const SCREEN_WIDTH = Dimensions.get("window").width;
const GRID_PAD_H = 20;
const CHIP_GAP = 10;
const COLS = 3;
const CHIP_WIDTH =
  (SCREEN_WIDTH - GRID_PAD_H * 2 - CHIP_GAP * (COLS - 1)) / COLS;

interface TimeSlot {
  /** Display label like "9:00 AM" — used as the chip text. */
  displayTime: string;
  /** 24-hour "HH:MM" used to bucket into morning / afternoon / evening. */
  startTime: string;
}

interface TimeSlotGridProps {
  slots: TimeSlot[];
  selectedTime: string | null;
  onSelect: (displayTime: string) => void;
  /** True while the upstream query is in flight. While true we
   *  render nothing so the "No available times" empty-state
   *  doesn't flash in the brief window between a date change and
   *  the new day's slots arriving from Convex. */
  isLoading?: boolean;
}

interface Bucket {
  label: string;
  slots: TimeSlot[];
}

// Cascade timing — quick + tight so 20-ish chips don't crawl.
const SECTION_GAP_MS = 60;
const CHIP_STEP_MS = 24;
const ENTRY_DURATION_MS = 320;
const LABEL_DURATION_MS = 380;

function bucketSlots(slots: TimeSlot[]): Bucket[] {
  const morning: TimeSlot[] = [];
  const afternoon: TimeSlot[] = [];
  const evening: TimeSlot[] = [];
  for (const s of slots) {
    const hh = parseInt(s.startTime.slice(0, 2), 10);
    if (hh < 12) morning.push(s);
    else if (hh < 17) afternoon.push(s);
    else evening.push(s);
  }
  const out: Bucket[] = [];
  if (morning.length > 0) out.push({ label: "MORNING", slots: morning });
  if (afternoon.length > 0) out.push({ label: "AFTERNOON", slots: afternoon });
  if (evening.length > 0) out.push({ label: "EVENING", slots: evening });
  return out;
}

export function TimeSlotGrid({
  slots,
  selectedTime,
  onSelect,
  isLoading = false,
}: TimeSlotGridProps) {
  const buckets = useMemo(() => bucketSlots(slots), [slots]);

  if (isLoading) {
    // Render an empty placeholder of stable height so the date
    // change doesn't trigger a layout jump while Convex returns
    // the new day's slots.
    return <View style={styles.loadingPlaceholder} />;
  }

  if (slots.length === 0) {
    return (
      <Animated.View
        style={styles.empty}
        entering={FadeInUp.duration(LABEL_DURATION_MS)}
      >
        <Text size="sm" weight="regular" color="#6B7280" center>
          No available times — try a different day.
        </Text>
      </Animated.View>
    );
  }

  return (
    <View style={styles.root}>
      {buckets.map((bucket, sectionIdx) => {
        const sectionDelay = sectionIdx * SECTION_GAP_MS;
        return (
          <View key={bucket.label} style={styles.section}>
            <Animated.View
              entering={FadeInUp.duration(LABEL_DURATION_MS).delay(sectionDelay)}
            >
              <Text size="xs" weight="semiBold" color="#6B7280" style={styles.eyebrow}>
                {bucket.label}
              </Text>
            </Animated.View>
            <View style={styles.grid}>
              {bucket.slots.map((slot, chipIdx) => {
                const isSelected = slot.displayTime === selectedTime;
                const delay = sectionDelay + 80 + chipIdx * CHIP_STEP_MS;
                return (
                  <Animated.View
                    key={slot.displayTime}
                    entering={FadeInUp.duration(ENTRY_DURATION_MS).delay(delay)}
                  >
                    <Pressable
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => onSelect(slot.displayTime)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={slot.displayTime}
                    >
                      <Text
                        size="sm"
                        weight={isSelected ? "bold" : "semiBold"}
                        color={isSelected ? "#FFFFFF" : "#0F172A"}
                      >
                        {slot.displayTime}
                      </Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    gap: 18,
  },
  section: {
    gap: 10,
  },
  eyebrow: {
    letterSpacing: 0.7,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: CHIP_GAP,
    rowGap: CHIP_GAP,
  },
  chip: {
    width: CHIP_WIDTH,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: {
    backgroundColor: "#5299FE",
    borderColor: "#5299FE",
  },
  empty: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  loadingPlaceholder: {
    minHeight: 220,
  },
});
