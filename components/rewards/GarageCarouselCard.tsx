/**
 * GarageCarouselCard
 *
 * PURPOSE: Compact vehicle selector card for My Garage bottom sheet.
 *          3-zone design: edge-to-edge photo with gradient → vehicle identity → clean end.
 *          Optimized for fast scanning and quick selection in a horizontal carousel.
 *
 * USED IN: components/rewards/GarageCarSelectionSheet.tsx
 */

import React, { memo, useCallback, useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight } from "lucide-react-native";
import { BrandColors, Text } from "@/components/shared-ui";
import { BorderRadius, Spacing } from "@/constants/theme";

const FALLBACK_VEHICLE_IMAGE = require("@/assets/images/covered-car.png");

export type VehicleTier = "driver" | "preferred" | "elite";

export interface GarageCarouselCardVehicle {
  id: string;
  vin?: string;
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileage?: number;
  imageSource?: ImageSourcePropType;
  isDefault: boolean;
  fuelPercent?: number | null;
}

const TIER_COLORS: Record<VehicleTier, string> = {
  driver: BrandColors.secondary,
  preferred: BrandColors.secondary,
  elite: "#EA580C",
};

const TIER_LABELS: Record<VehicleTier, string> = {
  driver: "Driver",
  preferred: "Preferred",
  elite: "Elite",
};

function formatMileage(mileage: number | undefined): string {
  if (mileage == null) return "N/A";
  return `${mileage.toLocaleString()} mi`;
}

export interface GarageCarouselCardProps {
  vehicle: GarageCarouselCardVehicle;
  tier: VehicleTier;
  onPress: () => void;
  onTierPress: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Size card so next card peeks ~17% from the right edge
const CARD_HORIZONTAL_PADDING = Spacing.lg; // 16
const CARD_GAP = Spacing.md; // 12
const CARD_WIDTH = Math.round(
  (SCREEN_WIDTH - CARD_HORIZONTAL_PADDING - CARD_GAP) / 1.17
);
const CARD_IMAGE_HEIGHT = 150;
const CARD_BORDER_RADIUS = 16;

function GarageCarouselCardComponent({
  vehicle,
  tier,
  onPress,
  onTierPress,
}: GarageCarouselCardProps) {
  const tierColor = TIER_COLORS[tier];
  const tierLabel = TIER_LABELS[tier];
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0.97,
      duration: 120,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const vehicleTitle =
    [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") ||
    "Vehicle";

  return (
    <Animated.View style={[styles.cardOuter, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {/* Inner wrapper clips children to border radius */}
        <View style={styles.cardInner}>
          {/* Zone 1 — Vehicle Photo */}
          <View style={styles.imageContainer}>
            <Image
              source={vehicle.imageSource || FALLBACK_VEHICLE_IMAGE}
              style={styles.carImage}
              resizeMode="cover"
            />
            {/* Subtle gradient overlay at bottom for text readability */}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.18)"]}
              style={styles.imageGradient}
            />
          </View>

          {/* Zone 2 — Vehicle Identity */}
          <View style={styles.content}>
            {/* Line 1: Vehicle name — primary visual anchor */}
            <Text weight="bold" size="md" color="#111827" numberOfLines={2}>
              {vehicleTitle}
            </Text>

            {/* Line 2: Mileage · Tier badge — supporting detail */}
            <View style={styles.identityRow}>
              <Text size="xs" color="#6B7280">
                {formatMileage(vehicle.mileage)}
              </Text>
              <Text size="xs" color="#6B7280" style={styles.dot}>
                {" · "}
              </Text>
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onTierPress();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                style={({ pressed }) => [
                  styles.tierTouchable,
                  pressed && styles.tierPressed,
                ]}
              >
                <Text size="xs" weight="medium" color={tierColor}>
                  {tierLabel}
                </Text>
                <ChevronRight size={11} color={tierColor} strokeWidth={2.5} />
              </Pressable>
            </View>
          </View>

          {/* Zone 3 — Nothing. Clean end. */}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export const GarageCarouselCard = memo(GarageCarouselCardComponent);

const styles = StyleSheet.create({
  // Outer: carries shadow, no overflow clip
  cardOuter: {
    width: CARD_WIDTH,
    marginRight: CARD_GAP,
    borderRadius: CARD_BORDER_RADIUS,
    backgroundColor: "#FFFFFF",
    // Card depth shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  // Inner: clips photo corners to border radius
  cardInner: {
    borderRadius: CARD_BORDER_RADIUS,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  imageContainer: {
    width: "100%",
    height: CARD_IMAGE_HEIGHT,
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  carImage: {
    width: "100%",
    height: "100%",
  },
  imageGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    flexWrap: "wrap",
  },
  dot: {
    marginHorizontal: 0,
  },
  tierTouchable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 1,
  },
  tierPressed: {
    opacity: 0.65,
  },
});

export { CARD_WIDTH, CARD_GAP, CARD_HORIZONTAL_PADDING };
