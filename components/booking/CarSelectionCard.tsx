/**
 * CarSelectionCard
 *
 * PURPOSE: Vehicle card for car selection. Supports two layouts:
 *          - "card": Horizontal card with thumbnail left, details right, Select/Selected button (carousel)
 *          - "row": Compact vertical-list row — details left, car icon right, tappable row, checkmark when selected
 *
 * USED IN: components/booking/sheets/CarSelectionContent.tsx
 *
 * PROPS:
 *   - vehicle (Vehicle): The vehicle data to display
 *   - variant ("card" | "row"): Layout style
 *   - isActive (boolean): Whether this card is currently active/focused (card only)
 *   - isSelected (boolean): Whether this vehicle is currently selected
 *   - onSelect (() => void): Called when row/card is tapped or Select is pressed
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
  /** "card" = horizontal card with button; "row" = compact list row */
  variant?: "card" | "row";
  /** Whether this card is currently active/focused (card variant only) */
  isActive?: boolean;
  /** Whether this vehicle is currently selected for booking */
  isSelected?: boolean;
  /** Called when row or Select button is tapped */
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

/** Display VIN in full uppercase. Previous behavior was to truncate
 *  to the first 11 chars with an ellipsis — user prefers the full
 *  17-char VIN visible (fits in the row at the existing font size). */
function truncateVin(vin: string | undefined): string {
  if (!vin) return "";
  return vin.toUpperCase();
}

// ============================================================================
// COMPONENT
// ============================================================================

function CarSelectionCardComponent({
  vehicle,
  variant = "card",
  isActive = false,
  isSelected = false,
  onSelect,
}: CarSelectionCardProps) {
  const isRow = variant === "row";

  if (isRow) {
    return (
      <TouchableOpacity style={[styles.row, isSelected && styles.rowSelected]} onPress={onSelect} activeOpacity={0.7}>
        {isSelected && (
          <View style={styles.rowCheckmark}>
            <Check size={16} color={BrandColors.secondary} strokeWidth={2.5} />
          </View>
        )}
        <View style={styles.rowContent}>
          <View style={styles.rowDetails}>
            <View style={styles.titleRow}>
              <Text weight="bold" size="md" color={BrandColors.primary} numberOfLines={1} style={styles.rowTitle}>
                {vehicle.make} {vehicle.model}
              </Text>
            </View>
            <View style={styles.subtitleRow}>
              <Text size="sm" color="#6B7280">
                {vehicle.year}
              </Text>
              <Text size="sm" color="#D1D5DB">
                {" · "}
              </Text>
              <Text size="sm" color="#6B7280">
                {formatMileage(vehicle.mileage)}
              </Text>
            </View>
            {vehicle.vin && (
              <Text size="xs" color="#000000" style={styles.vin}>
                {truncateVin(vehicle.vin)}
              </Text>
            )}
          </View>
          <View style={styles.rowIcon}>
            {vehicle.imageSource ? (
              <Image source={vehicle.imageSource} style={styles.rowImage} resizeMode="contain" />
            ) : (
              <Image
                source={require("@/assets/images/covered-car.png")}
                style={styles.rowCoveredCar}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.card, isActive && styles.cardActive]}>
      {/* Main content row: Image + Details */}
      <View style={styles.contentRow}>
        {/* Vehicle Image Thumbnail */}
        <View style={styles.imageContainer}>
          {vehicle.imageSource ? (
            <Image source={vehicle.imageSource} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Image
                source={require("@/assets/images/covered-car.png")}
                style={{ width: 56, height: 36 }}
                resizeMode="contain"
              />
            </View>
          )}
        </View>

        {/* Details */}
        <View style={styles.detailsContainer}>
          {/* Title row: Make Model */}
          <View style={styles.titleRow}>
            <Text weight="bold" size="lg" color={BrandColors.primary} numberOfLines={1} style={styles.title}>
              {vehicle.make} {vehicle.model}
            </Text>
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
  // Row variant (vertical list)
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    paddingRight: Spacing.lg,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    marginBottom: Spacing.sm,
  },
  rowSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: "rgba(82, 153, 254, 0.06)",
  },
  rowCheckmark: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 1,
  },
  rowContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowDetails: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    flexShrink: 1,
    marginBottom: 2,
  },
  rowIcon: {
    width: 72,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.md,
  },
  rowImage: {
    width: "100%",
    height: "100%",
  },
  rowCoveredCar: {
    width: 56,
    height: 40,
  },
  // Card variant (carousel)
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
