/**
 * PayOptionButton
 *
 * PURPOSE: Apple Pay / Google Pay button for payment options
 *          Used in payment/checkout flows
 *
 * USED IN: components/booking/sheets/ReviewPayContent.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants
import { BorderRadius } from "@/constants/theme";

// ============================================================================
// TYPES
// ============================================================================

export interface PayOptionButtonProps {
  /** Payment option type */
  type: "apple" | "google";
  /** Called when button is pressed */
  onPress: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PayOptionButton({ type, onPress }: PayOptionButtonProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <Text size="md" weight="semiBold" color={BrandColors.primary}>
        {type === "apple" ? "" : "G"} Pay
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: BrandColors.white,
  },
});

