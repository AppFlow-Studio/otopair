/**
 * StarRating
 *
 * PURPOSE: Displays a row of star icons representing a rating (1-5)
 *          Filled stars for rating, empty for remaining
 *
 * USED IN: components/booking/shared/ReviewCard.tsx, BookingDetailsContent.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { StyleSheet, View } from "react-native";

// 2. Third-party libraries
import { Star } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors } from "@/components/shared-ui";

// ============================================================================
// TYPES
// ============================================================================

export interface StarRatingProps {
  /** Rating value (1-5) */
  rating: number;
  /** Size of each star icon */
  size?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StarRating({ rating, size = 14 }: StarRatingProps) {
  return (
    <View style={styles.container}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          color={star <= rating ? BrandColors.secondary : "#E5E7EB"}
          fill={star <= rating ? BrandColors.secondary : "transparent"}
        />
      ))}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 2,
    marginVertical: 4,
  },
});




