/**
 * BookingsScreen
 *
 * PURPOSE: Main screen for discovering and booking auto repair shops
 *
 * USED IN: app/(main-tabs)/bookings/_layout.tsx
 *
 * FEATURES:
 *   - Location-based shop discovery with top bar navigation
 *   - Service-based filtering
 *   - Map view with nearby shops
 *   - State managed via useBookingStore and useShopStore
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

// 2. Third-party libraries
import { useRouter } from "expo-router";
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
import { useShopStore } from "@/stores/useShopStore";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Vertical offset for bottom sheet and carousel (adjust this value as needed) */
const VERTICAL_OFFSET = 35; // pixels to shift down

/** Maximum number of shops to show in carousel */
const MAX_CAROUSEL_SHOPS = 5;

// ============================================================================
// COMPONENT
// ============================================================================

export default function BookingsScreen() {
  const router = useRouter();

  // ═══════════════ BOOKING STORE (location, map, service selection) ═══════════════
  const userLocation = useBookingStore((state) => state.userLocation);
  const selectedServiceCategory = useBookingStore((state) => state.selectedServiceCategory);
  const setSelectedServiceCategory = useBookingStore((state) => state.setSelectedServiceCategory);
  const bookingStage = useBookingStore((state) => state.bookingStage);
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const getSelectedServices = useBookingStore((state) => state.getSelectedServices);
  const prevBookingStage = useBookingStore((state) => state.prevBookingStage);

  // ═══════════════ MECHANIC FILTER STATE ═══════════════
  const [mechanicFilter, setMechanicFilter] = useState<MechanicFilterOption>("available_now");

  // ═══════════════ BOTTOM SHEET ANIMATED INDEX ═══════════════
  const [sheetAnimatedIndex, setSheetAnimatedIndex] = useState<SharedValue<number> | null>(null);

  const handleAnimatedIndexChange = useCallback((animatedIndex: SharedValue<number>) => {
    setSheetAnimatedIndex(animatedIndex);
  }, []);

  // ═══════════════ SHOP STORE (shops, filters, selection) ═══════════════
  const shops = useShopStore((state) => state.shops);
  const shopIds = useShopStore((state) => state.shopIds);
  const filters = useShopStore((state) => state.filters);
  const selectShop = useShopStore((state) => state.selectShop);
  const setFilters = useShopStore((state) => state.setFilters);

  // ═══════════════ FILTERED SHOPS (using custom hook) ═══════════════
  const { carouselShops } = useFilteredShops({
    shops,
    shopIds,
    filters,
    userLocation,
    maxResults: MAX_CAROUSEL_SHOPS,
  });

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleBackPress = () => {
    // Navigate back to the previous screen (e.g., home page)
    if (router.canGoBack()) {
      router.back();
    }
  };

  const handleFilterSelect = useCallback(
    (filter: FilterOption) => {
      // Map filter options to shop store filters using shared presets
      if (filter === "available_now") {
        setFilters(AVAILABLE_NOW_FILTER);
      } else if (filter === "top_rated") {
        setFilters(TOP_RATED_FILTER);
      } else {
        // Default/specialists - clear filters
        setFilters({ availableOnly: false, minRating: 0 });
      }
      console.log("Shop filter selected:", filter);
    },
    [setFilters]
  );

  // Use a ref to track the selected category to avoid re-render loops
  const selectedServiceRef = React.useRef(selectedServiceCategory);
  selectedServiceRef.current = selectedServiceCategory;

  const handleServiceSelect = useCallback(
    (service: ServiceCategory) => {
      // Toggle service category - if already selected, deselect it
      const isCurrentlySelected = selectedServiceRef.current === service;

      if (isCurrentlySelected) {
        // Deselect - clear both states
        setSelectedServiceCategory(null);
        setFilters({ serviceIds: [] });
        console.log("Service category deselected");
      } else {
        // Select new category using shared mapping
        const serviceIds = getServiceIdsForCategory(service);
        setSelectedServiceCategory(service);
        setFilters({ serviceIds });
        console.log("Service category selected:", service, "→ serviceIds:", serviceIds);
      }
    },
    [setSelectedServiceCategory, setFilters]
  );

  const handleSelectServices = () => {
    // Handle service selection confirmation - navigate to next step in booking flow
    console.log("Services confirmed");
  };

  const handleShopSelect = (shop: Shop) => {
    // Store selected shop for booking flow
    selectShop(shop.id);
    console.log("Shop selected:", shop.name);
    // TODO: Navigate to next step in booking flow (e.g., shop details or service selection)
    // router.push(`/bookings/shop/${shop.id}`);
  };

  const handleMechanicFilterSelect = useCallback((filter: MechanicFilterOption) => {
    setMechanicFilter(filter);
    console.log("Mechanic filter selected:", filter);
    // TODO: Apply filter to mechanics list in the bottom sheet
  }, []);

  // Handle back press from mechanic selection - go back to service selection
  const handleMechanicBackPress = useCallback(() => {
    prevBookingStage();
  }, [prevBookingStage]);

  // ═══════════════ COMPUTED VALUES ═══════════════

  /** Generate truncated selected services text for mechanic selection mode */
  const selectedServicesText = useMemo(() => {
    const services = getSelectedServices();
    if (services.length === 0) return "";
    const names = services.map((s) => s.name);
    const joined = names.join(", ");
    // Truncate if too long (approx 25 chars)
    if (joined.length > 25) {
      return joined.slice(0, 22) + "...";
    }
    return joined;
  }, [getSelectedServices, selectedServiceIds]);

  /** Mock mechanics count - TODO: get from actual data */
  const mechanicsCount = 3;

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <ScreenContainer style={styles.container}>
      {/* Main Content - Map with shop markers (full screen) */}
      <BookingMap onShopSelect={handleShopSelect} />

      {/* Top Bar - Positioned over map with blur */}
      <View style={styles.topBarContainer}>
        {bookingStage === "mechanic_selection" ? (
          <TopBar
            mode="mechanic_selection"
            mechanicsCount={mechanicsCount}
            selectedServicesText={selectedServicesText}
            onBackPress={handleMechanicBackPress}
            onMechanicFilterSelect={handleMechanicFilterSelect}
            selectedMechanicFilter={mechanicFilter}
            sheetAnimatedIndex={sheetAnimatedIndex ?? undefined}
          />
        ) : (
          <TopBar
            mode="discovery"
            label="Your Location"
            location={userLocation?.label ?? "Set Location"}
            onBackPress={handleBackPress}
            onFilterSelect={handleFilterSelect}
            onServiceSelect={handleServiceSelect}
            selectedService={selectedServiceCategory}
            sheetAnimatedIndex={sheetAnimatedIndex ?? undefined}
          />
        )}
      </View>

      {/* Shop Carousel - shows filtered shops (debounced) */}
      <ShopCarousel
        shops={carouselShops}
        userLocation={userLocation}
        onShopSelect={handleShopSelect}
        offsetY={VERTICAL_OFFSET}
      />

      {/* Service Bottom Sheet */}
      <ServiceBottomSheet
        onSelectServices={handleSelectServices}
        offsetY={VERTICAL_OFFSET}
        onAnimatedIndexChange={handleAnimatedIndexChange}
        onMechanicBackPress={handleMechanicBackPress}
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
