/**
 * RatingSummaryCard
 *
 * PURPOSE: Displays a rating summary with distribution bars on the left
 *          and overall rating with stars on the right
 *
 * USED IN: components/booking/sheets/BookingDetailsContent.tsx
 *
 * PROPS:
 *   - rating (number): Overall rating value (e.g., 4.8)
 *   - ratingCount (number): Total number of reviews
 *   - distribution (Record<1|2|3|4|5, number>): Percentage distribution for each star level
 *
 * EXAMPLE:
 *   <RatingSummaryCard
 *     rating={4.8}
 *     ratingCount={127}
 *     distribution={{ 5: 75, 4: 15, 3: 5, 2: 3, 1: 2 }}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { StyleSheet, View } from "react-native";

// 2. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 3. Local components
import { RatingBar } from "./RatingBar";
import { StarRating } from "./StarRating";

// 4. Constants
import { BorderRadius } from "@/constants/theme";

// ============================================================================
// TYPES
// ============================================================================

export type RatingDistribution = Record<1 | 2 | 3 | 4 | 5, number>;

export interface RatingSummaryCardProps {
  /** Overall rating value (e.g., 4.8) */
  rating: number;
  /** Total number of reviews */
  ratingCount: number;
  /** Percentage distribution for each star level */
  distribution: RatingDistribution;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RatingSummaryCard({ rating, ratingCount, distribution }: RatingSummaryCardProps) {
  return (
    <View style={styles.ratingSummaryCard}>
      {/* Rating Distribution Bars */}
      <View style={styles.ratingDistributionContainer}>
        {[5, 4, 3, 2, 1].map((stars) => (
          <RatingBar
            key={stars}
            stars={stars}
            percentage={distribution[stars as keyof RatingDistribution]}
          />
        ))}
      </View>

      {/* Overall Rating */}
      <View style={styles.overallRatingContainer}>
        <Text size="3xl" weight="bold" color={BrandColors.primary}>
          {rating.toFixed(1)}
        </Text>
        <StarRating rating={Math.round(rating)} size={16} />
        <Text size="xs" weight="regular" color="#9CA3AF">
          {ratingCount} Reviews
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  ratingSummaryCard: {
    flexDirection: "row",
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  ratingDistributionContainer: {
    flex: 1,
    gap: 4,
  },
  overallRatingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: Spacing.lg,
    minWidth: 80,
  },
});




