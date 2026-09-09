/**
 * IncludePadsRow
 *
 * Step 6 of the Shop Rotors screen (spec section 6). "Include new brake
 * pads?" Yes/No segmented control. Default Yes — spec rationale: most
 * shops recommend replacing pads when doing rotors.
 */

import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

import { Text } from "@/components/shared-ui";

interface Props {
  value: boolean;
  onChange: (next: boolean) => void;
}

export function IncludePadsRow({ value, onChange }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <Text size="md" weight="semiBold" color="#1A1A1A">
          Include new brake pads?
        </Text>
        <Text size="xs" weight="regular" color="#8E8E93" style={styles.subtext}>
          Recommended when replacing rotors
        </Text>
      </View>

      <View style={styles.segmented}>
        <Segment label="Yes" active={value} onPress={() => onChange(true)} />
        <Segment label="No" active={!value} onPress={() => onChange(false)} />
      </View>
    </View>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.segment, active && styles.segmentActive]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text
        size="sm"
        weight={active ? "semiBold" : "medium"}
        color={active ? "#FFFFFF" : "#1A1A1A"}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  copy: {
    flex: 1,
  },
  subtext: {
    marginTop: 2,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    padding: 3,
  },
  segment: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    backgroundColor: "#5299FE",
  },
});
