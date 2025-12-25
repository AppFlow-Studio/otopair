/**
 * RatingBar
 *
 * PURPOSE: Displays a single rating distribution bar (e.g., "5 ★ [████░░░░]")
 *          Used in rating summary sections
 *
 * USED IN: components/booking/sheets/BookingDetailsContent.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { StyleSheet, View } from "react-native";

// 2. Third-party libraries
import { Star } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Text } from "@/components/shared-ui";

// 4. Constants
import { BorderRadius } from "@/constants/theme";

// ============================================================================
// TYPES
// ============================================================================

export interface RatingBarProps {
  /** Number of stars (1-5) */
  stars: number;
  /** Percentage filled (0-1) */
  percentage: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RatingBar({ stars, percentage }: RatingBarProps) {
  return (
    <View style={styles.container}>
      <Text size="xs" weight="medium" color="#6B7280" style={styles.label}>
        {stars}
      </Text>
      <Star size={10} color={BrandColors.secondary} fill={BrandColors.secondary} />
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percentage * 100}%` }]} />
      </View>
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
    gap: 4,
  },
  label: {
    width: 12,
    textAlign: "right",
  },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: BrandColors.secondary,
    borderRadius: BorderRadius.full,
  },
});



