/**
 * CollapsedContent
 *
 * PURPOSE: Displays the collapsed state of the booking bottom sheet
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * OWNER: Waleed Mansour
 */

import React from "react";
import { StyleSheet, View } from "react-native";

import { BrandColors, Spacing, Text } from "@/components/shared-ui";
import type { BookingStage } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

interface CollapsedContentProps {
  /** Current booking stage to determine the message */
  bookingStage?: BookingStage;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CollapsedContent({ bookingStage = "discovery" }: CollapsedContentProps) {
  // Show "service list" message for initial stages (discovery, service_selection)
  // Show "continue booking" for later stages (mechanic_selection, payment, confirmation)
  const isInitialStage = bookingStage === "discovery" || bookingStage === "service_selection";
  const message = isInitialStage ? "Swipe up for service list" : "Swipe up to continue booking";

  return (
    <View style={styles.container}>
      <Text size="lg" weight="medium" color={BrandColors.primary} center>
        {message}
      </Text>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
});








