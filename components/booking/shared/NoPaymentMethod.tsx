/**
 * NoPaymentMethod
 *
 * PURPOSE: Empty state display when no payment method is saved
 *          Shows message and "Add One" button
 *
 * USED IN: components/booking/sheets/ReviewPayContent.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants
import { BorderRadius } from "@/constants/theme";

// ============================================================================
// TYPES
// ============================================================================

export interface NoPaymentMethodProps {
  /** Called when add button is pressed */
  onAddPress: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function NoPaymentMethod({ onAddPress }: NoPaymentMethodProps) {
  return (
    <View style={styles.container}>
      <Text size="md" weight="regular" color="#6B7280">
        No payment method found.
      </Text>
      <TouchableOpacity style={styles.addButton} onPress={onAddPress} activeOpacity={0.7}>
        <Text size="sm" weight="semiBold" color={BrandColors.white}>
          Add One
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  addButton: {
    backgroundColor: BrandColors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
});

