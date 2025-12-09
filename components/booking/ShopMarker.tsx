/**
 * ShopMarker
 *
 * PURPOSE: Custom map marker (thumbtack) component for mechanic shops
 *
 * USED IN: components/booking/map.tsx
 *
 * PROPS:
 *   - shop (Shop): The shop data to display
 *   - isSelected (boolean): Whether this marker is currently selected
 *   - onPress (() => void): Called when marker is tapped
 *
 * EXAMPLE:
 *   <ShopMarker
 *     shop={shop}
 *     isSelected={selectedShopId === shop.id}
 *     onPress={() => handleSelectShop(shop)}
 *   />
 *
 * OWNER: Waleed Mansour
 */

import { BrandColors } from "@/constants/theme";
import type { Shop } from "@/stores/types/store.types";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Availability gradient colors (0-10 scale)
 * Based on map marker design: Dark (closed) → Red → Orange → Yellow → Green
 */
const AVAILABILITY_COLORS = [
  "#3D4654", // 0 - Dark/Closed (charcoal)
  "#E85D5D", // 1 - Red/Salmon
  "#E86A5D", // 2
  "#F28B5A", // 3 - Orange-Red
  "#F5A754", // 4 - Orange
  "#F5C254", // 5 - Yellow-Orange
  "#E8D44D", // 6 - Yellow
  "#C4D94D", // 7 - Yellow-Green
  "#8FD44D", // 8 - Light Green
  "#5FCF5F", // 9 - Green
  "#4CB34C", // 10 - Full Green (fully available)
] as const;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get color based on availability score (0-10)
 */
function getAvailabilityColor(availability: number): string {
  // Clamp availability to 0-10 range
  const clamped = Math.max(0, Math.min(10, Math.round(availability)));
  return AVAILABILITY_COLORS[clamped];
}

// ============================================================================
// TYPES
// ============================================================================

interface ShopMarkerProps {
  /** The shop data to display */
  shop: Shop;
  /** Called when marker is tapped */
  onPress?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

function ShopMarkerComponent({ shop, onPress }: ShopMarkerProps) {
  // Animation for tap feedback
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Get marker color based on availability (0-10)
  const backgroundColor = getAvailabilityColor(shop.availability);

  const handlePress = useCallback(() => {
    // Quick scale animation for tap feedback
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Trigger onPress after animation completes
      onPress?.();
    });
  }, [onPress, scaleAnim]);

  return (
    <Marker
      coordinate={shop.coordinate}
      onPress={handlePress}
      anchor={{ x: 0.5, y: 1 }} // Anchor at bottom center (tip of pointer)
      tracksViewChanges={false} // Performance optimization
    >
      <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
        {/* Badge with rating */}
        <View style={[styles.badge, { backgroundColor }]}>
          <Ionicons name="star" size={12} color={BrandColors.white} />
          <Text style={styles.ratingText}>{shop.rating.toFixed(1)}</Text>
        </View>

        {/* Pointer/Triangle */}
        <View style={[styles.pointer, { borderTopColor: backgroundColor }]} />
      </Animated.View>
    </Marker>
  );
}

// Memoize to prevent unnecessary re-renders
export const ShopMarker = memo(ShopMarkerComponent);

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    // Shadow for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  ratingText: {
    color: BrandColors.white,
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Urbanist-SemiBold",
  },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1, // Overlap slightly with badge
  },
});

