/**
 * ServiceRow
 *
 * PURPOSE: Displays a single service with name, price, and optional remove button
 *          Used in service lists within booking flow
 *
 * USED IN: components/booking/sheets/BookingDetailsContent.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { X } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants
import { BorderRadius } from "@/constants/theme";

// 5. Types
import type { Service } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

export interface ServiceRowProps {
  /** Service to display */
  service: Service;
  /** Called when remove button is pressed */
  onRemove: () => void;
  /** Override price for display (e.g. shop-specific labor + parts); formatted to 2 decimals */
  priceOverride?: number;
  /** Optional extra content rendered below the name/price line, inside the
   *  same row container. Used by Diagnostic Scan to surface the picked area
   *  and customer notes inline with the service. */
  extra?: React.ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceRow({ service, onRemove, priceOverride, extra }: ServiceRowProps) {
  const price = priceOverride !== undefined ? priceOverride : service.price;
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.left}>
          <Text size="md" weight="bold" color={BrandColors.primary}>
            {service.name}
          </Text>
          <Text size="sm" weight="regular" color="#9CA3AF">
            ${Number(price).toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity style={styles.removeButton} onPress={onRemove} activeOpacity={0.7}>
          <X size={18} color={BrandColors.white} />
        </TouchableOpacity>
      </View>
      {extra ? <View style={styles.extraSlot}>{extra}</View> : null}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: {
    flex: 1,
  },
  removeButton: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  extraSlot: {
    marginTop: Spacing.sm,
  },
});
