/**
 * ConfirmBookingBar — Screen 4 sticky CTA.
 *
 * Dark pill with "Confirm booking" left + the chosen
 * "<Day>, <Month> <Date> · <Time>" right (or a "Pick a date & time"
 * placeholder when nothing's selected). → arrow at the far right.
 * Below the pill: muted cancellation caption.
 */

import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowRight } from "lucide-react-native";

import { Text } from "@/components/shared-ui";

interface ConfirmBookingBarProps {
  /** Display string like "Mon, June 9 · 9:00 AM"; null when nothing picked. */
  selectionLabel: string | null;
  isLoading?: boolean;
  onPress: () => void;
}

export function ConfirmBookingBar({
  selectionLabel,
  isLoading = false,
  onPress,
}: ConfirmBookingBarProps) {
  const insets = useSafeAreaInsets();
  const disabled = selectionLabel === null || isLoading;

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, 12) + 6 },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        style={[styles.pill, disabled && styles.pillDisabled]}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={
          selectionLabel ? `Confirm booking ${selectionLabel}` : "Pick a date and time first"
        }
        accessibilityState={{ disabled }}
      >
        <View style={styles.pillBody}>
          <Text size="md" weight="bold" color="#FFFFFF">
            Confirm booking
          </Text>
          <Text size="sm" weight="medium" color="rgba(255, 255, 255, 0.85)" style={styles.selection}>
            {selectionLabel ?? "Pick a date & time"}
          </Text>
        </View>
        {isLoading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <ArrowRight size={20} color="#FFFFFF" strokeWidth={2} />
        )}
      </Pressable>
      <Text size="xs" weight="regular" color="#6B7280" style={styles.caption} center>
        Free cancellation up to 2 hours before your appointment
      </Text>
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
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 22,
    backgroundColor: "#5299FE",
  },
  pillDisabled: {
    backgroundColor: "rgba(82, 153, 254, 0.45)",
  },
  pillBody: {
    flex: 1,
    gap: 2,
  },
  selection: {
    marginTop: 2,
  },
  caption: {
    marginTop: 8,
  },
});
