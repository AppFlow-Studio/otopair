/**
 * ShopCarousel
 *
 * PURPOSE: Displays a horizontal scrollable carousel of shop cards with frosted glass effect
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - shops (Shop[]): Array of shop objects to display
 *   - selectedShopId (string): ID of currently selected shop [optional]
 *   - onShopSelect ((shop: Shop) => void): Called when a shop card is tapped [optional]
 *
 * EXAMPLE:
 *   <ShopCarousel
 *     shops={nearbyShops}
 *     selectedShopId="shop_1"
 *     onShopSelect={(shop) => console.log("Selected:", shop.name)}
 *   />
 *
 * OWNER: Waleed Mansour
 */

import { BrandColors, Spacing, Text } from "@/components/shared-ui";
import { BorderRadius } from "@/constants/theme";
import type { Shop } from "@/stores/types/store.types";
import { BlurView } from "expo-blur";
import { BriefcaseBusiness } from "lucide-react-native";
import React, { useCallback } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";

// ============================================================================
// TYPES
// ============================================================================

interface ShopCarouselProps {
  /** Array of shop objects to display */
  shops: Shop[];
  /** ID of currently selected shop */
  selectedShopId?: string;
  /** Called when a shop card is tapped */
  onShopSelect?: (shop: Shop) => void;
  /** Vertical offset to shift carousel down (pixels) */
  offsetY?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ShopCarousel({ shops, selectedShopId, onShopSelect, offsetY = 0 }: ShopCarouselProps) {
  const { height } = Dimensions.get("window");
  // Position just above the ServiceBottomSheet collapsed position (22% from bottom)
  const bottomSheetCollapsedHeight = height * 0.22;
  const bottomPosition = bottomSheetCollapsedHeight + Spacing.md - offsetY;

  const handleCardPress = useCallback(
    (shop: Shop) => {
      onShopSelect?.(shop);
    },
    [onShopSelect]
  );

  const renderShopCard = useCallback(
    (shop: Shop, index: number) => {
      const isSelected = shop.id === selectedShopId;

      return (
        <Pressable
          key={shop.id}
          style={[styles.cardWrapper, index === 0 && styles.firstCard, index === shops.length - 1 && styles.lastCard]}
          onPress={() => handleCardPress(shop)}
        >
          <BlurView intensity={85} tint="light" style={[styles.card, isSelected && styles.cardSelected]}>
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
                  <View style={styles.ratingBadge}>
                    <Text size="xs" color={BrandColors.secondary}>
                      ★
                    </Text>
                    <Text weight="semiBold" size="xs" color={BrandColors.primary}>
                      {shop.rating}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardDetails}>
                  <Text size="xs" color="#6B7280">
                    {shop.address}
                  </Text>
                  <Text size="xs" color="#6B7280">
                    {" • "}
                  </Text>
                  <Text size="xs" color="#6B7280">
                    {shop.distance}
                  </Text>
                  <Text size="xs" color="#6B7280">
                    {" • "}
                  </Text>
                  <Text size="xs" color={shop.isOpen ? "#22C55E" : "#EF4444"} weight="medium">
                    {shop.isOpen ? "Open" : "Closed"}
                  </Text>
                  {shop.isVerified && (
                    <View style={styles.verifiedBadge}>
                      <Text size="xs" color="#22C55E">
                        ✓ Verified
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </BlurView>
        </Pressable>
      );
    },
    [selectedShopId, handleCardPress, shops.length]
  );

  if (shops.length === 0) {
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
        {shops.map(renderShopCard)}
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
  cardSelected: {
    borderWidth: 2,
    borderColor: BrandColors.secondary,
  },
  frostedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
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
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: Spacing.sm,
  },
});

