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


// 4. Flow-specific components
import {
  BookingMap,
  FullScreenBookingView,
  MechanicCarouselSheet,
  MechanicFilterOption,
  ServiceBottomSheet,
  Shop,
  TopBar,
} from "@/components/booking";

// 5. Constants, hooks, types, stores
import { AVAILABLE_NOW_FILTER, TOP_RATED_FILTER } from "@/constants/filters";
import type { FilterOption } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
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
  // ═══════════════ BOOKING STORE ═══════════════
  const userLocation = useBookingStore((state) => state.userLocation);
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const getSelectedServices = useBookingStore((state) => state.getSelectedServices);
  const selectedMechanicId = useBookingStore((state) => state.selectedMechanicId);
  const bookingStage = useBookingStore((state) => state.bookingStage);
  
  // ═══════════════ COMPUTED: Full-screen stages ═══════════════
  const isFullScreenStage = bookingStage === "booking_details" || bookingStage === "payment";

  // ═══════════════ MECHANIC STORE ═══════════════
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);

  // ═══════════════ LOCAL STATE ═══════════════
  const [mechanicFilter, setMechanicFilter] = useState<MechanicFilterOption>("available_now");
  const [sheetAnimatedIndex, setSheetAnimatedIndex] = useState<SharedValue<number> | null>(null);
  const [isCarouselVisible, setIsCarouselVisible] = useState(false);
  const [selectedMapShopId, setSelectedMapShopId] = useState<number | null>(null);
  const [focusedShop, setFocusedShop] = useState<Shop | null>(null);

  // Search bar state
  const [searchQuery, setSearchQuery] = useState("");

  // Active filters from search bar (dynamic filters)
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

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

  // Handler to remove a filter chip
  const handleRemoveFilter = useCallback((filter: string) => {
    setActiveFilters((prev) => prev.filter((f) => f !== filter));
  }, []);

  // Search handlers
  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    // TODO: Implement search functionality
    console.log("Search submitted:", searchQuery);
  }, [searchQuery]);

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
  // Full-screen stages (booking_details, payment) are rendered on top of everything
  if (isFullScreenStage) {
    return <FullScreenBookingView />;
  }

  return (
    <View style={styles.container}>
      {/* Map - dynamically loads pins based on current view */}
      <BookingMap
        onShopSelect={handleShopSelect}
        sheetAnimatedIndex={sheetAnimatedIndex ?? undefined}
        focusedShop={focusedShop}
      />

      {/* Top Bar - Uses transition hook internally */}
      <View style={styles.topBarContainer}>
        <TopBar
          location={userLocation?.label ?? "Set Location"}
          mechanicsCount={mechanicsCount}
          selectedServicesText={selectedServicesText}
          shopName={selectedMechanicShopName}
          onFilterSelect={handleFilterSelect}
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onSearchSubmit={handleSearchSubmit}
          activeFilters={activeFilters}
          onRemoveFilter={handleRemoveFilter}
          onMechanicFilterSelect={handleMechanicFilterSelect}
          selectedMechanicFilter={mechanicFilter}
          sheetAnimatedIndex={sheetAnimatedIndex ?? undefined}
        />
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
  topBarContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});