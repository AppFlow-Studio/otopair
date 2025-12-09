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

import { BrandColors } from "@/constants/theme";
import type { Shop } from "@/stores/types/store.types";
import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Colors for marker based on availability status */
const MarkerColors = {
  /** Available shops - green */
  available: "#4CB34C",
  /** Unavailable shops - dark gray */
  unavailable: "#3D4654",
} as const;

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

  // Get marker color based on availability
  const backgroundColor = shop.hasAvailableSlots ? MarkerColors.available : MarkerColors.unavailable;

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
          <Text style={styles.ratingText}>{shop.rating?.toFixed(1) ?? "N/A"}</Text>
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
