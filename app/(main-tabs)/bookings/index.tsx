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

import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SharedValue } from "react-native-reanimated";

import { BookingMap, MechanicFilterOption, ServiceBottomSheet, Shop, ShopCarousel, TopBar } from "@/components/booking";
import { ScreenContainer } from "@/components/shared-ui";
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

/** Map service categories to service IDs */
const SERVICE_CATEGORY_TO_IDS: Record<ServiceCategory, string[]> = {
  basic_maintenance: ["svc_oil_change"],
  tires_wheels: ["svc_tire_service"],
  brakes_suspension: ["svc_brake_service"],
  system_diagnostics: ["svc_diagnostics"],
};

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

export default function BookingsScreen() {
  const router = useRouter();

  // ═══════════════ BOOKING STORE (location, map, service selection) ═══════════════
  const userLocation = useBookingStore((state) => state.userLocation);
  const selectedServiceCategory = useBookingStore((state) => state.selectedServiceCategory);
  const setSelectedServiceCategory = useBookingStore((state) => state.setSelectedServiceCategory);
  const bookingStage = useBookingStore((state) => state.bookingStage);
  const getSelectedServices = useBookingStore((state) => state.getSelectedServices);

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

  const filteredShops = useMemo(() => {
    // Safety check - ensure we have valid data
    if (!shopIds || !shops) return [];

    let filtered = shopIds.map((id) => shops[id]).filter((shop): shop is Shop => shop != null);

    // Apply availability filter (show only shops with availability > 0)
    if (filters.availableOnly) {
      filtered = filtered.filter((shop) => shop.availability > 0);
    }

    // Apply minimum rating filter (for "top_rated" - also sort by rating)
    if (filters.minRating > 0) {
      filtered = filtered
        .filter((shop) => (shop.rating ?? 0) >= filters.minRating)
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)); // Sort by rating descending
    }

    // Apply service ID filter
    if (filters.serviceIds && filters.serviceIds.length > 0) {
      filtered = filtered.filter(
        (shop) => shop.serviceIds && filters.serviceIds.some((svcId) => shop.serviceIds.includes(svcId))
      );
    }

    // If no rating filter applied, sort by distance from user location (closest first)
    if (filters.minRating === 0 && userLocation?.latitude && userLocation?.longitude) {
      filtered = [...filtered].sort((a, b) => {
        const distA = calculateDistanceKm(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude);
        const distB = calculateDistanceKm(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude);
        return distA - distB;
      });
    }

    // Limit to closest shops for carousel
    return filtered.slice(0, MAX_CAROUSEL_SHOPS);
  }, [shops, shopIds, filters, userLocation]);

  // Debounce the carousel shops to prevent rapid updates that crash the app
  const [carouselShops, setCarouselShops] = useState<Shop[]>(filteredShops);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const prevFilteredShopsLengthRef = useRef(filteredShops.length);

  useEffect(() => {
    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // If showing MORE shops (clearing filters), update immediately
    // If showing FEWER shops (adding filters), debounce to prevent crashes
    const isShowingMore = filteredShops.length > prevFilteredShopsLengthRef.current;
    prevFilteredShopsLengthRef.current = filteredShops.length;

    if (isShowingMore || filteredShops.length === 0) {
      // Immediate update when clearing filters or showing more
      setCarouselShops(filteredShops);
    } else {
      // Debounce when filtering down
      debounceRef.current = setTimeout(() => {
        setCarouselShops(filteredShops);
      }, 50);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [filteredShops]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleBackPress = () => {
    // Always navigate back to the previous screen (e.g., home page)
    if (router.canGoBack()) {
      router.back();
    }
  };

  const handleFilterSelect = useCallback(
    (filter: FilterOption) => {
      // Map filter options to shop store filters
      if (filter === "available_now") {
        setFilters({ availableOnly: true, minRating: 0 });
      } else if (filter === "top_rated") {
        setFilters({ availableOnly: false, minRating: 4.0 });
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
        // Select new category
        const serviceIds = SERVICE_CATEGORY_TO_IDS[service] || [];
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
  }, [getSelectedServices]);

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
            onBackPress={handleBackPress}
            onMechanicFilterSelect={handleMechanicFilterSelect}
            selectedMechanicFilter={mechanicFilter}
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
