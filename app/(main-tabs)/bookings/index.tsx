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
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import {
  BookingMap,
  FilterOption,
  LocationTopBar,
  ServiceBottomSheet,
  ServiceCategory,
  Shop,
  ShopCarousel,
} from "@/components/booking";
import { ScreenContainer } from "@/components/shared-ui";
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

  // ═══════════════ SHOP STORE (shops, filters, selection) ═══════════════
  const shops = useShopStore((state) => state.shops);
  const shopIds = useShopStore((state) => state.shopIds);
  const filters = useShopStore((state) => state.filters);
  const selectShop = useShopStore((state) => state.selectShop);
  const setFilters = useShopStore((state) => state.setFilters);

  const filteredShops = useMemo(() => {
    let filtered = shopIds.map((id) => shops[id]).filter(Boolean);

    // Apply availability filter
    if (filters.availableOnly) {
      filtered = filtered.filter((shop) => shop.hasAvailableSlots);
    }

    // Apply minimum rating filter
    if (filters.minRating > 0) {
      filtered = filtered.filter((shop) => (shop.rating ?? 0) >= filters.minRating);
    }

    // Apply service ID filter
    if (filters.serviceIds.length > 0) {
      filtered = filtered.filter((shop) => filters.serviceIds.some((svcId) => shop.serviceIds.includes(svcId)));
    }

    // Sort by distance from user location (closest first) if we have user location
    if (userLocation?.latitude && userLocation?.longitude) {
      filtered = [...filtered].sort((a, b) => {
        const distA = calculateDistanceKm(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude);
        const distB = calculateDistanceKm(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude);
        return distA - distB;
      });
    }

    // Limit to closest shops for carousel
    return filtered.slice(0, MAX_CAROUSEL_SHOPS);
  }, [shops, shopIds, filters, userLocation]);

  // ===========================================================================
  // HANDLERS
  // ===========================================================================

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  const handleFilterSelect = (filter: FilterOption) => {
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
  };

  const handleServiceSelect = (service: ServiceCategory) => {
    // Update booking store for service display
    setSelectedServiceCategory(service);
    console.log("Service category selected:", service);
  };

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

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <ScreenContainer style={styles.container}>
      {/* Main Content - Map with shop markers (full screen) */}
      <BookingMap onShopSelect={handleShopSelect} />

      {/* Location Top Bar - Positioned over map with blur */}
      <View style={styles.topBarContainer}>
        <LocationTopBar
          label="Your Location"
          location={userLocation?.label ?? "Set Location"}
          onBackPress={handleBackPress}
          onFilterSelect={handleFilterSelect}
          onServiceSelect={handleServiceSelect}
          selectedService={selectedServiceCategory}
        />
      </View>

      {/* Shop Carousel - shows filtered shops */}
      <ShopCarousel
        shops={filteredShops}
        userLocation={userLocation}
        onShopSelect={handleShopSelect}
        offsetY={VERTICAL_OFFSET}
      />

      {/* Service Bottom Sheet */}
      <ServiceBottomSheet onSelectServices={handleSelectServices} offsetY={VERTICAL_OFFSET} />
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
