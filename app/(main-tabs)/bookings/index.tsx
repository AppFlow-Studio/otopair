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
import { BookingMap, MechanicFilterOption, ServiceBottomSheet, Shop, ShopCarousel, TopBar } from "@/components/booking";

// 5. Constants, hooks, types, stores
import { AVAILABLE_NOW_FILTER, TOP_RATED_FILTER } from "@/constants/filters";
import { getServiceIdsForCategory } from "@/constants/services";
import { useFilteredShops } from "@/hooks/useFilteredShops";
import type { FilterOption, ServiceCategory } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Vertical offset for bottom sheet and carousel */
const VERTICAL_OFFSET = 35;

/** Maximum number of shops to show in carousel */
const MAX_CAROUSEL_SHOPS = 5;

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

  const handleAnimatedIndexChange = useCallback((animatedIndex: SharedValue<number>) => {
    setSheetAnimatedIndex(animatedIndex);
  }, []);

  // ═══════════════ SHOP STORE ═══════════════
  const shops = useShopStore((state) => state.shops);
  const shopIds = useShopStore((state) => state.shopIds);
  const filters = useShopStore((state) => state.filters);
  const selectShop = useShopStore((state) => state.selectShop);
  const setFilters = useShopStore((state) => state.setFilters);

  // ═══════════════ FILTERED SHOPS ═══════════════
  const { carouselShops } = useFilteredShops({
    shops,
    shopIds,
    filters,
    userLocation,
    maxResults: MAX_CAROUSEL_SHOPS,
  });

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

  const handleShopSelect = (shop: Shop) => {
    selectShop(shop.id);
  };

  const handleMechanicFilterSelect = useCallback((filter: MechanicFilterOption) => {
    setMechanicFilter(filter);
  }, []);

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
      <BookingMap onShopSelect={handleShopSelect} sheetAnimatedIndex={sheetAnimatedIndex ?? undefined} />

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
      </View>

      {/* Shop Carousel */}
      <ShopCarousel
        shops={carouselShops}
        userLocation={userLocation}
        onShopSelect={handleShopSelect}
        offsetY={VERTICAL_OFFSET}
      />

      {/* Bottom Sheet - Uses transition hook internally */}
      <ServiceBottomSheet
        offsetY={VERTICAL_OFFSET}
        onAnimatedIndexChange={handleAnimatedIndexChange}
        mechanicFilter={mechanicFilter}
      />
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
