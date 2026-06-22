/**
 * SelectedServicesFab — bottom-right floating action button on Screen 2.
 *
 * Surfaces the current multi-tab service cart at a glance and offers
 * a tap target to open the review sheet. Renders NOTHING when the
 * count is 0 — the FAB only exists once the user has picked at least
 * one service. A small white badge in the top-right corner shows the
 * count in brand navy.
 *
 * Positioning (right + bottom offset) is the parent's job; this
 * component just lays out the circle + icon + badge.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ListChecks } from "lucide-react-native";

import { Text } from "@/components/shared-ui";

const ACCENT = "#5299FE";
const INK = "#0F172A";

interface SelectedServicesFabProps {
  count: number;
  onPress: () => void;
}

export function SelectedServicesFab({ count, onPress }: SelectedServicesFabProps) {
  if (count <= 0) return null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Review ${count} selected service${count === 1 ? "" : "s"}`}
    >
      <ListChecks size={24} color="#FFFFFF" strokeWidth={2} />
      <View style={styles.badge}>
        <Text size="xs" weight="bold" color={INK}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    // Soft drop shadow so the FAB lifts off the sheet behind it.
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    // Tiny border so the badge separates from the blue FAB cleanly.
    borderWidth: 2,
    borderColor: ACCENT,
  },
});
