/**
 * CarSelectionContent
 *
 * PURPOSE: Displays a swipeable carousel of vehicle cards for selecting which car to service
 *          Shown when user taps the car icon in the ServiceBottomSheet header
 *          Follows the same pattern as ShopPreviewContent
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
import { BrandColors, Text } from "@/components/shared-ui";

// 4. Flow-specific components
import { CarSelectionCard } from "../CarSelectionCard";

// 5. Constants, hooks, types, stores
import { BorderRadius, Spacing } from "@/constants/theme";
import { useVehicleStore, type Vehicle } from "@/stores/useVehicleStore";

// ============================================================================
// TYPES
// ============================================================================

interface CarSelectionContentProps {
  /** Called when user closes the car selection (X button or after selection) */
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
// COMPONENT
// ============================================================================

export function CarSelectionContent({ onClose }: CarSelectionContentProps) {
  // ═══════════════ REFS ═══════════════
  const flatListRef = useRef<FlatList<Vehicle>>(null);

  // ═══════════════ STATE ═══════════════
  const [activeIndex, setActiveIndex] = useState(0);

  // ═══════════════ STORE ═══════════════
  const vehicles = useVehicleStore((state) => state.vehicles);
  const vehicleIds = useVehicleStore((state) => state.vehicleIds);
  const selectedVehicleId = useVehicleStore((state) => state.selectedVehicleId);
  const selectVehicle = useVehicleStore((state) => state.selectVehicle);

  // ═══════════════ COMPUTED ═══════════════
  // Get vehicles list with selected vehicle first
  const vehiclesList = useMemo(() => {
    const allVehicles = vehicleIds.map((id) => vehicles[id]).filter(Boolean);
    
    // If there's a selected vehicle, put it first
    if (selectedVehicleId) {
      const selectedVehicle = vehicles[selectedVehicleId];
      if (selectedVehicle) {
        const otherVehicles = allVehicles.filter((v) => v.id !== selectedVehicleId);
        return [selectedVehicle, ...otherVehicles];
      }
    }
    
    return allVehicles;
  }, [vehicles, vehicleIds, selectedVehicleId]);

  const activeVehicle = vehiclesList[activeIndex] ?? null;

  // ═══════════════ EFFECTS ═══════════════
  // Reset to first card when component mounts
  useEffect(() => {
    if (flatListRef.current) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: false });
      setActiveIndex(0);
    }
  }, []);

  // ═══════════════ HANDLERS ═══════════════
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  });

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  });

  const handleSelect = useCallback(() => {
    if (activeVehicle) {
      selectVehicle(activeVehicle.id);
      onClose?.();
    }
  }, [activeVehicle, selectVehicle, onClose]);

  // ═══════════════ RENDER FUNCTIONS ═══════════════
  const renderVehicleCard = useCallback(
    ({ item, index }: { item: Vehicle; index: number }) => {
      const isActive = index === activeIndex;
      const isSelected = item.id === selectedVehicleId;

      return (
        <View style={styles.cardContainer}>
          <CarSelectionCard
            vehicle={item}
            isActive={isActive}
            isSelected={isSelected}
            onSelect={handleSelect}
          />
        </View>
      );
    },
    [activeIndex, selectedVehicleId, handleSelect]
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
  if (vehiclesList.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text size="lg" weight="medium" color="#6B7280" center>
          No vehicles found
        </Text>
        <Text size="md" color="#9CA3AF" center style={{ marginTop: Spacing.sm }}>
          Add a vehicle to get started
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Horizontal carousel */}
      <FlatList
        ref={flatListRef}
        data={vehiclesList}
        renderItem={renderVehicleCard}
        keyExtractor={(item) => `vehicle-preview-${item.id}`}
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
        style={styles.carousel}
      />

      {/* Pagination Dots - iOS style */}
      {vehiclesList.length > 1 && (
        <View style={styles.paginationDots}>
          {vehiclesList.map((vehicle, index) => (
            <View
              key={vehicle.id}
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
    // Don't use flex: 1 so content doesn't expand beyond natural size
  },
  carousel: {
    flexGrow: 0,
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
  paginationDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: Spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    backgroundColor: BrandColors.secondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
});
