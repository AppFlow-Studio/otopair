/**
 * ShopMarker
 *
 * PURPOSE: Custom map marker (thumbtack) component for mechanic shops
 *
 * USED IN: components/booking/map.tsx
 *
 * PROPS:
 *   - shop (Shop): The shop data to display
 *   - onPress (() => void): Called when marker is tapped
 *
 * EXAMPLE:
 *   <ShopMarker
 *     shop={shop}
 *     onPress={() => handleSelectShop(shop)}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { memo, useCallback, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

// 2. Third-party libraries
import { Ionicons } from "@expo/vector-icons";
import { Marker } from "react-native-maps";

// 3. Shared UI (design system)
import { BrandColors, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import type { Shop } from "@/stores/types/store.types";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Availability gradient colors (0-10 scale)
 * Based on map marker design: Dark (closed) → Red → Orange → Yellow → Green
 */
const AVAILABILITY_COLORS = [
  "#3D4654", // 0 - Dark/Closed
  "#E85D5D", // 1 - Red/Salmon
  "#E86A5D", // 2
  "#F28B5A", // 3 - Orange-Red
  "#F5A754", // 4 - Orange
  "#F5C254", // 5 - Yellow-Orange
  "#E8D44D", // 6 - Yellow
  "#C4D94D", // 7 - Yellow-Green
  "#8FD44D", // 8 - Light Green
  "#5FCF5F", // 9 - Green
  "#4CB34C", // 10 - Full Green
] as const;

// ============================================================================
// HELPERS
// ============================================================================

/** Get color based on availability score (0-10) */
function getAvailabilityColor(availability: number): string {
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

  // Safety check - if shop is invalid, don't render
  if (!shop || shop.latitude == null || shop.longitude == null) {
    return null;
  }

  // Get marker color based on availability (0-10 gradient)
  const backgroundColor = getAvailabilityColor(shop.availability ?? 0);

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
      coordinate={{ latitude: shop.latitude, longitude: shop.longitude }}
      onPress={handlePress}
      anchor={{ x: 0.5, y: 1 }} // Anchor at bottom center (tip of pointer)
      tracksViewChanges={false} // Performance optimization
    >
      <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
        {/* Badge with rating */}
        <View style={[styles.badge, { backgroundColor }]}>
          <Ionicons name="star" size={12} color={BrandColors.white} />
          <Text weight="semiBold" size={14} color={BrandColors.white}>
            {shop.rating?.toFixed(1) ?? "N/A"}
          </Text>
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
