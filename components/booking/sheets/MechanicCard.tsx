/**
 * MechanicCard
 *
 * @deprecated This component has been replaced by ShopCard which uses a shop-centric design
 *             with mechanic avatars. Use ShopCard from ./ShopCard instead.
 *
 * PURPOSE: Displays a detailed mechanic/shop card with availability, services, and booking options
 *
 * USED IN: DEPRECATED - Was used in components/booking/sheets/MechanicSelectionContent.tsx
 *          Now replaced by ShopCard in the same file.
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
 * TICKET: OTO-142
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
import { formatDistanceMiles } from "@/utils/geo";
import type { Mechanic } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

interface MechanicCardProps {
  /** The mechanic data to display */
  mechanic: Mechanic;
  /** Called when "Book Now" is pressed with a selected slot */
  onBookNow?: (mechanicId: string, slot: { day: string; dayOfWeek: string; time: string }) => void;
  /** Called when "Schedule For Later" is pressed (navigates to mechanic detail page) */
  onScheduleLater?: (mechanicId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const MechanicCard = memo(function MechanicCard({ mechanic, onBookNow, onScheduleLater }: MechanicCardProps) {
  // Track which availability slot is selected (null = none selected)
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  // Check if a slot is selected
  const hasSelectedSlot = selectedSlotIndex !== null;
  const selectedSlot = hasSelectedSlot ? mechanic.nextAvailability[selectedSlotIndex] : null;

  // Memoize handlers to prevent re-renders
  const handleBookNow = useCallback(() => {
    if (selectedSlot) {
      onBookNow?.(mechanic.id, selectedSlot);
    }
  }, [onBookNow, mechanic.id, selectedSlot]);

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
              <User size={32} color="#9CA3AF" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <Text size="lg" weight="bold" color={BrandColors.primary}>
              {mechanic.name}
            </Text>
            <View style={styles.ratingBadge}>
              <Star size={16} color={BrandColors.secondary} fill={BrandColors.secondary} />
              <Text size="sm" weight="bold" color={BrandColors.primary}>
                {mechanic.rating.toFixed(1)}
              </Text>
            </View>
          </View>

          <Text size="sm" weight="medium" color="#6B7280" style={{ marginBottom: 2 }}>
            {mechanic.shopName}
          </Text>

          <View style={styles.detailsRow}>
            <Text size="xs" weight="regular" color="#9CA3AF">
              {formatDistanceMiles(mechanic.distanceMi)}
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
      <Text size="sm" weight="regular" color="#6B7280" style={styles.servicesText} numberOfLines={2}>
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

      {/* Next Availability */}
      <View style={styles.availabilitySection}>
        <Text size="sm" weight="bold" color={BrandColors.primary} style={styles.availabilityTitle}>
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
        <PrimaryButton
          style={[styles.bookButton, !hasSelectedSlot && styles.bookButtonDisabled]}
          onPress={handleBookNow}
          disabled={!hasSelectedSlot}
        >
          <Text size="sm" weight="semiBold" color={hasSelectedSlot ? BrandColors.white : "#9CA3AF"}>
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
    backgroundColor: BrandColors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  infoContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
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
  },
  servicesText: {
    marginTop: Spacing.lg,
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
    backgroundColor: BrandColors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  availabilitySection: {
    marginTop: Spacing.xl,
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
    marginTop: Spacing.xl,
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
  bookButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
});
