/**
 * GarageCarSelectionCard
 *
 * PURPOSE: Vehicle row for My Garage car selection (rewards context).
 *          Circular car image, details, and tappable status badge (Driver/Preferred/Elite).
 *          Design matches 1st image - purple border + checkmark when selected.
 *
 * USED IN: components/rewards/GarageCarSelectionSheet.tsx
 */

import React, { memo } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Car, Check } from "lucide-react-native";
import { BrandColors, Text } from "@/components/shared-ui";
import { BorderRadius, Spacing } from "@/constants/theme";
import type { Vehicle } from "@/stores/useVehicleStore";

export type VehicleTier = "driver" | "preferred" | "elite";

const TIER_CONFIG: Record<VehicleTier, { label: string; bg: string; text: string }> = {
  driver: { label: "Driver", bg: "#EBF4FF", text: BrandColors.secondary },
  preferred: { label: "Preferred", bg: "#EBF4FF", text: BrandColors.secondary },
  elite: { label: "Elite", bg: "#FFEDD5", text: "#EA580C" },
};

function formatMileage(mileage: number | undefined): string {
  if (!mileage) return "N/A";
  return `${mileage.toLocaleString()} mi`;
}

function formatPlateOrVin(vin: string | undefined): string {
  if (!vin) return "";
  if (vin.length <= 8) return vin;
  return vin.slice(0, 8).toUpperCase();
}

export interface GarageCarSelectionCardProps {
  vehicle: Vehicle;
  tier: VehicleTier;
  isSelected: boolean;
  onSelect: () => void;
  onStatusPress: () => void;
}

function GarageCarSelectionCardComponent({
  vehicle,
  tier,
  isSelected,
  onSelect,
  onStatusPress,
}: GarageCarSelectionCardProps) {
  const tierConfig = TIER_CONFIG[tier];

  return (
    <Pressable style={[styles.row, isSelected && styles.rowSelected]} onPress={onSelect}>
      {isSelected && (
        <View style={styles.checkmark}>
          <Check size={16} color={BrandColors.secondary} strokeWidth={2.5} />
        </View>
      )}
      <View style={styles.content}>
        <View style={styles.details}>
          <View style={styles.imageWrapper}>
            {vehicle.imageSource ? (
              <Image source={vehicle.imageSource} style={styles.carImage} resizeMode="cover" />
            ) : (
              <View style={[styles.imagePlaceholder, isSelected && styles.imagePlaceholderSelected]}>
                <Car size={24} color={isSelected ? BrandColors.secondary : "#9CA3AF"} />
              </View>
            )}
          </View>
          <View style={styles.textBlock}>
            <Text weight="bold" size="md" color="#1F2937" numberOfLines={1}>
              {vehicle.year} {vehicle.make} {vehicle.model}
            </Text>
            <Text size="sm" color="#6B7280">
              {formatMileage(vehicle.mileage)} · {formatPlateOrVin(vehicle.vin) || "—"}
            </Text>
          </View>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onStatusPress();
            }}
            style={[styles.statusBadge, { backgroundColor: tierConfig.bg }]}
          >
            <Text size="xs" weight="semiBold" color={tierConfig.text}>
              {tierConfig.label}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

export const GarageCarSelectionCard = memo(GarageCarSelectionCardComponent);

const styles = StyleSheet.create({
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
  checkmark: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 1,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  details: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  imageWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
  },
  carImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlaceholderSelected: {
    backgroundColor: "rgba(82, 153, 254, 0.15)",
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
});
