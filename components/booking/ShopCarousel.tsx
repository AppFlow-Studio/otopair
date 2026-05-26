/**
 * ShopCarousel
 *
 * PURPOSE: Displays a horizontal scrollable carousel of shop cards with frosted glass effect
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - shops (Shop[]): Array of shop objects to display
 *   - userLocation (UserLocation): User's location for distance calculation
 *   - onShopSelect ((shop: Shop) => void): Called when a shop card is tapped
 *
 * EXAMPLE:
 *   <ShopCarousel
 *     shops={nearbyShops}
 *     userLocation={userLocation}
 *     onShopSelect={(shop) => handleShopSelect(shop)}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useMemo, useRef } from "react";
import { Animated, Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";

// 2. Expo & Third-party
import { BlurView } from "expo-blur";
import { BriefcaseBusiness } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius } from "@/constants/theme";
import { useDistanceUnit } from "@/hooks/useDistanceUnit";
import type { Shop, UserLocation } from "@/stores/types/store.types";
import { calculateDistanceKm, formatProximityDistanceFromKm } from "@/utils/geo";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Availability gradient colors (0-10 scale)
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

/** Get color based on availability score (0-10) */
function getAvailabilityColor(availability: number): string {
  const clamped = Math.max(0, Math.min(10, Math.round(availability)));
  return AVAILABILITY_COLORS[clamped];
}

/** Get availability label */
function getAvailabilityLabel(availability: number): string {
  if (availability === 0) return "Closed";
  if (availability <= 3) return "Low";
  if (availability <= 6) return "Medium";
  if (availability <= 8) return "Good";
  return "High";
}

// ============================================================================
// TYPES
// ============================================================================

interface ShopCarouselProps {
  /** Array of shop objects to display */
  shops: Shop[];
  /** User's current location for distance calculation */
  userLocation?: UserLocation | null;
  /** Called when a shop card is tapped */
  onShopSelect?: (shop: Shop) => void;
  /** Vertical offset to shift carousel down (pixels) */
  offsetY?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ShopCarousel({ shops, userLocation, onShopSelect, offsetY = 0 }: ShopCarouselProps) {
  const distanceUnit = useDistanceUnit();
  const { height } = Dimensions.get("window");
  // Position just above the ServiceBottomSheet collapsed position (22% from bottom)
  const bottomSheetCollapsedHeight = height * 0.22;
  const bottomPosition = bottomSheetCollapsedHeight + Spacing.md - offsetY;

  // Store animation refs for each shop card
  const animationRefs = useRef<Record<string, Animated.Value>>({});

  // Pre-calculate distances for all shops
  const shopDistances = useMemo(() => {
    if (!userLocation?.latitude || !userLocation?.longitude || !shops) return {};
    const distances: Record<string, string> = {};
    shops.forEach((shop) => {
      if (shop && shop.latitude != null && shop.longitude != null) {
        const dist = calculateDistanceKm(userLocation.latitude, userLocation.longitude, shop.latitude, shop.longitude);
        distances[shop.id] = formatProximityDistanceFromKm(dist, distanceUnit);
      }
    });
    return distances;
  }, [shops, userLocation, distanceUnit]);

  // Get or create animation value for a shop
  const getAnimValue = useCallback((shopId: string) => {
    if (!animationRefs.current[shopId]) {
      animationRefs.current[shopId] = new Animated.Value(1);
    }
    return animationRefs.current[shopId];
  }, []);

  const handleCardPress = useCallback(
    (shop: Shop) => {
      const scaleAnim = getAnimValue(shop.id);

      // Quick scale animation for tap feedback
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Trigger onShopSelect after animation completes
        onShopSelect?.(shop);
      });
    },
    [onShopSelect, getAnimValue]
  );

  const renderShopCard = useCallback(
    (shop: Shop, index: number, totalShops: number) => {
      if (!shop) return null;
      const scaleAnim = getAnimValue(shop.id);

      return (
        <Pressable
          key={`card-${shop.id}`}
          style={[styles.cardWrapper, index === 0 && styles.firstCard, index === totalShops - 1 && styles.lastCard]}
          onPress={() => handleCardPress(shop)}
        >
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <BlurView intensity={60} tint="light" style={styles.card}>
              <View style={styles.frostedOverlay} />
              <View style={styles.cardContent}>
                <View style={styles.cardIcon}>
                  <BriefcaseBusiness size={24} color={BrandColors.secondary} />
                </View>
                <View style={styles.cardInfo}>
                  <View style={styles.cardHeader}>
                    <Text weight="semiBold" size="md" color={BrandColors.primary}>
                      {shop.name}
                    </Text>
                    {shop.rating && (
                      <View style={styles.ratingBadge}>
                        <Text size="xs" color={BrandColors.secondary}>
                          ★
                        </Text>
                        <Text weight="semiBold" size="xs" color={BrandColors.primary}>
                          {shop.rating.toFixed(1)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.cardDetails}>
                    <Text size="xs" color="#6B7280">
                      {shop.address}
                    </Text>
                    {shopDistances[shop.id] && (
                      <>
                        <Text size="xs" color="#6B7280">
                          {" • "}
                        </Text>
                        <Text size="xs" color="#6B7280">
                          {shopDistances[shop.id]}
                        </Text>
                      </>
                    )}
                    <Text size="xs" color="#6B7280">
                      {" • "}
                    </Text>
                    <Text size="xs" color={getAvailabilityColor(shop.availability)} weight="medium">
                      {getAvailabilityLabel(shop.availability)}
                    </Text>
                  </View>
                </View>
              </View>
            </BlurView>
          </Animated.View>
        </Pressable>
      );
    },
    [handleCardPress, getAnimValue, shopDistances]
  );

  if (!shops || shops.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, { bottom: bottomPosition }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        snapToInterval={SNAP_INTERVAL}
        decelerationRate="fast"
        snapToAlignment="start"
      >
        {shops.map((shop, index) => renderShopCard(shop, index, shops.length))}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;
const SNAP_INTERVAL = CARD_WIDTH + Spacing.md;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  cardWrapper: {
    width: CARD_WIDTH,
  },
  firstCard: {
    marginLeft: 0,
  },
  lastCard: {
    marginRight: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    overflow: "hidden",
  },
  frostedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  cardInfo: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardDetails: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
});
