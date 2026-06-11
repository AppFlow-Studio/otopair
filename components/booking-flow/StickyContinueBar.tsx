/**
 * StickyContinueBar — bottom CTA used on Screens 2 and 3 of the
 * booking flow. Dark pill that lives over the safe area showing
 * the current selection count and an arrow to advance.
 *
 * Disabled state (count = 0) renders greyed and ignores taps.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight } from "lucide-react-native";

import { Text } from "@/components/shared-ui";

interface StickyContinueBarProps {
  count: number;
  onPress: () => void;
  /** Override the label text. Defaults to "Continue · N service(s)". */
  label?: string;
}

export function StickyContinueBar({ count, onPress, label }: StickyContinueBarProps) {
  const insets = useSafeAreaInsets();
  const disabled = count === 0;
  const displayLabel =
    label ?? `Continue · ${count} service${count === 1 ? "" : "s"}`;

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, 12) + 8 },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        style={[styles.pill, disabled && styles.pillDisabled]}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={displayLabel}
        accessibilityState={{ disabled }}
      >
        <Text size="md" weight="semiBold" color="#FFFFFF" style={styles.label}>
          {displayLabel}
        </Text>
        <ArrowRight size={20} color="#FFFFFF" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: "#5299FE",
  },
  pillDisabled: {
    backgroundColor: "rgba(82, 153, 254, 0.45)",
  },
  label: {
    flex: 1,
    textAlign: "center",
  },
});
