/**
 * ShopMarker
 *
 * PURPOSE: Apple Maps style marker for shops
 * - Zoomed out: OtoPair pin icon
 * - Zoomed in: Circular logo icon with plain text name (like Apple Maps POIs)
 *
 * USED IN: components/booking/map.tsx
 *
 * PROPS:
 *   - shop (Shop): The shop data to display
 *   - onPress (() => void): Called when marker is tapped
 *   - showLabel (boolean): If true, show full label mode; if false, show pin only
 *
 * EXAMPLE:
 *   <ShopMarker
 *     shop={shop}
 *     onPress={() => handleShopSelect(shop)}
 *     showLabel={isZoomedIn}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { memo, useCallback, useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

// 2. Expo & Third-party
import { Marker } from "react-native-maps";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

// 3. Shared UI (design system)
// (none required)

// 4. Flow-specific components
// (none required)

// 5. Constants, hooks, types, stores
import type { Shop } from "@/stores/types/store.types";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Availability gradient colors (0-10 scale)
 * Based on design: Dark (closed) → Red → Orange → Yellow → Green
 */
const AVAILABILITY_GRADIENTS: { start: string; end: string }[] = [
  { start: "#4A5568", end: "#2D3748" }, // 0 - Dark/Closed
  { start: "#FC8181", end: "#E53E3E" }, // 1 - Red
  { start: "#F6AD55", end: "#DD6B20" }, // 2 - Orange-Red
  { start: "#F6AD55", end: "#ED8936" }, // 3 - Orange
  { start: "#FAF089", end: "#ECC94B" }, // 4 - Yellow-Orange
  { start: "#FAF089", end: "#F6E05E" }, // 5 - Yellow
  { start: "#9AE6B4", end: "#68D391" }, // 6 - Yellow-Green
  { start: "#68D391", end: "#48BB78" }, // 7 - Light Green
  { start: "#48BB78", end: "#38A169" }, // 8 - Green
  { start: "#38A169", end: "#2F855A" }, // 9 - Full Green
  { start: "#2F855A", end: "#276749" }, // 10 - Deep Green
];

const BADGE_SIZE = 10;
const ICON_SIZE = 24;

// ============================================================================
// HELPERS
// ============================================================================

/** Get gradient colors based on availability score (0-10) */
function getAvailabilityGradient(availability: number): { start: string; end: string } {
  const clamped = Math.max(0, Math.min(10, Math.round(availability)));
  return AVAILABILITY_GRADIENTS[clamped];
}

// ============================================================================
// TYPES
// ============================================================================

interface ShopMarkerProps {
  /** The shop data to display */
  shop: Shop;
  /** Called when marker is tapped */
  onPress?: () => void;
  /** Whether to show the name label (false = pin only, for zoomed out view) */
  showLabel?: boolean;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** OtoPair Logo Pin - the full teardrop pin icon (for zoomed out) */
function OtoPairPin({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 120 132" fill="none">
      {/* Main pin shape with gradient */}
      <Path
        d="M90 15.192C85.5727 11.1575 80.3846 8.04754 74.7397 6.04433C69.0948 4.04111 63.1068 3.185 57.1267 3.52619C51.1467 3.86738 45.2949 5.39899 39.9145 8.03124C34.534 10.6635 29.7333 14.3434 25.7936 18.8552C21.8539 23.367 18.8546 28.62 16.9716 34.3061C15.0885 39.9922 14.3596 45.997 14.8275 51.9685C15.2954 57.94 16.9508 63.7579 19.6965 69.0813C22.4423 74.4047 26.2231 79.1264 30.8175 82.9695C41.3211 91.7021 50.0973 102.324 56.6925 114.286C57.0149 114.881 57.4927 115.379 58.0751 115.725C58.6574 116.071 59.3226 116.252 60 116.251C60.6769 116.25 61.341 116.067 61.922 115.72C62.503 115.372 62.9792 114.874 63.3 114.278L63.6075 113.701C70.2501 101.884 79.0081 91.388 89.445 82.737C94.2816 78.5572 98.1713 73.394 100.854 67.592C103.538 61.7899 104.953 55.4823 105.005 49.0901C105.058 42.6978 103.747 36.3679 101.159 30.5225C98.5716 24.6771 94.7673 19.4507 90 15.192ZM60 67.5007C56.2916 67.5007 52.6665 66.4011 49.5831 64.3408C46.4996 62.2805 44.0964 59.3522 42.6773 55.9261C41.2581 52.5 40.8868 48.7299 41.6103 45.0928C42.3337 41.4557 44.1195 38.1147 46.7417 35.4925C49.364 32.8703 52.7049 31.0845 56.3421 30.361C59.9792 29.6376 63.7492 30.0089 67.1753 31.428C70.6014 32.8472 73.5298 35.2504 75.5901 38.3338C77.6503 41.4172 78.75 45.0424 78.75 48.7508C78.744 53.7217 76.7667 58.4874 73.2517 62.0024C69.7367 65.5174 64.971 67.4948 60 67.5007Z"
        fill="url(#pin_gradient)"
      />
      {/* Inner circle */}
      <Circle cx="60" cy="48" r="30" fill="url(#circle_gradient)" />
      {/* Wrench/Timer icon */}
      <Path
        d="M52.0381 16.9834C57.4005 15.6352 63.018 15.6743 68.3614 17.0957C68.9752 17.2602 69.5351 17.5829 69.9844 18.0322C70.4338 18.4816 70.7574 19.0414 70.9219 19.6553C71.0871 20.2716 71.0863 20.9212 70.92 21.5371C70.7536 22.1529 70.4274 22.7138 69.9747 23.1631L56.0977 37.04L58.0176 50.4814L71.459 52.4014L85.336 38.5244C85.7853 38.0717 86.3462 37.7454 86.962 37.5791C87.5779 37.4128 88.2275 37.412 88.8438 37.5771C89.4577 37.7417 90.0175 38.0653 90.4669 38.5146C90.9162 38.964 91.2389 39.5239 91.4034 40.1377C92.683 44.9133 92.8553 49.9072 91.9229 54.7422C88.854 69.5523 75.7355 80.6836 60.0157 80.6836C42.0185 80.6835 27.429 66.0939 27.4288 48.0967C27.4288 47.4476 27.4499 46.8028 27.4874 46.1631C27.6786 43.5991 28.1727 41.0565 28.9678 38.5898C30.6642 33.3272 33.6724 28.5824 37.7081 24.8027C41.7439 21.023 46.6756 18.3317 52.0381 16.9834Z"
        fill="url(#icon_gradient)"
      />
      <Defs>
        <LinearGradient id="pin_gradient" x1="60" y1="3" x2="60" y2="116" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#5299FE" />
          <Stop offset="1" stopColor="#70B7FF" />
        </LinearGradient>
        <LinearGradient id="circle_gradient" x1="60" y1="18" x2="60" y2="78" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#5299FE" />
          <Stop offset="1" stopColor="#70B7FF" />
        </LinearGradient>
        <LinearGradient id="icon_gradient" x1="60" y1="16" x2="60" y2="81" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#EBF4FF" />
          <Stop offset="1" stopColor="white" />
        </LinearGradient>
      </Defs>
    </Svg>
  );
}

/** Small circular logo icon (for zoomed in - like Apple Maps POI icons) */
function OtoPairCircleIcon({ size = ICON_SIZE }: { size?: number }) {
  return (
    <View style={styles.circleIconContainer}>
      <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
        {/* Outer circle with gradient */}
        <Circle cx="60" cy="60" r="58" fill="url(#circle_bg_small)" />
        {/* Inner circle */}
        <Circle cx="60" cy="60" r="45" fill="url(#inner_circle_small)" />
        {/* Wrench/Timer icon */}
        <Path
          d="M52.0381 26.9834C57.4005 25.6352 63.018 25.6743 68.3614 27.0957C68.9752 27.2602 69.5351 27.5829 69.9844 28.0322C70.4338 28.4816 70.7574 29.0414 70.9219 29.6553C71.0871 30.2716 71.0863 30.9212 70.92 31.5371C70.7536 32.1529 70.4274 32.7138 69.9747 33.1631L56.0977 47.04L58.0176 60.4814L71.459 62.4014L85.336 48.5244C85.7853 48.0717 86.3462 47.7454 86.962 47.5791C87.5779 47.4128 88.2275 47.412 88.8438 47.5771C89.4577 47.7417 90.0175 48.0653 90.4669 48.5146C90.9162 48.964 91.2389 49.5239 91.4034 50.1377C92.683 54.9133 92.8553 59.9072 91.9229 64.7422C88.854 79.5523 75.7355 90.6836 60.0157 90.6836C42.0185 90.6835 27.429 76.0939 27.4288 58.0967C27.4288 57.4476 27.4499 56.8028 27.4874 56.1631C27.6786 53.5991 28.1727 51.0565 28.9678 48.5898C30.6642 43.3272 33.6724 38.5824 37.7081 34.8027C41.7439 31.023 46.6756 28.3317 52.0381 26.9834Z"
          fill="url(#icon_grad_small)"
        />
        <Defs>
          <LinearGradient id="circle_bg_small" x1="60" y1="2" x2="60" y2="118" gradientUnits="userSpaceOnUse">
            <Stop stopColor="#5299FE" />
            <Stop offset="1" stopColor="#70B7FF" />
          </LinearGradient>
          <LinearGradient id="inner_circle_small" x1="60" y1="15" x2="60" y2="105" gradientUnits="userSpaceOnUse">
            <Stop stopColor="#5299FE" />
            <Stop offset="1" stopColor="#70B7FF" />
          </LinearGradient>
          <LinearGradient id="icon_grad_small" x1="60" y1="26" x2="60" y2="91" gradientUnits="userSpaceOnUse">
            <Stop stopColor="#EBF4FF" />
            <Stop offset="1" stopColor="white" />
          </LinearGradient>
        </Defs>
      </Svg>
    </View>
  );
}

/** Availability notification badge with gradient */
function AvailabilityBadge({ availability }: { availability: number }) {
  const gradient = getAvailabilityGradient(availability);
  const uniqueId = `badge_grad_${Math.random().toString(36).substr(2, 9)}`;

  return (
    <View style={styles.badgeContainer}>
      <Svg width={BADGE_SIZE} height={BADGE_SIZE} viewBox="0 0 10 10" fill="none">
        {/* White border */}
        <Circle cx="5" cy="5" r="5" fill="white" />
        {/* Gradient fill */}
        <Circle cx="5" cy="5" r="4" fill={`url(#${uniqueId})`} />
        <Defs>
          <LinearGradient id={uniqueId} x1="5" y1="1" x2="5" y2="9" gradientUnits="userSpaceOnUse">
            <Stop stopColor={gradient.start} />
            <Stop offset="1" stopColor={gradient.end} />
          </LinearGradient>
        </Defs>
      </Svg>
    </View>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

function ShopMarkerComponent({ shop, onPress, showLabel = true }: ShopMarkerProps) {
  // Animation for tap feedback
  const scaleAnim = useRef(new Animated.Value(1)).current;
  // Animation for crossfade between pin and label modes
  const modeAnim = useRef(new Animated.Value(showLabel ? 1 : 0)).current;

  // Crossfade animation when showLabel changes
  useEffect(() => {
    Animated.timing(modeAnim, {
      toValue: showLabel ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [showLabel, modeAnim]);

  const handlePress = useCallback(() => {
    // Quick scale animation for tap feedback
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.1,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onPress?.();
    });
  }, [onPress, scaleAnim]);

  // Safety check - if shop is invalid, don't render. (0,0) is the
  // placeholder for a shop that hasn't been geocoded yet — skip it so
  // the pin never lands in the Gulf of Guinea.
  // Must come AFTER all hooks to preserve hook order across renders.
  if (
    !shop ||
    shop.latitude == null ||
    shop.longitude == null ||
    (shop.latitude === 0 && shop.longitude === 0)
  ) {
    return null;
  }

  // Interpolate opacities for crossfade
  // Pin: visible when modeAnim = 0 (zoomed out), hidden when modeAnim = 1 (zoomed in)
  const pinOpacity = modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  // Label mode: visible when modeAnim = 1 (zoomed in), hidden when modeAnim = 0 (zoomed out)
  const labelModeOpacity = modeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Render both modes stacked, crossfading between them
  return (
    <Marker
      coordinate={{ latitude: shop.latitude, longitude: shop.longitude }}
      onPress={handlePress}
      anchor={{ x: 0.5, y: 0.5 }} // Center anchor
      tracksViewChanges={false}
    >
      <Animated.View style={[styles.markerContainer, { transform: [{ scale: scaleAnim }] }]}>
        {/* Pin mode (zoomed out) */}
        <Animated.View style={[styles.pinModeLayer, { opacity: pinOpacity }]}>
          <OtoPairPin size={32} />
        </Animated.View>

        {/* Label mode (zoomed in) */}
        <Animated.View style={[styles.labelModeLayer, { opacity: labelModeOpacity }]}>
          <OtoPairCircleIcon size={ICON_SIZE} />
          <View style={styles.labelWrapper}>
            <Animated.Text style={styles.labelText} numberOfLines={2}>
              {shop.name}
            </Animated.Text>
            <View style={styles.badgePositioner}>
              <AvailabilityBadge availability={shop.availability ?? 0} />
            </View>
          </View>
        </Animated.View>
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
  // Container for both modes (stacked for crossfade)
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 140,
    height: 50,
  },

  // Pin mode layer (zoomed out)
  pinModeLayer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "flex-end",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },

  // Label mode layer (zoomed in)
  labelModeLayer: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
  },
  circleIconContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  labelWrapper: {
    position: "relative",
    marginLeft: 3,
    maxWidth: 100,
  },
  labelText: {
    fontFamily: "Urbanist-Bold",
    fontSize: 12,
    color: "#FFFFFF",
    letterSpacing: 0.1,
    lineHeight: 14,
    // Text shadow for readability on map
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    paddingRight: 10, // Space for badge
  },
  badgePositioner: {
    position: "absolute",
    top: -3,
    right: 0,
  },
  badgeContainer: {
    // Just the badge itself, no extra margin needed
  },
});
