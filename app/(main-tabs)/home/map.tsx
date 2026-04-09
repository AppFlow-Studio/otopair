/**
 * BookingsScreen
 *
 * PURPOSE: Main screen for discovering and booking auto repair shops
 *
 * FLOW: service → mechanic → booking → confirmation
 *
 * USED IN: app/(main-tabs)/bookings/_layout.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BlurView } from "expo-blur";
import { useNavigation, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import MapView from "react-native-maps";
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 4. Flow-specific components
import {
  BookingMap,
  FilterDropdown,
  FloatingMapControls,
  FullScreenBookingView,
  ServiceBottomSheet,
  Shop,
} from "@/components/booking";

// 5. Shared UI (design system)
import { BrandColors } from "@/components/shared-ui";

// 6. Constants, hooks, types, stores
import { AVAILABLE_NOW_FILTER, SHOP_FILTER_OPTIONS, TOP_RATED_FILTER } from "@/constants/filters";
import { BorderRadius, Spacing } from "@/constants/theme";
import type { FilterOption } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { usePendingNavigationStore } from "@/stores/usePendingNavigationStore";
import { useShopStore } from "@/stores/useShopStore";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Vertical offset for bottom sheet and carousel */
const VERTICAL_OFFSET = 55;

// ============================================================================
// COMPONENT
// ============================================================================

export default function BookingsScreen() {
  // ═══════════════ HOOKS ═══════════════
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Hide tab bar when map is open so bottom sheet can cover it
  useLayoutEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({
        tabBarStyle: { display: "none" },
      });
    }
    return () => {
      if (parent) {
        parent.setOptions({
          tabBarStyle: undefined,
        });
      }
    };
  }, [navigation]);

  // ═══════════════ REFS ═══════════════
  const mapRef = useRef<MapView>(null);

  // ═══════════════ BOOKING STORE ═══════════════
  const userLocation = useBookingStore((state) => state.userLocation);
  const bookingStage = useBookingStore((state) => state.bookingStage);

  // ═══════════════ COMPUTED: Full-screen stages ═══════════════
  const isFullScreenStage = bookingStage === "booking_details" || bookingStage === "payment";

  // ═══════════════ LOCAL STATE ═══════════════
  const [sheetAnimatedIndex, setSheetAnimatedIndex] = useState<SharedValue<number> | null>(null);
  const [mapRelevantIndex, setMapRelevantIndex] = useState<SharedValue<number> | null>(null);
  const [selectedMapShopId, setSelectedMapShopId] = useState<number | null>(null);
  const [shopPreviewRequestKey, setShopPreviewRequestKey] = useState(0);
  const [focusedShop, setFocusedShop] = useState<Shop | null>(null);

  // Search mode state (controlled by ServiceBottomSheet)
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Filter dropdown state
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Track if any filter is active
  const [hasActiveFilter, setHasActiveFilter] = useState(false);

  const handleAnimatedIndexChange = useCallback((animatedIndex: SharedValue<number>) => {
    setSheetAnimatedIndex(animatedIndex);
  }, []);

  const handleMapRelevantIndexChange = useCallback((index: SharedValue<number>) => {
    setMapRelevantIndex(index);
  }, []);

  /** For map/back controls: uses smoothly animated value when opening car selection, else sheet index */
  const indexForMap = mapRelevantIndex ?? sheetAnimatedIndex;

  // ═══════════════ SHOP STORE ═══════════════
  const selectShop = useShopStore((state) => state.selectShop);
  const setFilters = useShopStore((state) => state.setFilters);

  // ═══════════════ HANDLERS ═══════════════

  // Filter handlers
  const handleFilterPress = useCallback(() => {
    setIsFilterOpen(true);
  }, []);

  const handleFilterDismiss = useCallback(() => {
    setIsFilterOpen(false);
  }, []);

  const handleFilterSelect = useCallback(
    (optionId: string) => {
      setIsFilterOpen(false);
      const filter = optionId as FilterOption;
      if (filter === "available_now") {
        setFilters(AVAILABLE_NOW_FILTER);
        setHasActiveFilter(true);
      } else if (filter === "top_rated") {
        setFilters(TOP_RATED_FILTER);
        setHasActiveFilter(true);
      } else {
        setFilters({ availableOnly: false, minRating: 0 });
        setHasActiveFilter(false);
      }
    },
    [setFilters]
  );

  // Recenter handler
  const handleRecenter = useCallback(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        300
      );
    }
  }, [userLocation]);

  // Search mode change handler (from ServiceBottomSheet)
  const handleSearchModeChange = useCallback((isSearching: boolean) => {
    setIsSearchMode(isSearching);
  }, []);

  // Search result handlers
  const handleSearchSelectShop = useCallback(
    (shopId: number) => {
      router.push(`/home/shop/${shopId}`);
    },
    [router]
  );

  const handleSearchSelectMechanic = useCallback(
    (mechanicId: number) => {
      router.push(`/home/mechanic/${mechanicId}`);
    },
    [router]
  );

  // Shop/Map handlers
  const handleShopSelect = useCallback(
    (shop: Shop) => {
      selectShop(shop.id);
      setSelectedMapShopId(shop.id);
      setFocusedShop(shop);
      setShopPreviewRequestKey((prev) => prev + 1);
    },
    [selectShop]
  );

  // Called when shop changes in the carousel (from ServiceBottomSheet)
  const handleShopChange = useCallback((shop: { id: number; latitude: number; longitude: number }) => {
    // Focus the map on the new shop
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: shop.latitude,
          longitude: shop.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        300
      );
    }
  }, []);

  // Called when shop preview is closed
  const handleShopClose = useCallback(() => {
    setSelectedMapShopId(null);
    setFocusedShop(null);
    selectShop(null);
  }, [selectShop]);

  // Back button handler
  const handleBackPress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(main-tabs)/home");
    }
  }, [router]);

  // Add vehicle from car selection: back (dismiss modal) then navigate to cars from home
  const setPendingNavigateToCars = usePendingNavigationStore((s) => s.setPendingNavigateToCars);
  const handleAddVehicle = useCallback(() => {
    setPendingNavigateToCars(true);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(main-tabs)/home");
    }
  }, [router, setPendingNavigateToCars]);

  // ═══════════════ ANIMATED STYLES ═══════════════
  // Fade out and slide left when sheet is fully expanded (same as map controls)
  const backButtonAnimatedStyle = useAnimatedStyle(() => {
    if (!indexForMap) {
      return { opacity: 1, transform: [{ translateX: 0 }] };
    }

    // Start fading at index 2.5, fully hidden at index 3
    const opacity = interpolate(indexForMap.value, [2.5, 3], [1, 0], Extrapolation.CLAMP);

    // Slide left (opposite of map controls which slide right)
    const translateX = interpolate(indexForMap.value, [2.5, 3], [0, -60], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ translateX }],
    };
  }, [indexForMap]);

  // ═══════════════ RENDER ═══════════════
  // Full-screen stages (booking_details, payment) are rendered on top of everything
  if (isFullScreenStage) {
    return <FullScreenBookingView />;
  }

  return (
    <View style={styles.container}>
      {/* Map - dynamically loads pins based on current view */}
      <BookingMap
        ref={mapRef}
        onShopSelect={handleShopSelect}
        sheetAnimatedIndex={indexForMap ?? undefined}
        focusedShop={focusedShop}
      />

      {/* Floating Back Button - Top Left */}
      {/* Hidden when sheet is fully expanded OR in search mode */}
      {!isSearchMode && (
        <Animated.View style={[styles.backButtonContainer, { top: insets.top + Spacing.md }, backButtonAnimatedStyle]}>
          <BlurView intensity={80} tint="light" style={styles.backButtonBlur}>
            <View style={styles.backButtonOverlay} />
            <TouchableOpacity
              onPress={handleBackPress}
              style={styles.backButton}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronLeft size={24} color={BrandColors.primary} strokeWidth={2.5} />
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      )}

      {/* Floating Map Controls - Filter & Recenter buttons */}
      {/* Hidden when sheet is fully expanded OR in search mode */}
      {!isSearchMode && (
        <FloatingMapControls
          onFilterPress={handleFilterPress}
          onRecenterPress={handleRecenter}
          isFilterActive={hasActiveFilter}
          sheetAnimatedIndex={indexForMap ?? undefined}
        />
      )}

      {/* Filter Dropdown */}
      <FilterDropdown
        visible={isFilterOpen}
        options={SHOP_FILTER_OPTIONS}
        onSelect={handleFilterSelect}
        onDismiss={handleFilterDismiss}
      />

      {/* Bottom Sheet - Uses transition hook internally */}
      {/* Shop preview is integrated into the sheet when a map pin is clicked */}
      <ServiceBottomSheet
        offsetY={VERTICAL_OFFSET}
        onAnimatedIndexChange={handleAnimatedIndexChange}
        onMapRelevantIndexChange={handleMapRelevantIndexChange}
        onSelectShop={handleSearchSelectShop}
        onSelectMechanic={handleSearchSelectMechanic}
        onSearchModeChange={handleSearchModeChange}
        selectedShopId={selectedMapShopId}
        shopPreviewKey={shopPreviewRequestKey}
        onShopChange={handleShopChange}
        onShopClose={handleShopClose}
        onAddVehicle={handleAddVehicle}
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8ECF0",
  },
  backButtonContainer: {
    position: "absolute",
    left: Spacing.lg,
    zIndex: 10,
  },
  backButtonBlur: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  backButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
