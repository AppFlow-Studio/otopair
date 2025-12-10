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

// ============================================================================
// COMPONENT
// ============================================================================

export function CollapsedContent() {
  return (
    <View style={styles.container}>
      <Text size="lg" weight="medium" color={BrandColors.primary} center>
        Swipe up for service list
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


