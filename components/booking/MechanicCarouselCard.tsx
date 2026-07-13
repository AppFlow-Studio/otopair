/**
 * MechanicCarouselCard
 *
 * PURPOSE: Individual mechanic card for the Life360-style carousel sheet
 *          Displays mechanic info with avatar, rating, location status, and actions
 *
 * USED IN: components/booking/MechanicCarouselSheet.tsx
 *
 * PROPS:
 *   - mechanic (Mechanic): The mechanic data to display
 *   - isActive (boolean): Whether this card is currently active/focused
 *   - onCall (() => void): Called when call button is tapped
 *   - onText (() => void): Called when text button is tapped
 *   - onViewProfile (() => void): Called when profile action is tapped
 *
 * EXAMPLE:
 *   <MechanicCarouselCard
 *     mechanic={mechanic}
 *     isActive={true}
 *     onCall={() => handleCall()}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { memo } from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Expo & Third-party
import { MapPin, MessageCircle, Phone, Star } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius, Shadows, Spacing } from "@/constants/theme";
import { useDistanceUnit } from "@/hooks/useDistanceUnit";
import type { Mechanic } from "@/stores/types/store.types";
import { formatProximityDistanceFromMiles } from "@/utils/geo";

// ============================================================================
// TYPES
// ============================================================================

export interface MechanicCarouselCardProps {
  /** The mechanic data to display */
  mechanic: Mechanic;
  /** Whether this card is currently active/focused */
  isActive?: boolean;
  /** Called when call button is tapped */
  onCall?: () => void;
  /** Called when text button is tapped */
  onText?: () => void;
  /** Called when profile action is tapped */
  onViewProfile?: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Get time duration string (mocking Life360's "here for X hr, X min" */
function getTimeAtLocation(): string {
  // In a real app, this would come from the mechanic's location data
  const hours = Math.floor(Math.random() * 24);
  const mins = Math.floor(Math.random() * 60);
  if (hours > 0) {
    return `${hours} hr, ${mins} min`;
  }
  return `${mins} min`;
}

// ============================================================================
// COMPONENT
// ============================================================================

function MechanicCarouselCardComponent({
  mechanic,
  isActive = false,
  onCall,
  onText,
  onViewProfile,
}: MechanicCarouselCardProps) {
  const distanceUnit = useDistanceUnit();

  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      {/* Header: Name + Battery-like availability indicator */}
      <View style={styles.header}>
        <Text weight="bold" size="3xl" color={BrandColors.primary} style={styles.name}>
          {mechanic.name.split(" ")[0]}
        </Text>
        <View style={styles.availabilityBadge}>
          <View style={[styles.batteryIcon, { backgroundColor: mechanic.isAvailable ? "#4CB34C" : "#E85D5D" }]} />
          <Text size="sm" color="#6B7280">
            {mechanic.isAvailable ? "Available" : "Busy"}
          </Text>
        </View>
      </View>

      {/* Location Status */}
      <View style={styles.locationRow}>
        <Text weight="semiBold" size="lg" color={BrandColors.primary}>
          {mechanic.title ? mechanic.title : `At ${mechanic.shopName}`}
        </Text>
        {/* Shop Image/Icon */}
        <View style={styles.shopImageContainer}>
          <View style={styles.shopIcon}>
            {mechanic.shopLogoUrl ? (
              <Image source={{ uri: mechanic.shopLogoUrl }} style={styles.shopImage} resizeMode="cover" />
            ) : (
              <Text size="2xl">🏠</Text>
            )}
          </View>
        </View>
      </View>
      <Text size="sm" color="#6B7280" style={styles.sinceText}>
        Since {new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} today
      </Text>

      {/* Rating Row */}
      <View style={styles.ratingRow}>
        <Star size={16} color="#F5C254" fill="#F5C254" />
        <Text weight="semiBold" size="sm" color={BrandColors.primary}>
          {mechanic.rating.toFixed(1)}
        </Text>
        <Text size="sm" color="#6B7280">
          • {mechanic.yearsExperience} years exp
        </Text>
        <Text size="sm" color="#6B7280">
          • {formatProximityDistanceFromMiles(mechanic.distanceMi, distanceUnit)}
        </Text>
      </View>

      {/* Services Preview */}
      <View style={styles.servicesRow}>
        <Text size="xs" color="#9CA3AF" numberOfLines={1}>
          {mechanic.services.slice(0, 3).join(" • ")}
        </Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={onCall} activeOpacity={0.7}>
          <Phone size={18} color={BrandColors.primary} />
          <Text weight="medium" size="sm" color={BrandColors.primary}>
            Call
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onText} activeOpacity={0.7}>
          <MessageCircle size={18} color={BrandColors.primary} />
          <Text weight="medium" size="sm" color={BrandColors.primary}>
            Text
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onViewProfile} activeOpacity={0.7}>
          <MapPin size={18} color={BrandColors.primary} />
          <Text weight="medium" size="sm" color={BrandColors.primary}>
            Directions
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const MechanicCarouselCard = memo(MechanicCarouselCardComponent);

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  card: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius["2xl"],
    padding: Spacing.lg,
    ...Shadows.lg,
  },
  cardActive: {
    // Could add active state styles here
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  name: {
    flex: 1,
  },
  availabilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  batteryIcon: {
    width: 20,
    height: 10,
    borderRadius: 2,
  },
  locationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  shopImageContainer: {
    position: "relative",
  },
  shopIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  shopImage: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
  },
  sinceText: {
    marginBottom: Spacing.md,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  servicesRow: {
    marginBottom: Spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: Spacing.md,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: "#F3F4F6",
    borderRadius: BorderRadius.full,
  },
});
