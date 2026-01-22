/**
 * ShopCarouselCard
 *
 * PURPOSE: Individual shop card for the Life360-style floating carousel
 *          Displays shop info with rating, location, availability, and actions
 *
 * USED IN: components/booking/MechanicCarouselSheet.tsx
 *
 * PROPS:
 *   - shop (Shop): The shop data to display
 *   - isActive (boolean): Whether this card is currently active/focused
 *   - onCall (() => void): Called when call button is tapped
 *   - onText (() => void): Called when text button is tapped
 *   - onDirections (() => void): Called when directions button is tapped
 *   - onDetails (() => void): Called when details button is tapped [optional]
 *
 * EXAMPLE:
 *   <ShopCarouselCard
 *     shop={shop}
 *     isActive={true}
 *     onCall={() => handleCall()}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { memo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Expo & Third-party
import { Clock, MapPin, MessageCircle, Phone, Star } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius, Spacing } from "@/constants/theme";
import type { Shop } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

export interface ShopCarouselCardProps {
  /** The shop data to display */
  shop: Shop;
  /** Whether this card is currently active/focused */
  isActive?: boolean;
  /** Called when call button is tapped */
  onCall?: () => void;
  /** Called when directions button is tapped */
  onDirections?: () => void;
  /** Called when details button is tapped */
  onDetails?: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Format distance for display */
function formatDistance(km: number | null): string {
  if (km === null) return "";
  if (km < 0.1) return "< 0.1 km";
  if (km < 1) return `${(km * 1000).toFixed(0)} m`;
  return `${km.toFixed(1)} km`;
}

/** Get availability label and color */
function getAvailabilityInfo(availability: number): { label: string; color: string } {
  if (availability === 0) return { label: "Closed", color: "#6B7280" };
  if (availability <= 3) return { label: "Limited", color: "#E85D5D" };
  if (availability <= 6) return { label: "Available", color: "#F5A754" };
  return { label: "Open Now", color: "#4CB34C" };
}

// ============================================================================
// COMPONENT
// ============================================================================

function ShopCarouselCardComponent({ shop, isActive = false, onCall, onDirections, onDetails }: ShopCarouselCardProps) {
  const availabilityInfo = getAvailabilityInfo(shop.availability);

  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      {/* Header: Name only (with right padding for close button) */}
      <View style={styles.header}>
        <Text weight="bold" size="xl" color={BrandColors.primary} style={styles.name} numberOfLines={1}>
          {shop.name}
        </Text>
      </View>

      {/* Address + Availability */}
      <View style={styles.addressRow}>
        <MapPin size={14} color="#6B7280" />
        <Text size="sm" color="#6B7280" numberOfLines={1} style={styles.address}>
          {shop.address}
        </Text>
        <View style={[styles.availabilityBadge, { backgroundColor: availabilityInfo.color + "20" }]}>
          <View style={[styles.availabilityDot, { backgroundColor: availabilityInfo.color }]} />
          <Text size="sm" color={availabilityInfo.color} weight="medium">
            {availabilityInfo.label}
          </Text>
        </View>
      </View>

      {/* Stats Row: Rating, Distance, Next Available */}
      <View style={styles.statsRow}>
        {shop.rating && (
          <View style={styles.statItem}>
            <Star size={14} color="#F5C254" fill="#F5C254" />
            <Text weight="semiBold" size="sm" color={BrandColors.primary}>
              {shop.rating.toFixed(1)}
            </Text>
          </View>
        )}
        {shop.distanceKm !== null && (
          <View style={styles.statItem}>
            <Text size="sm" color="#6B7280">
              {formatDistance(shop.distanceKm)}
            </Text>
          </View>
        )}
        {shop.nextAvailableSlot && (
          <View style={styles.statItem}>
            <Clock size={14} color="#6B7280" />
            <Text size="sm" color="#6B7280">
              Next: Today
            </Text>
          </View>
        )}
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

        <TouchableOpacity style={styles.actionButton} onPress={onDirections} activeOpacity={0.7}>
          <MapPin size={18} color={BrandColors.primary} />
          <Text weight="medium" size="sm" color={BrandColors.primary}>
            Directions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={onDetails} activeOpacity={0.7}>
          <MessageCircle size={18} color={BrandColors.primary} />
          <Text weight="medium" size="sm" color={BrandColors.primary}>
            Details
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const ShopCarouselCard = memo(ShopCarouselCardComponent);

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius["2xl"],
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardActive: {
    // Could add active state styles here
  },
  header: {
    marginBottom: Spacing.sm,
    paddingRight: 40, // Space for close button overlay
  },
  name: {
    // Name takes full width
  },
  availabilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  availabilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  address: {
    flex: 1,
    flexShrink: 1,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: Spacing.sm,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: Spacing.xs,
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
