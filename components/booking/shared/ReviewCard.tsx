/**
 * ReviewCard
 *
 * PURPOSE: Displays a single customer review with avatar, name, rating, and text
 *          Used in review sections of booking flow
 *
 * USED IN: components/booking/sheets/BookingDetailsContent.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { MoreVertical, User } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Local components
import { StarRating } from "./StarRating";

// 5. Constants
import { BorderRadius } from "@/constants/theme";

// ============================================================================
// TYPES
// ============================================================================

export interface Review {
  id: string;
  userName: string;
  avatarUrl: string | null;
  rating: number;
  timeAgo: string;
  text: string;
}

export interface ReviewCardProps {
  /** Review data to display */
  review: Review;
  /** Called when menu button is pressed (optional) */
  onMenuPress?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ReviewCard({ review, onMenuPress }: ReviewCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {review.avatarUrl ? (
            <Image source={{ uri: review.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={20} color="#9CA3AF" strokeWidth={1.5} />
            </View>
          )}
        </View>
        <View style={styles.headerInfo}>
          <Text size="sm" weight="bold" color={BrandColors.primary}>
            {review.userName}
          </Text>
          <View style={styles.ratingRow}>
            <StarRating rating={review.rating} size={12} />
            <Text size="xs" weight="regular" color="#9CA3AF">
              {review.timeAgo}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.menuButton} activeOpacity={0.7} onPress={onMenuPress}>
          <MoreVertical size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
      <Text size="sm" weight="regular" color="#6B7280" style={styles.text}>
        {review.text}
      </Text>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  avatarContainer: {
    marginRight: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 2,
  },
  menuButton: {
    padding: 4,
  },
  text: {
    lineHeight: 20,
  },
});



