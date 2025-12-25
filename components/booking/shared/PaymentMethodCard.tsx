/**
 * PaymentMethodCard
 *
 * PURPOSE: Displays a saved payment method with card icon, masked number, and change button
 *          Used in payment/checkout flows
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

// 4. Local components
import { CardIcon } from "./CardIcon";

// 5. Constants, types
import { BorderRadius } from "@/constants/theme";
import type { PaymentMethod } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

export interface PaymentMethodCardProps {
  /** Payment method data */
  paymentMethod: PaymentMethod;
  /** Called when change button is pressed */
  onChangePress: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function PaymentMethodCard({ paymentMethod, onChangePress }: PaymentMethodCardProps) {
  return (
    <View style={styles.container}>
      <CardIcon brand={paymentMethod.brand} />
      <Text size="md" weight="medium" color={BrandColors.primary} style={styles.cardNumber}>
        ****{paymentMethod.last4}
      </Text>
      <TouchableOpacity style={styles.changeButton} onPress={onChangePress} activeOpacity={0.7}>
        <Text size="sm" weight="semiBold" color={BrandColors.white}>
          Change
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
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: BrandColors.secondary,
    marginBottom: Spacing.md,
  },
  cardNumber: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  changeButton: {
    backgroundColor: BrandColors.secondary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
});



