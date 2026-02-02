/**
 * AIBookingCarousel
 *
 * PURPOSE: Horizontal carousel of mechanic cards with availability slots for booking
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (shown when AI message contains shops array)
 *
 * PROPS:
 *   - shops (AIMechanic[]): Array of mechanic/shop objects to display
 *   - onBookNow ((mechanic: AIMechanic, timeSlot: SelectedTimeSlot) => void): Booking callback
 *
 * EXAMPLE:
 *   <AIBookingCarousel
 *     shops={message.shops}
 *     onBookNow={(mechanic, timeSlot) => navigateToPayment(mechanic, timeSlot)}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useState, useCallback } from "react";
import { View, ScrollView, Pressable, StyleSheet, Image, TouchableOpacity } from "react-native";

// 2. Expo & Third-party
import Animated, { FadeInRight, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Star, BadgeCheck, User, Clock } from "lucide-react-native";

// 3. Shared UI (design system)
import { Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { BrandColors, BorderRadius, Spacing, FontFamily } from "@/constants/theme";
import { formatDistanceMiles } from "@/utils/geo";
import type { AIMechanic } from "@/services/ai/types";

// Legacy type alias
export type AIShop = AIMechanic;

// ============================================================================
// TYPES
// ============================================================================

export interface SelectedTimeSlot {
  dayOfWeek: string;
  day: string;
  time: string;
}

interface AIBookingCarouselProps {
  shops: AIMechanic[];
  onBookNow: (mechanic: AIMechanic, timeSlot: SelectedTimeSlot) => void;
}

// ============================================================================
// MECHANIC CARD COMPONENT
// ============================================================================

function MechanicCard({
  mechanic,
  onBookNow,
  index,
}: {
  mechanic: AIMechanic;
  onBookNow: (timeSlot: SelectedTimeSlot) => void;
  index: number;
}) {
  const scale = useSharedValue(1);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handleSlotPress = useCallback((slotIndex: number) => {
    setSelectedSlotIndex(slotIndex);
  }, []);

  const handleBookNow = useCallback(() => {
    if (selectedSlotIndex !== null) {
      const slot = mechanic.nextAvailability[selectedSlotIndex];
      onBookNow({
        dayOfWeek: slot.dayOfWeek,
        day: slot.day,
        time: slot.time,
      });
    }
  }, [selectedSlotIndex, mechanic.nextAvailability, onBookNow]);

  // Get response time color
  const getResponseTimeColor = (time: string) => {
    switch (time) {
      case "Quick":
        return "#10B981";
      case "Normal":
        return "#F59E0B";
      case "Slow":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 100)
        .duration(300)
        .springify()}
    >
      <Animated.View style={animatedStyle}>
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.card}>
          {/* Header: Avatar, Name, Rating */}
          <View style={styles.header}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              {mechanic.photoUrl ? (
                <Image source={{ uri: mechanic.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={28} color="#9CA3AF" />
                </View>
              )}
            </View>

            {/* Info */}
            <View style={styles.infoContainer}>
              <View style={styles.nameRow}>
                <Text style={styles.shopName} weight="bold" numberOfLines={1}>
                  {mechanic.shopName}
                </Text>
                <View style={styles.ratingBadge}>
                  <Star size={14} color="#F59E0B" fill="#F59E0B" />
                  <Text style={styles.ratingText} size="sm" weight="bold">
                    {mechanic.rating.toFixed(1)}
                  </Text>
                </View>
              </View>

              <Text style={styles.mechanicName} size="sm" weight="medium">
                {mechanic.name}
              </Text>

              <View style={styles.detailsRow}>
                <Text style={styles.distanceText} size="xs">
                  {formatDistanceMiles(mechanic.distanceMi)}
                </Text>
                {mechanic.isVerified && (
                  <View style={styles.verifiedBadge}>
                    <BadgeCheck size={14} color="#10B981" />
                    <Text style={styles.verifiedText} size="xs" weight="bold">
                      Verified
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Services */}
          <Text style={styles.servicesText} size="sm" numberOfLines={2}>
            {mechanic.services.join(", ")}
          </Text>

          {/* Tags Row */}
          <View style={styles.tagsRow}>
            {mechanic.isAvailable && (
              <View style={styles.availableTag}>
                <View style={styles.availableDot} />
                <Text style={styles.tagText} size="xs" weight="medium">
                  Available
                </Text>
              </View>
            )}
            <View style={styles.responseTag}>
              <Clock size={12} color="#6B7280" />
              <Text
                style={[styles.responseText, { color: getResponseTimeColor(mechanic.responseTime) }]}
                size="xs"
                weight="bold"
              >
                {mechanic.responseTime}
              </Text>
            </View>
            {mechanic.price && (
              <View style={styles.priceTag}>
                <Text style={styles.priceText} size="sm" weight="bold">
                  {mechanic.price}
                </Text>
              </View>
            )}
          </View>

          {/* Next Availability Slots */}
          <View style={styles.availabilitySection}>
            <Text style={styles.availabilityTitle} size="sm" weight="bold">
              Next Available
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.slotsContainer}
              nestedScrollEnabled
            >
              {mechanic.nextAvailability.slice(0, 4).map((slot, slotIndex) => {
                const isSlotSelected = slotIndex === selectedSlotIndex;
                return (
                  <TouchableOpacity
                    key={slotIndex}
                    style={[styles.slot, isSlotSelected && styles.slotSelected]}
                    onPress={() => handleSlotPress(slotIndex)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.slotDay, isSlotSelected && styles.slotTextSelected]} size="xs" weight="medium">
                      {slot.dayOfWeek}
                    </Text>
                    <Text style={[styles.slotDate, isSlotSelected && styles.slotTextSelected]} size="lg" weight="bold">
                      {slot.day}
                    </Text>
                    <Text
                      style={[styles.slotTime, isSlotSelected && styles.slotTextSelected]}
                      size="xs"
                      weight="medium"
                    >
                      {slot.time}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Book Now Button */}
          <TouchableOpacity
            style={[styles.selectButton, selectedSlotIndex !== null && styles.selectButtonEnabled]}
            onPress={handleBookNow}
            activeOpacity={0.7}
            disabled={selectedSlotIndex === null}
          >
            <Text
              style={[styles.selectButtonText, selectedSlotIndex !== null && styles.selectButtonTextEnabled]}
              weight="semiBold"
            >
              {selectedSlotIndex !== null ? "Book Now" : "Choose a Time"}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIBookingCarousel({ shops, onBookNow }: AIBookingCarouselProps) {
  if (!shops || shops.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={300 + Spacing.md}
        decelerationRate="fast"
      >
        {shops.map((mechanic, index) => (
          <MechanicCard
            key={mechanic.id}
            mechanic={mechanic}
            onBookNow={(timeSlot) => onBookNow(mechanic, timeSlot)}
            index={index}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.md,
    marginHorizontal: -Spacing.md,
  },
  scrollContent: {
    paddingLeft: Spacing.xl + Spacing.md, // Offset to the right so cards peek from left
    paddingRight: Spacing.md,
    gap: Spacing.md,
  },
  card: {
    width: 300,
    backgroundColor: "rgba(255, 255, 255, 0.6)", // Semi-transparent, faded like suggestion pills
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
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
    marginBottom: 2,
  },
  shopName: {
    flex: 1,
    color: BrandColors.primary,
    fontSize: 15,
    marginRight: Spacing.xs,
  },
  mechanicName: {
    color: "#6B7280",
    marginBottom: 4,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    color: BrandColors.primary,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  distanceText: {
    color: "#9CA3AF",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  verifiedText: {
    color: "#10B981",
  },
  // Services
  servicesText: {
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  // Tags
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    flexWrap: "wrap",
  },
  availableTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BrandColors.white,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: "#10B981",
    marginRight: 6,
  },
  tagText: {
    color: "#374151",
  },
  responseTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: BrandColors.white,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  responseText: {
    fontFamily: FontFamily.bold,
  },
  priceTag: {
    backgroundColor: BrandColors.secondary + "15",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.md,
  },
  priceText: {
    color: BrandColors.secondary,
  },
  // Availability
  availabilitySection: {
    marginBottom: Spacing.md,
  },
  availabilityTitle: {
    color: BrandColors.primary,
    marginBottom: Spacing.sm,
  },
  slotsContainer: {
    gap: Spacing.xs,
  },
  slot: {
    width: 64,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  slotSelected: {
    backgroundColor: BrandColors.secondary + "15",
    borderColor: BrandColors.secondary,
  },
  slotDay: {
    color: "#6B7280",
  },
  slotDate: {
    color: "#374151",
  },
  slotTime: {
    color: "#6B7280",
  },
  slotTextSelected: {
    color: BrandColors.secondary,
  },
  // Select Button
  selectButton: {
    backgroundColor: "#E4E7EC",
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  selectButtonEnabled: {
    backgroundColor: BrandColors.secondary,
  },
  selectButtonText: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  selectButtonTextEnabled: {
    color: BrandColors.white,
  },
});
