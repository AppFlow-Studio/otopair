/**
 * GarageCarSelectionCard
 *
 * PURPOSE: Vehicle row for My Garage car selection (rewards context).
 *          Circular car image, details, tappable tier badge pill, and chevron affordance.
 *          White card on grey sheet surface — no explicit border, depth via shadow.
 *
 * USED IN: components/rewards/GarageCarSelectionSheet.tsx
 */

import React, { memo } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Car, ChevronRight } from "lucide-react-native";
import { BrandColors, Text } from "@/components/shared-ui";
import { BorderRadius, Spacing } from "@/constants/theme";
import type { Vehicle } from "@/stores/useVehicleStore";

export type VehicleTier = "driver" | "preferred" | "elite";

/** Tier badge config — all OtoPair blue */
const TIER_CONFIG: Record<VehicleTier, { label: string }> = {
  driver: { label: "DRIVER" },
  preferred: { label: "PREFERRED" },
  elite: { label: "ELITE" },
};

function formatMileage(mileage: number | undefined): string {
  if (!mileage) return "N/A";
  return `${mileage.toLocaleString()} mi`;
}

function formatVin(vin: string | undefined): string {
  if (!vin) return "";
  return vin.toUpperCase();
}

export interface GarageCarSelectionCardProps {
  vehicle: Vehicle;
  tier: VehicleTier;
  onSelect: () => void;
  onStatusPress: () => void;
}

function GarageCarSelectionCardComponent({
  vehicle,
  tier,
  onSelect,
  onStatusPress,
}: GarageCarSelectionCardProps) {
  const tierConfig = TIER_CONFIG[tier];

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
      ]}
      onPress={onSelect}
    >
      <View style={styles.content}>
        {/* Left: Car image */}
        <View style={styles.imageWrapper}>
          {vehicle.imageSource ? (
            <Image source={vehicle.imageSource} style={styles.carImage} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Car size={24} color="#8CBBFE" />
            </View>
          )}
        </View>

        {/* Center: Vehicle details */}
        <View style={styles.textBlock}>
          <Text weight="bold" size="md" color="#1F2937" numberOfLines={1}>
            {vehicle.make} {vehicle.model}
          </Text>
          <Text size="sm" color="#6B7280" style={styles.subtitleText}>
            {vehicle.year} · {formatMileage(vehicle.mileage)}
          </Text>
          <Text size="xs" color="#9CA3AF" style={styles.roleLabel}>
            {formatVin(vehicle.vin) || "—"}
          </Text>
        </View>

        {/* Right: Tier badge pill + chevron */}
        <View style={styles.rightSection}>
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onStatusPress();
            }}
            style={styles.tierBadge}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text size="xs" weight="bold" color={BrandColors.secondary}>
              {tierConfig.label}
            </Text>
          </Pressable>
          <ChevronRight size={18} color="#D1D5DB" strokeWidth={2} />
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
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.xl,
    padding: Spacing.md + 2,
    paddingRight: Spacing.md,
    marginBottom: Spacing.md,
    // Soft shadow for depth against grey sheet
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rowPressed: {
    opacity: 0.85,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  imageWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#EDF3FE",
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
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  subtitleText: {
    marginTop: 1,
  },
  roleLabel: {
    marginTop: 2,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexShrink: 0,
  },
  tierBadge: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#EBF4FF",
  },
});
