import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { Text } from "./Text";

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: View["props"]["style"];
}

export function Chip({ label, selected, onPress, disabled, style }: ChipProps) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        selected ? styles.chipSelected : styles.chipUnselected,
        disabled && styles.chipDisabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <Text size="sm" weight="medium" color="#1A1A1A">
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  chipUnselected: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  chipSelected: {
    borderWidth: 1.5,
    borderColor: "#5299FE",
    backgroundColor: "rgba(82,153,254,0.04)",
  },
  chipDisabled: {
    opacity: 0.4,
  },
});
