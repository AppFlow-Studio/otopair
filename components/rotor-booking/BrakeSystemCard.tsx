/**
 * BrakeSystemCard
 *
 * Step 3 of the Shop Rotors screen (spec section 6). "According to our
 * records, your YYYY Make Model has: …" radio card. Pre-selects from OEM
 * data; user can override. The pre-selection is a trust moment — the app
 * is telling the customer it knows their car.
 */

import { Info } from "lucide-react-native";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { Text } from "@/components/shared-ui";
import {
  BRAKE_SYSTEM_OPTIONS,
  type BrakeSystemType,
} from "@/constants/rotorFlow";

interface Props {
  vehicleLabel: string;
  selected: BrakeSystemType | null;
  onSelect: (next: BrakeSystemType) => void;
}

export function BrakeSystemCard({ vehicleLabel, selected, onSelect }: Props) {
  return (
    <View style={styles.card}>
      <Text size="sm" weight="regular" color="#6B7280" style={styles.preamble}>
        According to our records, your {vehicleLabel} has:
      </Text>

      <View style={styles.options}>
        {BRAKE_SYSTEM_OPTIONS.map((opt) => {
          const isSelected = opt.id === selected;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.row, isSelected && styles.rowSelected]}
              onPress={() => onSelect(opt.id)}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={opt.label}
            >
              <Text
                size="md"
                weight={isSelected ? "semiBold" : "medium"}
                color={isSelected ? "#5299FE" : "#1A1A1A"}
              >
                {opt.label}
              </Text>
              <View style={[styles.radio, isSelected && styles.radioActive]}>
                {isSelected ? <View style={styles.radioInner} /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.caption}>
        <Info size={12} color="#9CA3AF" />
        <Text size="xs" weight="regular" color="#8E8E93">
          This determines the correct rotor spec for your vehicle
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F5F7FA",
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  preamble: {
    fontStyle: "italic",
  },
  options: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  rowSelected: {
    backgroundColor: "#F0F6FF",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#C7C7CC",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: "#5299FE",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#5299FE",
  },
  caption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
});
