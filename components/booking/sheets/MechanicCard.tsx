/**
 * MechanicCard
 *
 * PURPOSE: Displays a detailed mechanic/shop card with availability, services, and booking options
 *
 * USED IN: components/booking/sheets/MechanicSelectionContent.tsx
 *
 * PROPS:
 *   - mechanic (MechanicData): The mechanic/shop data to display
 *   - onBookNow ((mechanicId: number) => void): Called when "Book Now" is pressed [optional]
 *   - onScheduleLater ((mechanicId: number) => void): Called when "Schedule For Later" is pressed [optional]
 *
 * EXAMPLE:
 *   <MechanicCard
 *     mechanic={mechanicData}
 *     onBookNow={handleBookNow}
 *     onScheduleLater={handleScheduleLater}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BadgeCheck, MapPin, Star, User } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { BorderRadius, Shadows } from "@/constants/theme";

// ============================================================================
// TYPES
// ============================================================================

export interface MechanicData {
  id: number;
  name: string;
  shopName: string;
  photoUrl: string | null;
  rating: number;
  isVerified: boolean;
  distanceMi: number;
  services: string[];
  isAvailable: boolean;
  responseTime: "Quick" | "Normal" | "Slow";
  nextAvailability: {
    day: string;
    dayOfWeek: string;
    time: string;
  }[];
}

interface MechanicCardProps {
  /** The mechanic data to display */
  mechanic: MechanicData;
  /** Called when "Book Now" is pressed */
  onBookNow?: (mechanicId: number) => void;
  /** Called when "Schedule For Later" is pressed */
  onScheduleLater?: (mechanicId: number) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MechanicCard({ mechanic, onBookNow, onScheduleLater }: MechanicCardProps) {
  return (
    <View style={styles.container}>
      {/* Header: Avatar, Name, Rating */}
      <View style={styles.header}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {mechanic.photoUrl ? (
            <Image source={{ uri: mechanic.photoUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={28} color={BrandColors.white} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <Text size="md" weight="bold" color={BrandColors.primary}>
              {mechanic.shopName}
            </Text>
          </View>
          <View style={styles.subInfoRow}>
            <Text size="sm" weight="medium" color="#6B7280">
              {mechanic.name}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <MapPin size={12} color="#9CA3AF" />
            <Text size="xs" weight="regular" color="#9CA3AF" style={styles.distanceText}>
              {mechanic.distanceMi} mi
            </Text>
          </View>
        </View>

        {/* Rating & Verified */}
        <View style={styles.ratingContainer}>
          <View style={styles.ratingBadge}>
            <Star size={12} color="#FBBF24" fill="#FBBF24" />
            <Text size="sm" weight="bold" color={BrandColors.primary}>
              {mechanic.rating.toFixed(1)}
            </Text>
          </View>
          {mechanic.isVerified && (
            <View style={styles.verifiedBadge}>
              <BadgeCheck size={12} color="#10B981" />
              <Text size="xs" weight="medium" color="#10B981">
                Verified
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Services */}
      <Text size="sm" weight="regular" color="#6B7280" style={styles.servicesText} numberOfLines={2}>
        {mechanic.services.join(", ")}
      </Text>

      {/* Tags */}
      <View style={styles.tagsRow}>
        {mechanic.isAvailable && (
          <View style={styles.availableTag}>
            <View style={styles.availableDot} />
            <Text size="xs" weight="medium" color="#10B981">
              Available
            </Text>
          </View>
        )}
        <View style={styles.responseTag}>
          <Text size="xs" weight="medium" color="#6B7280">
            Response Time:{" "}
          </Text>
          <Text
            size="xs"
            weight="semiBold"
            color={
              mechanic.responseTime === "Quick" ? "#10B981" : mechanic.responseTime === "Normal" ? "#F59E0B" : "#EF4444"
            }
          >
            {mechanic.responseTime}
          </Text>
        </View>
      </View>

      {/* Next Availability */}
      <View style={styles.availabilitySection}>
        <Text size="sm" weight="semiBold" color={BrandColors.primary} style={styles.availabilityTitle}>
          Next Availability
        </Text>
        <View style={styles.availabilitySlots}>
          {mechanic.nextAvailability.map((slot, index) => (
            <View key={index} style={[styles.availabilitySlot, index === 0 && styles.selectedSlot]}>
              <Text size="xs" weight="medium" color={index === 0 ? BrandColors.primary : "#6B7280"}>
                {slot.dayOfWeek}
              </Text>
              <Text size="lg" weight="bold" color={index === 0 ? BrandColors.primary : "#374151"}>
                {slot.day}
              </Text>
              <Text size="xs" weight="medium" color={index === 0 ? BrandColors.primary : "#6B7280"}>
                {slot.time}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.scheduleButton}
          onPress={() => onScheduleLater?.(mechanic.id)}
          activeOpacity={0.7}
        >
          <Text size="sm" weight="semiBold" color={BrandColors.primary}>
            Schedule For Later
          </Text>
        </TouchableOpacity>
        <PrimaryButton style={styles.bookButton} onPress={() => onBookNow?.(mechanic.id)}>
          <Text size="sm" weight="semiBold" color={BrandColors.white}>
            Book Now
          </Text>
        </PrimaryButton>
      </View>
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
    marginBottom: Spacing.md,
    ...Shadows.md,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatarContainer: {
    marginRight: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subInfoRow: {
    marginTop: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  distanceText: {
    marginLeft: 4,
  },
  ratingContainer: {
    alignItems: "flex-end",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  servicesText: {
    marginTop: Spacing.md,
    lineHeight: 18,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  availableTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: "#10B981",
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: "#10B981",
    marginRight: 6,
  },
  responseTag: {
    flexDirection: "row",
    alignItems: "center",
  },
  availabilitySection: {
    marginTop: Spacing.lg,
  },
  availabilityTitle: {
    marginBottom: Spacing.sm,
  },
  availabilitySlots: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  availabilitySlot: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  selectedSlot: {
    backgroundColor: "#F0F7FF",
    borderColor: BrandColors.secondary,
  },
  actionButtons: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  scheduleButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: BrandColors.primary,
    backgroundColor: BrandColors.white,
  },
  bookButton: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
});
