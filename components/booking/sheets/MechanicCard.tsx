/**
 * MechanicCard
 *
 * PURPOSE: Displays a detailed mechanic/shop card with availability, services, and booking options
 *
 * USED IN: components/booking/sheets/MechanicSelectionContent.tsx
 *
 * PROPS:
 *   - mechanic (Mechanic): The mechanic/shop data to display
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
import React, { memo, useCallback, useState } from "react";
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BadgeCheck, Star, User } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, PrimaryButton, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { BorderRadius } from "@/constants/theme";
import type { Mechanic } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

interface MechanicCardProps {
  /** The mechanic data to display */
  mechanic: Mechanic;
  /** Called when "Book Now" is pressed */
  onBookNow?: (mechanicId: number) => void;
  /** Called when "Schedule For Later" is pressed */
  onScheduleLater?: (mechanicId: number) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const MechanicCard = memo(function MechanicCard({ mechanic, onBookNow, onScheduleLater }: MechanicCardProps) {
  // Track which availability slot is selected (null = none selected)
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  // Memoize handlers to prevent re-renders
  const handleBookNow = useCallback(() => {
    onBookNow?.(mechanic.id);
  }, [onBookNow, mechanic.id]);

  const handleScheduleLater = useCallback(() => {
    onScheduleLater?.(mechanic.id);
  }, [onScheduleLater, mechanic.id]);

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
              <User size={24} color="#6B7280" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <Text size="md" weight="bold" color={BrandColors.primary}>
            {mechanic.shopName}
          </Text>
          <Text size="sm" weight="medium" color="#6B7280">
            {mechanic.name}
          </Text>
          <Text size="xs" weight="regular" color="#9CA3AF">
            {mechanic.distanceMi} mi
          </Text>
        </View>

        {/* Rating & Verified */}
        <View style={styles.ratingContainer}>
          <View style={styles.ratingBadge}>
            <Star size={14} color={BrandColors.secondary} fill={BrandColors.secondary} />
            <Text size="sm" weight="bold" color={BrandColors.primary}>
              {mechanic.rating.toFixed(1)}
            </Text>
          </View>
          {mechanic.isVerified && (
            <View style={styles.verifiedBadge}>
              <BadgeCheck size={14} color="#10B981" />
              <Text size="xs" weight="semiBold" color="#10B981">
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.availabilitySlotsContent}
        >
          {mechanic.nextAvailability.map((slot, index) => {
            const isSelected = index === selectedSlotIndex;
            return (
              <TouchableOpacity
                key={index}
                style={[styles.availabilitySlot, isSelected && styles.selectedSlot]}
                onPress={() => setSelectedSlotIndex(index)}
                activeOpacity={0.7}
              >
                <Text size="xs" weight="medium" color={isSelected ? BrandColors.primary : "#6B7280"}>
                  {slot.dayOfWeek}
                </Text>
                <Text size="lg" weight="bold" color={isSelected ? BrandColors.primary : "#374151"}>
                  {slot.day}
                </Text>
                <Text size="xs" weight="medium" color={isSelected ? BrandColors.primary : "#6B7280"}>
                  {slot.time}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.scheduleButton} onPress={handleScheduleLater} activeOpacity={0.7}>
          <Text size="sm" weight="semiBold" color={BrandColors.primary}>
            Schedule For Later
          </Text>
        </TouchableOpacity>
        <PrimaryButton style={styles.bookButton} onPress={handleBookNow}>
          <Text size="sm" weight="semiBold" color={BrandColors.white}>
            Book Now
          </Text>
        </PrimaryButton>
      </View>
    </View>
  );
});

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F2F4F7",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatarContainer: {
    marginRight: Spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  infoContainer: {
    flex: 1,
    gap: 2,
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
    marginTop: Spacing.sm,
    lineHeight: 18,
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
    backgroundColor: BrandColors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  availableDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: "#10B981",
    marginRight: 6,
  },
  responseTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BrandColors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  availabilitySection: {
    marginTop: Spacing.lg,
  },
  availabilityTitle: {
    marginBottom: Spacing.md,
  },
  availabilitySlotsContent: {
    gap: Spacing.sm,
  },
  availabilitySlot: {
    width: 80,
    alignItems: "center",
    paddingVertical: Spacing.md,
    backgroundColor: BrandColors.white,
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
    gap: Spacing.sm,
  },
  scheduleButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#E4E7EC",
  },
  bookButton: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
});
