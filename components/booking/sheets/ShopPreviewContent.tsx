/**
 * ShopPreviewContent
 *
 * PURPOSE: Displays shop card(s) inside the ServiceBottomSheet when a map pin is clicked
 *          Allows horizontal swiping between nearby shops
 *
 * USED IN: components/booking/ServiceBottomSheet.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewToken,
} from "react-native";

// 2. Third-party libraries
import { X } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors } from "@/components/shared-ui";

// 4. Flow-specific components
import { ShopCarouselCard } from "../ShopCarouselCard";

// 5. Constants, hooks, types, stores
import { BorderRadius, Spacing } from "@/constants/theme";
import type { Shop } from "@/stores/types/store.types";
import { useShopStore } from "@/stores/useShopStore";

// ============================================================================
// TYPES
// ============================================================================

interface ShopPreviewContentProps {
  /** Currently selected shop ID from map pin */
  selectedShopId: number | null;
  /** Called when active shop changes (for map focus) */
  onShopChange?: (shop: Shop) => void;
  /** Called when user taps "Details" on a shop */
  onShopDetails?: (shop: Shop) => void;
  /** Called when user taps the X button to close shop preview */
  onClose?: () => void;
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

export function ShopPreviewContent({
  selectedShopId,
  onShopChange,
  onShopDetails,
  onClose,
}: ShopPreviewContentProps) {
  // ═══════════════ REFS ═══════════════
  const flatListRef = useRef<FlatList<Shop>>(null);

  // ═══════════════ STATE ═══════════════
  const [activeIndex, setActiveIndex] = useState(0);

  // ═══════════════ STORE ═══════════════
  const shops = useShopStore((state) => state.shops);
  const shopIds = useShopStore((state) => state.shopIds);
  const getShopById = useShopStore((state) => state.getShopById);

  // ═══════════════ COMPUTED ═══════════════
  // Get the selected shop first, then nearby shops sorted by distance
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
        distance: calculateDistanceKm(
          selectedShop.latitude,
          selectedShop.longitude,
          shop.latitude,
          shop.longitude
        ),
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
      flatListRef.current.scrollToOffset({ offset: 0, animated: false });
      setActiveIndex(0);
    }
  }, [selectedShopId]);

  // Notify parent when active shop changes
  useEffect(() => {
    if (activeShop) {
      onShopChange?.(activeShop);
    }
  }, [activeShop, onShopChange]);

  // ═══════════════ HANDLERS ═══════════════
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  });

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  });

  const handleCall = useCallback(() => {
    // TODO: Implement phone call
  }, []);

  const handleDirections = useCallback(() => {
    // TODO: Open maps app with directions
  }, []);

  const handleDetails = useCallback(() => {
    if (activeShop) {
      onShopDetails?.(activeShop);
    }
  }, [activeShop, onShopDetails]);

  // ═══════════════ RENDER FUNCTIONS ═══════════════
  const renderShopCard = useCallback(
    ({ item, index }: { item: Shop; index: number }) => {
      const isActive = index === activeIndex;

      return (
        <View style={styles.cardContainer}>
          <ShopCarouselCard
            shop={item}
            isActive={isActive}
            onCall={handleCall}
            onDirections={handleDirections}
            onDetails={handleDetails}
          />
        </View>
      );
    },
    [activeIndex, handleCall, handleDirections, handleDetails]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: SNAP_INTERVAL,
      offset: SNAP_INTERVAL * index,
      index,
    }),
    []
  );

  // ═══════════════ RENDER ═══════════════
  if (shopsList.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Horizontal carousel */}
      <FlatList
        ref={flatListRef}
        data={shopsList}
        renderItem={renderShopCard}
        keyExtractor={(item) => `shop-preview-${item.id}`}
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

      {/* Page indicator dots */}
      {shopsList.length > 1 && (
        <View style={styles.dotsContainer}>
          {shopsList.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === activeIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}

      {/* X button - overlaid on top right of card */}
      <TouchableOpacity
        onPress={onClose}
        style={styles.closeButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <X size={20} color={BrandColors.primary} />
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.lg + Spacing.md,
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  carouselContent: {
    paddingHorizontal: Spacing.lg,
  },
  cardContainer: {
    width: CARD_WIDTH,
    marginRight: CARD_GAP,
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    backgroundColor: "#6B7280",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
