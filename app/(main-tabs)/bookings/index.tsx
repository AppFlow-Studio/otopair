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
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

// 2. Third-party libraries
import { SharedValue } from "react-native-reanimated";

// 3. Shared UI (design system)
import { ScreenContainer } from "@/components/shared-ui";

// 4. Flow-specific components
import {
  BookingMap,
  MechanicCarouselSheet,
  MechanicFilterOption,
  Region,
  SearchAreaButton,
  ServiceBottomSheet,
  Shop,
  TopBar,
} from "@/components/booking";

// 5. Constants, hooks, types, stores
import { AVAILABLE_NOW_FILTER, TOP_RATED_FILTER } from "@/constants/filters";
import { getServiceIdsForCategory } from "@/constants/services";
import type { FilterOption, ServiceCategory } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Vertical offset for bottom sheet and carousel */
const VERTICAL_OFFSET = 35;

// ============================================================================
// COMPONENT
// ============================================================================

export default function BookingsScreen() {
  // ═══════════════ BOOKING STORE ═══════════════
  const userLocation = useBookingStore((state) => state.userLocation);
  const selectedServiceCategory = useBookingStore((state) => state.selectedServiceCategory);
  const setSelectedServiceCategory = useBookingStore((state) => state.setSelectedServiceCategory);
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const getSelectedServices = useBookingStore((state) => state.getSelectedServices);
  const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);

  // ═══════════════ MECHANIC STORE ═══════════════
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);

  // ═══════════════ LOCAL STATE ═══════════════
  const [mechanicFilter, setMechanicFilter] = useState<MechanicFilterOption>("available_now");
  const [sheetAnimatedIndex, setSheetAnimatedIndex] = useState<SharedValue<number> | null>(null);
  const [isCarouselVisible, setIsCarouselVisible] = useState(false);
  const [selectedMapShopId, setSelectedMapShopId] = useState<number | null>(null);
  const [focusedShop, setFocusedShop] = useState<Shop | null>(null);

  // Search area state - initially show closest 10, button hidden until user pans
  const [showSearchButton, setShowSearchButton] = useState(false);
  const [lastSearchedRegion, setLastSearchedRegion] = useState<Region | null>(null);
  const currentRegionRef = React.useRef<Region | null>(null);
  const hasInitializedRef = React.useRef(false);

  const handleAnimatedIndexChange = useCallback((animatedIndex: SharedValue<number>) => {
    setSheetAnimatedIndex(animatedIndex);
  }, []);

  // ═══════════════ SHOP STORE ═══════════════
  const selectShop = useShopStore((state) => state.selectShop);
  const setFilters = useShopStore((state) => state.setFilters);

  // ═══════════════ HANDLERS ═══════════════
  const handleFilterSelect = useCallback(
    (filter: FilterOption) => {
      if (filter === "available_now") {
        setFilters(AVAILABLE_NOW_FILTER);
      } else if (filter === "top_rated") {
        setFilters(TOP_RATED_FILTER);
      } else {
        setFilters({ availableOnly: false, minRating: 0 });
      }
    },
    [setFilters]
  );

  const selectedServiceRef = React.useRef(selectedServiceCategory);
  selectedServiceRef.current = selectedServiceCategory;

  const handleServiceSelect = useCallback(
    (service: ServiceCategory) => {
      const isCurrentlySelected = selectedServiceRef.current === service;

      if (isCurrentlySelected) {
        setSelectedServiceCategory(null);
        setFilters({ serviceIds: [] });
      } else {
        const serviceIds = getServiceIdsForCategory(service);
        setSelectedServiceCategory(service);
        setFilters({ serviceIds });
      }
    },
    [setSelectedServiceCategory, setFilters]
  );

  const handleShopSelect = useCallback(
    (shop: Shop) => {
      selectShop(shop.id);
      // Show the mechanic carousel sheet when a map marker is tapped
      setSelectedMapShopId(shop.id);
      setIsCarouselVisible(true);
    },
    [selectShop]
  );

  const handleCarouselClose = useCallback(() => {
    setIsCarouselVisible(false);
    setSelectedMapShopId(null);
    setFocusedShop(null);
    selectShop(null);
  }, [selectShop]);

  const handleShopFromCarousel = useCallback(
    (shop: Shop) => {
      // Center the map on the active shop in the carousel
      setFocusedShop(shop);
    },
    []
  );

  const handleMechanicFilterSelect = useCallback((filter: MechanicFilterOption) => {
    setMechanicFilter(filter);
  }, []);

  // ═══════════════ SEARCH AREA HANDLERS ═══════════════
  const handleSearchArea = useCallback(() => {
    setShowSearchButton(false);
    // Store the current region as the last searched region
    if (currentRegionRef.current) {
      setLastSearchedRegion(currentRegionRef.current);
    }
    // TODO: In the future, this would filter shops by the current map bounds
  }, []);

  const handleMapRegionChange = useCallback(
    (newRegion: Region) => {
      // Always keep track of current region (must happen before any early returns!)
      currentRegionRef.current = newRegion;

      // On first region change, just mark as initialized (no search yet)
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        // Don't set lastSearchedRegion - user hasn't searched yet
        // Button stays hidden until user pans away from initial location
        return;
      }

      // If user has never searched, show button when they pan the map
      if (!lastSearchedRegion) {
        // Show button after user has moved the map at all
        setShowSearchButton(true);
        return;
      }

      // Check if map moved significantly from last searched region
      const latDiff = Math.abs(newRegion.latitude - lastSearchedRegion.latitude);
      const lonDiff = Math.abs(newRegion.longitude - lastSearchedRegion.longitude);
      const deltaDiff = Math.abs(newRegion.latitudeDelta - lastSearchedRegion.latitudeDelta);

      // Show search button if user panned or zoomed significantly
      const movedSignificantly = latDiff > 0.01 || lonDiff > 0.01 || deltaDiff > 0.02;
      setShowSearchButton(movedSignificantly);
    },
    [lastSearchedRegion]
  );

  // ═══════════════ COMPUTED VALUES ═══════════════
  const selectedServicesText = useMemo(() => {
    const services = getSelectedServices();
    if (services.length === 0) return "";
    const names = services.map((s) => s.name);
    const joined = names.join(", ");
    return joined.length > 25 ? joined.slice(0, 22) + "..." : joined;
  }, [getSelectedServices, selectedServiceIds]);

  const mechanicsCount = 3; // TODO: get from actual data

  const selectedMechanicShopName = useMemo(() => {
    if (!selectedMechanicId) return "";
    const mechanic = getMechanicById(selectedMechanicId);
    return mechanic?.shopName ?? "";
  }, [selectedMechanicId, getMechanicById]);

  // ═══════════════ RENDER ═══════════════
  return (
    <ScreenContainer style={styles.container}>
      {/* Map */}
      <BookingMap
        onShopSelect={handleShopSelect}
        sheetAnimatedIndex={sheetAnimatedIndex ?? undefined}
        focusedShop={focusedShop}
        onRegionChange={handleMapRegionChange}
        searchedRegion={lastSearchedRegion}
      />

      {/* Top Bar - Uses transition hook internally */}
      <View style={styles.topBarContainer}>
        <TopBar
          location={userLocation?.label ?? "Set Location"}
          mechanicsCount={mechanicsCount}
          selectedServicesText={selectedServicesText}
          shopName={selectedMechanicShopName}
          onFilterSelect={handleFilterSelect}
          onServiceSelect={handleServiceSelect}
          selectedService={selectedServiceCategory}
          onMechanicFilterSelect={handleMechanicFilterSelect}
          selectedMechanicFilter={mechanicFilter}
          sheetAnimatedIndex={sheetAnimatedIndex ?? undefined}
        />
        {/* Search Area Button - appears below the frosted header */}
        <SearchAreaButton visible={showSearchButton} onPress={handleSearchArea} />
      </View>

      {/* Bottom Sheet - Uses transition hook internally */}
      {/* Only show ServiceBottomSheet when carousel is not visible */}
      {!isCarouselVisible && (
        <ServiceBottomSheet
          offsetY={VERTICAL_OFFSET}
          onAnimatedIndexChange={handleAnimatedIndexChange}
          mechanicFilter={mechanicFilter}
        />
      )}

      {/* Shop Carousel - Life360 style, shows when map marker is selected */}
      {isCarouselVisible && (
        <MechanicCarouselSheet
          visible={isCarouselVisible}
          selectedShopId={selectedMapShopId}
          onClose={handleCarouselClose}
          onMechanicChange={handleShopFromCarousel}
          offsetY={VERTICAL_OFFSET}
        />
      )}
    </ScreenContainer>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#E8ECF0",
  },
  topBarContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});
