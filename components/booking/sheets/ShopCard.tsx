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
import { useNextAvailabilityForShop } from "@/hooks/useNextAvailabilityForShop";
import { useDistanceUnit } from "@/hooks/useDistanceUnit";
import { formatProximityDistanceFromMiles } from "@/utils/geo";
import { BorderRadius } from "@/constants/theme";
import type { Mechanic, MechanicAvailabilitySlot } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

/** Shop with grouped mechanics data */
export interface ShopWithMechanics {
  shopId: string;
  shopName: string;
  rating: number;
  isVerified: boolean;
  distanceMi: number;
  mechanics: Mechanic[];
  /** Hourly labor rate in dollars (for price = labor_rate × time + parts) */
  laborRate?: number;
}

/** Slot with optional Convex booking fields */
export type SlotWithBookingMeta = MechanicAvailabilitySlot & {
  timeSlotId?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  mechanicId?: string;
};

/** Selected slot information */
export interface SelectedSlotInfo {
  shopId: string;
  mechanicId: string | null; // null means "Any"
  slot: MechanicAvailabilitySlot;
}

/** Service info for price display */
export interface SelectedServiceInfo {
  id: string;
  name: string;
  price: number;
  /** Labor hours (for formula: labor_rate × time + parts) */
  default_labor_hours?: number;
  /** Parts cost in dollars */
  default_parts_estimate?: number;
  /** State fee from selected option (e.g. inspection fee) */
  state_fee?: number;
}

interface ShopCardProps {
  /** The shop data with mechanics to display */
  shop: ShopWithMechanics;
  /** Called when a time slot is selected (slot may include timeSlotId/scheduledDate/scheduledTime from Convex) */
  onSelectSlot: (shopId: string, mechanicId: string | null, slot: SlotWithBookingMeta) => void;
  /** Called when "Shop Details" is pressed */
  onShopDetails: (shopId: string) => void;
  /** Called when "More" button is pressed to see full calendar */
  onMoreAvailability: (shopId: string, mechanicId: string | null) => void;
  /** Currently selected slot (for highlighting) */
  selectedSlot: SelectedSlotInfo | null;
  /** Selected services for displaying cost */
  selectedServices: SelectedServiceInfo[];
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
function getEarliestAvailability(
  mechanics: Mechanic[],
  limit: number,
): Array<MechanicAvailabilitySlot & { mechanicId: string }> {
  const allSlots: Array<MechanicAvailabilitySlot & { mechanicId: string }> = [];

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
  const uniqueSlots: Array<MechanicAvailabilitySlot & { mechanicId: string }> = [];

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
  selectedServices,
}: ShopCardProps) {
  const distanceUnit = useDistanceUnit();
  // If only one mechanic, auto-select them (no "Any" option needed)
  const hasSingleMechanic = shop.mechanics.length === 1;
  const defaultMechanicId = hasSingleMechanic ? shop.mechanics[0].id : null;

  // Track which mechanic is selected (null = "Any")
  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>(defaultMechanicId);

  // Convex: next availability for this shop (and selected mechanic when one is chosen)
  const {
    slots: convexSlots,
    hasSlots: hasConvexSlots,
    isLoading: convexSlotsLoading,
  } = useNextAvailabilityForShop(shop.shopId, selectedMechanicId, MAX_VISIBLE_SLOTS + 4);

  // Get availability slots: prefer Convex when available, else fall back to mechanic.nextAvailability (mock)
  const displayedSlots = useMemo((): Array<SlotWithBookingMeta> => {
    if (hasConvexSlots && convexSlots.length > 0) {
      return convexSlots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        day: s.day,
        time: s.time,
        timeSlotId: s.timeSlotId as string,
        scheduledDate: s.scheduledDate,
        scheduledTime: s.scheduledTime,
        mechanicId: s.mechanicId,
      }));
    }
    if (selectedMechanicId === null) {
      return getEarliestAvailability(shop.mechanics, MAX_VISIBLE_SLOTS + 4);
    }
    const mechanic = shop.mechanics.find((m) => m.id === selectedMechanicId);
    return (
      mechanic?.nextAvailability.slice(0, MAX_VISIBLE_SLOTS + 4).map((slot) => ({
        ...slot,
        mechanicId: selectedMechanicId,
      })) || []
    );
  }, [shop.mechanics, selectedMechanicId, hasConvexSlots, convexSlots]);

  // Slots to show (first 3)
  const visibleSlots = displayedSlots.slice(0, MAX_VISIBLE_SLOTS);
  const hasMoreSlots = displayedSlots.length > MAX_VISIBLE_SLOTS;

  // Check if a slot is selected for this shop (when "Any", match mechanicId so the right bay highlights)
  const isSlotSelected = useCallback(
    (slot: SlotWithBookingMeta) => {
      if (!selectedSlot || selectedSlot.shopId !== shop.shopId) return false;
      const timeMatch =
        selectedSlot.slot.day === slot.day &&
        selectedSlot.slot.dayOfWeek === slot.dayOfWeek &&
        selectedSlot.slot.time === slot.time;
      if (!timeMatch) return false;
      // When multiple mechanics have the same time (e.g. two 8:00 AM bays), match by mechanicId
      if (slot.mechanicId != null && selectedSlot.mechanicId != null) {
        return selectedSlot.mechanicId === slot.mechanicId;
      }
      return true;
    },
    [selectedSlot, shop.shopId],
  );

  // Handlers
  const handleMechanicSelect = useCallback((mechanicId: string | null) => {
    setSelectedMechanicId(mechanicId);
  }, []);

  const handleSlotPress = useCallback(
    (slot: SlotWithBookingMeta) => {
      const mechanicId = selectedMechanicId === null ? (slot.mechanicId ?? null) : selectedMechanicId;
      onSelectSlot(shop.shopId, mechanicId, slot);
    },
    [onSelectSlot, shop.shopId, selectedMechanicId],
  );

  const handleShopDetails = useCallback(() => {
    onShopDetails(shop.shopId);
  }, [onShopDetails, shop.shopId]);

  const handleMorePress = useCallback(() => {
    onMoreAvailability(shop.shopId, selectedMechanicId);
  }, [onMoreAvailability, shop.shopId, selectedMechanicId]);

  // Get first mechanic for verified status (use shop-level if available)
  const firstMechanic = shop.mechanics[0];

  // Calculate service cost: (labor_rate × service time) + parts per shop, or fallback to sum(price)
  const serviceCostDisplay = useMemo(() => {
    if (selectedServices.length === 0) return null;

    const laborRate = shop.laborRate;
    const hasFormulaParams =
      laborRate != null &&
      selectedServices.every((s) => s.default_labor_hours != null && s.default_parts_estimate != null);

    const totalPrice = hasFormulaParams
      ? selectedServices.reduce(
          (sum, s) => sum + laborRate! * (s.default_labor_hours ?? 0) + (s.default_parts_estimate ?? 0) + (s.state_fee ?? 0),
          0,
        )
      : selectedServices.reduce((sum, s) => sum + s.price + (s.state_fee ?? 0), 0);

    const firstName = selectedServices[0].name;
    const firstDisplay = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();

    if (selectedServices.length === 1) {
      return `${firstDisplay} $${Math.round(totalPrice)}`;
    }
    const moreCount = selectedServices.length - 1;
    return `${firstDisplay} + ${moreCount} more... $${Math.round(totalPrice)}`;
  }, [selectedServices, shop.laborRate]);

  return (
    <View style={styles.container}>
      {/* Header: Shop Name, Rating, Verified + Arrow */}
      <TouchableOpacity style={styles.header} onPress={handleShopDetails} activeOpacity={0.7}>
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
              {formatProximityDistanceFromMiles(shop.distanceMi, distanceUnit)}
            </Text>
            {shop.isVerified && (
              <View style={styles.verifiedBadge}>
                <BadgeCheck size={18} color="#10B981" />
                <Text size="xs" weight="bold" color="#10B981">
                  Verified
                </Text>
              </View>
            )}
            {/* Arrow for shop details */}
            <View style={styles.detailsArrow}>
              <ChevronRight size={18} color="#9CA3AF" />
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Service Cost Display */}
      {serviceCostDisplay && (
        <View style={styles.serviceCostSection}>
          <Text size="md" weight="bold" color={BrandColors.primary}>
            {serviceCostDisplay}
          </Text>
        </View>
      )}

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
          {/* "Any" option - only show if multiple mechanics */}
          {!hasSingleMechanic && (
            <TouchableOpacity
              style={styles.mechanicAvatarWrapper}
              onPress={() => handleMechanicSelect(null)}
              activeOpacity={0.7}
            >
              <View style={[styles.mechanicAvatar, selectedMechanicId === null && styles.mechanicAvatarSelected]}>
                <Text size="xs" weight="bold" color={selectedMechanicId === null ? BrandColors.secondary : "#6B7280"}>
                  Any
                </Text>
              </View>
              <Text size="xs" weight="medium" color="#6B7280" numberOfLines={1}>
                Any
              </Text>
            </TouchableOpacity>
          )}

          {/* Mechanic avatars */}
          {shop.mechanics.map((mechanic) => {
            const isSelected = selectedMechanicId === mechanic.id;
            const firstName = mechanic.name.split(" ")[0];
            return (
              <TouchableOpacity
                key={mechanic.id}
                style={styles.mechanicAvatarWrapper}
                onPress={() => handleMechanicSelect(mechanic.id)}
                activeOpacity={hasSingleMechanic ? 1 : 0.7}
                disabled={hasSingleMechanic}
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
        <View style={styles.availabilitySlotsRow}>
          {convexSlotsLoading && visibleSlots.length === 0 ? (
            <Text size="sm" weight="medium" color="#6B7280" style={styles.emptySlotsText}>
              Loading times…
            </Text>
          ) : visibleSlots.length === 0 ? (
            <Text size="sm" weight="medium" color="#6B7280" style={styles.emptySlotsText}>
              No times available
            </Text>
          ) : (
            <>
              {visibleSlots.map((slot, index) => {
                const isSelected = isSlotSelected(slot);
                const [slotTime, slotMeridiem] = slot.time.split(/\s+/);
                return (
                  <TouchableOpacity
                    key={`${slot.dayOfWeek}-${slot.day}-${slot.time}-${index}`}
                    style={[styles.availabilitySlot, isSelected && styles.selectedSlot]}
                    onPress={() => handleSlotPress(slot)}
                    activeOpacity={0.7}
                  >
                    <Text size="xs" weight="medium" color={isSelected ? BrandColors.primary : "#6B7280"} style={styles.slotText}>
                      {slot.dayOfWeek}
                    </Text>
                    <Text size="lg" weight="bold" color={isSelected ? BrandColors.primary : "#374151"} style={styles.slotText}>
                      {slot.day}
                    </Text>
                    <View style={styles.slotTimeGroup}>
                      <Text size="xs" weight="medium" color={isSelected ? BrandColors.primary : "#6B7280"} style={styles.slotText}>
                        {slotTime}
                      </Text>
                      {slotMeridiem ? (
                        <Text size="xs" weight="medium" color={isSelected ? BrandColors.primary : "#6B7280"} style={styles.slotMeridiem}>
                          {slotMeridiem}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* "More" button */}
              {hasMoreSlots && (
                <TouchableOpacity style={styles.moreButton} onPress={handleMorePress} activeOpacity={0.7}>
                  <Calendar size={20} color="#6B7280" />
                  <Text size="xs" weight="medium" color="#6B7280">
                    More
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
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
  availabilitySlotsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  availabilitySlot: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: 2,
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  slotText: {
    width: "100%",
    textAlign: "center",
  },
  slotTimeGroup: {
    width: "100%",
    alignItems: "center",
    marginTop: 1,
  },
  slotMeridiem: {
    width: "100%",
    textAlign: "center",
    marginTop: -2,
  },
  selectedSlot: {
    backgroundColor: "#F0F7FF",
    borderColor: BrandColors.secondary,
  },
  moreButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 4,
  },
  emptySlotsText: {
    paddingVertical: Spacing.md,
  },
  detailsArrow: {
    marginLeft: "auto",
  },
  serviceCostSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
});
