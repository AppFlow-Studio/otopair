/**
 * SettingsRow
 *
 * PURPOSE: Single row inside a SettingsCard. Renders a circular icon
 *          bubble on the left, a label, an optional right-aligned value,
 *          a chevron, and a hairline separator (unless `isLast`).
 *
 *          Designed for the dark Revolut-style Settings surface — the
 *          icon bubble is a white circle so lucide icons render cleanly
 *          on the navy background.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx (every menu row)
 *
 * OWNER: Ahmad Hamoudeh
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { Text } from "@/components/shared-ui";

interface SettingsRowProps {
  /** Lucide icon (or any node) rendered inside the white circle. */
  icon: React.ReactNode;
  label: string;
  /** Override the label color (e.g. red for Delete Account). */
  labelColor?: string;
  /** Right-aligned secondary text (counts, status, etc.). */
  value?: string | number;
  onPress: () => void;
  /** Skip the bottom hairline separator on the last row of a card. */
  isLast?: boolean;
  /** Override the icon-bubble background. Defaults to translucent white. */
  iconBg?: string;
}

export function SettingsRow({
  icon,
  label,
  labelColor = "#FFFFFF",
  value,
  onPress,
  isLast = false,
  iconBg = "rgba(255,255,255,0.95)",
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.iconBubble, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <Text
        weight="medium"
        size="md"
        color={labelColor}
        style={styles.label}
        numberOfLines={1}
      >
        {label}
      </Text>
      {value != null && value !== "" ? (
        <Text
          weight="regular"
          size="sm"
          color="rgba(255,255,255,0.55)"
          style={styles.value}
        >
          {value}
        </Text>
      ) : null}
      <ChevronRight size={18} color="rgba(255,255,255,0.4)" />
      {!isLast ? <View style={styles.separator} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: {
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  label: {
    flex: 1,
  },
  value: {
    marginRight: 8,
  },
  separator: {
    position: "absolute",
    left: 62,
    right: 16,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
});

export default SettingsRow;
