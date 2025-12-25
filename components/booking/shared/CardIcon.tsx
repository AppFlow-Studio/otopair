/**
 * CardIcon
 *
 * PURPOSE: Displays payment card brand icons (Mastercard, Visa, Amex, generic)
 *          Used in payment method displays
 *
 * USED IN: components/booking/shared/PaymentMethodCard.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { StyleSheet, View } from "react-native";

// 2. Third-party libraries
import { CreditCard } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Text } from "@/components/shared-ui";

// 4. Constants
import { BorderRadius } from "@/constants/theme";

// 5. Types
import type { PaymentMethod } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

export interface CardIconProps {
  /** Payment card brand */
  brand: PaymentMethod["brand"];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CardIcon({ brand }: CardIconProps) {
  // Mastercard colors
  if (brand === "mastercard") {
    return (
      <View style={styles.mastercardIcon}>
        <View style={[styles.mastercardCircle, styles.mastercardRed]} />
        <View style={[styles.mastercardCircle, styles.mastercardYellow]} />
      </View>
    );
  }

  // Visa
  if (brand === "visa") {
    return (
      <View style={styles.visaIcon}>
        <Text size="sm" weight="bold" color="#1A1F71">
          VISA
        </Text>
      </View>
    );
  }

  // American Express
  if (brand === "amex") {
    return (
      <View style={styles.amexIcon}>
        <Text size="xs" weight="bold" color={BrandColors.white}>
          AMEX
        </Text>
      </View>
    );
  }

  // Fallback generic card
  return (
    <View style={styles.genericCardIcon}>
      <CreditCard size={24} color={BrandColors.primary} />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  mastercardIcon: {
    width: 40,
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  mastercardCircle: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
  },
  mastercardRed: {
    backgroundColor: "#EB001B",
    marginRight: -8,
    zIndex: 1,
  },
  mastercardYellow: {
    backgroundColor: "#F79E1B",
  },
  visaIcon: {
    width: 40,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.sm,
  },
  amexIcon: {
    width: 40,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#006FCF",
    borderRadius: BorderRadius.sm,
  },
  genericCardIcon: {
    width: 40,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});


