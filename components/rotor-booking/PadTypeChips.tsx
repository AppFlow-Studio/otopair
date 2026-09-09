/**
 * PadTypeChips
 *
 * Step 7 of the Shop Rotors screen (spec section 6). Conditional — only
 * renders when "Include new brake pads?" is Yes. OEM recommended is
 * pre-selected because the system already knows what type came on the
 * car (or falls back to OEM-equivalent when we don't).
 */

import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { Text } from "@/components/shared-ui";
import { PAD_TYPE_OPTIONS, type PadType } from "@/constants/rotorFlow";

interface Props {
  selected: PadType | null;
  onSelect: (next: PadType) => void;
}

export function PadTypeChips({ selected, onSelect }: Props) {
  return (
    <View style={styles.container}>
      <Text size="sm" weight="semiBold" color="#8E8E93" style={styles.label}>
        PAD TYPE
      </Text>
      <View style={styles.chipRow}>
        {PAD_TYPE_OPTIONS.map((opt) => {
          const isSelected = opt.id === selected;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => onSelect(opt.id)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                size="sm"
                weight={isSelected ? "semiBold" : "medium"}
                color={isSelected ? "#5299FE" : "#1A1A1A"}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  label: {
    letterSpacing: 1,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipSelected: {
    backgroundColor: "#F0F6FF",
    borderColor: "#5299FE",
  },
});
