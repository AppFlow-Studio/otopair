import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { BorderRadius, Spacing } from "@/constants/theme";

import { Text } from "./Text";

export interface EstimatePillProps {
  size?: "sm" | "md";
  label?: string;
  style?: ViewStyle | ViewStyle[];
}

/**
 * Soft amber pill rendered next to the disclosed price range when the
 * Pricing v2 quote engine flags one or more services as estimate-grade
 * (tier_estimate, fallback_only, price_outside_fallback_band, missing
 * vehicle-specific labor row, missing real parts data). Signals to the
 * customer that the displayed band is interpolated and the mechanic will
 * confirm the final amount at the appointment.
 */
export function EstimatePill({
  size = "sm",
  label = "Estimate",
  style,
}: EstimatePillProps) {
  const isSm = size === "sm";
  return (
    <View
      style={[styles.base, isSm ? styles.sm : styles.md, style as ViewStyle]}
    >
      <Text size={isSm ? "xs" : "sm"} weight="semiBold" color="#92400E">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: "#FEF3C7",
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
