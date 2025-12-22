/**
 * ShopMarker
 *
 * PURPOSE: Simple map pin marker for mechanic shops
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

// 2. Expo & Third-party
import { MapPin } from "lucide-react-native";
import { Marker } from "react-native-maps";

// 3. Constants, hooks, types, stores
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

  // Get pin color based on availability (0-10 gradient)
  const pinColor = getAvailabilityColor(shop.availability ?? 0);

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
      anchor={{ x: 0.5, y: 1 }} // Anchor at bottom center (tip of pin)
      tracksViewChanges={false} // Performance optimization
    >
      <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.pinContainer}>
          <MapPin size={36} color={pinColor} fill={pinColor} strokeWidth={2} />
          {/* Transparent circle overlay */}
          <View style={styles.circleOverlay} />
        </View>
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
  pinContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  circleOverlay: {
    position: "absolute",
    top: 9,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "white",
  },
});
