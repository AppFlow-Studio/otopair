/**
 * TimeSlotGrid — Screen 4 sectioned time picker.
 *
 * Buckets the available slot times into MORNING / AFTERNOON /
 * EVENING by 24-hour start hour. Empty sections are skipped. Each
 * time is a chip; the selected one is filled darker blue.
 */

import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@/components/shared-ui";

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
}

interface Bucket {
  label: string;
  slots: TimeSlot[];
}

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

export function TimeSlotGrid({ slots, selectedTime, onSelect }: TimeSlotGridProps) {
  const buckets = useMemo(() => bucketSlots(slots), [slots]);

  if (slots.length === 0) {
    return (
      <View style={styles.empty}>
        <Text size="sm" weight="regular" color="#6B7280" center>
          No available times — try a different day.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {buckets.map((bucket) => (
        <View key={bucket.label} style={styles.section}>
          <Text size="xs" weight="semiBold" color="#6B7280" style={styles.eyebrow}>
            {bucket.label}
          </Text>
          <View style={styles.grid}>
            {bucket.slots.map((slot) => {
              const isSelected = slot.displayTime === selectedTime;
              return (
                <Pressable
                  key={slot.displayTime}
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
              );
            })}
          </View>
        </View>
      ))}
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
    gap: 10,
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
  },
  chipSelected: {
    backgroundColor: "#5299FE",
    borderColor: "#5299FE",
  },
  empty: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
});
