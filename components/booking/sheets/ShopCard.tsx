/**
 * ShopCard
 *
 * PURPOSE: Displays a shop card with mechanic avatar selector, availability slots, and shop details button
 *
 * USED IN: components/booking/sheets/MechanicSelectionContent.tsx
 *
 * PROPS:
 *   - shop (ShopWithMechanics): The shop data with mechanics to display
 *   - onSelectSlot: Called when a time slot is selected
 *   - onShopDetails: Called when "Shop Details" is pressed
 *   - onMoreAvailability: Called when "More" button is pressed
 *   - selectedSlot: Currently selected slot (for highlighting)
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { memo, useCallback, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BadgeCheck, Calendar, ChevronRight, Star, User } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { BorderRadius } from "@/constants/theme";
import type { Mechanic, MechanicAvailabilitySlot } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

/** Shop with grouped mechanics data */
export interface ShopWithMechanics {
  shopId: number;
  shopName: string;
  rating: number;
  isVerified: boolean;
  distanceMi: number;
  mechanics: Mechanic[];
}

/** Selected slot information */
export interface SelectedSlotInfo {
  shopId: number;
  mechanicId: number | null; // null means "Any"
  slot: MechanicAvailabilitySlot;
}

interface ShopCardProps {
  /** The shop data with mechanics to display */
  shop: ShopWithMechanics;
  /** Called when a time slot is selected */
  onSelectSlot: (shopId: number, mechanicId: number | null, slot: MechanicAvailabilitySlot) => void;
  /** Called when "Shop Details" is pressed */
  onShopDetails: (shopId: number) => void;
  /** Called when "More" button is pressed to see full calendar */
  onMoreAvailability: (shopId: number, mechanicId: number | null) => void;
  /** Currently selected slot (for highlighting) */
  selectedSlot: SelectedSlotInfo | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_VISIBLE_SLOTS = 3;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Combines and sorts availability slots from all mechanics, returning earliest unique slots
 * Deduplicates slots with the same day/time, keeping the first mechanic's slot
 */
function getEarliestAvailability(mechanics: Mechanic[], limit: number): Array<MechanicAvailabilitySlot & { mechanicId: number }> {
  const allSlots: Array<MechanicAvailabilitySlot & { mechanicId: number }> = [];
  
  mechanics.forEach((mechanic) => {
    mechanic.nextAvailability.forEach((slot) => {
      allSlots.push({ ...slot, mechanicId: mechanic.id });
    });
  });

  // Sort by day (numeric) then time
  allSlots.sort((a, b) => {
    const dayA = parseInt(a.day, 10);
    const dayB = parseInt(b.day, 10);
    if (dayA !== dayB) return dayA - dayB;
    
    // Parse time for comparison (e.g., "9:00 AM" vs "2:00 PM")
    const timeA = parseTime(a.time);
    const timeB = parseTime(b.time);
    return timeA - timeB;
  });

  // Deduplicate slots with the same day and time
  // Keep the first occurrence (first mechanic that has this slot)
  const seen = new Set<string>();
  const uniqueSlots: Array<MechanicAvailabilitySlot & { mechanicId: number }> = [];
  
  for (const slot of allSlots) {
    const key = `${slot.dayOfWeek}-${slot.day}-${slot.time}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueSlots.push(slot);
    }
  }

  return uniqueSlots.slice(0, limit);
}

/**
 * Parse time string to minutes for comparison
 */
function parseTime(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const isPM = match[3].toUpperCase() === "PM";
  
  if (isPM && hours !== 12) hours += 12;
  if (!isPM && hours === 12) hours = 0;
  
  return hours * 60 + minutes;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const ShopCard = memo(function ShopCard({
  shop,
  onSelectSlot,
  onShopDetails,
  onMoreAvailability,
  selectedSlot,
}: ShopCardProps) {
  // Track which mechanic is selected (null = "Any")
  const [selectedMechanicId, setSelectedMechanicId] = useState<number | null>(null);

  // Get availability slots based on selected mechanic
  const displayedSlots = useMemo(() => {
    if (selectedMechanicId === null) {
      // "Any" selected - combine and sort all mechanics' slots
      return getEarliestAvailability(shop.mechanics, MAX_VISIBLE_SLOTS + 4); // Get extra for "More"
    } else {
      // Specific mechanic selected
      const mechanic = shop.mechanics.find((m) => m.id === selectedMechanicId);
      return mechanic?.nextAvailability.slice(0, MAX_VISIBLE_SLOTS + 4).map(slot => ({
        ...slot,
        mechanicId: selectedMechanicId,
      })) || [];
    }
  }, [shop.mechanics, selectedMechanicId]);

  // Slots to show (first 3)
  const visibleSlots = displayedSlots.slice(0, MAX_VISIBLE_SLOTS);
  const hasMoreSlots = displayedSlots.length > MAX_VISIBLE_SLOTS;

  // Check if a slot is selected for this shop
  const isSlotSelected = useCallback(
    (slot: MechanicAvailabilitySlot) => {
      if (!selectedSlot || selectedSlot.shopId !== shop.shopId) return false;
      return (
        selectedSlot.slot.day === slot.day &&
        selectedSlot.slot.dayOfWeek === slot.dayOfWeek &&
        selectedSlot.slot.time === slot.time
      );
    },
    [selectedSlot, shop.shopId]
  );

  // Handlers
  const handleMechanicSelect = useCallback((mechanicId: number | null) => {
    setSelectedMechanicId(mechanicId);
  }, []);

  const handleSlotPress = useCallback(
    (slot: MechanicAvailabilitySlot & { mechanicId?: number }) => {
      const mechanicId = selectedMechanicId === null ? (slot.mechanicId || null) : selectedMechanicId;
      onSelectSlot(shop.shopId, mechanicId, slot);
    },
    [onSelectSlot, shop.shopId, selectedMechanicId]
  );

  const handleShopDetails = useCallback(() => {
    onShopDetails(shop.shopId);
  }, [onShopDetails, shop.shopId]);

  const handleMorePress = useCallback(() => {
    onMoreAvailability(shop.shopId, selectedMechanicId);
  }, [onMoreAvailability, shop.shopId, selectedMechanicId]);

  // Get first mechanic for verified status (use shop-level if available)
  const firstMechanic = shop.mechanics[0];

  return (
    <View style={styles.container}>
      {/* Header: Shop Name, Rating, Verified */}
      <View style={styles.header}>
        {/* Avatar placeholder for shop */}
        <View style={styles.shopAvatarContainer}>
          <View style={styles.shopAvatarPlaceholder}>
            <User size={28} color="#9CA3AF" />
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <Text size="lg" weight="bold" color={BrandColors.primary} numberOfLines={1} style={styles.shopName}>
              {shop.shopName}
            </Text>
            <View style={styles.ratingBadge}>
              <Star size={16} color={BrandColors.secondary} fill={BrandColors.secondary} />
              <Text size="sm" weight="bold" color={BrandColors.primary}>
                {shop.rating.toFixed(1)}
              </Text>
            </View>
          </View>

          <View style={styles.detailsRow}>
            <Text size="xs" weight="regular" color="#9CA3AF">
              {shop.distanceMi} mi
            </Text>
            {shop.isVerified && (
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

      {/* SELECT MECHANIC Section */}
      <View style={styles.mechanicSection}>
        <Text size="xs" weight="bold" color="#9CA3AF" style={styles.sectionLabel}>
          SELECT MECHANIC
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mechanicAvatarsContent}
        >
          {/* "Any" option */}
          <TouchableOpacity
            style={styles.mechanicAvatarWrapper}
            onPress={() => handleMechanicSelect(null)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.mechanicAvatar,
                selectedMechanicId === null && styles.mechanicAvatarSelected,
              ]}
            >
              <Text size="xs" weight="bold" color={selectedMechanicId === null ? BrandColors.secondary : "#6B7280"}>
                Any
              </Text>
            </View>
            <Text size="xs" weight="medium" color="#6B7280" numberOfLines={1}>
              Any
            </Text>
          </TouchableOpacity>

          {/* Mechanic avatars */}
          {shop.mechanics.map((mechanic) => {
            const isSelected = selectedMechanicId === mechanic.id;
            const firstName = mechanic.name.split(" ")[0];
            return (
              <TouchableOpacity
                key={mechanic.id}
                style={styles.mechanicAvatarWrapper}
                onPress={() => handleMechanicSelect(mechanic.id)}
                activeOpacity={0.7}
              >
                {mechanic.photoUrl ? (
                  <Image
                    source={{ uri: mechanic.photoUrl }}
                    style={[styles.mechanicAvatar, isSelected && styles.mechanicAvatarSelected]}
                  />
                ) : (
                  <View style={[styles.mechanicAvatar, isSelected && styles.mechanicAvatarSelected]}>
                    <User size={20} color={isSelected ? BrandColors.secondary : "#9CA3AF"} />
                  </View>
                )}
                <Text size="xs" weight="medium" color="#6B7280" numberOfLines={1}>
                  {firstName}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
          {visibleSlots.map((slot, index) => {
            const isSelected = isSlotSelected(slot);
            return (
              <TouchableOpacity
                key={`${slot.dayOfWeek}-${slot.day}-${slot.time}-${index}`}
                style={[styles.availabilitySlot, isSelected && styles.selectedSlot]}
                onPress={() => handleSlotPress(slot)}
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

          {/* "More" button */}
          {hasMoreSlots && (
            <TouchableOpacity
              style={styles.moreButton}
              onPress={handleMorePress}
              activeOpacity={0.7}
            >
              <Calendar size={20} color="#6B7280" />
              <Text size="xs" weight="medium" color="#6B7280">
                More
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Shop Details Button */}
      <TouchableOpacity
        style={styles.shopDetailsButton}
        onPress={handleShopDetails}
        activeOpacity={0.7}
      >
        <Text size="sm" weight="semiBold" color={BrandColors.primary}>
          Shop Details
        </Text>
      </TouchableOpacity>
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
  shopAvatarContainer: {
    marginRight: Spacing.md,
  },
  shopAvatarPlaceholder: {
    width: 56,
    height: 56,
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
  shopName: {
    flex: 1,
    marginRight: Spacing.sm,
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
  mechanicSection: {
    marginTop: Spacing.lg,
  },
  sectionLabel: {
    marginBottom: Spacing.sm,
    letterSpacing: 0.5,
  },
  mechanicAvatarsContent: {
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  mechanicAvatarWrapper: {
    alignItems: "center",
    width: 56,
  },
  mechanicAvatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    marginBottom: 4,
  },
  mechanicAvatarSelected: {
    borderColor: BrandColors.secondary,
    borderWidth: 2,
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
    width: 72,
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
  moreButton: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 4,
  },
  shopDetailsButton: {
    marginTop: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: BrandColors.white,
  },
});
