/**
 * MechanicInfoCard
 *
 * PURPOSE: Displays mechanic information including avatar, name, rating,
 *          verified status, services, availability tags, and experience stats
 *
 * USED IN: components/booking/sheets/BookingDetailsContent.tsx
 *
 * PROPS:
 *   - mechanic (Mechanic): The mechanic data to display
 *   - ratingCount (number): Number of ratings for this mechanic
 *
 * EXAMPLE:
 *   <MechanicInfoCard mechanic={mechanic} ratingCount={127} />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { Image, StyleSheet, View } from "react-native";

// 2. Third-party libraries
import { BadgeCheck, Clock, Star, User } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants
import { BorderRadius } from "@/constants/theme";

// 5. Types
import type { Mechanic } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

export interface MechanicInfoCardProps {
  /** The mechanic data to display */
  mechanic: Mechanic;
  /** Number of ratings for this mechanic */
  ratingCount: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MechanicInfoCard({ mechanic, ratingCount }: MechanicInfoCardProps) {
  return (
    <View style={styles.mechanicSection}>
      {/* Avatar and Basic Info */}
      <View style={styles.mechanicHeader}>
        <View style={styles.avatarContainer}>
          {mechanic.photoUrl ? (
            <Image source={{ uri: mechanic.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={32} color="#9CA3AF" strokeWidth={1.5} />
            </View>
          )}
        </View>

        <View style={styles.mechanicInfo}>
          <View style={styles.nameRow}>
            <Text size="lg" weight="bold" color={BrandColors.primary}>
              {mechanic.shopName}
            </Text>
            <View style={styles.ratingBadge}>
              <Star size={16} color={BrandColors.secondary} fill={BrandColors.secondary} />
              <Text size="sm" weight="bold" color={BrandColors.primary}>
                {mechanic.rating.toFixed(1)}
              </Text>
            </View>
          </View>

          <Text size="sm" weight="medium" color="#6B7280" style={{ marginBottom: 2 }}>
            {mechanic.name}
          </Text>

          <View style={styles.distanceRow}>
            <Text size="xs" weight="regular" color="#9CA3AF">
              {mechanic.distanceMi} mi
            </Text>
            {mechanic.isVerified && (
              <View style={styles.verifiedBadge}>
                <BadgeCheck size={18} color="#10B981" />
                <Text size="xs" weight="bold" color="#10B981">
                  Verified
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Services Description */}
      <Text size="sm" weight="regular" color="#6B7280" style={styles.servicesDescription}>
        {mechanic.services.join(", ")}
      </Text>

      {/* Tags Row */}
      <View style={styles.tagsRow}>
        {mechanic.isAvailable && (
          <View style={styles.availableTag}>
            <View style={styles.availableDot} />
            <Text size="xs" weight="medium" color="#374151">
              Available
            </Text>
          </View>
        )}
        <View style={styles.responseTag}>
          <Text size="xs" weight="medium" color="#6B7280">
            Response Time:
          </Text>
          <Text
            size="xs"
            weight="bold"
            color={
              mechanic.responseTime === "Quick" ? "#10B981" : mechanic.responseTime === "Normal" ? "#F59E0B" : "#EF4444"
            }
          >
            {mechanic.responseTime}
          </Text>
        </View>
      </View>

      {/* Experience & Rating Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Clock size={20} color={BrandColors.secondary} />
          </View>
          <View style={styles.statTextContainer}>
            <Text size="xs" weight="bold" color="#6B7280">
              Total Experience
            </Text>
            <Text size="md" weight="bold" color={BrandColors.primary}>
              {mechanic.yearsExperience < 10 ? `0${mechanic.yearsExperience}` : mechanic.yearsExperience}+ Years
            </Text>
          </View>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Star size={20} color={BrandColors.secondary} fill={BrandColors.secondary} />
          </View>
          <View style={styles.statTextContainer}>
            <Text size="xs" weight="bold" color="#6B7280">
              Rating
            </Text>
            <View style={styles.ratingStatRow}>
              <Text size="md" weight="bold" color={BrandColors.primary}>
                {mechanic.rating.toFixed(1)}
              </Text>
              <Text size="sm" weight="regular" color="#6B7280">
                ({ratingCount})
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  mechanicSection: {
    marginBottom: Spacing.lg,
  },
  mechanicHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    marginRight: Spacing.md,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FAFAFA",
  },
  mechanicInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  distanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  servicesDescription: {
    marginTop: Spacing.lg,
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  availableTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  availableDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: "#10B981",
    marginRight: 8,
  },
  responseTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: "#EBF5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  statTextContainer: {
    flex: 1,
    gap: 2,
  },
  ratingStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
