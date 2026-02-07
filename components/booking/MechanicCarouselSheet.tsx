/**
 * MechanicCarouselSheet
 *
 * PURPOSE: Life360-style floating card carousel for shops
 *          Appears when a map marker is selected, allows swiping between nearby shops
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - visible (boolean): Whether the carousel is visible
 *   - selectedShopId (number | null): Currently selected shop from map
 *   - onClose (() => void): Called when carousel is dismissed
 *   - onShopChange ((shop: Shop) => void): Called when a shop card becomes active
 *
 * FEATURES:
 *   - Floating card carousel (no bottom sheet chrome)
 *   - Horizontal FlatList with paging for shop cards
 *   - Smooth slide-up animation on appear
 *   - Tap outside to dismiss
 *
 * EXAMPLE:
 *   <MechanicCarouselSheet
 *     visible={isCarouselVisible}
 *     selectedShopId={selectedMapShopId}
 *     onClose={() => setIsCarouselVisible(false)}
 *     onMechanicChange={(shop) => setFocusedShop(shop)}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, View, ViewToken } from "react-native";

// 2. Expo & Third-party
import Animated, { SlideInDown, SlideOutDown, FadeIn, FadeOut } from "react-native-reanimated";

// 3. Shared UI (design system)
// (none required)

// 4. Flow-specific components
import { ShopCarouselCard } from "./ShopCarouselCard";

// 5. Constants, hooks, types, stores
import { Spacing } from "@/constants/theme";
import type { Shop } from "@/stores/types/store.types";
import { useShopStore } from "@/stores/useShopStore";
import { openMapsForAddress, openPhone } from "@/utils/linking";

// ============================================================================
// TYPES
// ============================================================================

export interface MechanicCarouselSheetProps {
  /** Whether the carousel is visible */
  visible: boolean;
  /** Currently selected shop from map marker */
  selectedShopId: number | null;
  /** Called when carousel is dismissed */
  onClose?: () => void;
  /** Called when a shop card becomes active */
  onMechanicChange?: (shop: Shop) => void;
  /** Called when user wants to proceed with booking */
  onMechanicSelect?: (shop: Shop) => void;
  /** Vertical offset from bottom */
  offsetY?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;
const CARD_GAP = Spacing.md;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

// ============================================================================
// HELPERS
// ============================================================================

/** Calculate distance between two coordinates using Haversine formula (returns km) */
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MechanicCarouselSheet({
  visible,
  selectedShopId,
  onClose,
  onMechanicChange,
  onMechanicSelect,
  offsetY = 0,
}: MechanicCarouselSheetProps) {
  // ═══════════════ REFS ═══════════════
  const flatListRef = useRef<FlatList<Shop>>(null);

  // ═══════════════ STATE ═══════════════
  const [activeIndex, setActiveIndex] = useState(0);

  // ═══════════════ STORE ═══════════════
  const shops = useShopStore((state) => state.shops);
  const shopIds = useShopStore((state) => state.shopIds);
  const getShopById = useShopStore((state) => state.getShopById);

  // ═══════════════ COMPUTED ═══════════════
  // Get the selected shop first, then nearby shops sorted by distance from selected shop
  const shopsList = useMemo(() => {
    if (!selectedShopId) {
      return [];
    }

    const selectedShop = getShopById(selectedShopId);
    if (!selectedShop) {
      return [];
    }

    // Get all other shops and calculate distance from selected shop
    const otherShopsWithDistance = shopIds
      .filter((id) => id !== selectedShopId)
      .map((id) => shops[id])
      .filter(Boolean)
      .map((shop) => ({
        shop,
        distance: calculateDistanceKm(selectedShop.latitude, selectedShop.longitude, shop.latitude, shop.longitude),
      }))
      // Sort by distance from selected shop (nearest first)
      .sort((a, b) => a.distance - b.distance)
      // Take the 9 nearest shops
      .slice(0, 9)
      .map(({ shop }) => shop);

    // Selected shop first, then nearest shops
    return [selectedShop, ...otherShopsWithDistance];
  }, [selectedShopId, shops, shopIds, getShopById]);

  const activeShop = shopsList[activeIndex] ?? null;

  // ═══════════════ EFFECTS ═══════════════
  // Reset to first card when selected shop changes
  useEffect(() => {
    if (selectedShopId && flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      setActiveIndex(0);
    }
  }, [selectedShopId]);

  // Notify parent when active shop changes
  useEffect(() => {
    if (activeShop) {
      onMechanicChange?.(activeShop);
    }
  }, [activeShop, onMechanicChange]);

  // ═══════════════ HANDLERS ═══════════════
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  });

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  });

  const handleDetails = useCallback(() => {
    if (activeShop) {
      onMechanicSelect?.(activeShop);
    }
  }, [activeShop, onMechanicSelect]);

  const handleBackdropPress = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // ═══════════════ RENDER FUNCTIONS ═══════════════
  const renderShopCard = useCallback(
    ({ item, index }: { item: Shop; index: number }) => {
      const isActive = index === activeIndex;

      return (
        <View style={styles.cardContainer}>
          <ShopCarouselCard
            shop={item}
            isActive={isActive}
            onCall={() => item.phone && openPhone(item.phone)}
            onDirections={() => openMapsForAddress(item.address)}
            onDetails={handleDetails}
          />
        </View>
      );
    },
    [activeIndex, handleDetails],
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SNAP_INTERVAL,
      offset: SNAP_INTERVAL * index,
      index,
    }),
    [],
  );

  // ═══════════════ RENDER ═══════════════
  if (!visible || shopsList.length === 0) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Invisible backdrop to detect taps outside */}
      <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={StyleSheet.absoluteFill}>
        <Pressable style={styles.backdrop} onPress={handleBackdropPress} />
      </Animated.View>

      {/* Floating carousel container - reduced spring animation */}
      <Animated.View
        entering={SlideInDown.duration(300).damping(18)}
        exiting={SlideOutDown.duration(200)}
        style={[styles.carouselWrapper, { bottom: offsetY + Spacing.lg }]}
        pointerEvents="box-none"
      >
        {/* Horizontal carousel */}
        <FlatList
          ref={flatListRef}
          data={shopsList}
          renderItem={renderShopCard}
          keyExtractor={(item) => `shop-${item.id}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP_INTERVAL}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={styles.carouselContent}
          getItemLayout={getItemLayout}
          viewabilityConfig={viewabilityConfig.current}
          onViewableItemsChanged={onViewableItemsChanged.current}
        />
      </Animated.View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  carouselWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  carouselContent: {
    paddingHorizontal: Spacing.lg,
  },
  cardContainer: {
    width: CARD_WIDTH,
    marginRight: CARD_GAP,
  },
});
