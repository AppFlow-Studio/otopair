import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { BrandColors, BorderRadius, Spacing } from "@/constants/theme";

import { Text } from "./Text";

export interface FixedPriceBadgeProps {
  size?: "sm" | "md";
  label?: string;
  style?: ViewStyle | ViewStyle[];
}

export function FixedPriceBadge({
  size = "sm",
  label = "Fixed price",
  style,
}: FixedPriceBadgeProps) {
  const isSm = size === "sm";
  return (
    <View
      style={[
        styles.base,
        isSm ? styles.sm : styles.md,
        style as ViewStyle,
      ]}
    >
      <Text
        size={isSm ? "xs" : "sm"}
        weight="semiBold"
        color={BrandColors.secondary}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: "#EFF6FF",
    borderRadius: BorderRadius.md,
    alignSelf: "flex-start",
  },
  sm: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  md: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
});
