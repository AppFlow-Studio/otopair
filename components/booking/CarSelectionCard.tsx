/**
 * CarSelectionCard
 *
 * PURPOSE: Individual vehicle card for the car selection carousel
 *          Horizontal layout with thumbnail on left, details on right
 *          Matches the shop carousel card theme
 *
 * USED IN: components/booking/sheets/CarSelectionContent.tsx
 *
 * PROPS:
 *   - vehicle (Vehicle): The vehicle data to display
 *   - isActive (boolean): Whether this card is currently active/focused
 *   - isSelected (boolean): Whether this vehicle is currently selected
 *   - onSelect (() => void): Called when Select button is tapped
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { memo } from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Expo & Third-party
import { Car, Check, Gauge } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius, Spacing } from "@/constants/theme";
import type { Vehicle } from "@/stores/useVehicleStore";

// ============================================================================
// TYPES
// ============================================================================

export interface CarSelectionCardProps {
  /** The vehicle data to display */
  vehicle: Vehicle;
  /** Whether this card is currently active/focused */
  isActive?: boolean;
  /** Whether this vehicle is currently selected for booking */
  isSelected?: boolean;
  /** Called when Select button is tapped */
  onSelect?: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Format mileage for display */
function formatMileage(mileage: number | undefined): string {
  if (!mileage) return "N/A";
  return `${mileage.toLocaleString()} mi`;
}

/** Truncate VIN for display */
function truncateVin(vin: string | undefined): string {
  if (!vin) return "";
  return vin.length > 11 ? `${vin.slice(0, 11)}...` : vin;
}

// ============================================================================
// COMPONENT
// ============================================================================

function CarSelectionCardComponent({
  vehicle,
  isActive = false,
  isSelected = false,
  onSelect,
}: CarSelectionCardProps) {
  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      {/* Main content row: Image + Details */}
      <View style={styles.contentRow}>
        {/* Vehicle Image Thumbnail */}
        <View style={styles.imageContainer}>
          {vehicle.imageSource ? (
            <Image
              source={vehicle.imageSource}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Car size={32} color="#9CA3AF" />
            </View>
          )}
        </View>

        {/* Details */}
        <View style={styles.detailsContainer}>
          {/* Title row: Make Model + Default badge */}
          <View style={styles.titleRow}>
            <Text
              weight="bold"
              size="lg"
              color={BrandColors.primary}
              numberOfLines={1}
              style={styles.title}
            >
              {vehicle.make} {vehicle.model}
            </Text>
            {vehicle.isDefault && (
              <View style={styles.defaultBadge}>
                <Text size="xs" color="#22C55E" weight="bold">
                  DEFAULT
                </Text>
              </View>
            )}
          </View>

          {/* Subtitle: Year • Mileage */}
          <View style={styles.subtitleRow}>
            <Text size="sm" color="#6B7280">
              {vehicle.year}
            </Text>
            <Text size="sm" color="#D1D5DB">
              {" • "}
            </Text>
            <Gauge size={12} color="#6B7280" />
            <Text size="sm" color="#6B7280" style={{ marginLeft: 2 }}>
              {formatMileage(vehicle.mileage)}
            </Text>
          </View>

          {/* VIN (truncated) */}
          {vehicle.vin && (
            <Text size="xs" color="#9CA3AF" style={styles.vin}>
              VIN: {truncateVin(vehicle.vin)}
            </Text>
          )}
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Select Button */}
      <TouchableOpacity
        style={[styles.selectButton, isSelected && styles.selectButtonSelected]}
        onPress={onSelect}
        activeOpacity={0.7}
      >
        {isSelected ? (
          <>
            <Check size={18} color={BrandColors.white} />
            <Text weight="semiBold" size="md" color={BrandColors.white}>
              Selected
            </Text>
          </>
        ) : (
          <Text weight="semiBold" size="md" color={BrandColors.white}>
            Select
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export const CarSelectionCard = memo(CarSelectionCardComponent);

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
  contentRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  imageContainer: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  detailsContainer: {
    flex: 1,
    justifyContent: "center",
    paddingRight: 32, // Space for close button overlay
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 4,
  },
  title: {
    flexShrink: 1,
  },
  defaultBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  vin: {
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: Spacing.sm,
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    backgroundColor: BrandColors.secondary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  selectButtonSelected: {
    backgroundColor: "#22C55E",
  },
});
